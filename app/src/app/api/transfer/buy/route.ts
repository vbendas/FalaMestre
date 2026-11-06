import { NextRequest, NextResponse } from 'next/server';
import { Player } from '@/lib/types';
import { calculatePlayerValue, calculatePlayerWage } from '@/lib/economy';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { transferBuyRequestSchema } from '@/lib/validations';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';

export const POST = withApiRoute('transfer-buy', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readBody(transferBuyRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { userId, player, sellValue } = bodyResult.body;

    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Read and write the session's own save, not the id the body named. The
    // check above already makes them equal; working off the session id means
    // the safety does not depend on that check staying correct.
    const targetUserId = sessionUserId || userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User not identified' }, { status: 401 });
    }

    const save = await loadSave(targetUserId);

    if (!save) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = save.state;
    const playerValue = sellValue 
      ? Math.floor(sellValue * 0.5) 
      : calculatePlayerValue(player);
    const playerWage = calculatePlayerWage(player);

    // Check if user has enough money
    if (gameState.user.money < playerValue) {
      return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
    }

    // Check if squad has space (max 25 players typical)
    if (gameState.squad.players.length >= 25) {
      return NextResponse.json({ error: 'Squad is full' }, { status: 400 });
    }

    // Deduct money and add player
    gameState.user.money -= playerValue;
    gameState.teamStats.totalSpent += playerValue;
    
    const newPlayer: Player = {
      ...player,
      fatigue: 0,
      currentForm: 'good' as const,
      weeklyTrainingCount: 0,
      isInjured: false,
      injuryWeeksRemaining: 0,
      injuryType: null,
    };
    
    gameState.squad.players.push(newPlayer);

    // The funds check above was made against the save as it was read. If
    // anything else wrote the save since (a sale, a match, another purchase)
    // the money and the squad it was checked against are gone, so the write
    // is refused rather than landing on top of them.
    const committed = await commitSave(targetUserId, gameState, save.version);
    if (!committed.ok) {
      log.warn('Transfer purchase rejected: the save moved on while it was being processed', {
        playerId: player.id,
      });
      return saveConflictResponse();
    }

    return NextResponse.json({
      success: true,
      player: newPlayer,
      purchaseValue: playerValue,
      weeklyWage: playerWage,
      newBalance: gameState.user.money,
      squadSize: gameState.squad.players.length,
    });

  } catch (error) {
    log.error('API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});