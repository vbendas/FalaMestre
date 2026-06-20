/**
 * Game constants for Fala Mestre!
 * Centralized configuration values to avoid magic numbers
 */

import { MatchSettings, TierDivision, StaffSpecialty, InvestmentTier, PredictionType, TurnConfig, TurnMentality, TacticalInstruction, TacticalInstructionType } from './types';

// Match simulation constants
export const MATCH_CONSTANTS = {
  DURATION_MINUTES: 90,
  HOME_ADVANTAGE_MULTIPLIER: 1.1,
  BASE_HOME_GOAL_PROBABILITY: 0.1,
  BASE_AWAY_GOAL_PROBABILITY: 0.05,
  MAX_GOAL_PROBABILITY: 0.4,
  YELLOW_CARD_PROBABILITY: 0.0015,
  RED_CARD_PROBABILITY: 0.0003,
} as const;

// VR Mode game clock timing
// 3 real seconds = 1 game minute (90 min match = 4.5 real minutes)
export const GAME_TIMING = {
  REAL_SECONDS_PER_GAME_MINUTE: 3,
  GAME_MINUTES_PER_MATCH: 90,
  GAME_SECONDS_PER_MATCH: 5400, // 90 × 60
  REAL_SECONDS_PER_MATCH: 270, // 90 × 3
  REAL_SECONDS_PER_GAME_SECOND: 0.05, // 3 / 60
  GAME_SECONDS_PER_REAL_SECOND: 20, // 60 / 3
} as const;

// Player rating constraints
export const PLAYER_RATINGS = {
  MIN: 50,
  MAX: 99,
  BASE_GK: 70,
  BASE_DEF: 68,
  BASE_MID: 72,
  BASE_FWD: 75,
  VARIANCE: 7,
} as const;

// Squad constraints
export const SQUAD_CONSTANTS = {
  SIZE: 11,
  MIN_MORALE: 30,
  MAX_MORALE: 100,
  MIN_FITNESS: 0,
  MAX_FITNESS: 100,
  DEFAULT_MORALE: 75,
  DEFAULT_FITNESS: 100,
  FORMATION: '4-3-3',
  POSITIONS: {
    GK: 1,
    DEF: 4,
    MID: 3,
    FWD: 3,
  },
} as const;

// Season constants
export const SEASON_CONSTANTS = {
  TOTAL_ROUNDS: 38,
  INITIAL_POSITION: 10,
  INITIAL_POINTS: 0,
  INITIAL_DIVISION: 'Serie D' as TierDivision,
  WIN_POINTS: 3,
  DRAW_POINTS: 1,
  LOSS_POINTS: 0,
} as const;

// Match rewards (now handled dynamically by tier)
// Morale changes
export const REWARD_CONSTANTS = {
  MORALE_CHANGE_WIN: 10,
  MORALE_CHANGE_DRAW: 0,
  MORALE_CHANGE_LOSS: -10,
  MORALE_MIN: 30,
  MORALE_MAX: 100,
} as const;

// Position weights for team power calculation
export const POSITION_WEIGHTS = {
  GK: 0.8,
  DEF: 1.0,
  MID: 1.1,
  FWD: 1.2,
} as const;

// Hidden attribute ranges
export const ATTRIBUTE_RANGES = {
  POTENTIAL: { MIN: 80, MAX: 95 },
  CONSISTENCY: { MIN: 60, MAX: 90 },
  BIG_MATCH_PLAYER: { MIN: 50, MAX: 90 },
  LEADERSHIP: { MIN: 40, MAX: 80 },
  INJURY_PRONENESS: { MIN: 20, MAX: 50 },
} as const;

// Opponent settings
export const OPPONENT_CONSTANTS = {
  MIN_MORALE: 55,
  MAX_MORALE: 85,
} as const;

// API and timing constants
export const API_CONSTANTS = {
  AI_TIMEOUT_MS: 8000,
  MOCK_LATENCY_MIN: 300,
  MOCK_LATENCY_MAX: 800,
} as const;

// User ID format
export const USER_ID_FORMAT = {
  PREFIX: 'user',
  LENGTH: 9,
  PATTERN: /^user_[a-z0-9]{9}$/,
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  MESSAGE_MAX_LENGTH: 2000,
  USER_ID_MAX_LENGTH: 100,
} as const;

// Event density configuration
export const EVENT_DENSITY_CONFIG = {
  minimal: { 
    eventMultiplier: 0.3, 
    throttleLimit: 1, 
    throttleWindow: 5,
    description: '30% events - Relaxed pace',
  },
  standard: { 
    eventMultiplier: 0.5, 
    throttleLimit: 2, 
    throttleWindow: 5,
    description: '50% events - Balanced',
  },
  enhanced: { 
    eventMultiplier: 0.8, 
    throttleLimit: 3, 
    throttleWindow: 5,
    description: '80% events - Intense',
  },
  maximum: { 
    eventMultiplier: 1.0, 
    throttleLimit: 5, 
    throttleWindow: 5,
    description: '100% events - Full action',
  },
} as const;

// Animation quality configuration
export const ANIMATION_CONFIG = {
  low: {
    duration: 0.2,
    springPhysics: false,
    complexAnimations: false,
    enableLottie: false,
    maxSimultaneousAnimations: 2,
    description: 'Performance optimized',
  },
  medium: {
    duration: 0.3,
    springPhysics: true,
    complexAnimations: true,
    enableLottie: true,
    maxSimultaneousAnimations: 5,
    description: 'Balanced quality',
  },
  high: {
    duration: 0.5,
    springPhysics: true,
    complexAnimations: true,
    enableLottie: true,
    maxSimultaneousAnimations: 10,
    description: 'Best visual experience',
  },
} as const;

// Narration speed configuration (milliseconds per match minute)
// 3 real seconds = 1 game minute (as per user requirement)
export const NARRATION_SPEED_CONFIG = {
  slow: { msPerMinute: 6000, description: 'Slow - 6 real seconds per game minute' },
  normal: { msPerMinute: 3000, description: 'Normal - 3 real seconds per game minute' },
  fast: { msPerMinute: 1500, description: 'Fast - 1.5 real seconds per game minute' },
} as const;

// Tier/Division system
export const TIER_CONSTANTS = {
  'Serie D': {
    name: 'Serie D',
    order: 0,
    ticketPrice: 50,
    winPrize: 25000,
    drawPrize: 10000,
    lossPrize: 2500,
    weeklyEstEarnings: 40000,
    championshipWinner: 250000,
    championshipSecond: 100000,
    championshipThird: 50000,
    promotionPrize: 50000,
  },
  'Serie C': {
    name: 'Serie C',
    order: 1,
    ticketPrice: 150,
    winPrize: 100000,
    drawPrize: 40000,
    lossPrize: 10000,
    weeklyEstEarnings: 200000,
    championshipWinner: 1000000,
    championshipSecond: 400000,
    championshipThird: 200000,
    promotionPrize: 200000,
  },
  'Serie B': {
    name: 'Serie B',
    order: 2,
    ticketPrice: 500,
    winPrize: 500000,
    drawPrize: 200000,
    lossPrize: 50000,
    weeklyEstEarnings: 1000000,
    championshipWinner: 5000000,
    championshipSecond: 2000000,
    championshipThird: 1000000,
    promotionPrize: 1000000,
  },
  'Serie A': {
    name: 'Serie A',
    order: 3,
    ticketPrice: 1500,
    winPrize: 2500000,
    drawPrize: 1000000,
    lossPrize: 250000,
    weeklyEstEarnings: 5000000,
    championshipWinner: 25000000,
    championshipSecond: 10000000,
    championshipThird: 5000000,
    promotionPrize: 5000000,
  },
} as const;

// Economy constants
export const ECONOMY_CONSTANTS = {
  INITIAL_MONEY: 100000,
  FIRST_STADIUM_COST: 50000,
  FIRST_STADIUM_CAPACITY: 100,
  TICKET_REVENUE_SHARE: 0.7, // 30% goes to league/operating costs
  BASE_ATTENDANCE: 0.7,
  PLAYER_SELL_VALUE_RATIO: 0.5, // Sell at 50% of purchase value
  
  // Youth Academy
  YOUTH_INTAKE_INTERVAL_WEEKS: 4,
  YOUTH_INITIAL_AGE: 16,
  YOUTH_MIN_CURRENT_ABILITY: 50,
  YOUTH_MAX_CURRENT_ABILITY: 65,
  YOUTH_MIN_POTENTIAL: 75,
  YOUTH_MAX_POTENTIAL: 90,
  
  // Training
  TRAINING_ATTR_GROWTH_PER_SESSION: 3,
  MAX_TRAININGS_PER_PLAYER_WEEK: 3,
  WEEKLY_TRAINING_BUDGET: 15,
  
  // Daily Rewards (7-day cycle)
  DAILY_REWARD_BASE: [5000, 7500, 10000, 15000, 20000, 30000, 50000],
  STREAK_BONUS_MULTIPLIER: 0.1, // 10% bonus per consecutive day
} as const;

// Stadium upgrade costs (exponential)
export const STADIUM_UPGRADES = [
  { level: 0, capacity: 0, cost: 0, ticketPrice: 0 },
  { level: 1, capacity: 100, cost: 50000, ticketPrice: 50 },
  { level: 2, capacity: 500, cost: 250000, ticketPrice: 80 },
  { level: 3, capacity: 2000, cost: 1500000, ticketPrice: 120 },
  { level: 4, capacity: 5000, cost: 8000000, ticketPrice: 180 },
  { level: 5, capacity: 10000, cost: 40000000, ticketPrice: 250 },
  { level: 6, capacity: 25000, cost: 200000000, ticketPrice: 350 },
  { level: 7, capacity: 50000, cost: 1000000000, ticketPrice: 500 },
  { level: 8, capacity: 100000, cost: 5000000000, ticketPrice: 750 },
  { level: 9, capacity: 150000, cost: 25000000000, ticketPrice: 1000 },
  { level: 10, capacity: 200000, cost: 100000000000, ticketPrice: 1500 },
] as const;

// Facility upgrade costs
export const FACILITY_UPGRADES = {
  trainingCenter: {
    baseCost: 500000,
    costMultiplier: 2.5,
    maxLevel: 100,
    effectPerLevel: 2, // +2% attr growth per level
  },
  medicalCenter: {
    baseCost: 300000,
    costMultiplier: 2.5,
    maxLevel: 100,
    effectPerLevel: 2, // -2% injury days per level
  },
  youthAcademy: {
    baseCost: 1000000,
    costMultiplier: 2.5,
    maxLevel: 50,
    effectPerLevel: 0.2, // +0.2 youth players per intake per 10 levels
  },
  scoutOffice: {
    baseCost: 500000,
    costMultiplier: 2.5,
    maxLevel: 100,
    effectPerLevel: 2, // +2% player discovery quality per level
  },
} as const;

// Staff hiring options
export const STAFF_TIERS = {
  rookie: { levelRange: [1, 10], wageMultiplier: 1 },
  professional: { levelRange: [11, 30], wageMultiplier: 3 },
  elite: { levelRange: [31, 50], wageMultiplier: 8 },
} as const;

export const STAFF_WAGES = {
  headCoach: { base: 20000, perLevel: 400000 },
  scout: { base: 15000, perLevel: 300000 },
  medicalStaff: { base: 10000, perLevel: 200000 },
} as const;

export const STAFF_SPECIALTIES: Record<string, StaffSpecialty[]> = {
  headCoach: ['development', 'technical', 'physical', 'tactical'],
  scout: ['scouting', 'technical', 'tactical'],
  medicalStaff: ['injuryPrevention', 'medical', 'development'],
} as const;

// Player value calculation
export const PLAYER_VALUE = {
  BASE: 5000,
  OVR_SQUARED_FACTOR: 0.01,
  AGE_BONUS_THRESHOLD: 80,
  AGE_BONUS_MULTIPLIER: 1.5,
  RANDOM_FACTOR: 30,
  
  // Weekly wage calculation
  WAGE_PER_OVR: 500,
} as const;

// =====================================================
// PREDICTION MARKET CONSTANTS
// =====================================================

export const PREDICTION_MARKET = {
  // Entry costs by type
  ENTRY_COSTS: {
    win_draw_loss: 50000,
    first_scorer: 75000,
    clean_sheet: 50000,
    score_range: 100000,
  } as Record<PredictionType, number>,
  
  // Odds configuration
  ODDS: {
    MIN: 1.2,
    MAX: 4.0,
    BASE: 2.0, // Even odds
  },
  
  // Streak multipliers for payouts
  STREAK_MULTIPLIERS: {
    0: 1.0,
    3: 1.1,
    5: 1.25,
    10: 1.5,
    20: 2.0,
  } as Record<number, number>,
  
  // Expert fan levels
  EXPERT_LEVELS: [
    { level: 0, name: 'Iniciante', minStreak: 0 },
    { level: 1, name: 'Apostador', minStreak: 3 },
    { level: 2, name: 'Torcedor Experiente', minStreak: 5 },
    { level: 3, name: 'Especialista', minStreak: 10 },
    { level: 4, name: 'Mestre das Apostas', minStreak: 20 },
    { level: 5, name: 'Lenda do Predit', minStreak: 50 },
  ],
  
  // Discount on entry fee per expert level
  EXPERT_DISCOUNT_PER_LEVEL: 0.05, // 5% discount per level
  
  // Prediction window (hours before match)
  PREDICTION_WINDOW_HOURS: 1,
  
  // Maximum bet per prediction
  MAX_BET_AMOUNT: 1000000,
  
  // Minimum bet amount
  MIN_BET_AMOUNT: 10000,
} as const;

// =====================================================
// FAN CLUB INVESTMENT CONSTANTS
// =====================================================

export const INVESTMENT_TIERS: Record<string, InvestmentTier> = {
  A: {
    option: 'A',
    amount: 50000,
    lockPeriodDays: 3,
    yieldPerDay: 10000,
    moraleBoost: 2,
    revenueBoostPerMatch: 15000,
  },
  B: {
    option: 'B',
    amount: 100000,
    lockPeriodDays: 7,
    yieldPerDay: 25000,
    moraleBoost: 5,
    revenueBoostPerMatch: 30000,
  },
  C: {
    option: 'C',
    amount: 500000,
    lockPeriodDays: 30,
    yieldPerDay: 100000,
    moraleBoost: 15,
    revenueBoostPerMatch: 150000,
  },
} as const;

export const INVESTMENT_CONFIG = {
  // Yield expiry in days (7 days as per spec)
  YIELD_EXPIRY_DAYS: 7,
  
  // Days to claim after expiry (grace period before lost)
  CLAIM_GRACE_PERIOD_DAYS: 2,
  
  // Daily yield generation time (UTC)
  DAILY_YIELD_HOUR: 0, // Midnight
  
  // Maximum active investments per user
  MAX_ACTIVE_INVESTMENTS: 3,
} as const;

// =====================================================
// ELITE CONTENT CONSTANTS
// =====================================================

export const ELITE_CONTENT = {
  // Training multiplier
  TRAINING_MULTIPLIER: 2.0,
  
  // Recovery multiplier
  RECOVERY_MULTIPLIER: 2.0,
  
  // Unlock criteria
  UNLOCK_CRITERIA: {
    eliteTraining: {
      winsRequired: 10,
      investmentOptionRequired: 'C',
    },
    fastRecovery: {
      winsStreakRequired: 5,
      investmentOptionRequired: 'B',
    },
  },
} as const;

// =====================================================
// TOURNAMENT CONSTANTS
// =====================================================

interface TournamentConfig {
  id: string;
  name: string;
  description: string;
  prizeType: 'jersey' | 'fan_tokens' | 'game_currency';
  prizeValue: number;
  entryTicketCost: number;
  scheduledDate: string;
  maxParticipants: number;
  participants: number;
}

export const SPECIAL_TOURNAMENTS: Record<string, TournamentConfig> = {
  COPA_BRASIL_DA_MASSA: {
    id: 'copa_brasil_da_massa',
    name: 'Copa Brasil da Massa',
    description: 'Torneio especial para torcedores dedicados',
    prizeType: 'jersey',
    prizeValue: 1,
    entryTicketCost: 1,
    scheduledDate: '2026-02-15',
    maxParticipants: 1000,
    participants: 0,
  },
  COPA_SOCIOS_SEMIFINAL: {
    id: 'copa_socios_semifinal',
    name: 'Copa Socios - Semifinal',
    description: 'Semifinal do torneo oficial',
    prizeType: 'fan_tokens',
    prizeValue: 500,
    entryTicketCost: 1,
    scheduledDate: '2026-03-01',
    maxParticipants: 500,
    participants: 0,
  },
  COPA_SOCIOS_FINAL: {
    id: 'copa_socios_final',
    name: 'Copa Socios - Final',
    description: 'Final do torneo-promocional com premiacoes exclusivas',
    prizeType: 'fan_tokens',
    prizeValue: 1000,
    entryTicketCost: 1,
    scheduledDate: '2026-03-15',
    maxParticipants: 100,
    participants: 0,
  },
} as const;

export const TICKET_EARNING_METHODS = {
  WIN_5_MATCHES_STREAK: {
    method: 'win_5_matches_streak',
    tickets: 1,
    description: 'Venca 5 partidas consecutivas',
  },
  FINISH_TOP_4_LEAGUE: {
    method: 'finish_top_4_league',
    tickets: 1,
    description: 'Termine entre os 4 primeiros do Campeonato',
  },
  COMPLETE_SEASON_UNBEATEN: {
    method: 'complete_season_unbeaten',
    tickets: 2,
    description: 'Complete uma temporada sem derrotas',
  },
  REFER_FRIEND_5_MATCHES: {
    method: 'refer_friend_5_matches',
    tickets: 1,
    description: 'Indique um amigo que jogue 5 partidas',
  },
} as const;

// =====================================================
// PHASE SYSTEM CONSTANTS
// =====================================================

export const PHASE_CONFIG = {
  // Phase transition triggers
  PHASE_2_UNLOCK: {
    matchesRequired: 10,
    description: 'Complete 10 partidas para desbloquear',
  },
  PHASE_3_UNLOCK: {
    predictionsWonRequired: 5,
    hoursPlayedRequired: 20,
    description: 'Ganhe 5 previsoes ou jogue 20 horas',
  },
  PHASE_4_UNLOCK: {
    ticketsRequired: 1,
    description: 'Obtenha um ticket de torneo',
  },
} as const;

// =====================================================
// DECISION TURN CONSTANTS
// =====================================================

export const DECISION_TURN_CONFIG = {
  TIMER_SECONDS: 30,
  MAX_OPTIONS: 8,
  TOTAL_TURNS: 6,
} as const;

export const DECISION_TURNS: TurnConfig[] = [
  {
    minute: 0,
    label: 'Pré-jogo',
    defaultAction: 'keep_setup',
    defaultLabel: 'Manter escalação',
  },
  {
    minute: 15,
    label: 'Primeiros 15 minutos',
    defaultAction: 'keep_setup',
    defaultLabel: 'Manter como está',
  },
  {
    minute: 30,
    label: 'Avaliação tática',
    defaultAction: 'keep_setup',
    defaultLabel: 'Manter estratégia',
  },
  {
    minute: 45,
    label: 'Intervalo',
    defaultAction: 'keep_setup',
    defaultLabel: 'Voltar igual',
  },
  {
    minute: 60,
    label: 'Segundo tempo',
    defaultAction: 'keep_setup',
    defaultLabel: 'Manter como está',
  },
  {
    minute: 75,
    label: 'Retas finais',
    defaultAction: 'keep_setup',
    defaultLabel: 'Segurar resultado',
  },
] as const;

export const DEFAULT_ACTIONS_BY_CONTEXT = {
  LOSING_BY_2PLUS: {
    action: 'change_mentality' as const,
    mentality: 'attacking' as const,
    label: 'Partir para o ataque',
  },
  WINNING_BY_2PLUS: {
    action: 'change_mentality' as const,
    mentality: 'defensive' as const,
    label: 'Proteger o resultado',
  },
  LOW_FITNESS: {
    action: 'substitution' as const,
    label: 'Trocar jogador cansado',
  },
  RED_CARD: {
    action: 'substitution' as const,
    label: 'Preencher vaga',
  },
  NORMAL: {
    action: 'keep_setup' as const,
    label: 'Manter como está',
  },
} as const;

export const MENTALITY_MODIFIERS = {
  attacking: {
    homeGoalMultiplier: 1.3,
    awayGoalMultiplier: 1.15,
    description: 'Mais ofensivo, mas vulnerável no contra-ataque',
  },
  balanced: {
    homeGoalMultiplier: 1.0,
    awayGoalMultiplier: 1.0,
    description: 'Equilíbrio entre ataque e defesa',
  },
  defensive: {
    homeGoalMultiplier: 0.7,
    awayGoalMultiplier: 0.8,
    description: 'Prioriza a defesa, menos chances de gol',
  },
} as const;

export const TACTICAL_INSTRUCTIONS: Record<TacticalInstructionType, TacticalInstruction> = {
  high_press: {
    type: 'high_press',
    statModifiers: { phy: 5, def: 3 },
    teamPowerMultiplier: 1.05,
    opponentPowerMultiplier: 0.93,
    description: 'Pressão alta — recupera a bola rápido, mas gasta energia',
    riskFactor: 0.3,
  },
  park_the_bus: {
    type: 'park_the_bus',
    statModifiers: { def: 10, phy: 5 },
    teamPowerMultiplier: 0.95,
    opponentPowerMultiplier: 0.85,
    description: 'Bloco baixo — máxima proteção defensiva',
    riskFactor: 0.05,
  },
  tiki_taka: {
    type: 'tiki_taka',
    statModifiers: { pas: 10, dri: 5 },
    teamPowerMultiplier: 1.04,
    opponentPowerMultiplier: 1.0,
    description: 'Tique-taque — controle o ritmo do jogo com passes curtos',
    riskFactor: 0.15,
  },
  counter_attack: {
    type: 'counter_attack',
    statModifiers: { pac: 10, sho: 5 },
    teamPowerMultiplier: 1.02,
    opponentPowerMultiplier: 1.0,
    description: 'Contra-ataque rápido — velocidade e oportunismo',
    riskFactor: 0.4,
  },
  long_balls: {
    type: 'long_balls',
    statModifiers: { phy: 8, sho: 3 },
    teamPowerMultiplier: 1.0,
    opponentPowerMultiplier: 1.0,
    description: 'Bolas longas — jogo direto e físico',
    riskFactor: 0.2,
  },
  wing_play: {
    type: 'wing_play',
    statModifiers: { pac: 8, dri: 5 },
    teamPowerMultiplier: 1.03,
    opponentPowerMultiplier: 1.0,
    description: 'Jogo pelas laterais — cruzamentos e velocidade',
    riskFactor: 0.25,
  },
  shoot_on_sight: {
    type: 'shoot_on_sight',
    statModifiers: { sho: 10, pas: 3 },
    teamPowerMultiplier: 1.02,
    opponentPowerMultiplier: 1.0,
    description: 'Finalizar de qualquer posição — mais chutes, menos precisão',
    riskFactor: 0.35,
  },
  time_wasting: {
    type: 'time_wasting',
    statModifiers: { pas: 5, dri: 3 },
    teamPowerMultiplier: 0.92,
    opponentPowerMultiplier: 0.95,
    description: 'Cera — segurar o resultado consumindo tempo',
    riskFactor: 0.0,
  },
  target_man: {
    type: 'target_man',
    statModifiers: { phy: 8, sho: 5 },
    teamPowerMultiplier: 1.02,
    opponentPowerMultiplier: 1.0,
    description: 'Jogo no pivô — bola no atacante e tabelas',
    riskFactor: 0.2,
  },
  free_role: {
    type: 'free_role',
    statModifiers: { dri: 8, pac: 5, sho: 3 },
    teamPowerMultiplier: 1.03,
    opponentPowerMultiplier: 1.0,
    description: 'Liberdade total — criatividade e imprevisibilidade',
    riskFactor: 0.3,
  },
  man_mark: {
    type: 'man_mark',
    statModifiers: { def: 8, phy: 5 },
    teamPowerMultiplier: 0.98,
    opponentPowerMultiplier: 0.90,
    description: 'Marcação individual — neutralizar o principal atacante rival',
    riskFactor: 0.1,
  },
  overlap: {
    type: 'overlap',
    statModifiers: { pac: 6, pas: 6 },
    teamPowerMultiplier: 1.04,
    opponentPowerMultiplier: 1.0,
    description: 'Sobreposição — laterais avançando no ataque',
    riskFactor: 0.35,
  },
};
