import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { GameState } from '@/lib/types';
import { calculatePlayerValue, calculateSellValue } from '@/lib/economy';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';

type GameStateRecordShape = {
  currentState: GameState;
};

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const sessionUserId = await getAuthenticatedUser();
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { userId, playerId } = requestBody;

    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameStateRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = (gameStateRecord as GameStateRecordShape).currentState;
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

    await db
      .update(gameStates)
      .set({ currentState: gameState, updatedAt: new Date() })
      .where(eq(gameStates.userId, userId));

    return NextResponse.json({
      success: true,
      sellValue,
      newBalance: gameState.user.money,
      squadSize: gameState.squad.players.length,
    });

  } catch (error) {
    console.error('[TransferSell] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}