import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { GameState, YouthAcademy, YouthPlayer, TrainingFocus } from '@/lib/types';
import { generateYouthIntake } from '@/lib/youth-generator';
import { withApiRoute, ApiContext } from '@/lib/api-route';

type GameStateRecordShape = {
  currentState: GameState;
};

interface YouthRequest {
  action?: string;
  playerId?: string;
  focus: TrainingFocus;
}

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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameStateRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = (gameStateRecord as GameStateRecordShape).currentState;
    
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
  { log, readJson }: ApiContext
) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const bodyResult = await readJson<YouthRequest>();
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const requestBody = bodyResult.body;

    const action = requestBody.action;
    const playerId = requestBody.playerId;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });

    if (!gameStateRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const gameState = (gameStateRecord as GameStateRecordShape).currentState;
    const yai = gameState.youthAcademy || initializeYouthAcademy(gameState.season.week);
    const academyLevel = gameState.facilities.youthAcademy;
    const scoutLevel = gameState.facilities.scoutOffice;
    const headOfYouth = gameState.staff.headCoach;

    if (action === 'generate' || action === 'intake') {
      const shouldGenerate = yai.playersAvailable.length === 0 && 
        (gameState.season.week >= yai.nextIntakeWeek || !yai.nextIntakeWeek);

      if (shouldGenerate) {
        const newPlayers = generateYouthIntake(academyLevel, scoutLevel);
        yai.playersAvailable = newPlayers;
        yai.lastIntakeWeek = gameState.season.week;
        yai.nextIntakeWeek = gameState.season.week + 4;
        gameState.youthAcademy = yai;

        await db
          .update(gameStates)
          .set({ currentState: gameState, updatedAt: new Date() })
          .where(eq(gameStates.userId, userId));

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

    if (action === 'sign') {
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

      await db
        .update(gameStates)
        .set({ currentState: gameState, updatedAt: new Date() })
        .where(eq(gameStates.userId, userId));

      return NextResponse.json({
        success: true,
        action: 'signed',
        player: newPlayer,
        squadSize: gameState.squad.players.length,
      });
    }

    if (action === 'reject') {
      const playerIndex = yai.playersAvailable.findIndex(p => p.id === playerId);
      if (playerIndex === -1) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }

      yai.playersAvailable.splice(playerIndex, 1);
      gameState.youthAcademy = yai;

      await db
        .update(gameStates)
        .set({ currentState: gameState, updatedAt: new Date() })
        .where(eq(gameStates.userId, userId));

      return NextResponse.json({
        success: true,
        action: 'rejected',
        remainingPlayers: yai.playersAvailable.length,
      });
    }

    if (action === 'set-focus') {
      const focus = requestBody.focus;
      const validFocuses = ['technical', 'physical', 'tactical'];
      
      if (focus !== null && !validFocuses.includes(focus)) {
        return NextResponse.json({ error: 'Invalid focus' }, { status: 400 });
      }

      yai.trainingFocus = focus;
      gameState.youthAcademy = yai;

      await db
        .update(gameStates)
        .set({ currentState: gameState, updatedAt: new Date() })
        .where(eq(gameStates.userId, userId));

      return NextResponse.json({
        success: true,
        action: 'focus_set',
        trainingFocus: focus,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    log.error('POST API error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}