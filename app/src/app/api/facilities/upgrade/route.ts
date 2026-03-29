import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { GameState, Facilities } from '@/lib/types';
import { FACILITY_UPGRADES } from '@/lib/constants';
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

    const { userId, facilityType } = requestBody;

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
    const currentLevel = gameState.facilities[facilityType as keyof typeof gameState.facilities];
    const facility = FACILITY_UPGRADES[facilityType as keyof typeof FACILITY_UPGRADES];

    if (!facility) {
      return NextResponse.json({ error: 'Invalid facility type' }, { status: 400 });
    }

    if (currentLevel >= facility.maxLevel) {
      return NextResponse.json({ error: 'Already at max level' }, { status: 400 });
    }

    const upgradeCost = Math.floor(facility.baseCost * Math.pow(facility.costMultiplier, currentLevel));

    if (gameState.user.money < upgradeCost) {
      return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
    }

    gameState.user.money -= upgradeCost;
    gameState.teamStats.totalSpent += upgradeCost;
    gameState.facilities = {
      ...gameState.facilities,
      [facilityType]: currentLevel + 1,
    } as unknown as Facilities;

    await db
      .update(gameStates)
      .set({ currentState: gameState, updatedAt: new Date() })
      .where(eq(gameStates.userId, userId));

    return NextResponse.json({
      success: true,
      newFacilityLevel: gameState.facilities[facilityType as keyof typeof gameState.facilities],
      newBalance: gameState.user.money,
    });

  } catch (error) {
    console.error('[FacilitiesUpgrade] API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}