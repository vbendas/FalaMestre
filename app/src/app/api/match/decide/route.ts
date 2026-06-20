import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateSquad } from '@/lib/game-engine';
import { GameState, DecisionOption, TurnResult, TurnMentality, Player } from '@/lib/types';
import { DECISION_TURNS } from '@/lib/constants';
import { createTurnResult, resolveDefaultAction } from '@/lib/decision-engine';
import { runMatchSegment } from '@/lib/match-segment-engine';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';

type GameStateRecordShape = {
  currentState: GameState;
};

interface PriorState {
  homeScore: number;
  awayScore: number;
  homeMomentum: number;
  awayMomentum: number;
  tension: number;
  formation: string;
  mentality: TurnMentality;
  hasRedCard: boolean;
  squad: Player[];
}

interface DecisionRequestBody {
  userId: string;
  turnNumber: number;
  decision?: DecisionOption | null;
  priorState: PriorState;
}

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
 * Validates the request body for the decision turn endpoint.
 * Returns an error message if invalid, or null if valid.
 */
function validateRequestBody(body: Record<string, unknown>): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  if (typeof body.userId !== 'string' || body.userId.trim().length === 0) {
    return 'userId is required and must be a non-empty string';
  }

  if (typeof body.turnNumber !== 'number' || !Number.isInteger(body.turnNumber)) {
    return 'turnNumber is required and must be an integer';
  }

  if (body.turnNumber < 0 || body.turnNumber >= DECISION_TURNS.length) {
    return `turnNumber must be between 0 and ${DECISION_TURNS.length - 1}`;
  }

  if (!body.priorState || typeof body.priorState !== 'object') {
    return 'priorState is required and must be an object';
  }

  const ps = body.priorState as Record<string, unknown>;

  if (typeof ps.homeScore !== 'number' || typeof ps.awayScore !== 'number') {
    return 'priorState.homeScore and priorState.awayScore must be numbers';
  }

  if (typeof ps.formation !== 'string') {
    return 'priorState.formation must be a string';
  }

  if (!['attacking', 'balanced', 'defensive'].includes(ps.mentality as string)) {
    return 'priorState.mentality must be one of: attacking, balanced, defensive';
  }

  if (!Array.isArray(ps.squad)) {
    return 'priorState.squad must be an array of Player objects';
  }

  // Validate each player in the squad
  for (let i = 0; i < ps.squad.length; i++) {
    const player = ps.squad[i];
    if (!player || typeof player !== 'object') {
      return `priorState.squad[${i}] must be a Player object`;
    }

    const p = player as Record<string, unknown>;

    if (typeof p.id !== 'string' || p.id.trim().length === 0) {
      return `priorState.squad[${i}].id must be a non-empty string`;
    }

    if (typeof p.name !== 'string' || p.name.trim().length === 0) {
      return `priorState.squad[${i}].name must be a non-empty string`;
    }

    if (typeof p.position !== 'string' || !['GK', 'DEF', 'MID', 'FWD'].includes(p.position)) {
      return `priorState.squad[${i}].position must be one of: GK, DEF, MID, FWD`;
    }

    // Validate numeric stats (clamped to valid ranges by game engine, but must be numbers)
    const stats = ['pac', 'sho', 'pas', 'dri', 'def', 'phy', 'fatigue'];
    for (const stat of stats) {
      if (typeof p[stat] !== 'number') {
        return `priorState.squad[${i}].${stat} must be a number`;
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check authentication
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    // Get authenticated user ID (or null if not using auth)
    const sessionUserId = await getAuthenticatedUser();

    // Rate limit: 30 requests per minute
    const rateLimit = checkRateLimit(request, 'match-decide', 30, 60_000);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    // Parse request body with timeout protection
    let requestBody: DecisionRequestBody;
    try {
      const parsed = await withTimeout(
        request.json(),
        5000,
        'Request body parsing'
      );
      requestBody = parsed as DecisionRequestBody;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body or timeout' },
        { status: 400 }
      );
    }

    // Validate request body
    const validationError = validateRequestBody(requestBody as unknown as Record<string, unknown>);
    if (validationError) {
      return NextResponse.json(
        { error: 'Validation failed', message: validationError },
        { status: 400 }
      );
    }

    const { userId, turnNumber, decision, priorState } = requestBody;

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
      console.error('[MatchDecide] Failed to fetch game state:', error);
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

    // Determine home and away teams based on isHome flag
    const isHome = match.isHome;
    const opponentTeam = match.opponent;
    const opponentSquad = generateSquad(opponentTeam);
    const opponentMorale = 55 + Math.floor(Math.random() * 30);

    const homeTeam = isHome ? gameState.user.team : opponentTeam;
    const awayTeam = isHome ? opponentTeam : gameState.user.team;
    const homeSquad = isHome ? priorState.squad : opponentSquad;
    const awaySquad = isHome ? opponentSquad : priorState.squad;
    const homeMorale = isHome ? gameState.squad.morale : opponentMorale;
    const awayMorale = isHome ? opponentMorale : gameState.squad.morale;

    // Build TurnResult from decision or resolve default on timeout
    let turnResult: TurnResult;
    const turnConfig = DECISION_TURNS[turnNumber];

    if (decision) {
      // User made a decision — create TurnResult from it
      turnResult = createTurnResult(
        turnNumber,
        turnConfig.minute,
        decision,
        resolveDefaultAction(
          priorState.homeScore,
          priorState.awayScore,
          priorState.squad,
          priorState.hasRedCard
        )
      );
    } else {
      // Timeout — use context-aware default
      const defaultOption = resolveDefaultAction(
        priorState.homeScore,
        priorState.awayScore,
        priorState.squad,
        priorState.hasRedCard
      );
      turnResult = createTurnResult(
        turnNumber,
        turnConfig.minute,
        null,
        defaultOption
      );
    }

    // Run the match segment
    const segmentResult = runMatchSegment(
      homeTeam,
      awayTeam,
      homeSquad,
      awaySquad,
      homeMorale,
      awayMorale,
      turnNumber,
      {
        homeScore: priorState.homeScore,
        awayScore: priorState.awayScore,
        homeMomentum: priorState.homeMomentum ?? 0,
        awayMomentum: priorState.awayMomentum ?? 0,
        tension: priorState.tension ?? 30,
        formation: priorState.formation,
        mentality: priorState.mentality,
        hasRedCard: priorState.hasRedCard ?? false,
        squad: priorState.squad,
      },
      turnResult,
      gameState.season.week
    );

    const duration = Date.now() - startTime;
    console.log(`[MatchDecide] Turn ${turnNumber} processed in ${duration}ms`);

    return NextResponse.json({
      events: segmentResult.events,
      segmentSummary: segmentResult.segmentSummary,
      turnPrompt: segmentResult.turnPrompt,
      nextTurn: segmentResult.nextTurn,
      endState: segmentResult.endState,
      turnResult,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[MatchDecide] API error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
