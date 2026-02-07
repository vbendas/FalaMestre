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
}

export interface Squad {
  players: Player[];
  formation: string;
  morale: number;
  fitness: number;
}

export interface Match {
  opponent: string;
  isHome: boolean;
  date: string;
  competition: string;
}

export interface GameState {
  user: {
    id: string;
    team: string;
    level: number;
    sociosPoints: number;
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
    pendingDecisions: any[];
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
