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
  opponent: string;
  isHome: boolean;
  date: string;
  competition: string;
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
    sociosPoints: number;
    matchSettings?: MatchSettings;
  };
  season: {
    week: number;
    league: string;
    position: number;
    points: number;
    wins: number;
    draws: number;
    losses: number;
    nextMatch: Match;
  };
  squad: Squad;
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
