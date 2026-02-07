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

export async function POST(request: NextRequest) {
  try {
    let requestBody;
    
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
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
    const hasApiKey = !!process.env.SYNTHETIC_API_KEY || !!process.env.OPENROUTER_API_KEY;
    const useMock = requestUseMock ?? envMockMode ?? !hasApiKey;

    // Get or create game state
    let gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    let gameState: GameState;
    let conversationHistory: Message[] = [];

    if (!gameStateRecord) {
      // First time user - create default state with fictional team
      // In production, this should trigger the team creation flow
      gameState = createInitialGameState(userId, 'Dragões do Cerrado');
      
      // Insert initial game state
      await db.insert(gameStates).values({
        userId,
        team: gameState.user.team,
        currentState: gameState,
        conversationHistory: [],
        statistics: {},
      });
    } else {
      gameState = gameStateRecord.currentState as GameState;
      conversationHistory = (gameStateRecord.conversationHistory as Message[]) || [];
    }

    // Call AI (mock or real)
    let aiResponse;
    if (useMock || !process.env.OPENROUTER_API_KEY) {
      aiResponse = await callAIMock(message, gameState, conversationHistory);
    } else {
      try {
        aiResponse = await callAI(message, gameState, conversationHistory);
      } catch (error) {
        console.warn('AI call failed, falling back to mock:', error);
        aiResponse = await callAIMock(message, gameState, conversationHistory);
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

    // Update game state in database
    await db
      .update(gameStates)
      .set({
        currentState: gameState,
        conversationHistory: updatedHistory,
        updatedAt: new Date(),
      })
      .where(eq(gameStates.userId, userId));

    // Log conversation for analytics
    await db.insert(conversations).values({
      userId,
      messageType: 'user',
      content: message,
      intent: aiResponse.intent,
      gameStateSnapshot: gameState,
    });

    await db.insert(conversations).values({
      userId,
      messageType: 'ai',
      content: aiResponse.content,
      intent: aiResponse.intent,
      gameStateSnapshot: gameState,
    });

    // Log analytics event with enriched signals
    const emotionalWords = countEmotionalWords(message);
    await db.insert(analyticsEvents).values({
      userId,
      eventType: 'conversation',
      properties: {
        intent: aiResponse.intent,
        cost: aiResponse.cost,
        latency: aiResponse.latency,
        useMock,
        // Enriched signals for clustering
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
    });

    // Fire-and-forget embedding (don't block the response)
    embedMessage(message).then(embedding => {
      if (embedding) {
        db.insert(messageEmbeddings).values({
          userId,
          content: message,
          embedding,
        }).catch((err: Error) => console.error('Embedding insert failed:', err));
      }
    }).catch((err: Error) => console.error('Embedding generation failed:', err));

    return NextResponse.json({
      response: aiResponse.content,
      actions: aiResponse.actions,
      intent: aiResponse.intent,
      cost: aiResponse.cost,
      latency: aiResponse.latency,
      gameState,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

  try {
    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameStateRecord) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      gameState: gameStateRecord.currentState,
      conversationHistory: gameStateRecord.conversationHistory,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
