import { describe, test, expect } from 'vitest';
import {
  resolveDefaultAction,
  generateDecisionOptions,
  buildDecisionTurn,
  createTurnResult,
  applyTurnResult,
} from '../decision-engine';
import { Player, DecisionOption, TurnMentality } from '../types';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    name: 'Test Player',
    position: 'MID',
    pac: 70,
    sho: 65,
    pas: 75,
    dri: 70,
    def: 60,
    phy: 68,
    potential: 85,
    consistency: 75,
    bigMatchPlayer: 70,
    leadership: 65,
    injuryProneness: 30,
    fatigue: 80,
    currentForm: 'good',
    weeklyTrainingCount: 1,
    isInjured: false,
    injuryWeeksRemaining: 0,
    injuryType: null,
    ...overrides,
  };
}

const fitSquad: Player[] = [
  makePlayer({ id: 'p1', name: 'Player 1', fatigue: 20 }),
  makePlayer({ id: 'p2', name: 'Player 2', fatigue: 30 }),
  makePlayer({ id: 'p3', name: 'Player 3', fatigue: 40 }),
];

const tiredSquad: Player[] = [
  makePlayer({ id: 'p1', name: 'Tired Player', fatigue: 80 }),
  makePlayer({ id: 'p2', name: 'Fit Player', fatigue: 30 }),
  makePlayer({ id: 'p3', name: 'OK Player', fatigue: 40 }),
];

// ─── resolveDefaultAction ───────────────────────────────────────────────────

describe('resolveDefaultAction', () => {
  test('red card scenario returns substitution action', () => {
    // Use tiredSquad so substituteOut is populated
    const result = resolveDefaultAction(1, 1, tiredSquad, true);

    expect(result.id).toBe('default_red_card');
    expect(result.action).toBe('substitution');
    expect(result.category).toBe('substitution');
    expect(result.label).toBe('Preencher vaga');
    expect(result.icon).toBe('🟥');
    expect(result.substituteOut).toBe('p1');
  });

  test('red card with no tired players returns substitution without substituteOut', () => {
    const result = resolveDefaultAction(1, 1, fitSquad, true);

    expect(result.id).toBe('default_red_card');
    expect(result.action).toBe('substitution');
    expect(result.substituteOut).toBeUndefined();
  });

  test('red card takes precedence over losing by 2+', () => {
    const result = resolveDefaultAction(0, 3, fitSquad, true);

    expect(result.id).toBe('default_red_card');
    expect(result.action).toBe('substitution');
  });

  test('red card takes precedence over winning by 2+', () => {
    const result = resolveDefaultAction(3, 0, fitSquad, true);

    expect(result.id).toBe('default_red_card');
    expect(result.action).toBe('substitution');
  });

  test('losing by 2+ returns attacking mentality', () => {
    const result = resolveDefaultAction(0, 2, fitSquad, false);

    expect(result.id).toBe('default_losing');
    expect(result.action).toBe('change_mentality');
    expect(result.mentality).toBe('attacking');
    expect(result.category).toBe('mentality');
    expect(result.label).toBe('Partir para o ataque');
  });

  test('losing by 3+ also returns attacking mentality', () => {
    const result = resolveDefaultAction(0, 4, fitSquad, false);

    expect(result.id).toBe('default_losing');
    expect(result.mentality).toBe('attacking');
  });

  test('winning by 2+ returns defensive mentality', () => {
    const result = resolveDefaultAction(3, 1, fitSquad, false);

    expect(result.id).toBe('default_winning');
    expect(result.action).toBe('change_mentality');
    expect(result.mentality).toBe('defensive');
    expect(result.category).toBe('mentality');
    expect(result.label).toBe('Proteger o resultado');
  });

  test('winning by 3+ also returns defensive mentality', () => {
    const result = resolveDefaultAction(5, 1, fitSquad, false);

    expect(result.id).toBe('default_winning');
    expect(result.mentality).toBe('defensive');
  });

  test('low fatigue player returns substitution', () => {
    const result = resolveDefaultAction(1, 1, tiredSquad, false);

    expect(result.id).toBe('default_low_fitness');
    expect(result.action).toBe('substitution');
    expect(result.category).toBe('substitution');
    expect(result.substituteOut).toBe('p1');
    expect(result.label).toBe('Trocar jogador cansado');
  });

  test('low fatigue takes precedence over losing by 2+', () => {
    const result = resolveDefaultAction(0, 3, tiredSquad, false);

    expect(result.id).toBe('default_low_fitness');
    expect(result.action).toBe('substitution');
  });

  test('normal scenario returns keep_setup', () => {
    const result = resolveDefaultAction(1, 1, fitSquad, false);

    expect(result.id).toBe('default_normal');
    expect(result.action).toBe('keep_setup');
    expect(result.category).toBe('tactical');
    expect(result.label).toBe('Manter como está');
  });

  test('losing by 1 (not enough) returns normal', () => {
    const result = resolveDefaultAction(1, 2, fitSquad, false);

    expect(result.id).toBe('default_normal');
    expect(result.action).toBe('keep_setup');
  });

  test('winning by 1 (not enough) returns normal', () => {
    const result = resolveDefaultAction(2, 1, fitSquad, false);

    expect(result.id).toBe('default_normal');
    expect(result.action).toBe('keep_setup');
  });

  test('empty squad with red card still returns substitution (no substituteOut)', () => {
    const result = resolveDefaultAction(1, 1, [], true);

    expect(result.id).toBe('default_red_card');
    expect(result.action).toBe('substitution');
    expect(result.substituteOut).toBeUndefined();
  });

  test('empty squad with no red card returns normal', () => {
    const result = resolveDefaultAction(1, 1, [], false);

    expect(result.id).toBe('default_normal');
    expect(result.action).toBe('keep_setup');
  });
});

// ─── generateDecisionOptions ────────────────────────────────────────────────

describe('generateDecisionOptions', () => {
  test('losing scenario offers attacking option', () => {
    const options = generateDecisionOptions(1, 0, 3, fitSquad, '4-4-2', 'balanced');

    const attackingOption = options.find((o) => o.mentality === 'attacking');
    expect(attackingOption).toBeDefined();
    expect(attackingOption!.label).toBe('Subir a marcação');
    expect(attackingOption!.action).toBe('change_mentality');
  });

  test('losing scenario offers 4-3-3 formation option', () => {
    const options = generateDecisionOptions(1, 0, 3, fitSquad, '4-4-2', 'balanced');

    const formationOption = options.find((o) => o.formation === '4-3-3');
    expect(formationOption).toBeDefined();
    expect(formationOption!.action).toBe('change_formation');
  });

  test('winning scenario offers defensive option', () => {
    const options = generateDecisionOptions(1, 3, 0, fitSquad, '4-3-3', 'balanced');

    const defensiveOption = options.find((o) => o.mentality === 'defensive');
    expect(defensiveOption).toBeDefined();
    expect(defensiveOption!.label).toBe('Proteger resultado');
    expect(defensiveOption!.action).toBe('change_mentality');
  });

  test('winning scenario offers 5-4-1 formation option', () => {
    const options = generateDecisionOptions(1, 3, 0, fitSquad, '4-3-3', 'balanced');

    const formationOption = options.find((o) => o.formation === '5-4-1');
    expect(formationOption).toBeDefined();
    expect(formationOption!.action).toBe('change_formation');
  });

  test('tied scenario offers balanced option', () => {
    const options = generateDecisionOptions(1, 1, 1, fitSquad, '4-3-3', 'attacking');

    const balancedOption = options.find((o) => o.mentality === 'balanced');
    expect(balancedOption).toBeDefined();
    expect(balancedOption!.label).toBe('Equilibrar o time');
    expect(balancedOption!.action).toBe('change_mentality');
  });

  test('always includes "Manter como está" as last option', () => {
    const options = generateDecisionOptions(1, 0, 3, fitSquad, '4-4-2', 'balanced');

    const lastOption = options[options.length - 1];
    expect(lastOption.label).toBe('Manter como está');
    expect(lastOption.action).toBe('keep_setup');
    expect(lastOption.category).toBe('tactical');
  });

  test('never offers current mentality as an option (losing + attacking)', () => {
    const options = generateDecisionOptions(1, 0, 3, fitSquad, '4-4-2', 'attacking');

    const attackingOption = options.find((o) => o.mentality === 'attacking');
    expect(attackingOption).toBeUndefined();
  });

  test('never offers current mentality as an option (winning + defensive)', () => {
    const options = generateDecisionOptions(1, 3, 0, fitSquad, '4-3-3', 'defensive');

    const defensiveOption = options.find((o) => o.mentality === 'defensive');
    expect(defensiveOption).toBeUndefined();
  });

  test('never offers current mentality as an option (tied + balanced)', () => {
    const options = generateDecisionOptions(1, 1, 1, fitSquad, '4-3-3', 'balanced');

    const balancedOption = options.find((o) => o.mentality === 'balanced');
    expect(balancedOption).toBeUndefined();
  });

  test('max 3 options returned', () => {
    const options = generateDecisionOptions(1, 0, 3, fitSquad, '4-4-2', 'balanced');

    expect(options.length).toBeLessThanOrEqual(3);
  });

  test('never offers current formation as an option (losing)', () => {
    const options = generateDecisionOptions(1, 0, 3, fitSquad, '4-3-3', 'balanced');

    const formationOption = options.find((o) => o.formation === '4-3-3');
    expect(formationOption).toBeUndefined();
  });

  test('never offers current formation as an option (winning)', () => {
    const options = generateDecisionOptions(1, 3, 0, fitSquad, '5-4-1', 'balanced');

    const formationOption = options.find((o) => o.formation === '5-4-1');
    expect(formationOption).toBeUndefined();
  });

  test('losing with attacking mentality and 4-3-3 formation only offers keep', () => {
    const options = generateDecisionOptions(1, 0, 3, fitSquad, '4-3-3', 'attacking');

    expect(options.length).toBe(1);
    expect(options[0].action).toBe('keep_setup');
  });

  test('winning with defensive mentality and 5-4-1 formation only offers keep', () => {
    const options = generateDecisionOptions(1, 3, 0, fitSquad, '5-4-1', 'defensive');

    expect(options.length).toBe(1);
    expect(options[0].action).toBe('keep_setup');
  });

  test('tied with balanced mentality and default formation offers keep + formation', () => {
    const options = generateDecisionOptions(1, 1, 1, fitSquad, '4-4-2', 'balanced');

    const formationOption = options.find((o) => o.formation === '4-3-3');
    expect(formationOption).toBeDefined();
    expect(options[options.length - 1].action).toBe('keep_setup');
  });
});

// ─── buildDecisionTurn ──────────────────────────────────────────────────────

describe('buildDecisionTurn', () => {
  test('returns valid DecisionTurn with correct minute/label for turn 0', () => {
    const turn = buildDecisionTurn(0, 1, 1, fitSquad, '4-3-3', 'balanced', false);

    expect(turn.turnNumber).toBe(0);
    expect(turn.minute).toBe(0);
    expect(turn.label).toBe('Pré-jogo');
    expect(turn.timerSeconds).toBe(30);
    expect(turn.options).toBeDefined();
    expect(turn.defaultOption).toBeDefined();
  });

  test('returns valid DecisionTurn with correct minute/label for turn 3', () => {
    const turn = buildDecisionTurn(3, 1, 1, fitSquad, '4-3-3', 'balanced', false);

    expect(turn.turnNumber).toBe(3);
    expect(turn.minute).toBe(45);
    expect(turn.label).toBe('Intervalo');
  });

  test('returns valid DecisionTurn with correct minute/label for turn 5', () => {
    const turn = buildDecisionTurn(5, 1, 1, fitSquad, '4-3-3', 'balanced', false);

    expect(turn.turnNumber).toBe(5);
    expect(turn.minute).toBe(75);
    expect(turn.label).toBe('Retas finais');
  });

  test('throws for invalid turn number (negative)', () => {
    expect(() => buildDecisionTurn(-1, 1, 1, fitSquad, '4-3-3', 'balanced', false)).toThrow(
      'Invalid turn number'
    );
  });

  test('throws for invalid turn number (too high)', () => {
    expect(() => buildDecisionTurn(99, 1, 1, fitSquad, '4-3-3', 'balanced', false)).toThrow(
      'Invalid turn number'
    );
  });

  test('includes red card default when hasRedCard is true', () => {
    const turn = buildDecisionTurn(1, 1, 1, fitSquad, '4-3-3', 'balanced', true);

    expect(turn.defaultOption.id).toBe('default_red_card');
    expect(turn.defaultOption.action).toBe('substitution');
  });

  test('includes losing default when score diff is -2', () => {
    const turn = buildDecisionTurn(1, 0, 2, fitSquad, '4-3-3', 'balanced', false);

    expect(turn.defaultOption.id).toBe('default_losing');
    expect(turn.defaultOption.mentality).toBe('attacking');
  });
});

// ─── createTurnResult ───────────────────────────────────────────────────────

describe('createTurnResult', () => {
  const defaultOption: DecisionOption = {
    id: 'default_normal',
    label: 'Manter como está',
    description: 'Default',
    icon: '✅',
    action: 'keep_setup',
    category: 'tactical',
  };

  test('null decision creates default result with wasDefault=true', () => {
    const result = createTurnResult(1, 15, null, defaultOption);

    expect(result.turnNumber).toBe(1);
    expect(result.minute).toBe(15);
    expect(result.wasDefault).toBe(true);
    expect(result.decision).toEqual(defaultOption);
  });

  test('valid decision creates result with wasDefault=false', () => {
    const decision: DecisionOption = {
      id: 'turn_1_attacking',
      label: 'Subir a marcação',
      description: 'Go attacking',
      icon: '⚔️',
      action: 'change_mentality',
      category: 'mentality',
      mentality: 'attacking',
    };

    const result = createTurnResult(1, 15, decision, defaultOption);

    expect(result.wasDefault).toBe(false);
    expect(result.decision).toEqual(decision);
  });

  test('correctly extracts mentalityShift from change_mentality action', () => {
    const decision: DecisionOption = {
      id: 'turn_1_attacking',
      label: 'Subir a marcação',
      description: 'Go attacking',
      icon: '⚔️',
      action: 'change_mentality',
      category: 'mentality',
      mentality: 'attacking',
    };

    const result = createTurnResult(1, 15, decision, defaultOption);

    expect(result.mentalityShift).toBe('attacking');
    expect(result.formationChange).toBeUndefined();
    expect(result.substitution).toBeUndefined();
  });

  test('correctly extracts formationChange from change_formation action', () => {
    const decision: DecisionOption = {
      id: 'turn_1_formation',
      label: 'Formação 4-3-3',
      description: 'Change formation',
      icon: '📐',
      action: 'change_formation',
      category: 'formation',
      formation: '4-3-3',
    };

    const result = createTurnResult(1, 15, decision, defaultOption);

    expect(result.formationChange).toBe('4-3-3');
    expect(result.mentalityShift).toBeUndefined();
    expect(result.substitution).toBeUndefined();
  });

  test('correctly extracts substitution from substitution action', () => {
    const decision: DecisionOption = {
      id: 'turn_1_sub',
      label: 'Substitution',
      description: 'Swap players',
      icon: '🔄',
      action: 'substitution',
      category: 'substitution',
      substituteOut: 'p1',
      substituteIn: 'p2',
    };

    const result = createTurnResult(1, 15, decision, defaultOption);

    expect(result.substitution).toEqual({ out: 'p1', in: 'p2' });
    expect(result.mentalityShift).toBeUndefined();
    expect(result.formationChange).toBeUndefined();
  });

  test('substitution without both substituteOut and substituteIn does not set substitution', () => {
    const decision: DecisionOption = {
      id: 'turn_1_sub',
      label: 'Substitution',
      description: 'Swap players',
      icon: '🔄',
      action: 'substitution',
      category: 'substitution',
      substituteOut: 'p1',
    };

    const result = createTurnResult(1, 15, decision, defaultOption);

    expect(result.substitution).toBeUndefined();
  });

  test('keep_setup action does not set mentalityShift, formationChange, or substitution', () => {
    const result = createTurnResult(1, 15, defaultOption, defaultOption);

    expect(result.mentalityShift).toBeUndefined();
    expect(result.formationChange).toBeUndefined();
    expect(result.substitution).toBeUndefined();
  });
});

// ─── applyTurnResult ────────────────────────────────────────────────────────

describe('applyTurnResult', () => {
  const baseState = {
    formation: '4-3-3',
    mentality: 'balanced' as TurnMentality,
    squad: [
      makePlayer({ id: 'p1', name: 'Player 1' }),
      makePlayer({ id: 'p2', name: 'Player 2' }),
      makePlayer({ id: 'p3', name: 'Player 3' }),
    ],
  };

  test('mentality shift updates mentality', () => {
    const result = applyTurnResult(
      {
        turnNumber: 1,
        minute: 15,
        decision: null,
        wasDefault: true,
        mentalityShift: 'attacking',
      },
      baseState
    );

    expect(result.mentality).toBe('attacking');
    expect(result.formation).toBe('4-3-3');
    expect(result.squad).toEqual(baseState.squad);
  });

  test('formation change updates formation', () => {
    const result = applyTurnResult(
      {
        turnNumber: 1,
        minute: 15,
        decision: null,
        wasDefault: true,
        formationChange: '4-4-2',
      },
      baseState
    );

    expect(result.formation).toBe('4-4-2');
    expect(result.mentality).toBe('balanced');
  });

  test('substitution does not modify squad (substitution is logged only)', () => {
    const result = applyTurnResult(
      {
        turnNumber: 1,
        minute: 15,
        decision: null,
        wasDefault: true,
        substitution: { out: 'p1', in: 'p3' },
      },
      baseState
    );

    expect(result.squad).toEqual(baseState.squad)
  });

  test('substitution with invalid player IDs does not modify squad', () => {
    const result = applyTurnResult(
      {
        turnNumber: 1,
        minute: 15,
        decision: null,
        wasDefault: true,
        substitution: { out: 'nonexistent', in: 'p1' },
      },
      baseState
    );

    expect(result.squad).toEqual(baseState.squad);
  });

  test('substitution with both invalid IDs does not modify squad', () => {
    const result = applyTurnResult(
      {
        turnNumber: 1,
        minute: 15,
        decision: null,
        wasDefault: true,
        substitution: { out: 'a', in: 'b' },
      },
      baseState
    );

    expect(result.squad).toEqual(baseState.squad);
  });

  test('no changes returns same state', () => {
    const result = applyTurnResult(
      {
        turnNumber: 1,
        minute: 15,
        decision: null,
        wasDefault: true,
      },
      baseState
    );

    expect(result.formation).toBe('4-3-3');
    expect(result.mentality).toBe('balanced');
    expect(result.squad).toEqual(baseState.squad);
  });

  test('both mentality and formation change together', () => {
    const result = applyTurnResult(
      {
        turnNumber: 1,
        minute: 15,
        decision: null,
        wasDefault: true,
        mentalityShift: 'defensive',
        formationChange: '5-4-1',
      },
      baseState
    );

    expect(result.mentality).toBe('defensive');
    expect(result.formation).toBe('5-4-1');
  });

  test('does not mutate original squad array', () => {
    const originalSquad = [...baseState.squad];
    applyTurnResult(
      {
        turnNumber: 1,
        minute: 15,
        decision: null,
        wasDefault: true,
        substitution: { out: 'p1', in: 'p3' },
      },
      baseState
    );

    expect(baseState.squad).toEqual(originalSquad);
  });
});
