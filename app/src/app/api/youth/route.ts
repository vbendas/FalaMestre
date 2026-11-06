import { NextRequest, NextResponse } from 'next/server';
import { YouthAcademy, YouthPlayer } from '@/lib/types';
import { generateYouthIntake } from '@/lib/youth-generator';
import { loadInvestmentBonuses } from '@/lib/investment-bonuses-store';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { youthRequestSchema } from '@/lib/validations';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';

function initializeYouthAcademy(currentWeek: number): YouthAcademy {
  return {
    nextIntakeWeek: currentWeek + 4,
    playersAvailable: [],
    trainingFocus: null,
    lastIntakeWeek: 0,
  };
}

export const GET = withApiRoute('youth', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  try {
    // Check authentication
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetUserId = sessionUserId || userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const save = await loadSave(targetUserId);

    if (!save) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = save.state;

    const youthAcademy = gameState.youthAcademy || initializeYouthAcademy(gameState.season.week);
    const weeksUntilIntake = youthAcademy.nextIntakeWeek - gameState.season.week;

    return NextResponse.json({
      youthAcademy,
      weeksUntilIntake: Math.max(0, weeksUntilIntake),
      canGenerateIntake: weeksUntilIntake <= 0,
    });

  } catch (error) {
    log.error('GET API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withApiRoute('youth', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    // Check authentication
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetUserId = sessionUserId || userId;

    const bodyResult = await readBody(youthRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    // Kept whole as well as destructured: `playerId` is only on a sign or a
    // reject and `focus` only on a set-focus, and narrowing on `body.action`
    // is what tells TypeScript which.
    const body = bodyResult.body;
    const action = body.action;

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const save = await loadSave(targetUserId);

    if (!save) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = save.state;
    const yai = gameState.youthAcademy || initializeYouthAcademy(gameState.season.week);
    const academyLevel = gameState.facilities.youthAcademy;
    const scoutLevel = gameState.facilities.scoutOffice;
    const headOfYouth = gameState.staff.headCoach;

    if (action === 'generate' || action === 'intake') {
      const shouldGenerate = yai.playersAvailable.length === 0 && 
        (gameState.season.week >= yai.nextIntakeWeek || !yai.nextIntakeWeek);

      if (shouldGenerate) {
        // An active `academia_base` investment is worth a better intake.
        const bonuses = await loadInvestmentBonuses(targetUserId);
        const newPlayers = generateYouthIntake(
          academyLevel,
          scoutLevel,
          bonuses.youthQualityPercent
        );
        yai.playersAvailable = newPlayers;
        yai.lastIntakeWeek = gameState.season.week;
        yai.nextIntakeWeek = gameState.season.week + 4;
        gameState.youthAcademy = yai;

        const committed = await commitSave(targetUserId, gameState, save.version);
        if (!committed.ok) {
          log.warn('Youth action rejected: the save moved on while it was being processed', { action });
          return saveConflictResponse();
        }

        return NextResponse.json({
          success: true,
          action: 'intake_generated',
          players: newPlayers,
          nextIntakeWeek: yai.nextIntakeWeek,
        });
      } else {
        return NextResponse.json({
          success: true,
          action: 'no_intake_needed',
          players: yai.playersAvailable,
          nextIntakeWeek: yai.nextIntakeWeek,
        });
      }
    }

    if (body.action === 'sign') {
      const playerId = body.playerId;
      const playerIndex = yai.playersAvailable.findIndex(p => p.id === playerId);
      if (playerIndex === -1) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }

      const player = yai.playersAvailable[playerIndex];
      
      const newPlayer: YouthPlayer = {
        ...player,
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        age: 16,
      };

      gameState.squad.players.push({
        id: newPlayer.id,
        name: newPlayer.name,
        position: newPlayer.position,
        pac: newPlayer.currentAbility + randomBetween(-5, 10),
        sho: newPlayer.currentAbility + randomBetween(-5, 10),
        pas: newPlayer.currentAbility + randomBetween(-5, 10),
        dri: newPlayer.currentAbility + randomBetween(-5, 10),
        def: newPlayer.currentAbility + randomBetween(-5, 10),
        phy: newPlayer.currentAbility + randomBetween(-5, 10),
        potential: newPlayer.potential,
        consistency: randomBetween(60, 90),
        bigMatchPlayer: randomBetween(50, 90),
        leadership: randomBetween(40, 80),
        injuryProneness: randomBetween(20, 50),
        fatigue: 0,
        currentForm: 'good',
        weeklyTrainingCount: 0,
        isInjured: false,
        injuryWeeksRemaining: 0,
        injuryType: null,
      });

      yai.playersAvailable.splice(playerIndex, 1);
      gameState.youthAcademy = yai;

      const committed = await commitSave(targetUserId, gameState, save.version);
      if (!committed.ok) {
        log.warn('Youth action rejected: the save moved on while it was being processed', { action });
        return saveConflictResponse();
      }

      return NextResponse.json({
        success: true,
        action: 'signed',
        player: newPlayer,
        squadSize: gameState.squad.players.length,
      });
    }

    if (body.action === 'reject') {
      const playerIndex = yai.playersAvailable.findIndex(p => p.id === body.playerId);
      if (playerIndex === -1) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }

      yai.playersAvailable.splice(playerIndex, 1);
      gameState.youthAcademy = yai;

      const committed = await commitSave(targetUserId, gameState, save.version);
      if (!committed.ok) {
        log.warn('Youth action rejected: the save moved on while it was being processed', { action });
        return saveConflictResponse();
      }

      return NextResponse.json({
        success: true,
        action: 'rejected',
        remainingPlayers: yai.playersAvailable.length,
      });
    }

    if (body.action === 'set-focus') {
      // Checked by the schema, down to null meaning "clear it".
      const focus = body.focus;

      yai.trainingFocus = focus;
      gameState.youthAcademy = yai;

      const committed = await commitSave(targetUserId, gameState, save.version);
      if (!committed.ok) {
        log.warn('Youth action rejected: the save moved on while it was being processed', { action });
        return saveConflictResponse();
      }

      return NextResponse.json({
        success: true,
        action: 'focus_set',
        trainingFocus: focus,
      });
    }

    // Unreachable: the schema admits only the actions handled above, and
    // 'generate' and 'intake' share the first branch.
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    log.error('POST API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}