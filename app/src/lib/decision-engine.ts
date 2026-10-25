import {
  DecisionOption,
  DecisionTurn,
  TurnResult,
  TurnAction,
  TurnMentality,
  Player,
  TacticalInstructionType,
} from './types';
import {
  DECISION_TURNS,
  DECISION_TURN_CONFIG,
  DEFAULT_ACTIONS_BY_CONTEXT,
  SQUAD_CONSTANTS,
  TACTICAL_INSTRUCTIONS,
} from './constants';

const FATIGUE_THRESHOLD = 50;
const SCORE_DIFFERENCE_THRESHOLD = 2;

/**
 * Resolves the context-aware default action based on current match state.
 * Priority: red card > low fitness > losing by 2+ > winning by 2+ > normal
 */
export function resolveDefaultAction(
  homeScore: number,
  awayScore: number,
  homeSquad: Player[],
  hasRedCard: boolean
): DecisionOption {
  // Priority 1: Red card — must fill the gap
  if (hasRedCard) {
    const context = DEFAULT_ACTIONS_BY_CONTEXT.RED_CARD;
    const tiredPlayer = homeSquad.find((p) => p.fatigue > FATIGUE_THRESHOLD);
    const substitutePlayer = tiredPlayer
      ? homeSquad
          .filter((p) => p.id !== tiredPlayer.id)
          .reduce<Player | undefined>((best, p) => {
            if (!best || p.fatigue > best.fatigue) return p;
            return best;
          }, undefined)
      : undefined;
    return {
      id: 'default_red_card',
      label: context.label,
      description: 'Um jogador foi expulso — é preciso preencher a vaga imediatamente.',
      icon: '🟥',
      action: context.action,
      category: 'substitution',
      substituteOut: tiredPlayer?.id,
      substituteIn: substitutePlayer?.id,
    };
  }

  // Priority 2: Low fitness — swap out tired player
  const tiredPlayer = homeSquad.find((p) => p.fatigue > FATIGUE_THRESHOLD);
  if (tiredPlayer) {
    const context = DEFAULT_ACTIONS_BY_CONTEXT.LOW_FITNESS;
    const substitutePlayer = homeSquad
      .filter((p) => p.id !== tiredPlayer.id)
      .reduce<Player | undefined>((best, p) => {
        if (!best || p.fatigue > best.fatigue) return p;
        return best;
      }, undefined);
    return {
      id: 'default_low_fitness',
      label: context.label,
      description: `${tiredPlayer.name} está cansado — hora de repor energia.`,
      icon: '😮‍💨',
      action: context.action,
      category: 'substitution',
      substituteOut: tiredPlayer.id,
      substituteIn: substitutePlayer?.id,
    };
  }

  const scoreDiff = homeScore - awayScore;

  // Priority 3: Losing by 2+ — go attacking
  if (scoreDiff <= -SCORE_DIFFERENCE_THRESHOLD) {
    const context = DEFAULT_ACTIONS_BY_CONTEXT.LOSING_BY_2PLUS;
    return {
      id: 'default_losing',
      label: context.label,
      description: 'Estamos perdendo por 2 ou mais — é hora de arriscar no ataque.',
      icon: '⚔️',
      action: context.action,
      category: 'mentality',
      mentality: context.mentality,
    };
  }

  // Priority 4: Winning by 2+ — go defensive
  if (scoreDiff >= SCORE_DIFFERENCE_THRESHOLD) {
    const context = DEFAULT_ACTIONS_BY_CONTEXT.WINNING_BY_2PLUS;
    return {
      id: 'default_winning',
      label: context.label,
      description: 'Estamos ganhando confortavelmente — proteger o resultado.',
      icon: '🛡️',
      action: context.action,
      category: 'mentality',
      mentality: context.mentality,
    };
  }

  // Priority 5: Normal — keep setup
  const context = DEFAULT_ACTIONS_BY_CONTEXT.NORMAL;
  return {
    id: 'default_normal',
    label: context.label,
    description: 'O jogo está equilibrado — manter a estratégia atual.',
    icon: '✅',
    action: context.action,
    category: 'tactical',
  };
}

/**
 * Generates contextual decision options based on the turn and match state.
 * Always includes a tactical instruction option and "Manter como está".
 */
export function generateDecisionOptions(
  turnNumber: number,
  homeScore: number,
  awayScore: number,
  homeSquad: Player[],
  currentFormation: string,
  currentMentality: TurnMentality
): DecisionOption[] {
  const options: DecisionOption[] = [];
  const scoreDiff = homeScore - awayScore;

  // Contextual tactical instructions — offer multiple based on match state
  const losingInstructions: TacticalInstructionType[] = ['high_press', 'counter_attack', 'shoot_on_sight', 'long_balls', 'target_man'];
  const winningInstructions: TacticalInstructionType[] = ['park_the_bus', 'time_wasting', 'man_mark', 'tiki_taka', 'counter_attack'];
  const tiedInstructions: TacticalInstructionType[] = ['tiki_taka', 'wing_play', 'free_role', 'high_press', 'overlap', 'counter_attack'];

  const contextInstructions = scoreDiff <= -1 ? losingInstructions : scoreDiff >= 1 ? winningInstructions : tiedInstructions;

  if (scoreDiff <= -SCORE_DIFFERENCE_THRESHOLD) {
    // Losing by 2+ — push attacking
    if (currentMentality !== 'attacking') {
      options.push({
        id: `turn_${turnNumber}_attacking`,
        label: 'Subir a marcação',
        description: 'Mudar para mentalidade ofensiva para buscar o empate.',
        icon: '⚔️',
        action: 'change_mentality',
        category: 'mentality',
        mentality: 'attacking',
      });
    }
    if (currentFormation !== '4-3-3') {
      options.push({
        id: `turn_${turnNumber}_formation_433`,
        label: 'Formação 4-3-3',
        description: 'Adotar formação mais ofensiva com três atacantes.',
        icon: '📐',
        action: 'change_formation',
        category: 'formation',
        formation: '4-3-3',
      });
    }
    if (!options.some((o) => o.category === 'mentality')) {
      options.push({
        id: `turn_${turnNumber}_balanced`,
        label: 'Equilibrar o time',
        description: 'Manter pressão mas fechar as linhas.',
        icon: '⚖️',
        action: 'change_mentality',
        category: 'mentality',
        mentality: 'balanced',
      });
    }
  } else if (scoreDiff >= SCORE_DIFFERENCE_THRESHOLD) {
    // Winning by 2+ — push defensive
    if (currentMentality !== 'defensive') {
      options.push({
        id: `turn_${turnNumber}_defensive`,
        label: 'Proteger resultado',
        description: 'Mudar para mentalidade defensiva para segurar a vantagem.',
        icon: '🛡️',
        action: 'change_mentality',
        category: 'mentality',
        mentality: 'defensive',
      });
    }
    if (currentFormation !== '5-4-1') {
      options.push({
        id: `turn_${turnNumber}_formation_541`,
        label: 'Formação 5-4-1',
        description: 'Adotar formação mais defensiva com cinco zagueiros.',
        icon: '📐',
        action: 'change_formation',
        category: 'formation',
        formation: '5-4-1',
      });
    }
    if (!options.some((o) => o.category === 'mentality')) {
      options.push({
        id: `turn_${turnNumber}_balanced`,
        label: 'Equilibrar o time',
        description: 'Segurar vantagem com equilíbrio.',
        icon: '⚖️',
        action: 'change_mentality',
        category: 'mentality',
        mentality: 'balanced',
      });
    }
  } else {
    // Tied — offer mentality alternative
    if (currentMentality === 'balanced') {
      options.push({
        id: `turn_${turnNumber}_attacking`,
        label: 'Subir a marcação',
        description: 'Mudar para mentalidade ofensiva para buscar o gol.',
        icon: '⚔️',
        action: 'change_mentality',
        category: 'mentality',
        mentality: 'attacking',
      });
    } else if (currentMentality === 'attacking') {
      options.push({
        id: `turn_${turnNumber}_defensive`,
        label: 'Proteger resultado',
        description: 'Mudar para mentalidade defensiva.',
        icon: '🛡️',
        action: 'change_mentality',
        category: 'mentality',
        mentality: 'defensive',
      });
    } else {
      options.push({
        id: `turn_${turnNumber}_attacking`,
        label: 'Subir a marcação',
        description: 'Mudar para mentalidade ofensiva para buscar o gol.',
        icon: '⚔️',
        action: 'change_mentality',
        category: 'mentality',
        mentality: 'attacking',
      });
    }
    const altFormation = currentFormation === '4-3-3' ? '5-4-1' : '4-3-3';
    options.push({
      id: `turn_${turnNumber}_formation_${altFormation.replace(/-/g, '')}`,
      label: `Formação ${altFormation}`,
      description:
        altFormation === '4-3-3'
          ? 'Adotar formação mais ofensiva com três atacantes.'
          : 'Adotar formação mais defensiva com cinco zagueiros.',
      icon: '📐',
      action: 'change_formation',
      category: 'formation',
      formation: altFormation,
    });
  }

  // Add tactical instruction options (contextual to match state)
  const instrIcons: Record<TacticalInstructionType, string> = {
    high_press: '🔥', park_the_bus: '🚌', tiki_taka: '⚽', counter_attack: '⚡',
    long_balls: '📏', wing_play: '🏃', shoot_on_sight: '💥', time_wasting: '⏰',
    target_man: '🎯', free_role: '🌟', man_mark: '👤', overlap: '↗️',
  };
  const remainingSlots = DECISION_TURN_CONFIG.MAX_OPTIONS - options.length - 1; // -1 for "Manter"
  for (const instrType of contextInstructions.slice(0, Math.max(remainingSlots, 3))) {
    const instr = TACTICAL_INSTRUCTIONS[instrType];
    options.push({
      id: `turn_${turnNumber}_instr_${instrType}`,
      label: instr.description.split('—')[0].trim(),
      description: instr.description.split('—')[1]?.trim() || instr.description,
      icon: instrIcons[instrType] || '📋',
      action: 'tactical_instruction',
      category: 'instruction',
      tacticalInstruction: instrType,
    });
  }

  // Always include "Manter como está" as last option
  options.push({
    id: `turn_${turnNumber}_keep`,
    label: 'Manter como está',
    description: 'Manter a estratégia e formação atuais.',
    icon: '✅',
    action: 'keep_setup',
    category: 'tactical',
  });

  // Cap at MAX_OPTIONS
  return options.slice(0, DECISION_TURN_CONFIG.MAX_OPTIONS);
}

/**
 * Builds a complete DecisionTurn for a given turn number and match state.
 * Combines generated options with the default option and timer config.
 */
export function buildDecisionTurn(
  turnNumber: number,
  homeScore: number,
  awayScore: number,
  homeSquad: Player[],
  currentFormation: string,
  currentMentality: TurnMentality,
  hasRedCard: boolean
): DecisionTurn {
  const turnConfig = DECISION_TURNS[turnNumber];

  if (!turnConfig) {
    throw new Error(`Invalid turn number: ${turnNumber}. Must be between 0 and ${DECISION_TURNS.length - 1}.`);
  }

  const options = generateDecisionOptions(
    turnNumber,
    homeScore,
    awayScore,
    homeSquad,
    currentFormation,
    currentMentality
  );

  const defaultOption = resolveDefaultAction(homeScore, awayScore, homeSquad, hasRedCard);

  return {
    turnNumber,
    minute: turnConfig.minute,
    label: turnConfig.label,
    options,
    defaultOption,
    timerSeconds: DECISION_TURN_CONFIG.TIMER_SECONDS,
  };
}

/**
 * Applies a TurnResult to the match state, returning modified parameters
 * for the next segment simulation.
 */
export function applyTurnResult(
  turnResult: TurnResult,
  currentState: {
    formation: string;
    mentality: TurnMentality;
    squad: Player[];
  }
): {
  formation: string;
  mentality: TurnMentality;
  squad: Player[];
  tacticalInstruction?: TacticalInstructionType;
} {
  let { formation, mentality } = currentState;
  const { squad } = currentState;

  if (turnResult.mentalityShift) {
    mentality = turnResult.mentalityShift;
  }

  if (turnResult.formationChange) {
    formation = turnResult.formationChange;
  }

  // Substitutions are recorded in the TurnResult but do not change the squad:
  // the squad is a fixed 11 (SQUAD_CONSTANTS.SIZE) with no bench, so both
  // players named in a substitution are already on the pitch. Swapping them
  // would only reorder the array, which the simulation ignores.

  return {
    formation,
    mentality,
    squad,
    tacticalInstruction: turnResult.tacticalInstruction?.type,
  };
}

/**
 * Creates a TurnResult from a user decision or timeout.
 */
export function createTurnResult(
  turnNumber: number,
  minute: number,
  decision: DecisionOption | null,
  defaultOption: DecisionOption
): TurnResult {
  const wasDefault = decision === null;
  const activeDecision = decision ?? defaultOption;

  const result: TurnResult = {
    turnNumber,
    minute,
    decision: activeDecision,
    wasDefault,
  };

  if (activeDecision.action === 'change_mentality' && activeDecision.mentality) {
    result.mentalityShift = activeDecision.mentality;
  }

  if (activeDecision.action === 'change_formation' && activeDecision.formation) {
    result.formationChange = activeDecision.formation;
  }

  if (activeDecision.action === 'substitution' && activeDecision.substituteOut && activeDecision.substituteIn) {
    result.substitution = {
      out: activeDecision.substituteOut,
      in: activeDecision.substituteIn,
    };
  }

  if (activeDecision.action === 'tactical_instruction' && activeDecision.tacticalInstruction) {
    const instrKey = activeDecision.tacticalInstruction;
    if (Object.hasOwn(TACTICAL_INSTRUCTIONS, instrKey)) {
      result.tacticalInstruction = TACTICAL_INSTRUCTIONS[instrKey];
    }
  }

  return result;
}
