import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates, users } from '@/db/schema';
import { createInitialGameState } from '@/lib/game-engine';
import { GameState } from '@/lib/types';
import { generateUserId } from '@/lib/utils';
import { z } from 'zod';

// Validation schema for team creation
const teamCreationSchema = z.object({
  teamName: z.string().min(3).max(30),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  badgeStyle: z.enum(['shield', 'circle', 'crest', 'diamond']),
});

export async function POST(request: NextRequest) {
  try {
    let requestBody;

    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate request
    let validatedData;
    try {
      validatedData = teamCreationSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues?.[0];
        return NextResponse.json(
          {
            error: 'Validation failed',
            message: firstError?.message || 'Invalid input',
            field: firstError?.path?.join('.') || 'unknown',
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { teamName, primaryColor, secondaryColor, badgeStyle } = validatedData;

    // Generate userId using consistent format matching validation regex
    const userId = generateUserId();

    // Create initial game state with custom team name
    const gameState: GameState = createInitialGameState(userId, teamName);

    // Add team customization to game state
    const enhancedGameState: GameState & {
      teamCustomization?: {
        primaryColor: string;
        secondaryColor: string;
        badgeStyle: string;
      };
    } = {
      ...gameState,
      teamCustomization: {
        primaryColor,
        secondaryColor,
        badgeStyle,
      },
    };

    // Create user record
    try {
      await db.insert(users).values({
        id: userId,
        username: teamName,
        email: `${userId}@falamestre.local`,
        onboardingCompleted: true,
        createdAt: new Date(),
      });
    } catch (userError) {
      console.warn('Failed to create user record, continuing anyway:', userError);
      // Continue even if user creation fails - it's not critical
    }

    // Create game state record
    try {
      await db.insert(gameStates).values({
        userId,
        team: teamName,
        currentState: enhancedGameState,
        conversationHistory: [],
        statistics: {
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          pointsEarned: 0,
        },
      });
    } catch (gameStateError) {
      console.warn('Failed to persist game state to DB, continuing with client-only mode:', gameStateError);
    }

    // Return success with userId (client will store in localStorage)
    return NextResponse.json(
      {
        success: true,
        userId,
        team: teamName,
        message: 'Time criado com sucesso!',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
