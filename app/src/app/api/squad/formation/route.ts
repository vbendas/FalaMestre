import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, getAuthenticatedUser } from '@/lib/auth-helpers';
import { FORMATIONS } from '@/lib/formations';
import { withApiRoute, ApiContext } from '@/lib/api-route';

interface FormationRequest {
  userId?: string;
  formation: string;
}

export const POST = withApiRoute('squad-formation', async (
  request: NextRequest,
  { log, readJson }: ApiContext
) => {
  try {
    // Check authentication - returns 401 only if REQUIRE_AUTH=true and no session
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }
    
    // Get authenticated user ID (or null if not using auth)
    const sessionUserId = await getAuthenticatedUser();
    
    // Parse and validate request
    const bodyResult = await readJson<FormationRequest>();
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const body = bodyResult.body;

    const { userId, formation } = body;

    // Determine userId: session takes priority, fallback to provided userId
    const targetUserId = sessionUserId || userId;
    
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User not identified. Please provide userId or sign in.' },
        { status: 401 }
      );
    }

    // Validate formation
    if (!formation || !FORMATIONS[formation]) {
      return NextResponse.json(
        { error: 'Invalid formation. Available: 4-3-3, 4-4-2, 4-5-1, 3-5-2, 3-4-3, 5-3-2' },
        { status: 400 }
      );
    }

    // Get user's game state
    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, targetUserId),
    });

    if (!gameStateRecord) {
      return NextResponse.json(
        { error: 'Game state not found' },
        { status: 404 }
      );
    }

    const gameState = gameStateRecord.currentState;
    
    // Update formation
    gameState.squad.formation = formation;

    // Update database
    await db.update(gameStates)
      .set({ currentState: gameState })
      .where(eq(gameStates.userId, targetUserId));

    return NextResponse.json({
      success: true,
      formation,
      message: `Formação alterada para ${FORMATIONS[formation].name}!`,
    });
  } catch (error) {
    log.error('Error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
