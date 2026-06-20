export type FormState = 'hot' | 'good' | 'average' | 'poor' | 'cold';
export type InjuryType = 'minor' | 'moderate' | 'severe' | null;

// Match event types for rich narration
export type EventIntensity = 'low' | 'medium' | 'high' | 'dramatic';
export type ShotType = 'header' | 'volley' | 'free_kick' | 'penalty' | 'long_range' | 'normal';
export type DefensiveAction = 'tackle' | 'block' | 'interception' | 'save';
export type EventType = 'goal' | 'save' | 'miss' | 'foul' | 'corner' | 
                       'substitution' | 'card' | 'whistle' | 'pressure' | 
                       'buildup' | 'commentary' | 'tension' | 'kickoff' | 'halftime';

export interface MatchEventStats {
  shotType?: ShotType;
  distance?: number;
  wasSave?: boolean;
  wasPost?: boolean;
  wasBar?: boolean;
  defensiveAction?: DefensiveAction;
  isPenalty?: boolean;
  isFreeKick?: boolean;
}

export interface MatchEvent {
  id: string;
  minute: number;
  type: EventType;
  team: 'home' | 'away';
  player?: Player;
  assistPlayer?: Player;
  description: string;
  intensity: EventIntensity;
  highlight: boolean;
  commentary: string;
  momentum: number; // -100 to +100, affects team morale
  stats?: MatchEventStats;
}

export type ActionType = 'kickoff' | 'pass' | 'dribble' | 'shot' | 'header' | 'tackle' | 'foul' | 'corner' | 'freekick' | 'goal' | 'celebration' | 'throwin' | 'offside' | 'save' | 'miss' | 'buildup' | 'pressure';

export interface PlayerPosition {
  x: number;
  z: number;
}

export interface GameAction {
  id: string;
  minute: number;
  actionType: ActionType;
  team: 'home' | 'away';
  
  ballPosition: PlayerPosition;
  ballTargetPosition?: PlayerPosition;
  ballHeight: number;
  
  playerId?: string;
  playerName?: string;
  playerPosition?: PlayerPosition;
  
  targetPlayerId?: string;
  targetPlayerPosition?: PlayerPosition;
  
  homePlayerPositions: Record<string, PlayerPosition>;
  awayPlayerPositions: Record<string, PlayerPosition>;
  
  animation: string;
  duration: number;
  
  commentaryId?: string;
}

export interface MatchScript {
  matchId: string;
  actions: GameAction[];
  totalActions: number;
  // Enhanced data for VR mode with 5400 movement events
  _enhanced?: EnhancedMatchScript;
}

export interface MatchContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  homeMomentum: number;
  awayMomentum: number;
  tension: number; // 0-100, increases near end of close games
  lastEvent?: MatchEvent;
  eventCount: number;
  possession: { home: number; away: number };
  homeTeam: string;
  awayTeam: string;
  isHome: boolean;
}

export interface Player {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  pac: number; // Pace
  sho: number; // Shooting
  pas: number; // Passing
  dri: number; // Dribbling
  def: number; // Defending
  phy: number; // Physical
  potential: number;
  consistency: number;
  bigMatchPlayer: number;
  leadership: number;
  injuryProneness: number;
  // Training system fields
  fatigue: number; // 0-100
  currentForm: FormState;
  weeklyTrainingCount: number; // 0-3
  isInjured: boolean;
  injuryWeeksRemaining: number;
  injuryType: InjuryType;
}

export interface Squad {
  players: Player[];
  formation: string;
  morale: number;
  fitness: number;
  captainId?: string;
  // Training system fields
  weeklyTrainingBudget: number; // 15 sessions per week
  currentWeek: number; // Track week for budget reset
}

export interface Match {
  id?: string;
  opponent: string;
  isHome: boolean;
  date: string;
  competition: string;
}

export type TierDivision = 'Serie D' | 'Serie C' | 'Serie B' | 'Serie A';

export interface Stadium {
  level: number;
  capacity: number;
  amenities: number;
  ticketPrice: number;
  maintenanceLevel: number;
}

export interface FacilityLevel {
  level: number;
  upgradeCost: number;
  monthlyWage: number;
  currentEffect: number;
}

export interface Facilities {
  trainingCenter: number;
  medicalCenter: number;
  youthAcademy: number;
  scoutOffice: number;
}

export type StaffRole = 'headCoach' | 'scout' | 'medicalStaff';
export type StaffSpecialty = 'development' | 'injuryPrevention' | 'technical' | 'physical' | 'tactical' | 'scouting' | 'medical';

export interface StaffMember {
  name: string;
  level: number;
  role: StaffRole;
  specialty: StaffSpecialty;
  weeklyWage: number;
  hiredAt: number;
}

export interface Staff {
  headCoach: StaffMember | null;
  scout: StaffMember | null;
  medicalStaff: StaffMember | null;
}

export interface TeamStats {
  totalEarnings: number;
  totalSpent: number;
  matchesPlayed: number;
  championshipsWon: number;
  promotionCount: number;
}

export interface YouthPlayer {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  age: number;
  potential: number;
  currentAbility: number;
  personalityTraits: string[];
  scoutAssessment: number; // 1-5 stars
}

export type TrainingFocus = 'technical' | 'physical' | 'tactical' | null;

export interface YouthAcademy {
  nextIntakeWeek: number;
  playersAvailable: YouthPlayer[];
  trainingFocus: TrainingFocus;
  lastIntakeWeek: number;
}

export interface MatchSettings {
  eventDensity: 'minimal' | 'standard' | 'enhanced' | 'maximum';
  commentaryLevel: 'brief' | 'normal' | 'detailed';
  animationQuality: 'low' | 'medium' | 'high';
  narrationSpeed: 'slow' | 'normal' | 'fast';
}

export const MATCH_SETTINGS_DEFAULTS: MatchSettings = {
  eventDensity: 'minimal',
  commentaryLevel: 'normal',
  animationQuality: 'low',
  narrationSpeed: 'slow',
};

export interface GameState {
  user: {
    id: string;
    team: string;
    level: number;
    money: number;
    matchSettings?: MatchSettings;
  };
  season: {
    week: number;
    league: string;
    division: TierDivision;
    position: number;
    points: number;
    wins: number;
    draws: number;
    losses: number;
    nextMatch: Match;
  };
  squad: Squad;
  stadium: Stadium;
  facilities: Facilities;
  staff: Staff;
  teamStats: TeamStats;
  youthAcademy: YouthAcademy;
  context: {
    lastAction: string;
    availableActions: string[];
    pendingDecisions: string[];
    narrative: {
      lastEvent: string;
      momentum: 'home' | 'away' | 'neutral';
    };
  };
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  actions?: string[];
}

export interface Conversation {
  messages: Message[];
  gameState: GameState;
}

// VR Mode enhanced types for granular movement and ball possession tracking

export type MovementType = 
  | 'dribble'       
  | 'pass'          
  | 'run'           
  | 'position'      
  | 'shot_windup'   
  | 'shot_flight'   
  | 'clearance'     
  | 'tackle'        
  | 'idle';

export interface MovementEvent {
  gameSecond: number;              // 0-5399 (90 min × 60 sec)
  type: MovementType;
  teamWithBall: 'home' | 'away';
  playerWithBall: string;          // Player ID
  ballPosition: { x: number; z: number };
  ballHeight: number;             // 0.1-3.0 meters
  intensity: number;               // 0-1 (animation speed)
  
  // Optional - for specific event types
  passTarget?: string;            // Target player ID for passes
  targetPosition?: { x: number; z: number };
  
  // Link to commentary event if this second has one
  commentaryEventId?: string;
}

export interface EnhancedMatchScript {
  matchId: string;
  homeTeam: { id: string; name: string; formation: string };
  awayTeam: { id: string; name: string; formation: string };
  
  // Original commentary events (every 5 game minutes)
  commentary: MatchEvent[];
  
  // Granular movement events (every 1 game second = 5400 events)
  movements: MovementEvent[];
  
  // Metadata
  finalScore: { home: number; away: number };
  winner: 'home' | 'away' | 'draw';
  generatedAt: number;
}

// Game clock state for VR mode
export interface GameClock {
  realStartTime: number;
  realElapsedSeconds: number;
  gameElapsedSeconds: number;
  currentGameMinute: number;
  currentGameSecond: number;
  isPaused: boolean;
  pausedAt: number | null;
}

// =====================================================
// PREDICTION MARKET TYPES
// =====================================================

export type PredictionType = 'win_draw_loss' | 'first_scorer' | 'clean_sheet' | 'score_range';
export type PredictionStatus = 'open' | 'closed' | 'settled';

export interface PredictionOption {
  id: string;
  label: string;
  odds: number;
  totalBets: number;
  result?: 'won' | 'lost' | 'pending';
}

export interface Prediction {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  type: PredictionType;
  options: PredictionOption[];
  entryCost: number;
  deadline: string;
  status: PredictionStatus;
  settledAt?: string;
  createdAt: string;
  matchDate?: string;
}

export interface UserBet {
  id: string;
  userId: string;
  predictionId: string;
  optionId: string;
  amount: number;
  potentialWin: number;
  settled: boolean;
  won?: boolean;
  settledAt?: string;
  createdAt: string;
}

export interface PredictionHistory {
  userId: string;
  totalBets: number;
  correctBets: number;
  currentStreak: number;
  bestStreak: number;
  expertLevel: number; // 0-5
  totalWinnings: number;
  lastBetAt?: string;
}

// =====================================================
// FAN CLUB INVESTMENT TYPES
// =====================================================

export type InvestmentOption = 'A' | 'B' | 'C';

export interface FanClubInvestment {
  id: string;
  userId: string;
  option: InvestmentOption;
  amount: number;
  startDate: string;
  unlockDate: string;
  yieldPerDay: number;
  moraleBoost: number;
  revenueBoostPerMatch: number;
  active: boolean;
  createdAt: string;
}

export interface InvestmentYield {
  id: string;
  investmentId: string;
  userId: string;
  amount: number;
  createdAt: string;
  claimed: boolean;
  claimedAt?: string;
  expiryDate: string;
}

export interface InvestmentTier {
  option: InvestmentOption;
  amount: number;
  lockPeriodDays: number;
  yieldPerDay: number;
  moraleBoost: number;
  revenueBoostPerMatch: number;
}

// =====================================================
// TOURNAMENT TICKET TYPES
// =====================================================

export type PrizeType = 'jersey' | 'fan_tokens' | 'game_currency';

export interface SpecialTournament {
  id: string;
  name: string;
  description: string;
  prizeType: PrizeType;
  prizeValue: number;
  entryTicketCost: number;
  scheduledDate: string;
  maxParticipants: number;
  participants: number;
}

export interface TournamentTicket {
  id: string;
  userId: string;
  tournamentId: string;
  earned: boolean;
  earnedAt?: string;
  used: boolean;
  usedAt?: string;
}

export type TicketEarningMethod = 
  | 'win_5_matches_streak'
  | 'finish_top_4_league'
  | 'complete_season_unbeaten'
  | 'refer_friend_5_matches';

// =====================================================
// ELITE CONTENT TYPES
// =====================================================

export interface EliteContent {
  userId: string;
  eliteTrainingUnlocked: boolean;
  eliteTrainingUnlockedAt?: string;
  eliteTrainingUsesRemaining?: number;
  fastRecoveryUnlocked: boolean;
  fastRecoveryUnlockedAt?: string;
  activeInjuriesFastTracked: string[]; // Player IDs
}

export interface EliteUnlockCriteria {
  eliteTraining: {
    method: 'wins' | 'investment';
    winsRequired?: number;
    investmentOptionRequired?: InvestmentOption;
  };
  fastRecovery: {
    method: 'wins_streak' | 'investment';
    winsStreakRequired?: number;
    investmentOptionRequired?: InvestmentOption;
  };
}

// =====================================================
// PHASE SYSTEM TYPES
// =====================================================

export type Phase = 1 | 2 | 3 | 4;

export interface PhaseProgress {
  userId: string;
  currentPhase: Phase;
  phase2Unlocked: boolean;
  phase2UnlockedAt?: string;
  phase3Unlocked: boolean;
  phase3UnlockedAt?: string;
  phase4Unlocked: boolean;
  phase4UnlockedAt?: string;
  totalMatches: number;
  totalPredictions: number;
  predictionsWon: number;
  totalInvestmentMade: number;
  hoursPlayed: number;
  lastUpdated: string;
}

export interface PhaseUnlock {
  type: 'prediction_market_unlock' | 'fan_club_investment_unlock' | 'tournament_unlock';
  phase: Phase;
  priority: 'high' | 'medium';
  message: string;
}

// =====================================================
// DECISION TURN TYPES
// =====================================================

export type TurnMentality = 'attacking' | 'balanced' | 'defensive';
export type TurnAction = 'change_formation' | 'change_mentality' | 'substitution' | 'tactical_instruction' | 'keep_setup';
export type DecisionCategory = 'formation' | 'mentality' | 'substitution' | 'tactical' | 'instruction';

export type TacticalInstructionType =
  | 'high_press' | 'park_the_bus' | 'tiki_taka' | 'counter_attack'
  | 'long_balls' | 'wing_play' | 'shoot_on_sight' | 'time_wasting'
  | 'target_man' | 'free_role' | 'man_mark' | 'overlap';

export interface TacticalInstruction {
  type: TacticalInstructionType;
  targetPlayerId?: string;
  statModifiers: { pac?: number; sho?: number; pas?: number; dri?: number; def?: number; phy?: number };
  teamPowerMultiplier: number;
  opponentPowerMultiplier: number;
  description: string;
  riskFactor: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: TurnAction;
  category: DecisionCategory;
  formation?: string;
  mentality?: TurnMentality;
  substituteOut?: string;
  substituteIn?: string;
  tacticalInstruction?: TacticalInstructionType;
}

export interface TurnResult {
  turnNumber: number;
  minute: number;
  decision: DecisionOption | null;
  wasDefault: boolean;
  mentalityShift?: TurnMentality;
  formationChange?: string;
  substitution?: { out: string; in: string };
  tacticalInstruction?: TacticalInstruction;
}

export interface DecisionTurn {
  turnNumber: number;
  minute: number;
  label: string;
  options: DecisionOption[];
  defaultOption: DecisionOption;
  timerSeconds: number;
}

export interface MatchSegment {
  fromMinute: number;
  toMinute: number;
  events: MatchEvent[];
  homeScoreAtStart: number;
  awayScoreAtStart: number;
  homeScoreAtEnd: number;
  awayScoreAtEnd: number;
  turnResult?: TurnResult;
}

export interface DecisionPromptState {
  isActive: boolean;
  currentTurn: DecisionTurn | null;
  timeRemaining: number;
  segmentSummary: string;
  priorSegment: MatchSegment | null;
}

export interface TurnConfig {
  minute: number;
  label: string;
  defaultAction: TurnAction;
  defaultLabel: string;
}
