import { NextRequest, NextResponse } from 'next/server';
import { FACILITY_UPGRADES } from '@/lib/constants';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { facilityUpgradeRequestSchema } from '@/lib/validations';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';

export const POST = withApiRoute('facilities-upgrade', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readBody(facilityUpgradeRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { userId, facilityType } = bodyResult.body;

    if (sessionUserId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const save = await loadSave(userId);

    if (!save) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = save.state;
    // `facilityType` came through the schema, so it names a facility that
    // exists on both the save and the upgrade table; the lookups need no
    // cast and the "invalid facility type" branch that used to follow them
    // is now unreachable by construction.
    const currentLevel = gameState.facilities[facilityType];
    const facility = FACILITY_UPGRADES[facilityType];

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
    };

    const committed = await commitSave(userId, gameState, save.version);
    if (!committed.ok) {
      log.warn('Facility upgrade rejected: the save moved on while it was being processed', { facilityType });
      return saveConflictResponse();
    }

    return NextResponse.json({
      success: true,
      newFacilityLevel: gameState.facilities[facilityType],
      newBalance: gameState.user.money,
    });

  } catch (error) {
    log.error('API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});