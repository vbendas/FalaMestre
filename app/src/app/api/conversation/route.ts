import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates, conversations, analyticsEvents } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { callAIMock, callAI } from '@/lib/ai-service';
import { GameState, Message } from '@/lib/types';
import { conversationRequestSchema, isValidUserId } from '@/lib/validations';
import { generateMessageId } from '@/lib/utils';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { withApiRoute, type ApiContext } from '@/lib/api-route';
import { CONVERSATION_CONTEXT_MESSAGES } from '@/lib/constants';

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

export const POST = withApiRoute('conversation', handlePost, BODY_OPTIONS);

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
    
    const rateLimited = ctx.rateLimit('conversation', 60, 60_000);
    if (rateLimited) {
      return rateLimited;
    }

    // Body, body size, and shape, in one call: see ctx.readBody. The 5s
    // parse timeout and the 'or timeout' wording are the route's options on
    // withApiRoute at the bottom of this file.
    const bodyResult = await ctx.readBody(conversationRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const validatedData = bodyResult.body;
    
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

    // A message is never a reason to invent a save. This used to create one
    // on the spot, named 'Dragões do Cerrado', for any id that asked —
    // silently taking the place of the team the player was about to create
    // in onboarding, with a club they never chose. A save is made in exactly
    // one place, /api/onboarding/create-team, and a chat without one is an
    // error the screen can act on.
    if (!gameStateRecord) {
      log.warn('Conversation requested for a user with no save');
      return NextResponse.json(
        { error: 'No save for this user', code: 'no_save' },
        { status: 404 }
      );
    }

    const typedRecord = gameStateRecord as GameStateRecordShape;
    const gameState: GameState = typedRecord.currentState;
    const conversationHistory: Message[] = typedRecord.conversationHistory || [];

    // Only the tail of a long conversation is replayed to the assistant.
    const aiContext = conversationHistory.slice(-CONVERSATION_CONTEXT_MESSAGES);

    // Call AI (mock or real) with timeout
    let aiResponse;
    const aiTimeout = 15000; // 15 second timeout for AI calls
    
    if (useMock || !process.env.OPENROUTER_API_KEY) {
      try {
        aiResponse = await withTimeout(
          callAIMock(message, gameState, aiContext),
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
          callAI(message, gameState, aiContext),
          aiTimeout,
          'AI call'
        );
      } catch (error) {
        log.warn('AI call failed, falling back to mock', { error });
        try {
          const fallback = await withTimeout(
            callAIMock(message, gameState, aiContext),
            aiTimeout,
            'Fallback mock AI call'
          );
          // The mock answered in the live model's place. The player is told,
          // so a canned reply is not mistaken for the real assistant.
          aiResponse = { ...fallback, source: 'fallback' as const };
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
      source: aiResponse.source,
    };

    // Append the two new messages to the stored history.
    //
    // Two things this deliberately does not do. It does not write
    // `currentState` back: talking to the assistant never changes the game,
    // and the state in hand was read before the AI call, so re-saving it
    // would undo anything another route (a match being banked, a transfer)
    // committed in between. And it does not send the whole array it just
    // built: the append happens in the database, on whatever history is
    // stored at that moment, so two messages sent at once both survive
    // instead of the slower one erasing the other.
    // Whether the two new messages actually reached the save. A reply the
    // player can see but the save never kept is a reply that vanishes on
    // reload, so the answer says which one this is.
    let persisted = true;
    try {
      await withTimeout(
        db
          .update(gameStates)
          .set({
            conversationHistory: sql`coalesce(${gameStates.conversationHistory}, '[]'::jsonb) || ${JSON.stringify(
              [newUserMessage, newAIMessage]
            )}::jsonb`,
            updatedAt: new Date(),
          })
          .where(eq(gameStates.userId, userId)),
        5000,
        'Conversation history update'
      );
    } catch (error) {
      persisted = false;
      log.error('Failed to update conversation history', { error });
      // The reply is still worth returning — the player asked for it — but it
      // goes back flagged as unsaved rather than looking like history.
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
            source: aiResponse.source,
            messageLength: message.length,
            persisted,
            // These used to report the player's money as `points` and the
            // round as `matchesPlayed`, which made every save look like it
            // had played as many matches as weeks had passed. Both counters
            // exist for real; these are them.
            gameContext: {
              points: gameState.season.points,
              money: gameState.user.money,
              week: gameState.season.week,
              matchesPlayed: gameState.teamStats?.matchesPlayed ?? 0,
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

    return NextResponse.json({
      response: aiResponse.content,
      actions: aiResponse.actions,
      intent: aiResponse.intent,
      source: aiResponse.source,
      persisted,
      cost: aiResponse.cost,
      latency: aiResponse.latency,
      gameState,
    });
  } catch (error) {
    log.error('API error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withApiRoute('conversation', handleGet);

async function handleGet(request: NextRequest, ctx: ApiContext) {
  const { log } = ctx;
  try {
    // The load is the first thing the client calls, and it used to answer a
    // caller with no session at all with whatever save the id pointed at.
    const authError = await ctx.requireAuth();
    if (authError) {
      return authError;
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Accepts both a local game id and an auth provider's subject id; see
    // USER_ID_PATTERN.
    if (!isValidUserId(userId)) {
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

    return NextResponse.json({
      exists: true,
      gameState: (gameStateRecord as GameStateRecordShape).currentState,
      conversationHistory: (gameStateRecord as GameStateRecordShape).conversationHistory,
    });
  } catch (error) {
    log.error('GET API error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
