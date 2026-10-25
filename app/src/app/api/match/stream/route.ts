import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { simulateMatchWithNarrative, BRAZILIAN_TEAMS, generateSquad } from '@/lib/game-engine';
import { MatchEvent } from '@/lib/types';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { readJsonBody } from '@/lib/request-body';
import { createRequestLogger } from '@/lib/logger';
import { pickTeam, rollOpponentMorale } from '@/lib/match-setup';
import { generateSeed, withSeed } from '@/lib/rng';
import { seedSchema } from '@/lib/validations';

/** One message for every way a seed can be wrong; see seedSchema. */
const SEED_MESSAGE =
  'seed must be a token of 1-64 letters, digits or _ . : - , or an integer';

type GameStateRecordShape = {
  currentState: any;
};

export async function POST(request: NextRequest) {
  const log = createRequestLogger('match-stream', request);

  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }
    
    const sessionUserId = await getAuthenticatedUser();
    
    const rateLimit = checkRateLimit(request, 'match_stream', 10, 60_000);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      if (bodyResult.reason === 'too_large') {
        log.warn('Request body rejected: too large');
      } else if (bodyResult.reason === 'not_object') {
        log.warn('Request body rejected: not a JSON object');
      } else {
        log.warn('Request body rejected: invalid JSON');
      }
      // readJsonBody answers 413 for an oversized body, 400 for malformed
      // JSON and 400 for valid JSON that is not an object. This route has no
      // body-parse timeout, so the plain 'Invalid JSON body' message fits it
      // better than the 'Invalid JSON body or timeout' wording used by the
      // timeout-wrapped routes.
      return bodyResult.response;
    }

    const { userId, opponent, seed: requestedSeed } = bodyResult.body as {
      userId: string;
      opponent?: string;
      seed?: unknown;
    };

    if (requestedSeed !== undefined) {
      if (!seedSchema.safeParse(requestedSeed).success) {
        return NextResponse.json(
          { error: 'Validation failed', message: SEED_MESSAGE, field: 'seed' },
          { status: 400 }
        );
      }
    }
    const seed = requestedSeed !== undefined ? (requestedSeed as string | number) : generateSeed();

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
      const homeSquad = isHome ? gameState.squad.players : opponentSquad;
      const awaySquad = isHome ? opponentSquad : gameState.squad.players;
      const homeMorale = isHome ? gameState.squad.morale : opponentMorale;
      const awayMorale = isHome ? opponentMorale : gameState.squad.morale;

      return simulateMatchWithNarrative(
        homeTeam,
        awayTeam,
        homeSquad,
        awaySquad,
        homeMorale,
        awayMorale,
        gameState.season?.week,
        gameState.user.matchSettings,
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
