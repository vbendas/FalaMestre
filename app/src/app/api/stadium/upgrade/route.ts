import { NextRequest, NextResponse } from 'next/server';
import { STADIUM_UPGRADES } from '@/lib/constants';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { stadiumUpgradeRequestSchema } from '@/lib/validations';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';

export const POST = withApiRoute('stadium-upgrade', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readBody(stadiumUpgradeRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { userId } = bodyResult.body;

    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get game state, remembering the version it was read at
    const save = await loadSave(userId);

    if (!save) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = save.state;
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

    const committed = await commitSave(userId, gameState, save.version);
    if (!committed.ok) {
      log.warn('Stadium upgrade rejected: the save moved on while it was being processed', { fromLevel: currentLevel });
      return saveConflictResponse();
    }

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