import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { simulateMatchWithNarrative, BRAZILIAN_TEAMS, generateSquad } from '@/lib/game-engine';
import { MatchEvent } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { withApiRoute, type ApiContext } from '@/lib/api-route';
import { pickTeam, rollOpponentMorale } from '@/lib/match-setup';
import { generateSeed, withSeed } from '@/lib/rng';
import { loadInvestmentBonuses } from '@/lib/investment-bonuses-store';
import { effectiveMorale } from '@/lib/investment-bonuses';
import { matchStreamRequestSchema } from '@/lib/validations';
import { isSeasonOver } from '@/lib/constants';
import { kickOffFixture, type KickoffSetup } from '@/lib/fixture-kickoff';

type GameStateRecordShape = {
  currentState: any;
};

export const POST = withApiRoute('match-stream', handlePost);

async function handlePost(request: NextRequest, ctx: ApiContext) {
  const { log } = ctx;

  try {
    const authError = await ctx.requireAuth();
    if (authError) {
      return authError;
    }
    
    const sessionUserId = await getAuthenticatedUser();
    
    const rateLimited = ctx.rateLimit('match_stream', 10, 60_000);
    if (rateLimited) {
      return rateLimited;
    }

    // Body, body size, and shape, in one call: see ctx.readBody. No parse
    // timeout here, unlike the other match routes, so a body that will not
    // parse gets the plain 'Invalid JSON body' rather than the 'or timeout'
    // wording — there is no timeout for it to have been.
    const bodyResult = await ctx.readBody(matchStreamRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    // `seed` in the body is accepted and ignored (see below).
    const { userId, opponent } = bodyResult.body;

    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json(
        { error: 'Forbidden. You can only access your own data.' },
        { status: 403 }
      );
    }

    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameStateRecord) {
      return NextResponse.json(
        { error: 'User not found. Please start a new game.' },
        { status: 404 }
      );
    }

    const gameState = (gameStateRecord as GameStateRecordShape).currentState;

    // Loaded before the seeded block, which cannot span an await (rng.ts).
    const bonuses = await loadInvestmentBonuses(userId);

    // Streaming the fixture the save is waiting on is watching it be played:
    // it kicks the fixture off as a full match, closing its market, and plays
    // it under the fixture's seed and kickoff setup, so what it shows is what
    // /api/match will bank. This route used to play the fixture under any
    // seed sent, without closing anything: a free look at the full-time score
    // of any seed, to bet on and then bank. A stream against any other
    // opponent is an exhibition, under a fresh seed the server draws.
    const fixture = gameState.season?.nextMatch;
    const isFixture =
      !isSeasonOver(gameState.season) && (!opponent || opponent === fixture?.opponent);
    let seed: string;
    let setup: KickoffSetup = {
      formation: gameState.squad.formation || '4-3-3',
      players: gameState.squad.players,
      userMorale: effectiveMorale(gameState.squad.morale, bonuses),
      matchSettings: gameState.user.matchSettings,
    };
    if (isFixture) {
      let kicked;
      try {
        kicked = await kickOffFixture(userId, gameState.season, 'quick', setup);
      } catch (error) {
        log.error('Could not kick off the fixture; nothing was streamed', { error });
        return NextResponse.json({ error: 'Could not start the match, try again' }, { status: 503 });
      }
      if (!kicked.ok) {
        return NextResponse.json(
          {
            error: 'Fixture already kicked off',
            message: 'This fixture is being played turn by turn.',
          },
          { status: 409 }
        );
      }
      ({ seed, setup } = kicked.kickoff);
    } else {
      seed = generateSeed();
    }
    
    // Opponent choice, opponent morale and the simulation are the stream's
    // random draws; one synchronous seeded block (withSeed cannot span an
    // await, see rng.ts) makes the whole match replay from `seed`.
    const result = withSeed(seed, () => {
      const opponentTeam = opponent || gameState.season?.nextMatch?.opponent ||
        pickTeam(BRAZILIAN_TEAMS).name;
      const opponentSquad = generateSquad(opponentTeam);
      const opponentMorale = rollOpponentMorale();

      // Determine home and away teams based on isHome flag
      const isHome = gameState.season?.nextMatch?.isHome ?? true;
      const homeTeam = isHome ? gameState.user.team : opponentTeam;
      const awayTeam = isHome ? opponentTeam : gameState.user.team;
      const homeSquad = isHome ? setup.players : opponentSquad;
      const awaySquad = isHome ? opponentSquad : setup.players;
      const userMorale = setup.userMorale;
      const homeMorale = isHome ? userMorale : opponentMorale;
      const awayMorale = isHome ? opponentMorale : userMorale;

      return simulateMatchWithNarrative(
        homeTeam,
        awayTeam,
        homeSquad,
        awaySquad,
        homeMorale,
        awayMorale,
        gameState.season?.week,
        setup.matchSettings,
        isHome
      );
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i <= 90; i += 5) {
          const minuteEvents = result.events.filter((e: MatchEvent) => e.minute <= i && e.minute > i - 5);
          
          if (i === 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'kickoff', minute: 0, seed })}\n\n`));
          }
          
          for (const event of minuteEvents) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'event', event })}\n\n`));
          }
          
          if (i === 45 && i < 90) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'halftime', homeScore: result.homeScore, awayScore: result.awayScore })}\n\n`));
          }
          
          if (i >= 90) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'fulltime', 
              homeScore: result.homeScore, 
              awayScore: result.awayScore,
              winner: result.winner
            })}\n\n`));
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    log.error('Error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
