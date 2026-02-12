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
import { wordCount, hasQuestion, countEmotionalWords, detectAssertiveness } from '@/lib/clustering/linguistic-utils';
import { embedMessage } from '@/lib/clustering/embedding-service';
import { messageEmbeddings } from '@/db/schema';

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT = 30000;

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
 * Process embedding asynchronously with proper error handling
 * This runs after the response is sent, so it shouldn't block
 */
async function processEmbedding(userId: string, message: string): Promise<void> {
  const embeddingTimeout = 10000; // 10 second timeout for embeddings
  
  try {
    const embedding = await withTimeout(
      embedMessage(message),
      embeddingTimeout,
      'Embedding generation'
    );
    
    if (embedding) {
      await withTimeout(
        db.insert(messageEmbeddings).values({
          userId,
          content: message,
          embedding,
        }),
        embeddingTimeout,
        'Embedding insert'
      );
    }
  } catch (error) {
    // Log but don't throw - this is background processing
    console.error('[Conversation] Embedding processing failed:', error);
  }
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
    
    // Determine if we should use mock AI
    // Priority: 1. Request param, 2. Env var, 3. Default to true if no API key
    const envMockMode = process.env.USE_MOCK_AI === 'true';
    const hasApiKey = !!process.env.SYNTHETIC_API_KEY;
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
      console.error('[Conversation] Failed to fetch game state:', error);
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
        console.error('[Conversation] Failed to create game state:', error);
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
    
    if (useMock || !process.env.SYNTHETIC_API_KEY) {
      try {
        aiResponse = await withTimeout(
          callAIMock(message, gameState, conversationHistory),
          aiTimeout,
          'Mock AI call'
        );
      } catch (error) {
        console.error('[Conversation] Mock AI call failed:', error);
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
        console.warn('[Conversation] AI call failed, falling back to mock:', error);
        try {
          aiResponse = await withTimeout(
            callAIMock(message, gameState, conversationHistory),
            aiTimeout,
            'Fallback mock AI call'
          );
        } catch (fallbackError) {
          console.error('[Conversation] Fallback AI call also failed:', fallbackError);
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
      console.error('[Conversation] Failed to update game state:', error);
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
      console.error('[Conversation] Failed to log conversation:', error);
      // Continue even if logging fails
    }

    // Log analytics event with enriched signals
    const emotionalWords = countEmotionalWords(message);
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
            wordCount: wordCount(message),
            hasQuestion: hasQuestion(message),
            emotionalWords: emotionalWords,
            assertiveness: detectAssertiveness(message),
            gameContext: {
              points: gameState.user.sociosPoints,
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
      console.error('[Conversation] Failed to log analytics:', error);
      // Continue even if analytics fails
    }

    // Schedule embedding processing after response (non-blocking)
    // Use setImmediate equivalent for Node.js
    setImmediate(() => {
      processEmbedding(userId, message).catch(error => {
        console.error('[Conversation] Background embedding failed:', error);
      });
    });

    const duration = Date.now() - startTime;
    console.log(`[Conversation] Request processed in ${duration}ms`);

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
    console.error(`[Conversation] API error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Validate userId
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
      console.error('[Conversation] Failed to fetch game state:', error);
      return NextResponse.json(
        { error: 'Failed to fetch game state' },
        { status: 503 }
      );
    }

    if (!gameStateRecord) {
      return NextResponse.json({ exists: false });
    }

    const duration = Date.now() - startTime;
    console.log(`[Conversation] GET request processed in ${duration}ms`);

    return NextResponse.json({
      exists: true,
      gameState: (gameStateRecord as GameStateRecordShape).currentState,
      conversationHistory: (gameStateRecord as GameStateRecordShape).conversationHistory,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Conversation] GET API error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
