import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates, conversations, analyticsEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { callAIMock, callAI } from '@/lib/ai-service';
import { createInitialGameState } from '@/lib/game-engine';
import { GameState, Message } from '@/lib/types';
import { conversationRequestSchema } from '@/lib/validations';
import { generateMessageId } from '@/lib/utils';
import { ZodError } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { readJsonBody } from '@/lib/request-body';
import { createRequestLogger } from '@/lib/logger';

type GameStateRecordShape = {
  currentState: GameState;
  conversationHistory?: Message[];
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const log = createRequestLogger('conversation', request);

  try {
    // Check authentication - returns 401 only if REQUIRE_AUTH=true and no session
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }
    
    // Get authenticated user ID (or null if not using auth)
    const sessionUserId = await getAuthenticatedUser();
    
    const rateLimit = checkRateLimit(request, 'conversation', 60, 60_000);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    // Parse request body with a size limit and timeout protection
    let requestBody;
    try {
      const bodyResult = await withTimeout(
        readJsonBody(request),
        5000,
        'Request body parsing'
      );
      if (!bodyResult.ok) {
        if (bodyResult.reason === 'too_large') {
          log.warn('Request body rejected: too large');
          return bodyResult.response;
        }
        if (bodyResult.reason === 'not_object') {
          log.warn('Request body rejected: not a JSON object');
          return bodyResult.response;
        }
        throw new Error(bodyResult.reason);
      }
      requestBody = bodyResult.body;
    } catch (error) {
      // Covers both a body that will not parse and the 5s parse timeout;
      // the reply cannot tell them apart, so the log line carries the cause.
      log.warn('Request body rejected: invalid JSON or timeout', { error });
      return NextResponse.json(
        { error: 'Invalid JSON body or timeout' },
        { status: 400 }
      );
    }
    
    // Validate request body
    let validatedData;
    try {
      validatedData = conversationRequestSchema.parse(requestBody);
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
    
    const { userId, message, useMock: requestUseMock } = validatedData;
    
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

    // Determine if we should use mock AI
    const envMockMode = process.env.USE_MOCK_AI === 'true';
    const hasApiKey = !!process.env.OPENROUTER_API_KEY;
    const useMock = requestUseMock ?? (envMockMode || !hasApiKey);

    // Get or create game state with timeout
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

    let gameState: GameState;
    let conversationHistory: Message[] = [];

    if (!gameStateRecord) {
      // First time user - create default state with fictional team
      gameState = createInitialGameState(userId, 'Dragões do Cerrado');
      
      // Insert initial game state
      try {
        await withTimeout(
          db.insert(gameStates).values({
            userId,
            team: gameState.user.team,
            currentState: gameState,
            conversationHistory: [],
            statistics: {},
          }),
          5000,
          'Game state insert'
        );
      } catch (error) {
        log.error('Failed to create game state', { error });
        return NextResponse.json(
          { error: 'Failed to create game state' },
          { status: 503 }
        );
      }
    } else {
      const typedRecord = gameStateRecord as GameStateRecordShape;
      gameState = typedRecord.currentState;
      conversationHistory = typedRecord.conversationHistory || [];
    }

    // Call AI (mock or real) with timeout
    let aiResponse;
    const aiTimeout = 15000; // 15 second timeout for AI calls
    
    if (useMock || !process.env.OPENROUTER_API_KEY) {
      try {
        aiResponse = await withTimeout(
          callAIMock(message, gameState, conversationHistory),
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
          callAI(message, gameState, conversationHistory),
          aiTimeout,
          'AI call'
        );
      } catch (error) {
        log.warn('AI call failed, falling back to mock', { error });
        try {
          aiResponse = await withTimeout(
            callAIMock(message, gameState, conversationHistory),
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

    // Update conversation history
    const newUserMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    const newAIMessage: Message = {
      id: generateMessageId(),
      role: 'ai',
      content: aiResponse.content,
      timestamp: new Date(),
      actions: aiResponse.actions,
    };

    const updatedHistory = [...conversationHistory, newUserMessage, newAIMessage];

    // Update game state in database with timeout
    try {
      await withTimeout(
        db
          .update(gameStates)
          .set({
            currentState: gameState,
            conversationHistory: updatedHistory,
            updatedAt: new Date(),
          })
          .where(eq(gameStates.userId, userId)),
        5000,
        'Game state update'
      );
    } catch (error) {
      log.error('Failed to update game state', { error });
      // Continue to return response even if update fails
    }

    // Log conversation for analytics with timeout
    try {
      await withTimeout(
        Promise.all([
          db.insert(conversations).values({
            userId,
            messageType: 'user',
            content: message,
            intent: aiResponse.intent,
            gameStateSnapshot: gameState,
          }),
          db.insert(conversations).values({
            userId,
            messageType: 'ai',
            content: aiResponse.content,
            intent: aiResponse.intent,
            gameStateSnapshot: gameState,
          }),
        ]),
        5000,
        'Conversation logging'
      );
    } catch (error) {
      log.error('Failed to log conversation', { error });
      // Continue even if logging fails
    }

    // Log a first-party analytics event (gameplay telemetry only)
    try {
      await withTimeout(
        db.insert(analyticsEvents).values({
          userId,
          eventType: 'conversation',
          properties: {
            intent: aiResponse.intent,
            cost: aiResponse.cost,
            latency: aiResponse.latency,
            useMock,
            messageLength: message.length,
            gameContext: {
              points: gameState.user.money,
              matchesPlayed: gameState.season.week,
              position: gameState.season.position,
              wins: gameState.season.wins,
              losses: gameState.season.losses,
            },
          },
          sessionId: `session_${Date.now()}`,
        }),
        3000,
        'Analytics logging'
      );
    } catch (error) {
      log.error('Failed to log analytics', { error });
      // Continue even if analytics fails
    }

    const duration = Date.now() - startTime;
    log.info('Request processed', { durationMs: duration });

    return NextResponse.json({
      response: aiResponse.content,
      actions: aiResponse.actions,
      intent: aiResponse.intent,
      cost: aiResponse.cost,
      latency: aiResponse.latency,
      gameState,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('API error', { durationMs: duration, error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const log = createRequestLogger('conversation', request);

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const userIdRegex = /^user_[a-z0-9]{9}$/;
    if (!userIdRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid userId format' },
        { status: 400 }
      );
    }

    if (process.env.AUTH_DISABLED !== 'true') {
      const sessionUserId = await getAuthenticatedUser();
      if (sessionUserId && sessionUserId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Fetch game state with timeout
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
      return NextResponse.json({ exists: false });
    }

    const duration = Date.now() - startTime;
    log.info('GET request processed', { durationMs: duration });

    return NextResponse.json({
      exists: true,
      gameState: (gameStateRecord as GameStateRecordShape).currentState,
      conversationHistory: (gameStateRecord as GameStateRecordShape).conversationHistory,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error('GET API error', { durationMs: duration, error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
