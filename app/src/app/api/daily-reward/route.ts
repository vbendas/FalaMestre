import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { GameState } from '@/lib/types';
import { getDailyRewardAmount } from '@/lib/economy';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';

type GameStateRecordShape = {
  currentState: GameState;
};

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();
    let requestBody;
    
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { userId } = requestBody;

    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (process.env.AUTH_DISABLED !== 'true' && !sessionUserId && !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get game state
    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameStateRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = (gameStateRecord as GameStateRecordShape).currentState;
    
    // Get current streak (default to day 1)
    const today = new Date();
    const lastClaim = requestBody.lastClaimDate ? new Date(requestBody.lastClaimDate) : null;
    let dayOfCycle = 1;
    
    if (lastClaim) {
      const diffDays = Math.floor((today.getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
      } else if (diffDays === 1) {
        dayOfCycle = (requestBody.currentStreak || 1) + 1;
        if (dayOfCycle > 7) dayOfCycle = 1;
      }
    }

    const rewardAmount = getDailyRewardAmount(dayOfCycle);

    // Add money to user
    gameState.user.money += rewardAmount;
    gameState.teamStats.totalEarnings += rewardAmount;

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
      rewardAmount,
      newBalance: gameState.user.money,
      streak: dayOfCycle,
    });

  } catch (error) {
    console.error('[DailyReward] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}