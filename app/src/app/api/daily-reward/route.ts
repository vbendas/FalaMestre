import { NextRequest, NextResponse } from 'next/server';
import { getDailyRewardAmount } from '@/lib/economy';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { dailyRewardRequestSchema } from '@/lib/validations';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';

export const POST = withApiRoute('daily-reward', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readBody(dailyRewardRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const requestBody = bodyResult.body;

    const { userId } = requestBody;

    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get game state, remembering the version it was read at
    const save = await loadSave(userId);

    if (!save) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = save.state;
    
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

    const committed = await commitSave(userId, gameState, save.version);
    if (!committed.ok) {
      log.warn('Daily reward rejected: the save moved on while it was being processed', { dayOfCycle });
      return saveConflictResponse();
    }

    return NextResponse.json({
      success: true,
      rewardAmount,
      newBalance: gameState.user.money,
      streak: dayOfCycle,
    });

  } catch (error) {
    log.error('API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});