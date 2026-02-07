import { GameState, Player, Match } from './types';
import { generatePlayerId } from './utils';
import { 
  PLAYER_RATINGS, 
  SQUAD_CONSTANTS, 
  POSITION_WEIGHTS,
  ATTRIBUTE_RANGES,
  MATCH_CONSTANTS,
  SEASON_CONSTANTS
} from './constants';

// Fictional PvE teams database (IP-safe)
export const PVE_TEAMS = [
  { name: 'Leões do Norte', city: 'Norte', stadium: 'Estádio do Norte', primaryColor: '#FFD700', secondaryColor: '#008000' },
  { name: 'Falcões de Aço', city: 'Aço', stadium: 'Arena de Aço', primaryColor: '#C0C0C0', secondaryColor: '#000000' },
  { name: 'Trovão FC', city: 'Trovão', stadium: 'Estádio do Trovão', primaryColor: '#800080', secondaryColor: '#FFFFFF' },
  { name: 'Maré Alta', city: 'Maré', stadium: 'Estádio da Maré', primaryColor: '#0000FF', secondaryColor: '#00FFFF' },
  { name: 'Serra Brava', city: 'Serra', stadium: 'Estádio da Serra', primaryColor: '#FF0000', secondaryColor: '#FFA500' },
  { name: 'Estrela do Sul', city: 'Sul', stadium: 'Estádio do Sul', primaryColor: '#FFFFFF', secondaryColor: '#FFD700' },
];

// Keep BRAZILIAN_TEAMS for backwards compatibility, but use PVE_TEAMS
export const BRAZILIAN_TEAMS = PVE_TEAMS;

// Generate a random player
function generatePlayer(position: 'GK' | 'DEF' | 'MID' | 'FWD'): Player {
  const baseRating = position === 'GK' 
    ? PLAYER_RATINGS.BASE_GK 
    : position === 'DEF' 
      ? PLAYER_RATINGS.BASE_DEF 
      : position === 'MID' 
        ? PLAYER_RATINGS.BASE_MID 
        : PLAYER_RATINGS.BASE_FWD;
  const variance = Math.random() * (PLAYER_RATINGS.VARIANCE * 2) - PLAYER_RATINGS.VARIANCE;
  
  const clampRating = (value: number) => 
    Math.max(PLAYER_RATINGS.MIN, Math.min(PLAYER_RATINGS.MAX, Math.floor(value)));
  
  return {
    id: generatePlayerId(),
    name: generatePlayerName(),
    position,
    pac: clampRating(baseRating + variance),
    sho: clampRating(baseRating + variance),
    pas: clampRating(baseRating + variance),
    dri: clampRating(baseRating + variance),
    def: clampRating(baseRating + variance),
    phy: clampRating(baseRating + variance),
    potential: Math.floor(ATTRIBUTE_RANGES.POTENTIAL.MIN + Math.random() * (ATTRIBUTE_RANGES.POTENTIAL.MAX - ATTRIBUTE_RANGES.POTENTIAL.MIN)),
    consistency: Math.floor(ATTRIBUTE_RANGES.CONSISTENCY.MIN + Math.random() * (ATTRIBUTE_RANGES.CONSISTENCY.MAX - ATTRIBUTE_RANGES.CONSISTENCY.MIN)),
    bigMatchPlayer: Math.floor(ATTRIBUTE_RANGES.BIG_MATCH_PLAYER.MIN + Math.random() * (ATTRIBUTE_RANGES.BIG_MATCH_PLAYER.MAX - ATTRIBUTE_RANGES.BIG_MATCH_PLAYER.MIN)),
    leadership: Math.floor(ATTRIBUTE_RANGES.LEADERSHIP.MIN + Math.random() * (ATTRIBUTE_RANGES.LEADERSHIP.MAX - ATTRIBUTE_RANGES.LEADERSHIP.MIN)),
    injuryProneness: Math.floor(ATTRIBUTE_RANGES.INJURY_PRONENESS.MIN + Math.random() * (ATTRIBUTE_RANGES.INJURY_PRONENESS.MAX - ATTRIBUTE_RANGES.INJURY_PRONENESS.MIN)),
  };
}

function generatePlayerName(): string {
  const firstNames = ['João', 'Pedro', 'Lucas', 'Gabriel', 'Matheus', 'Rafael', 'Diego', 'Felipe', 'André', 'Bruno'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Costa'];
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

// Generate squad for a team
export function generateSquad(teamName: string): Player[] {
  const squad: Player[] = [];
  
  // Formation: 4-3-3
  // GK
  squad.push(generatePlayer('GK'));
  
  // DEF
  for (let i = 0; i < SQUAD_CONSTANTS.POSITIONS.DEF; i++) squad.push(generatePlayer('DEF'));
  
  // MID
  for (let i = 0; i < SQUAD_CONSTANTS.POSITIONS.MID; i++) squad.push(generatePlayer('MID'));
  
  // FWD
  for (let i = 0; i < SQUAD_CONSTANTS.POSITIONS.FWD; i++) squad.push(generatePlayer('FWD'));
  
  return squad;
}

// Calculate team power
export function calculateTeamPower(squad: Player[], formation: string, morale: number, fitness: number): number {
  const basePower = squad.reduce((sum, player) => {
    const positionWeight = player.position === 'GK' 
      ? POSITION_WEIGHTS.GK 
      : player.position === 'DEF' 
        ? POSITION_WEIGHTS.DEF 
        : player.position === 'MID' 
          ? POSITION_WEIGHTS.MID 
          : POSITION_WEIGHTS.FWD;
    const avgAttributes = (player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6;
    
    // Apply hidden attributes
    const consistencyMultiplier = 0.8 + (player.consistency / 100) * 0.4; // 0.8 to 1.2
    const leadershipBonus = player.leadership / 200; // 0.2 to 0.4 bonus for leadership
    
    return sum + (avgAttributes * positionWeight * consistencyMultiplier) + leadershipBonus;
  }, 0);
  
  const moraleMultiplier = morale / 100;
  const fitnessMultiplier = fitness / 100;
  
  return basePower * moraleMultiplier * fitnessMultiplier;
}

// Simulate a match
export function simulateMatch(
  homeTeam: string,
  awayTeam: string,
  homeSquad: Player[],
  awaySquad: Player[],
  homeMorale: number,
  awayMorale: number,
  week?: number
): {
  homeScore: number;
  awayScore: number;
  events: string[];
  winner: string;
} {
  // Check if it's a "big match" (last 10 weeks or top teams)
  const isBigMatch = week ? week >= 28 : false;

  const homePower = calculateTeamPower(homeSquad, SQUAD_CONSTANTS.FORMATION, homeMorale, SQUAD_CONSTANTS.MAX_FITNESS);
  const awayPower = calculateTeamPower(awaySquad, SQUAD_CONSTANTS.FORMATION, awayMorale, SQUAD_CONSTANTS.MAX_FITNESS);

  // Home advantage
  const homeAdvantage = MATCH_CONSTANTS.HOME_ADVANTAGE_MULTIPLIER;
  const adjustedHomePower = homePower * homeAdvantage;

  // Big match player bonus
  const homeBigMatchBonus = isBigMatch
    ? homeSquad.reduce((sum, p) => sum + p.bigMatchPlayer, 0) / (homeSquad.length * 100) * 0.1
    : 0;
  const awayBigMatchBonus = isBigMatch
    ? awaySquad.reduce((sum, p) => sum + p.bigMatchPlayer, 0) / (awaySquad.length * 100) * 0.1
    : 0;

  const finalHomePower = adjustedHomePower * (1 + homeBigMatchBonus);
  const finalAwayPower = awayPower * (1 + awayBigMatchBonus);

  // Goal probability calculation using constants
  const homeGoalProb = (finalHomePower / (finalHomePower + finalAwayPower)) * MATCH_CONSTANTS.MAX_GOAL_PROBABILITY + MATCH_CONSTANTS.BASE_HOME_GOAL_PROBABILITY;
  const awayGoalProb = (finalAwayPower / (finalAwayPower + finalHomePower)) * 0.3 + MATCH_CONSTANTS.BASE_AWAY_GOAL_PROBABILITY;

  // Simulate match minutes
  let homeScore = 0;
  let awayScore = 0;
  const events: string[] = [];

  // Minute-by-minute simulation
  for (let minute = 1; minute <= MATCH_CONSTANTS.DURATION_MINUTES; minute++) {
    // Home team scoring chance
    if (Math.random() < homeGoalProb / MATCH_CONSTANTS.DURATION_MINUTES) {
      homeScore++;
      // Pick scorer - forwards more likely, but midfielders and defenders can score too
      const scorers = homeSquad.filter(p => p.position === 'FWD');
      const scorer = scorers[Math.floor(Math.random() * scorers.length)] || homeSquad[10];
      events.push(`⚽ ${minute}' - ${scorer.name} (${homeTeam}) marca!`);
    }

    // Away team scoring chance
    if (Math.random() < awayGoalProb / MATCH_CONSTANTS.DURATION_MINUTES) {
      awayScore++;
      const scorers = awaySquad.filter(p => p.position === 'FWD');
      const scorer = scorers[Math.floor(Math.random() * scorers.length)] || awaySquad[10];
      events.push(`⚽ ${minute}' - ${scorer.name} (${awayTeam}) marca!`);
    }

    // Random cards using constants
    if (Math.random() < MATCH_CONSTANTS.YELLOW_CARD_PROBABILITY) {
      const isHomeTeam = Math.random() < 0.5;
      const team = isHomeTeam ? homeTeam : awayTeam;
      const squad = isHomeTeam ? homeSquad : awaySquad;
      const player = squad[Math.floor(Math.random() * squad.length)];
      events.push(`🟨 ${minute}' - Cartão amarelo para ${player.name} (${team})`);
    }

    // Red card (rare)
    if (Math.random() < MATCH_CONSTANTS.RED_CARD_PROBABILITY) {
      const isHomeTeam = Math.random() < 0.5;
      const team = isHomeTeam ? homeTeam : awayTeam;
      const squad = isHomeTeam ? homeSquad : awaySquad;
      const player = squad[Math.floor(Math.random() * squad.length)];
      events.push(`🟥 ${minute}' - Cartão vermelho! ${player.name} (${team}) é expulso!`);
    }
  }

  const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : 'Empate';

  return { homeScore, awayScore, events, winner };
}

// Create initial game state
export function createInitialGameState(userId: string, teamName: string): GameState {
  const team = BRAZILIAN_TEAMS.find(t => t.name === teamName) || BRAZILIAN_TEAMS[0];
  
  return {
    user: {
      id: userId,
      team: teamName,
      level: 1,
      sociosPoints: 0,
    },
    season: {
      week: 1,
      league: 'Brasileirão Serie A',
      position: SEASON_CONSTANTS.INITIAL_POSITION,
      points: SEASON_CONSTANTS.INITIAL_POINTS,
      wins: 0,
      draws: 0,
      losses: 0,
      nextMatch: {
        opponent: 'Palmeiras',
        isHome: true,
        date: new Date().toISOString(),
        competition: 'Brasileirão',
      },
    },
    squad: {
      players: generateSquad(teamName),
      formation: SQUAD_CONSTANTS.FORMATION,
      morale: SQUAD_CONSTANTS.DEFAULT_MORALE,
      fitness: SQUAD_CONSTANTS.DEFAULT_FITNESS,
    },
    context: {
      lastAction: 'team_selected',
      availableActions: ['view_squad', 'play_match', 'train', 'transfer_market'],
      pendingDecisions: [],
      narrative: {
        lastEvent: `Você assumiu o comando do ${teamName}!`,
        momentum: 'neutral',
      },
    },
  };
}
