import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { GameState, Player } from '@/lib/types';
import { calculatePlayerValue, calculatePlayerWage } from '@/lib/economy';
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

    const { userId, player, sellValue } = requestBody;

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

    await db
      .update(gameStates)
      .set({ currentState: gameState, updatedAt: new Date() })
      .where(eq(gameStates.userId, userId));

    return NextResponse.json({
      success: true,
      player: newPlayer,
      purchaseValue: playerValue,
      weeklyWage: playerWage,
      newBalance: gameState.user.money,
      squadSize: gameState.squad.players.length,
    });

  } catch (error) {
    console.error('[TransferBuy] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}