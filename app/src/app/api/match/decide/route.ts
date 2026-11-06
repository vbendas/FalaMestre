import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { DecisionOption, GameState } from '@/lib/types';
import { SEASON_LENGTH, isSeasonOver } from '@/lib/constants';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { withApiRoute, type ApiContext } from '@/lib/api-route';
import { playDecisionTurn } from '@/lib/match-replay';
import { loadInvestmentBonuses } from '@/lib/investment-bonuses-store';
import { effectiveMorale } from '@/lib/investment-bonuses';
import { matchDecideRequestSchema } from '@/lib/validations';
import { hasDecision, kickOffFixture, recordDecisions } from '@/lib/fixture-kickoff';
import { buildDecisionTurn } from '@/lib/decision-engine';
import { deriveTurnSeed } from '@/lib/match-seed';

type GameStateRecordShape = {
  currentState: GameState;
};

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

export const POST = withApiRoute('match-decide', handlePost, BODY_OPTIONS);

async function handlePost(request: NextRequest, ctx: ApiContext) {
  const { log } = ctx;
  try {
    // Check authentication
    const authError = await ctx.requireAuth();
    if (authError) {
      return authError;
    }

    // Get authenticated user ID (or null if not using auth)
    const sessionUserId = await getAuthenticatedUser();

    // Rate limit: 30 requests per minute
    const rateLimited = ctx.rateLimit('match-decide', 30, 60_000);
    if (rateLimited) {
      return rateLimited;
    }

    // Body, body size, and shape, in one call: see ctx.readBody. The 5s
    // parse timeout and the 'or timeout' wording are the route's options on
    // withApiRoute above.
    //
    // This replaced seventy lines of hand-written `typeof` checks. They were
    // careful and they were the only ones in the codebase, which was the
    // problem: the same malformed body got a different answer here than
    // anywhere else, and a field name appeared in the message or not
    // depending on which check caught it.
    const bodyResult = await ctx.readBody(matchDecideRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { userId, turnNumber, decision, priorState } = bodyResult.body;
    // `seed` in the body is accepted and ignored: a fixture is played under
    // the seed the server drew for it at kickoff (fixture-kickoff.ts).

    // Ensure user can only access their own data
    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json(
        { error: 'Forbidden. You can only access your own data.' },
        { status: 403 }
      );
    }

    // Get game state with timeout
    let gameStateRecord;
    try {
      gameStateRecord = await withTimeout(
        db.query.gameStates.findFirst({
          where: eq(gameStates.userId, userId),
        }),
        5000,
        'Game state fetch'
      );
    } catch (error) {
      log.error('Failed to fetch game state', { error });
      return NextResponse.json(
        { error: 'Failed to fetch game state' },
        { status: 503 }
      );
    }

    if (!gameStateRecord) {
      return NextResponse.json(
        { error: 'User not found. Please start a new game.' },
        { status: 404 }
      );
    }

    const gameState = (gameStateRecord as GameStateRecordShape).currentState;
    const match = gameState.season.nextMatch;

    // A turn of a match that could never be banked. This route writes nothing,
    // so it is not where the damage was, but playing ninety minutes that
    // finalize is bound to refuse is worse than being told up front.
    if (isSeasonOver(gameState.season)) {
      log.warn('Decision turn rejected: the season is over', { week: gameState.season.week });
      return NextResponse.json(
        {
          error: 'Season complete',
          message: `The season ended after ${SEASON_LENGTH} rounds. There is no fixture left to play.`,
          week: gameState.season.week,
        },
        { status: 409 }
      );
    }

    const prior = {
      homeScore: priorState.homeScore,
      awayScore: priorState.awayScore,
      homeMomentum: priorState.homeMomentum ?? 0,
      awayMomentum: priorState.awayMomentum ?? 0,
      tension: priorState.tension ?? 30,
      formation: priorState.formation,
      mentality: priorState.mentality,
      hasRedCard: priorState.hasRedCard ?? false,
      squad: priorState.squad,
    };

    // The decision sent has to be one this turn offers. The offer is rebuilt
    // here from the state the turn starts in, exactly as finalize's replay
    // rebuilds it, and the option played is the server's, found by id: the
    // option object the client sends is never played as sent. An id the turn
    // does not offer is refused before anything is recorded, shown or kicked
    // off. It used to be played as sent, invented formation and all, and its
    // id recorded; the replay then could not resolve it, so the match shown
    // was not the match banked.
    const offered = buildDecisionTurn(
      turnNumber,
      prior.homeScore,
      prior.awayScore,
      prior.squad,
      prior.formation,
      prior.mentality,
      prior.hasRedCard
    );
    const resolveOffered = (id: string | null): DecisionOption | null =>
      id === null
        ? null
        : offered.options.find(o => o.id === id) ??
          (offered.defaultOption.id === id ? offered.defaultOption : null);
    const sentId = decision?.id ?? null;
    const sentOption = resolveOffered(sentId);
    if (sentId !== null && !sentOption) {
      log.warn('Decision turn rejected: the decision was not offered', { turnNumber });
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'unknown_decision',
          message: `decision "${sentId}" was not offered at turn ${turnNumber}`,
        },
        { status: 400 }
      );
    }

    // What the fan club is worth to morale, for the setup taken at kickoff.
    const bonuses = await loadInvestmentBonuses(userId);

    // Kickoff: the first turn of the fixture fixes its seed (the server's,
    // never the one sent), the setup it is played from, and closes its
    // market, all before any of the match is played, because the reply to
    // this turn shows the score. A later turn, or the same turn sent again,
    // gets the same kickoff back. If it cannot be written the turn is not
    // played. See fixture-kickoff.ts.
    let kicked;
    try {
      kicked = await kickOffFixture(userId, gameState.season, 'turns', {
        formation: gameState.squad.formation || '4-3-3',
        players: gameState.squad.players,
        userMorale: effectiveMorale(gameState.squad.morale, bonuses),
        matchSettings: gameState.user.matchSettings,
      });
    } catch (error) {
      log.error('Could not kick off the fixture; the turn was not played', { error });
      return NextResponse.json({ error: 'Could not start the match, try again' }, { status: 503 });
    }
    if (!kicked.ok) {
      log.warn('Decision turn rejected: the fixture was kicked off as a full match', { week: gameState.season.week });
      return NextResponse.json(
        {
          error: 'Fixture already played',
          message: 'This fixture has already been played out as a full match; bank it with /api/match.',
        },
        { status: 409 }
      );
    }
    const { kickoff } = kicked;

    // The decision this turn is played with: the one recorded the first time
    // the turn was played, if it has been, otherwise the one sent, recorded
    // now, before the turn is shown. So a match abandoned and played again
    // goes the way it went the first time, whatever is picked second time
    // round; and a retry of the same turn is the same turn.
    let recorded: Record<string, string | null>;
    try {
      recorded = hasDecision(kickoff, turnNumber)
        ? kickoff.decisions
        : await recordDecisions(userId, gameState.season, { [turnNumber]: sentId });
    } catch (error) {
      log.error('Could not record the decision; the turn was not played', { error });
      return NextResponse.json({ error: 'Could not play the turn, try again' }, { status: 503 });
    }
    const playedId = recorded[String(turnNumber)] ?? null;
    // A recorded id this state does not offer (recorded by a client that
    // forged its prior state) plays as the timer's default, as finalize's
    // replay does.
    const played = playedId === sentId ? sentOption : resolveOffered(playedId);

    // One turn, played by the shared runner in match-replay.ts: the same code
    // /api/match/finalize replays the match with, under the same seed and
    // morale, so a finalized match lands on the score these turns showed.
    // All of its random draws happen in one synchronous seeded block
    // (withSeed cannot span an await, see rng.ts).
    const { turnResult, ...segmentResult } = playDecisionTurn(
      {
        userTeam: gameState.user.team,
        opponentTeam: match.opponent,
        isHome: match.isHome,
        userMorale: kickoff.setup.userMorale,
        week: gameState.season.week,
      },
      turnNumber,
      played,
      prior,
      deriveTurnSeed(kickoff.seed, turnNumber)
    );

    // No seed in the reply. Knowing the fixture's seed (and a turn's seed
    // names it) is knowing how every remaining turn goes for every choice.
    return NextResponse.json({
      events: segmentResult.events,
      segmentSummary: segmentResult.segmentSummary,
      turnPrompt: segmentResult.turnPrompt,
      nextTurn: segmentResult.nextTurn,
      endState: segmentResult.endState,
      turnResult,
      // The decision this turn was played with, which the screen sends back
      // at finalize. Differs from the one sent when the turn had already
      // been played.
      decisionId: playedId,
    });

  } catch (error) {
    log.error('API error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
