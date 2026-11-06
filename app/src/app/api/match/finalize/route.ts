/**
 * POST /api/match/finalize — bank a match the player watched turn by turn.
 *
 * /api/match/decide plays one segment and saves nothing, so a match played on
 * the match screen used to vanish on reload. This route is the missing step:
 * it takes the match seed and the decisions, replays all six turns itself —
 * the same shared runner /api/match/decide uses, so the replay lands on the
 * same events — and then runs the post-match bookkeeping shared with
 * /api/match. The score the client believes in is never written; only the
 * score this route recomputes is.
 *
 * It deliberately does not narrate. /api/match pays for an AI call because it
 * is the whole match in one request; a finalize is a save, and the player has
 * already watched the football.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SEASON_LENGTH, isSeasonOver } from '@/lib/constants';
import { matchFinalizeRequestSchema } from '@/lib/validations';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { withApiRoute, type ApiContext } from '@/lib/api-route';
import { applyMatchOutcome } from '@/lib/match-bookkeeping';
import { loadInvestmentBonuses } from '@/lib/investment-bonuses-store';
import { effectiveMorale } from '@/lib/investment-bonuses';
import { replayMatch } from '@/lib/match-replay';
import { withSeed } from '@/lib/rng';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';
import { openFixtureMarketAfterCommit, recordRoundResult } from '@/lib/fixture-markets';
import { hasDecision, kickOffFixture, recordDecisions } from '@/lib/fixture-kickoff';
import { settlePlayedFixtureAfterCommit } from '@/lib/market-settlement';

/**
 * Wrapper for async operations with timeout and cleanup
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * How this route takes its body.
 *
 * `parseTimeoutMs`: a client that opens the request and then stalls would
 * otherwise hold it open indefinitely, and this is one of the routes that
 * goes on to run a simulation or call the model.
 *
 * `invalidJsonResponse`: with a timeout in play the route cannot tell a body
 * that will not parse from one that never arrived, so it does not pretend to
 * — one reply covers both, and the summary line's `cause` says which it was.
 */
const BODY_OPTIONS = {
  parseTimeoutMs: 5000,
  invalidJsonResponse: () =>
    NextResponse.json({ error: 'Invalid JSON body or timeout' }, { status: 400 }),
};

export const POST = withApiRoute('match-finalize', handlePost, BODY_OPTIONS);

async function handlePost(request: NextRequest, ctx: ApiContext) {
  const { log } = ctx;
  try {
    // Check authentication - returns 401 only if REQUIRE_AUTH=true and no session
    const authError = await ctx.requireAuth();
    if (authError) {
      return authError;
    }

    // Get authenticated user ID (or null if not using auth)
    const sessionUserId = await getAuthenticatedUser();

    const rateLimited = ctx.rateLimit('match-finalize', 30, 60_000);
    if (rateLimited) {
      return rateLimited;
    }

    // Body, body size, and shape, in one call: see ctx.readBody. The 5s
    // parse timeout and the 'or timeout' wording are the route's options on
    // withApiRoute at the bottom of this file.
    const bodyResult = await ctx.readBody(matchFinalizeRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    // `seed` in the body is accepted and ignored: the fixture is replayed under
    // the seed the server drew at kickoff (fixture-kickoff.ts).
    const { userId, week, opponent, isHome, decisions, claimedScore } = bodyResult.body;

    // Ensure user can only access their own data
    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json(
        { error: 'Forbidden. You can only access your own data.' },
        { status: 403 }
      );
    }

    // If auth is required but no session and no userId provided
    if (process.env.AUTH_DISABLED !== 'true' && !sessionUserId && !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get game state with timeout, remembering the version it was read at
    let save;
    try {
      save = await withTimeout(loadSave(userId), 5000, 'Game state fetch');
    } catch (error) {
      log.error('Failed to fetch game state', { error });
      return NextResponse.json(
        { error: 'Failed to fetch game state' },
        { status: 503 }
      );
    }

    if (!save) {
      return NextResponse.json(
        { error: 'User not found. Please start a new game.' },
        { status: 404 }
      );
    }

    const gameState = save.state;
    const fixture = gameState.season.nextMatch;

    // A season that is over has no fixture left to play. The placeholder the
    // bookkeeping leaves in `nextMatch` ('Temporada Completa') looked like a
    // real fixture to every check below — the client sends back exactly what
    // the save says, so the fixture matched — and the match was banked: the
    // week moved past the end of the season, points and gate receipts kept
    // accruing, and because the placeholder never changes it could be played
    // again and again. The week is the authority, not the fixture.
    if (isSeasonOver(gameState.season)) {
      log.warn('Finalize rejected: the season is over', { week: gameState.season.week });
      return NextResponse.json(
        {
          error: 'Season complete',
          message: `The season ended after ${SEASON_LENGTH} rounds. There is no fixture left to play.`,
          week: gameState.season.week,
        },
        { status: 409 }
      );
    }

    // The fixture the client played has to be the one the save is waiting on.
    // This is what keeps a match from counting twice: once finalized, the week
    // has advanced and a replayed submission no longer matches.
    if (
      gameState.season.week !== week ||
      fixture.opponent !== opponent ||
      fixture.isHome !== isHome
    ) {
      log.warn('Finalize rejected: fixture does not match the saved game', {
        sentWeek: week,
        savedWeek: gameState.season.week,
      });
      return NextResponse.json(
        {
          error: 'Fixture mismatch',
          message:
            'This match is not the fixture the saved game is waiting on. It may already have been finalized.',
          expected: {
            week: gameState.season.week,
            opponent: fixture.opponent,
            isHome: fixture.isHome,
          },
        },
        { status: 409 }
      );
    }

    // What the fan club is worth: to morale, for a kickoff taken here, and to
    // the gate and prize the bookkeeping banks.
    const bonuses = await loadInvestmentBonuses(userId);

    // The fixture's kickoff: its seed, the setup it is played from and the
    // decisions already played. Written here, closing the market, if no turn
    // was played through /api/match/decide first. The match is replayed from
    // these, never from the save as it is now nor from the seed sent, so it
    // banks the football that was watched. See fixture-kickoff.ts.
    let kicked;
    try {
      kicked = await kickOffFixture(userId, gameState.season, 'turns', {
        formation: gameState.squad.formation || '4-3-3',
        players: gameState.squad.players,
        userMorale: effectiveMorale(gameState.squad.morale, bonuses),
        matchSettings: gameState.user.matchSettings,
      });
    } catch (error) {
      log.error('Could not kick off the fixture; the match was not banked', { error });
      return NextResponse.json({ error: 'Failed to save match' }, { status: 503 });
    }
    if (!kicked.ok) {
      log.warn('Finalize rejected: the fixture was kicked off as a full match', { week });
      return NextResponse.json(
        {
          error: 'Fixture already played',
          message: 'This fixture has already been played out as a full match; bank it with /api/match.',
        },
        { status: 409 }
      );
    }
    const { kickoff } = kicked;
    const seed = kickoff.seed;

    // A turn already played counts as it was played, whatever is sent for
    // it now; the others take what was sent.
    const recordedTurns = new Set(
      decisions.map(d => d.turnNumber).filter(turnNumber => hasDecision(kickoff, turnNumber))
    );
    const effective = decisions.map(d => ({
      turnNumber: d.turnNumber,
      decisionId: recordedTurns.has(d.turnNumber)
        ? (kickoff.decisions[String(d.turnNumber)] ?? null)
        : d.decisionId,
    }));

    // Replay the turns the player watched, then do the bookkeeping — both in
    // one synchronous seeded scope. The replay seeds each turn itself from the
    // match seed; the scope here covers the draws the bookkeeping makes (the
    // rival table and next week's fixture) so a finalize is reproducible end
    // to end, exactly as /api/match is.
    const settled = withSeed(seed, () => {
      const replay = replayMatch(
        {
          userTeam: gameState.user.team,
          opponentTeam: fixture.opponent,
          isHome: fixture.isHome,
          userMorale: kickoff.setup.userMorale,
          week: gameState.season.week,
        },
        seed,
        kickoff.setup.formation,
        kickoff.setup.players,
        effective,
        recordedTurns
      );

      if (!replay.ok) {
        return { ok: false as const, rejection: replay.rejection };
      }

      const bookkeeping = applyMatchOutcome(gameState, {
        opponentTeam: fixture.opponent,
        bonuses,
        isHome: fixture.isHome,
        outcome: replay.match,
      });

      return { ok: true as const, match: replay.match, bookkeeping };
    });

    if (!settled.ok) {
      const { code, message } = settled.rejection;
      log.warn('Finalize rejected: decisions could not be replayed', { code });
      return NextResponse.json(
        { error: 'Validation failed', code, message },
        { status: 400 }
      );
    }

    // Every decision this replay used is recorded before anything about the
    // result leaves this route, the score-mismatch reply below included. That
    // reply used to be a free look at the score under any decisions sent;
    // now the first look fixes the decisions, and every later one replays
    // the same match. If a decide call recorded a turn in the meantime, the
    // replay is out of date: refused, and a retry replays the recorded one.
    let nowRecorded: Record<string, string | null>;
    try {
      // The fixture played: the bookkeeping has already moved the week on.
      nowRecorded = await recordDecisions(
        userId,
        { week, number: gameState.season.number },
        Object.fromEntries(effective.map(d => [d.turnNumber, d.decisionId]))
      );
    } catch (error) {
      log.error('Could not record the decisions; the match was not banked', { error });
      return NextResponse.json({ error: 'Failed to save match' }, { status: 503 });
    }
    if (effective.some(d => (nowRecorded[String(d.turnNumber)] ?? null) !== d.decisionId)) {
      log.warn('Finalize rejected: a turn was played while this one was being settled', { week });
      return saveConflictResponse();
    }

    const { match, bookkeeping } = settled;

    // The score goes into the save with the match, so the market can always
    // be settled against it (see market-settlement.ts). The bookkeeping has
    // already moved the week on; the round played is `week`.
    recordRoundResult(gameState, week, match);

    // The claimed score is a cross-check, never an input. A mismatch means the
    // client and the server played different football, so the save is left
    // alone and the caller is told both scores.
    if (
      claimedScore &&
      (claimedScore.homeScore !== match.homeScore || claimedScore.awayScore !== match.awayScore)
    ) {
      log.warn('Finalize rejected: claimed score does not match the replay', {
        claimed: claimedScore,
        replayed: { homeScore: match.homeScore, awayScore: match.awayScore },
      });
      return NextResponse.json(
        {
          error: 'Score mismatch',
          message: 'The replayed match does not match the score sent by the client.',
          claimed: claimedScore,
          replayed: { homeScore: match.homeScore, awayScore: match.awayScore },
        },
        { status: 409 }
      );
    }

    // Save, but only if nothing has written the save since it was read.
    //
    // The check above is not enough on its own: two tabs finishing at the same
    // moment both read the pre-match save, both pass it, and both write — so
    // both players are told their match counted while the save keeps only the
    // second one. The guard used to be the week inside the UPDATE's WHERE,
    // which stopped a second finalize but not anything else: a training
    // session or a transfer landing during the replay left the week alone
    // and was erased by this write. The version (`commitSave`, see
    // src/lib/save-store.ts) catches every writer, and an unchanged version
    // implies an unchanged week.
    let committed;
    try {
      committed = await withTimeout(
        commitSave(userId, gameState, save.version),
        5000,
        'Game state update'
      );
    } catch (error) {
      // Unlike the other failures above this one is reported: a finalize whose
      // write was lost has not counted, and the caller needs to know that
      // rather than show the player a banked result.
      log.error('Failed to save finalized match', { error });
      return NextResponse.json(
        { error: 'Failed to save match' },
        { status: 503 }
      );
    }

    if (!committed.ok) {
      // Lost the race. Whether the fixture itself moved on decides the
      // answer, because the match screen handles the two differently: a
      // fixture that was finalized elsewhere is over and the screen moves to
      // the next one, while a save changed by anything else (a training
      // session from another tab, say) means this same match can simply be
      // finalized again. One more read tells them apart; a read that fails
      // here is answered as the generic conflict rather than as an error,
      // since the caller's next step, reloading the save, is the same.
      const current = await loadSave(userId).catch(() => null);
      if (current && current.state.season.week !== week) {
        log.warn('Finalize rejected: the fixture was finalized elsewhere while this one was being settled', {
          sentWeek: week,
          savedWeek: current.state.season.week,
        });
        return NextResponse.json(
          {
            error: 'Fixture mismatch',
            message:
              'The saved game moved on while this match was being settled. It may already have been finalized.',
            expected: {
              week: current.state.season.week,
              opponent: current.state.season.nextMatch.opponent,
              isHome: current.state.season.nextMatch.isHome,
            },
          },
          { status: 409 }
        );
      }
      log.warn('Finalize rejected: the save changed while the match was being settled', {
        sentWeek: week,
      });
      return saveConflictResponse();
    }

    // The match has counted: pay out the market on it, then open the market
    // on the fixture it left the save waiting on. After the commit, so a
    // market is only settled on, and opened for, what was really saved; and
    // never failing the finalize, since the match stands either way (the
    // scheduled settlement job picks up anything left). Settled first, so the
    // result screen's balance already carries any winnings.
    await settlePlayedFixtureAfterCommit(userId, gameState);
    await openFixtureMarketAfterCommit(userId, gameState);

    log.info('Match finalized', {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      pointsEarned: bookkeeping.pointsEarned,
    });

    return NextResponse.json({
      result: {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        winner: match.winner,
        events: match.events,
      },
      pointsEarned: bookkeeping.pointsEarned,
      matchResult: bookkeeping.matchResult,
      earnings: {
        amount: bookkeeping.matchEarnings,
        breakdown:
          isHome && gameState.stadium.capacity > 0
            ? `Ingressos: R$${Math.floor(bookkeeping.matchEarnings * 0.7).toLocaleString()} + Bônus: R$${Math.floor(bookkeeping.matchEarnings * 0.3).toLocaleString()}`
            : bookkeeping.matchResult === 'win'
              ? 'Vitória'
              : bookkeeping.matchResult === 'draw'
                ? 'Empate'
                : 'Derrota',
        isHome,
        hasStadium: gameState.stadium.capacity > 0,
      },
      wages: bookkeeping.weeklyWages,
      position: bookkeeping.position,
      isSeasonEnd: bookkeeping.isSeasonEnd,
      turnHistory: match.turnHistory,
      segments: match.segments,
      seed,
      turnSeeds: match.turnSeeds,
      nextMatch: gameState.season.nextMatch,
      updatedGameState: gameState,
    });
  } catch (error) {
    log.error('API error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
