import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, getAuthenticatedUser } from '@/lib/auth-helpers';
import { Player, FormState } from '@/lib/types';

interface TrainingRequest {
  userId?: string;
  playerId: string;
  focus: 'technical' | 'physical' | 'tactical' | 'rest';
}

interface TrainingResult {
  success: boolean;
  player?: Player;
  gains?: Record<string, number>;
  newFatigue?: number;
  injuryOccurred?: boolean;
  injuryType?: string;
  injuryWeeks?: number;
  teamBudgetRemaining: number;
  message: string;
}

interface TrainingConfig {
  attributes: string[];
  fatigueCost: number;
  injuryRiskBonus: number;
}

const TRAINING_CONFIG: Record<string, TrainingConfig> = {
  technical: { attributes: ['dri', 'pas'], fatigueCost: 15, injuryRiskBonus: 5 },
  physical: { attributes: ['pac', 'phy'], fatigueCost: 20, injuryRiskBonus: 10 },
  tactical: { attributes: ['def', 'sho'], fatigueCost: 15, injuryRiskBonus: 5 },
  rest: { attributes: [], fatigueCost: -25, injuryRiskBonus: 0 },
};

const WEEKLY_TRAINING_LIMIT = 3;
const WEEKLY_BUDGET = 15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getOverallRating(player: Player): number {
  return Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
}

function calculateTrainingGain(player: Player): number {
  const rating = getOverallRating(player);
  let baseGain = 2;

  // Diminishing returns by rating
  if (rating >= 90) baseGain *= 0.1;
  else if (rating >= 85) baseGain *= 0.3;
  else if (rating >= 80) baseGain *= 0.5;
  else if (rating >= 75) baseGain *= 0.8;

  // Potential bonus
  const potentialBonus = (player.potential - 80) / 5;
  baseGain *= (1 + potentialBonus / 100);

  // Form modifier
  if (player.currentForm === 'hot') baseGain *= 1.1;
  if (player.currentForm === 'cold') baseGain *= 0.9;

  // Final gain: randomized within range
  const actualGain = Math.max(1, Math.floor(baseGain + Math.random() * baseGain));
  return clamp(actualGain, 0, 3);
}

function calculateInjuryRisk(player: Player, focus: string): number {
  let risk = 5; // Base 5%

  // Fatigue factor
  if (player.fatigue > 50) {
    risk += (player.fatigue - 50) * 0.3;
  }

  // Training type
  risk += TRAINING_CONFIG[focus].injuryRiskBonus;

  // Weekly session count (3rd session = +5%)
  if (player.weeklyTrainingCount >= 2) {
    risk += 5;
  }

  // Injury proneness
  risk += player.injuryProneness * 0.1;

  return Math.min(35, Math.round(risk));
}

function applyInjury(player: Player): { occurred: boolean; type: string; weeks: number } {
  const roll = Math.random() * 100;
  
  if (roll < 5) {
    // Severe: 5%
    return { occurred: true, type: 'severe', weeks: 6 + Math.floor(Math.random() * 3) };
  } else if (roll < 20) {
    // Moderate: 15%
    return { occurred: true, type: 'moderate', weeks: 3 + Math.floor(Math.random() * 3) };
  } else if (roll < 40) {
    // Minor: 20%
    return { occurred: true, type: 'minor', weeks: 1 + Math.floor(Math.random() * 2) };
  }
  
  return { occurred: false, type: '', weeks: 0 };
}

function updateForm(player: Player, change: number): void {
  const formLevels: FormState[] = ['cold', 'poor', 'average', 'good', 'hot'];
  const currentIndex = formLevels.indexOf(player.currentForm);
  const newIndex = clamp(currentIndex + change, 0, 4);
  player.currentForm = formLevels[newIndex];
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }
    
    const sessionUserId = await getAuthenticatedUser();
    
    // Parse request
    let body: TrainingRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { userId, playerId, focus } = body;
    const targetUserId = sessionUserId || userId;
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'User not identified' }, { status: 401 });
    }

    if (!playerId || !focus || !TRAINING_CONFIG[focus]) {
      return NextResponse.json({ error: 'Invalid training focus' }, { status: 400 });
    }

    // Get game state
    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, targetUserId),
    });

    if (!gameStateRecord) {
      return NextResponse.json({ error: 'Game state not found' }, { status: 404 });
    }

    const gameState = gameStateRecord.currentState;
    const squad = gameState.squad;

    // Find player
    const playerIndex = squad.players.findIndex((p: Player) => p.id === playerId);
    if (playerIndex === -1) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const player = squad.players[playerIndex];
    const config = TRAINING_CONFIG[focus];

    // Handle undefined values from old game states - apply defaults
    const playerIsInjured = player.isInjured ?? false;
    const playerFatigue = player.fatigue ?? 100;
    const playerWeeklyCount = player.weeklyTrainingCount ?? 0;
    const squadBudget = squad.weeklyTrainingBudget ?? 15;

    // Migration: add missing fields if undefined
    if (player.fatigue === undefined) player.fatigue = 100;
    if (player.currentForm === undefined) player.currentForm = 'average';
    if (player.weeklyTrainingCount === undefined) player.weeklyTrainingCount = 0;
    if (player.isInjured === undefined) player.isInjured = false;
    if (player.injuryWeeksRemaining === undefined) player.injuryWeeksRemaining = 0;
    if (player.injuryType === undefined) player.injuryType = null;
    if (squad.weeklyTrainingBudget === undefined) squad.weeklyTrainingBudget = 15;

    // Validation checks
    if (playerIsInjured) {
      return NextResponse.json(
        { 
          error: 'Jogador lesionado!', 
          details: `${player.name} está lesionado e não pode treinar.`,
          code: 'PLAYER_INJURED'
        },
        { status: 400 }
      );
    }

    if (playerFatigue <= 20 && focus !== 'rest') {
      return NextResponse.json(
        { 
          error: 'Jogador exausto!', 
          details: `${player.name} está com apenas ${playerFatigue}% de energia. Use "Descanso" para recuperar.`,
          code: 'PLAYER_EXHAUSTED'
        },
        { status: 400 }
      );
    }

    if (playerWeeklyCount >= WEEKLY_TRAINING_LIMIT && focus !== 'rest') {
      return NextResponse.json(
        { 
          error: 'Limite semanal atingido!', 
          details: `${player.name} já treinou ${playerWeeklyCount} vezes esta semana.`,
          code: 'WEEKLY_LIMIT'
        },
        { status: 400 }
      );
    }

    if (squadBudget <= 0 && focus !== 'rest') {
      return NextResponse.json(
        { 
          error: 'Orçamento esgotado!', 
          details: `O time usou todos os ${squadBudget} treinos desta semana.`,
          code: 'BUDGET_EXHAUSTED'
        },
        { status: 400 }
      );
    }

    // Process training
    const result: TrainingResult = {
      success: true,
      player,
      teamBudgetRemaining: squad.weeklyTrainingBudget ?? 15,
      message: '',
    };

    if (focus === 'rest') {
      // Rest: recover fatigue, improve form
      const fatigueRecovery = Math.abs(config.fatigueCost);
      player.fatigue = clamp(player.fatigue + fatigueRecovery, 0, 100);
      updateForm(player, 1); // +1 form level
      result.newFatigue = player.fatigue;
      result.message = `${player.name} descansou! +${fatigueRecovery}% condicion, ${player.currentForm === 'hot' ? 'em ótima forma!' : 'forma melhorou!'}`;
    } else {
      // Training: apply gains
      const gains: Record<string, number> = {};
      
      for (const attr of config.attributes) {
        const gain = calculateTrainingGain(player);
        if (gain > 0) {
          const currentValue = player[attr as keyof Player] as number;
          const newValue = clamp(currentValue + gain, 50, 99);
          player[attr as keyof Player] = newValue;
          gains[attr] = gain;
        }
      }

      // Apply fatigue cost
      player.fatigue = clamp(player.fatigue - config.fatigueCost, 0, 100);
      result.newFatigue = player.fatigue;

      // Check for injury
      const injuryRisk = calculateInjuryRisk(player, focus);
      const injury = applyInjury(player);
      
      if (injury.occurred) {
        player.isInjured = true;
        player.injuryType = injury.type as 'minor' | 'moderate' | 'severe';
        player.injuryWeeksRemaining = injury.weeks;
        result.injuryOccurred = true;
        result.injuryType = injury.type;
        result.injuryWeeks = injury.weeks;
      }

      // Update training count
      player.weeklyTrainingCount += 1;

      // Consume team budget
      squad.weeklyTrainingBudget = Math.max(0, squad.weeklyTrainingBudget - 1);
      result.teamBudgetRemaining = squad.weeklyTrainingBudget;

      // Build message
      if (injury.occurred) {
        result.message = `${player.name} se lesionou durante o treino! ${injury.type} (${injury.weeks} semanas)`;
      } else if (Object.keys(gains).length > 0) {
        const gainStr = Object.entries(gains).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ');
        result.message = `${player.name} treinou! ${gainStr}`;
        result.gains = gains;
      } else {
        result.message = `${player.name} treinou, mas não houve melhoria visível.`;
      }
    }

    // Update squad average fitness
    squad.fitness = Math.round(
      squad.players.reduce((sum: number, p: Player) => sum + p.fatigue, 0) / squad.players.length
    );

    // Update database
    await db.update(gameStates)
      .set({ currentState: gameState })
      .where(eq(gameStates.userId, targetUserId));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Train] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function for injury risk calculation (exported for UI)
export function getInjuryRiskPreview(player: Player, focus: string): number {
  return calculateInjuryRisk(player, focus);
}

// Helper to check if player can train
export function canPlayerTrain(player: Player, teamBudget: number): { canTrain: boolean; reason?: string } {
  if (player.isInjured) {
    return { canTrain: false, reason: `Lesionado (${player.injuryWeeksRemaining} sem)` };
  }
  if (player.fatigue <= 20) {
    return { canTrain: false, reason: 'Exausto - Necessita descanso' };
  }
  if (player.weeklyTrainingCount >= WEEKLY_TRAINING_LIMIT) {
    return { canTrain: false, reason: 'Limite semanal atingido' };
  }
  if (teamBudget <= 0) {
    return { canTrain: false, reason: 'Orçamento do time esgotado' };
  }
  return { canTrain: true };
}
