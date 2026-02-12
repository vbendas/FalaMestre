import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { simulateMatch, calculateTeamPower, BRAZILIAN_TEAMS, generateSquad } from '@/lib/game-engine';
import { callAIMock, callAI } from '@/lib/ai-service';
import { GameState, Message } from '@/lib/types';
import { matchRequestSchema } from '@/lib/validations';
import { ZodError } from 'zod';

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT = 30000;

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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body with timeout protection
    let requestBody;
    try {
      requestBody = await withTimeout(
        request.json(),
        5000,
        'Request body parsing'
      );
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body or timeout' },
        { status: 400 }
      );
    }
    
    // Validate request body
    let validatedData;
    try {
      validatedData = matchRequestSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues || [];
        const firstError = issues[0];
        return NextResponse.json(
          { 
            error: 'Validation failed', 
            message: firstError?.message || 'Invalid input',
            field: firstError?.path?.join('.') || 'unknown'
          },
          { status: 400 }
        );
      }
      throw error;
    }
    
    const { userId } = validatedData;

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
      console.error('[Match] Failed to fetch game state:', error);
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

    const gameState = (gameStateRecord as any).currentState as GameState;
    const match = gameState.season.nextMatch;

    // Simulate match
    const opponentTeam = match.opponent;
    const opponentSquad = generateSquad(opponentTeam);
    const opponentMorale = 55 + Math.floor(Math.random() * 30); // Random morale 55-85

    const result = simulateMatch(
      gameState.user.team,
      opponentTeam,
      gameState.squad.players,
      opponentSquad,
      gameState.squad.morale,
      opponentMorale,
      gameState.season.week
    );

    // Update game state
    const pointsEarned = result.winner === gameState.user.team ? 3 : result.winner === 'Empate' ? 1 : 0;
    const pointsChange = result.winner === gameState.user.team ? 100 : result.winner === 'Empate' ? 50 : 20;

    // Update win/draw/loss record
    if (result.winner === gameState.user.team) {
      gameState.season.wins++;
    } else if (result.winner === 'Empate') {
      gameState.season.draws++;
    } else {
      gameState.season.losses++;
    }

    gameState.season.week++;
    gameState.season.points += pointsEarned;
    gameState.user.sociosPoints += pointsChange;
    gameState.squad.morale = Math.max(30, Math.min(100, gameState.squad.morale + (pointsEarned * 5 - 5)));

    // Calculate realistic league position based on points and other teams' performance
    // Simulate other 19 teams' performance
    const otherTeams = BRAZILIAN_TEAMS.filter(t => t.name !== gameState.user.team);
    const simulatedStandings = otherTeams.map((team, idx) => {
      // Teams have played similar number of matches with some variance
      const matchesPlayed = Math.max(1, gameState.season.week - 1 + Math.floor(Math.random() * 3) - 1);
      // Random points based on team strength (better teams get more points)
      const teamStrength = 1 - (idx / otherTeams.length); // 1.0 to 0.0
      const expectedPointsPerMatch = 1.2 + teamStrength * 0.8; // 1.2 to 2.0
      const randomFactor = 0.8 + Math.random() * 0.4; // Variance
      const simulatedPoints = Math.floor(matchesPlayed * expectedPointsPerMatch * randomFactor);
      return { name: team.name, points: simulatedPoints };
    });

    // Add user's team and sort by points
    const allStandings = [
      ...simulatedStandings,
      { name: gameState.user.team, points: gameState.season.points }
    ].sort((a, b) => b.points - a.points);

    // Find user's position
    const userPosition = allStandings.findIndex(t => t.name === gameState.user.team) + 1;
    gameState.season.position = userPosition;

    // Check if season is complete (38 rounds in Brasileirão)
    const isSeasonEnd = gameState.season.week > 38;

    if (isSeasonEnd) {
      // Season complete - generate summary instead of next match
      gameState.season.nextMatch = {
        opponent: 'Temporada Completa',
        isHome: false,
        date: new Date().toISOString(),
        competition: 'Fim da Temporada',
      };
      gameState.context.availableActions = ['view_final_standings', 'new_season'];
    } else {
      // Generate next match - filter out user's team and current opponent to avoid self-play
      const availableOpponents = BRAZILIAN_TEAMS.filter(t => t.name !== gameState.user.team && t.name !== opponentTeam);
      const nextOpponent = availableOpponents[Math.floor(Math.random() * availableOpponents.length)].name;
      gameState.season.nextMatch = {
        opponent: nextOpponent,
        isHome: Math.random() > 0.5,
        date: new Date().toISOString(),
        competition: 'Brasileirão',
      };
    }

    gameState.context.lastAction = 'match_completed';
    gameState.context.narrative.lastEvent = `Jogo contra ${opponentTeam}: ${result.homeScore}x${result.awayScore}`;
    gameState.context.narrative.momentum = result.winner === gameState.user.team ? 'home' : result.winner === 'Empate' ? 'neutral' : 'away';

    // Generate AI narration for the match
    const matchSummary = `O ${gameState.user.team} ${result.winner === gameState.user.team ? 'venceu' : result.winner === 'Empate' ? 'empatou' : 'perdeu'} contra o ${opponentTeam} por ${result.homeScore}x${result.awayScore}. ${result.events.slice(0, 3).join(' ')}`;

    // Determine if we should use mock AI
    const envMockMode = process.env.USE_MOCK_AI === 'true';
    const hasApiKey = !!process.env.SYNTHETIC_API_KEY;
    const useMock = envMockMode || !hasApiKey;

    // Call AI with timeout
    let aiResponse;
    const aiTimeout = 15000; // 15 second timeout for AI calls
    
    if (useMock) {
      try {
        aiResponse = await withTimeout(
          callAIMock(matchSummary, gameState, []),
          aiTimeout,
          'Mock AI call'
        );
      } catch (error) {
        console.error('[Match] Mock AI call failed:', error);
        return NextResponse.json(
          { error: 'AI service temporarily unavailable' },
          { status: 503 }
        );
      }
    } else {
      try {
        aiResponse = await withTimeout(
          callAI(matchSummary, gameState, []),
          aiTimeout,
          'AI call'
        );
      } catch (error) {
        console.warn('[Match] AI call failed, falling back to mock:', error);
        try {
          aiResponse = await withTimeout(
            callAIMock(matchSummary, gameState, []),
            aiTimeout,
            'Fallback mock AI call'
          );
        } catch (fallbackError) {
          console.error('[Match] Fallback AI call also failed:', fallbackError);
          return NextResponse.json(
            { error: 'AI service unavailable' },
            { status: 503 }
          );
        }
      }
    }

    // Update database with timeout
    try {
      await withTimeout(
        db
          .update(gameStates)
          .set({
            currentState: gameState,
            updatedAt: new Date(),
          })
          .where(eq(gameStates.userId, userId)),
        5000,
        'Game state update'
      );
    } catch (error) {
      console.error('[Match] Failed to update game state:', error);
      // Continue to return response even if update fails
    }

    const duration = Date.now() - startTime;
    console.log(`[Match] Request processed in ${duration}ms`);

    return NextResponse.json({
      result: {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        winner: result.winner,
        events: result.events,
      },
      pointsEarned,
      pointsChange,
      narration: aiResponse.content,
      nextMatch: gameState.season.nextMatch,
      updatedGameState: gameState,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Match] API error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
