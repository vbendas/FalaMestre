import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { simulateMatchWithNarrative, BRAZILIAN_TEAMS, generateSquad } from '@/lib/game-engine';
import { MatchEvent } from '@/lib/types';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';

type GameStateRecordShape = {
  currentState: any;
};

export async function POST(request: NextRequest) {
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

    const { userId, opponent } = await request.json();

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
    
    const opponentTeam = opponent || gameState.season?.nextMatch?.opponent || 
      BRAZILIAN_TEAMS[Math.floor(Math.random() * BRAZILIAN_TEAMS.length)].name;
    const opponentSquad = generateSquad(opponentTeam);
    const opponentMorale = 55 + Math.floor(Math.random() * 30);

    // Determine home and away teams based on isHome flag
    const isHome = gameState.season?.nextMatch?.isHome ?? true;
    const homeTeam = isHome ? gameState.user.team : opponentTeam;
    const awayTeam = isHome ? opponentTeam : gameState.user.team;
    const homeSquad = isHome ? gameState.squad.players : opponentSquad;
    const awaySquad = isHome ? opponentSquad : gameState.squad.players;
    const homeMorale = isHome ? gameState.squad.morale : opponentMorale;
    const awayMorale = isHome ? opponentMorale : gameState.squad.morale;

    const result = simulateMatchWithNarrative(
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i <= 90; i += 5) {
          const minuteEvents = result.events.filter((e: MatchEvent) => e.minute <= i && e.minute > i - 5);
          
          if (i === 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'kickoff', minute: 0 })}\n\n`));
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
    console.error('[Match Stream] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
