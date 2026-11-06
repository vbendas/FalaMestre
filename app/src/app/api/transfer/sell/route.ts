import { NextRequest, NextResponse } from 'next/server';
import { calculatePlayerValue, calculateSellValue } from '@/lib/economy';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { transferSellRequestSchema } from '@/lib/validations';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';

export const POST = withApiRoute('transfer-sell', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readBody(transferSellRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { userId, playerId } = bodyResult.body;

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
    const playerIndex = gameState.squad.players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) {
      return NextResponse.json({ error: 'Player not found in squad' }, { status: 404 });
    }

    const player = gameState.squad.players[playerIndex];
    const playerValue = calculatePlayerValue(player);
    const sellValue = calculateSellValue(playerValue);

    // Add money and remove player
    gameState.user.money += sellValue;
    gameState.teamStats.totalEarnings += sellValue;
    gameState.squad.players.splice(playerIndex, 1);

    // Refused if anything else wrote the save since it was read: the same
    // player sold twice from two tabs would otherwise be paid for twice, and
    // a match banked meanwhile would be erased.
    const committed = await commitSave(targetUserId, gameState, save.version);
    if (!committed.ok) {
      log.warn('Transfer sale rejected: the save moved on while it was being processed', {
        playerId,
      });
      return saveConflictResponse();
    }

    return NextResponse.json({
      success: true,
      sellValue,
      newBalance: gameState.user.money,
      squadSize: gameState.squad.players.length,
    });

  } catch (error) {
    log.error('API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});