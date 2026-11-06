/**
 * POST /api/match — a whole match in one request, simulated and banked here.
 *
 * **Nothing in the game calls this.** A match the player watches is played
 * turn by turn against /api/match/decide and banked by /api/match/finalize,
 * which replays those turns from their seed; this route runs its own
 * simulation instead, so pointing the screen at it would throw away the
 * decisions the player made. The client's `playMatch` wrapper was removed
 * along with the props that carried it.
 *
 * It is kept, rather than deleted, for three reasons:
 *
 *  - It is where the engine's determinism is tested end to end.
 *    `match-seed.test.ts` and `match-seed-concurrency.test.ts` replay this
 *    route for a seed and compare whole responses, including the narration
 *    and the visual script, and overlap differently-seeded requests at the
 *    database and AI awaits. Deleting the route would delete that coverage,
 *    which is the reason the seeded match mode is trustworthy.
 *  - It is the only path that produces the AI narration (`callAI`) and the
 *    enhanced match script the 3D match view is meant to play back. Finalize
 *    deliberately does neither: it is a save, not a show.
 *  - It is a complete, headless "simulate this fixture" endpoint, which is
 *    what a cron-run league, a bot opponent or a PvP fixture would want.
 *
 * If it stays uncalled and the 3D view never returns, it should go; whatever
 * is still wanted from it would then move into `match-replay.ts` with its
 * tests. Until then, treat it as the engine's reference implementation and
 * keep its bookkeeping shared with finalize (`applyMatchOutcome`) rather than
 * letting the two drift.
 */

import { NextRequest, NextResponse } from 'next/server';
import { simulateMatchWithNarrative, generateSquad } from '@/lib/game-engine';
import { callAIMock, callAI } from '@/lib/ai-service';
import { SEASON_LENGTH, isSeasonOver } from '@/lib/constants';
import { matchRequestSchema } from '@/lib/validations';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { generateMatchScript, generateEnhancedMatchScript } from '@/lib/matchScriptGenerator';
import { withApiRoute, type ApiContext } from '@/lib/api-route';
import { applyMatchOutcome } from '@/lib/match-bookkeeping';
import { loadInvestmentBonuses } from '@/lib/investment-bonuses-store';
import { effectiveMorale } from '@/lib/investment-bonuses';
import { rollOpponentMorale } from '@/lib/match-setup';
import { withSeed } from '@/lib/rng';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';
import { openFixtureMarketAfterCommit, recordRoundResult } from '@/lib/fixture-markets';
import { kickOffFixture } from '@/lib/fixture-kickoff';
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

export const POST = withApiRoute('match', handlePost, BODY_OPTIONS);

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
    
    const rateLimited = ctx.rateLimit('match', 30, 60_000);
    if (rateLimited) {
      return rateLimited;
    }

    // Body, body size, and shape, in one call: see ctx.readBody. The 5s
    // parse timeout and the 'or timeout' wording are the route's options on
    // withApiRoute at the bottom of this file.
    const bodyResult = await ctx.readBody(matchRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const validatedData = bodyResult.body;
    
    const { userId } = validatedData;
    // `seed` in the body is accepted and ignored: the fixture is played under
    // the seed the server drew at kickoff (fixture-kickoff.ts), which the
    // reply reports once the match has been banked.

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

    // Get game state with timeout, remembering the version it was read at:
    // this route holds the save across the AI call below, the widest window
    // any route has, and the write at the end is guarded on that version.
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
    const match = gameState.season.nextMatch;

    // No fixture left once the season is over. This route banks a match too,
    // through the same bookkeeping, so without the check the 'Temporada
    // Completa' placeholder could be played for ever (see finalize).
    if (isSeasonOver(gameState.season)) {
      log.warn('Match rejected: the season is over', { week: gameState.season.week });
      return NextResponse.json(
        {
          error: 'Season complete',
          message: `The season ended after ${SEASON_LENGTH} rounds. There is no fixture left to play.`,
          week: gameState.season.week,
        },
        { status: 409 }
      );
    }

    // What the player's active investments are worth to this match: morale
    // behind the team, and the gate and prize the bookkeeping banks. Loaded
    // before the seeded block, which cannot span an await (see rng.ts).
    const bonuses = await loadInvestmentBonuses(userId);

    // Kickoff: fixes the fixture's seed (the server's) and the setup it is
    // played from, and closes its market, before the match is simulated. A
    // stream of this fixture kicked it off the same way, so what it showed is
    // what is banked here. See fixture-kickoff.ts.
    let kicked;
    try {
      kicked = await kickOffFixture(userId, gameState.season, 'quick', {
        formation: gameState.squad.formation || '4-3-3',
        players: gameState.squad.players,
        userMorale: effectiveMorale(gameState.squad.morale, bonuses),
        matchSettings: gameState.user.matchSettings,
      });
    } catch (error) {
      log.error('Could not kick off the fixture; the match was not played', { error });
      return NextResponse.json({ error: 'Failed to save match' }, { status: 503 });
    }
    if (!kicked.ok) {
      log.warn('Match rejected: the fixture is being played turn by turn', { week: gameState.season.week });
      return NextResponse.json(
        {
          error: 'Fixture already kicked off',
          message: 'This fixture is being played turn by turn; bank it with /api/match/finalize.',
        },
        { status: 409 }
      );
    }
    const { seed, setup } = kicked.kickoff;

    // Every random draw for this match — opponent morale, the simulation, the
    // filler table, the next fixture and the visual script — happens inside
    // this one synchronous block, so the whole thing replays from `seed`.
    // withSeed() cannot span an await (see rng.ts), which is why the script
    // is generated here rather than after the AI narration.
    const played = withSeed(seed, () => {
      // Determine home and away teams based on isHome flag
      const isHome = match.isHome;
      const opponentTeam = match.opponent;
      const opponentSquad = generateSquad(opponentTeam);
      const opponentMorale = rollOpponentMorale(); // Random morale 55-85

      // Swap teams based on isHome
      const homeTeam = isHome ? gameState.user.team : opponentTeam;
      const awayTeam = isHome ? opponentTeam : gameState.user.team;
      const homeSquad = isHome ? setup.players : opponentSquad;
      const awaySquad = isHome ? opponentSquad : setup.players;
      const userMorale = setup.userMorale;
      const homeMorale = isHome ? userMorale : opponentMorale;
      const awayMorale = isHome ? opponentMorale : userMorale;

      const result = simulateMatchWithNarrative(
        homeTeam,
        awayTeam,
        homeSquad,
        awaySquad,
        homeMorale,
        awayMorale,
        gameState.season.week,
        setup.matchSettings,
        isHome
      );

      // Post-match bookkeeping — points, record, earnings, wages, morale,
      // position and next week's fixture. Shared with /api/match/finalize so a
      // match the player watched settles the same way this one does; it draws
      // from the seeded stream for the rival table and the next fixture, so it
      // runs here, inside the seeded block.
      const { pointsEarned, matchResult, matchEarnings } = applyMatchOutcome(gameState, {
        opponentTeam,
        bonuses,
        isHome: match.isHome,
        outcome: result,
      });

      const matchId = `${gameState.user.team}-${gameState.season.week}-${Date.now()}`;
    
      const homeTeamData = {
        name: homeTeam,
        formation: setup.formation,
        players: homeSquad.map((p: any, idx: number) => ({
          id: p.id || `home-${idx}`,
          name: p.name,
          number: idx + 1,
          position: p.position || 'MID',
        })),
        color: '#DC2626',
      };
    
      const awayTeamData = {
        name: awayTeam,
        formation: '4-3-3' as const,
        players: awaySquad.map((p: any, idx: number) => ({
          id: p.id || `away-${idx}`,
          name: p.name,
          number: idx + 1,
          position: p.position || 'MID',
        })),
        color: '#2563EB',
      };
    
      // Create Squad objects for enhanced script generation
      const homeSquadObj = {
        players: homeSquad,
        formation: setup.formation,
        morale: homeMorale,
        fitness: 75,
        weeklyTrainingBudget: 15,
        currentWeek: gameState.season.week,
      };

      const awaySquadObj = {
        players: awaySquad,
        formation: '4-3-3',
        morale: awayMorale,
        fitness: 75,
        weeklyTrainingBudget: 15,
        currentWeek: gameState.season.week,
      };

      // Generate enhanced script with 5400 movement events (1 per game second)
      const enhancedScript = generateEnhancedMatchScript(
        matchId,
        result.events,
        { id: 'home', name: homeTeam, formation: homeSquadObj.formation },
        { id: 'away', name: awayTeam, formation: awaySquadObj.formation },
        homeSquadObj,
        awaySquadObj,
        { home: result.homeScore, away: result.awayScore }
      );

      log.info('Enhanced script generated', {
        matchId: enhancedScript.matchId,
        movementsCount: enhancedScript.movements?.length || 0,
        commentaryCount: enhancedScript.commentary?.length || 0,
        finalScore: enhancedScript.finalScore,
      });

      // Generate match script with proper formation-based player positions
      const matchScript = {
        ...generateMatchScript(matchId, result.events, homeTeamData, awayTeamData),
        _enhanced: enhancedScript,
      };

      return { opponentTeam, result, pointsEarned, matchResult, matchEarnings, matchScript };
    });
    const { opponentTeam, result, pointsEarned, matchResult, matchEarnings, matchScript } = played;

    // The score goes into the save with the match, for the market to be
    // settled against (see market-settlement.ts). The bookkeeping has moved
    // the week on, so the round just played is the one before it.
    recordRoundResult(gameState, gameState.season.week - 1, result);

    // Generate AI narration for the match
    // A stream of its own, derived from the match seed: the narration replays
    // with the match without drawing from the same sequence the simulation
    // used, so a change to one does not reword the other.
    const narrationSeed = `${seed}:narration`;
    const matchSummary = `O ${gameState.user.team} ${result.winner === gameState.user.team ? 'venceu' : result.winner === 'Empate' ? 'empatou' : 'perdeu'} contra o ${opponentTeam} por ${result.homeScore}x${result.awayScore}. ${result.events.slice(0, 3).join(' ')}`;

    // Determine if we should use mock AI
    const envMockMode = process.env.USE_MOCK_AI === 'true';
    const hasApiKey = !!process.env.OPENROUTER_API_KEY;
    const useMock = envMockMode || !hasApiKey;

    // Call AI with timeout
    let aiResponse;
    const aiTimeout = 15000; // 15 second timeout for AI calls
    
    if (useMock) {
      try {
        aiResponse = await withTimeout(
          callAIMock(matchSummary, gameState, [], narrationSeed),
          aiTimeout,
          'Mock AI call'
        );
      } catch (error) {
        log.error('Mock AI call failed', { error });
        return NextResponse.json(
          { error: 'AI service temporarily unavailable' },
          { status: 503 }
        );
      }
    } else {
      try {
        aiResponse = await withTimeout(
          callAI(matchSummary, gameState, [], narrationSeed),
          aiTimeout,
          'AI call'
        );
      } catch (error) {
        log.warn('AI call failed, falling back to mock', { error });
        try {
          aiResponse = await withTimeout(
            callAIMock(matchSummary, gameState, [], narrationSeed),
            aiTimeout,
            'Fallback mock AI call'
          );
        } catch (fallbackError) {
          log.error('Fallback AI call also failed', { error: fallbackError });
          return NextResponse.json(
            { error: 'AI service unavailable' },
            { status: 503 }
          );
        }
      }
    }

    // Save, but only if nothing else wrote the save while the match was
    // being simulated and narrated. Anything that landed meanwhile (a
    // training session, a transfer, a finalize from another tab) would
    // otherwise be erased by this write; instead this match is refused, as a
    // finalize that loses its race is, and the caller reloads.
    //
    // A write that fails outright is reported too. This used to answer 200
    // with the match's result after a failed write, so the player was shown a
    // banked match that was never saved.
    let committed;
    try {
      committed = await withTimeout(
        commitSave(userId, gameState, save.version),
        5000,
        'Game state update'
      );
    } catch (error) {
      log.error('Failed to save match', { error });
      return NextResponse.json(
        { error: 'Failed to save match' },
        { status: 503 }
      );
    }

    if (!committed.ok) {
      log.warn('Match rejected: the save moved on while the match was being played', {
        week: gameState.season.week - 1,
      });
      return saveConflictResponse();
    }

    // The next fixture's market, exactly as finalize opens it. Out here, after
    // the seeded block and the commit: pricing it draws an opponent squad,
    // which inside the block would shift every seeded draw after it. The
    // market on the match just played is paid out first, as finalize does.
    await settlePlayedFixtureAfterCommit(userId, gameState);
    await openFixtureMarketAfterCommit(userId, gameState);

    return NextResponse.json({
      result: {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        winner: result.winner,
        events: result.events,
      },
      matchScript,
      pointsEarned,
      earnings: {
        amount: matchEarnings,
        breakdown: match.isHome && gameState.stadium.capacity > 0 
          ? `Ingressos: R$${Math.floor(matchEarnings * 0.7).toLocaleString()} + Bônus: R$${Math.floor(matchEarnings * 0.3).toLocaleString()}`
          : matchResult === 'win' ? 'Vitória' : matchResult === 'draw' ? 'Empate' : 'Derrota',
        isHome: match.isHome,
        hasStadium: gameState.stadium.capacity > 0,
      },
      narration: aiResponse.content,
      seed,
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
