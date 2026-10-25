import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { GameState } from '@/lib/types';
import { STADIUM_UPGRADES } from '@/lib/constants';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';

type GameStateRecordShape = {
  currentState: GameState;
};

interface StadiumUpgradeRequest {
  userId: string;
}

export const POST = withApiRoute('stadium-upgrade', async (
  request: NextRequest,
  { log, readJson }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readJson<StadiumUpgradeRequest>();
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const requestBody = bodyResult.body;

    const { userId } = requestBody;

    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get game state
    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameStateRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = (gameStateRecord as GameStateRecordShape).currentState;
    const currentLevel = gameState.stadium.level;

    // Check if max level
    if (currentLevel >= STADIUM_UPGRADES.length - 1) {
      return NextResponse.json({ error: 'Already at max level' }, { status: 400 });
    }

    const nextUpgrade = STADIUM_UPGRADES[currentLevel + 1];

    // Check if can afford
    if (gameState.user.money < nextUpgrade.cost) {
      return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
    }

    // Deduct money and upgrade stadium
    gameState.user.money -= nextUpgrade.cost;
    gameState.teamStats.totalSpent += nextUpgrade.cost;
    
    gameState.stadium.level = currentLevel + 1;
    gameState.stadium.capacity = nextUpgrade.capacity;
    gameState.stadium.ticketPrice = nextUpgrade.ticketPrice;

    // Update database
    await db
      .update(gameStates)
      .set({
        currentState: gameState,
        updatedAt: new Date(),
      })
      .where(eq(gameStates.userId, userId));

    return NextResponse.json({
      success: true,
      newStadiumLevel: gameState.stadium.level,
      newCapacity: gameState.stadium.capacity,
      newTicketPrice: gameState.stadium.ticketPrice,
      newBalance: gameState.user.money,
    });

  } catch (error) {
    log.error('API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});