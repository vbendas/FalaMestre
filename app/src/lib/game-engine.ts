import { GameState, Player, Match, FormState, MatchEvent, MatchContext, EventIntensity, EventType, MatchSettings, MATCH_SETTINGS_DEFAULTS } from './types';
import { generatePlayerId } from './utils';
import {
  PLAYER_RATINGS,
  SQUAD_CONSTANTS,
  POSITION_WEIGHTS,
  ATTRIBUTE_RANGES,
  MATCH_CONSTANTS,
  SEASON_CONSTANTS,
  EVENT_DENSITY_CONFIG
} from './constants';
import {
  generateGoalCommentary,
  generateSaveCommentary,
  generateNearMissCommentary,
  generateFoulCommentary,
  generateCardCommentary,
  generatePressureCommentary,
  generateBuildupCommentary,
  generateHalftimeCommentary,
  generateWhistleCommentary,
  calculateIntensity,
} from './commentary';

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
    // Training system fields - initialized
    fatigue: 100,
    currentForm: 'average',
    weeklyTrainingCount: 0,
    isInjured: false,
    injuryWeeksRemaining: 0,
    injuryType: null,
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

// Calculate team power with form multipliers
const FORM_MULTIPLIERS: Record<FormState, number> = {
  hot: 1.20,    // +20%
  good: 1.10,   // +10%
  average: 1.0,  // 0%
  poor: 0.90,   // -10%
  cold: 0.80,   // -20%
};

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

    // Apply form multiplier
    const formMultiplier = FORM_MULTIPLIERS[player.currentForm] || 1.0;

    return sum + (avgAttributes * positionWeight * consistencyMultiplier + leadershipBonus) * formMultiplier;
  }, 0);

  const moraleMultiplier = morale / 100;
  const fitnessMultiplier = fitness / 100;

  return basePower * moraleMultiplier * fitnessMultiplier;
}

// Weighted player selection based on specific attributes
function selectPlayerByAttribute(squad: Player[], attribute: 'sho' | 'def' | 'phy', biasPosition?: 'FWD' | 'MID' | 'DEF' | 'GK'): Player {
  let totalWeight = 0;
  const weights = squad.map(p => {
    let weight = Math.pow(p[attribute], 2); // Square the attribute to reward higher stats
    if (biasPosition && p.position === biasPosition) {
      weight *= 2.0; // Double weight for correct tactical position
    }
    totalWeight += weight;
    return weight;
  });

  let random = Math.random() * totalWeight;
  for (let i = 0; i < squad.length; i++) {
    random -= weights[i];
    if (random <= 0) return squad[i];
  }
  return squad[0]; // Fallback
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
  let homeGoalProb = (finalHomePower / (finalHomePower + finalAwayPower)) * MATCH_CONSTANTS.MAX_GOAL_PROBABILITY + MATCH_CONSTANTS.BASE_HOME_GOAL_PROBABILITY;
  let awayGoalProb = (finalAwayPower / (finalAwayPower + finalHomePower)) * 0.3 + MATCH_CONSTANTS.BASE_AWAY_GOAL_PROBABILITY;

  // Cap probabilities to prevent extreme outliers like 15-0 scores
  const MAX_PROB = 0.08; // Roughly limits max expected probability per minute
  homeGoalProb = Math.min(homeGoalProb, MAX_PROB);
  awayGoalProb = Math.min(awayGoalProb, MAX_PROB);

  // Simulate match minutes
  let homeScore = 0;
  let awayScore = 0;
  const events: string[] = [];

  // Minute-by-minute simulation
  for (let minute = 1; minute <= MATCH_CONSTANTS.DURATION_MINUTES; minute++) {
    // Home team scoring chance
    if (Math.random() < homeGoalProb / MATCH_CONSTANTS.DURATION_MINUTES) {
      homeScore++;
      // Pick scorer based on shooting attribute
      const scorer = selectPlayerByAttribute(homeSquad, 'sho', 'FWD');
      events.push(`⚽ ${minute}' - ${scorer.name} (${homeTeam}) marca!`);
    }

    // Away team scoring chance
    if (Math.random() < awayGoalProb / MATCH_CONSTANTS.DURATION_MINUTES) {
      awayScore++;
      // Pick scorer based on shooting attribute
      const scorer = selectPlayerByAttribute(awaySquad, 'sho', 'FWD');
      events.push(`⚽ ${minute}' - ${scorer.name} (${awayTeam}) marca!`);
    }

    // Random cards using constants
    if (Math.random() < MATCH_CONSTANTS.YELLOW_CARD_PROBABILITY) {
      const isHome = Math.random() < 0.5;
      const team = isHome ? homeTeam : awayTeam;
      const squad = isHome ? homeSquad : awaySquad;
      const player = squad[Math.floor(Math.random() * squad.length)];
      events.push(`🟨 ${minute}' - Cartão amarelo para ${player.name} (${team})`);
    }

    // Red card (rare)
    if (Math.random() < MATCH_CONSTANTS.RED_CARD_PROBABILITY) {
      const isHome = Math.random() < 0.5;
      const team = isHome ? homeTeam : awayTeam;
      const squad = isHome ? homeSquad : awaySquad;
      const player = squad[Math.floor(Math.random() * squad.length)];
      events.push(`🟥 ${minute}' - Cartão vermelho! ${player.name} (${team}) é expulso!`);
    }
  }

  const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : 'Empate';

  return { homeScore, awayScore, events, winner };
}

// Simulate a match with rich commentary events
export function simulateMatchWithCommentary(
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
  events: MatchEvent[];
  winner: string;
} {
  const isBigMatch = week ? week >= 28 : false;

  const homePower = calculateTeamPower(homeSquad, SQUAD_CONSTANTS.FORMATION, homeMorale, SQUAD_CONSTANTS.MAX_FITNESS);
  const awayPower = calculateTeamPower(awaySquad, SQUAD_CONSTANTS.FORMATION, awayMorale, SQUAD_CONSTANTS.MAX_FITNESS);

  const homeAdvantage = MATCH_CONSTANTS.HOME_ADVANTAGE_MULTIPLIER;
  const adjustedHomePower = homePower * homeAdvantage;

  const homeBigMatchBonus = isBigMatch
    ? homeSquad.reduce((sum, p) => sum + p.bigMatchPlayer, 0) / (homeSquad.length * 100) * 0.1
    : 0;
  const awayBigMatchBonus = isBigMatch
    ? awaySquad.reduce((sum, p) => sum + p.bigMatchPlayer, 0) / (awaySquad.length * 100) * 0.1
    : 0;

  const finalHomePower = adjustedHomePower * (1 + homeBigMatchBonus);
  const finalAwayPower = awayPower * (1 + awayBigMatchBonus);

  let homeGoalProb = (finalHomePower / (finalHomePower + finalAwayPower)) * MATCH_CONSTANTS.MAX_GOAL_PROBABILITY + MATCH_CONSTANTS.BASE_HOME_GOAL_PROBABILITY;
  let awayGoalProb = (finalAwayPower / (finalAwayPower + finalHomePower)) * 0.3 + MATCH_CONSTANTS.BASE_AWAY_GOAL_PROBABILITY;

  // Cap probabilities to prevent extreme outliers
  const MAX_PROB = 0.08;
  homeGoalProb = Math.min(homeGoalProb, MAX_PROB);
  awayGoalProb = Math.min(awayGoalProb, MAX_PROB);

  let homeScore = 0;
  let awayScore = 0;
  const events: MatchEvent[] = [];
  let tension = 30;
  let homeMomentum = 0;
  let awayMomentum = 0;

  const context: MatchContext = {
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    homeMomentum: 0,
    awayMomentum: 0,
    tension,
    eventCount: 0,
    possession: { home: 50, away: 50 },
    homeTeam,
    awayTeam,
    isHome: true,
  };

  const generateEventId = () => `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const getScorer = (squad: Player[]): Player => {
    return selectPlayerByAttribute(squad, 'sho', 'FWD');
  };

  const getRandomPlayer = (squad: Player[]): Player => squad[Math.floor(Math.random() * squad.length)];

  for (let minute = 1; minute <= MATCH_CONSTANTS.DURATION_MINUTES; minute++) {
    context.minute = minute;
    context.homeScore = homeScore;
    context.awayScore = awayScore;

    const scoreDiff = Math.abs(homeScore - awayScore);
    const isCloseGame = scoreDiff <= 1;
    const isEndGame = minute >= 75;
    context.tension = Math.min(100, isCloseGame ? 50 + (minute / 90) * 50 : 30 + (minute / 90) * 20);

    const homeChance = homeGoalProb / MATCH_CONSTANTS.DURATION_MINUTES;
    const awayChance = awayGoalProb / MATCH_CONSTANTS.DURATION_MINUTES;

    if (Math.random() < homeChance * 0.4) {
      const player = getScorer(homeSquad);
      const assist = Math.random() > 0.5 ? getRandomPlayer(homeSquad) : undefined;
      homeScore++;
      context.homeScore = homeScore;

      const commentary = generateGoalCommentary(player, assist, minute, context, true);
      events.push({
        id: generateEventId(),
        minute,
        type: 'goal',
        team: 'home',
        player,
        assistPlayer: assist,
        description: `${player.name} marca para ${homeTeam}`,
        intensity: calculateIntensity(minute, context),
        highlight: true,
        commentary,
        momentum: 30,
      });
    } else if (Math.random() < homeChance) {
      const player = getScorer(homeSquad);
      const intensity = calculateIntensity(minute, context);

      if (Math.random() < 0.3) {
        const commentary = generateNearMissCommentary(player, minute, context, true);
        events.push({
          id: generateEventId(),
          minute,
          type: 'miss',
          team: 'home',
          player,
          description: `${player.name} quase marca`,
          intensity,
          highlight: intensity === 'dramatic',
          commentary,
          momentum: -5,
        });
      } else if (Math.random() < 0.3) {
        const gk = awaySquad.find(p => p.position === 'GK') || awaySquad[0];
        const commentary = generateSaveCommentary(gk, minute, context, false);
        events.push({
          id: generateEventId(),
          minute,
          type: 'save',
          team: 'away',
          player: gk,
          description: `${gk.name} defende`,
          intensity: calculateIntensity(minute, context),
          highlight: true, // Trigger highlight overlay for great saves
          commentary,
          momentum: 10,
        });
      } else {
        const commentary = generateBuildupCommentary(player, minute, context, true);
        events.push({
          id: generateEventId(),
          minute,
          type: 'buildup',
          team: 'home',
          player,
          description: `${homeTeam} ataca`,
          intensity: 'low',
          highlight: false,
          commentary,
          momentum: 5,
        });
      }
    }

    if (Math.random() < awayChance * 0.4) {
      const player = getScorer(awaySquad);
      const assist = Math.random() > 0.5 ? getRandomPlayer(awaySquad) : undefined;
      awayScore++;
      context.awayScore = awayScore;

      const commentary = generateGoalCommentary(player, assist, minute, context, false);
      events.push({
        id: generateEventId(),
        minute,
        type: 'goal',
        team: 'away',
        player,
        assistPlayer: assist,
        description: `${player.name} marca para ${awayTeam}`,
        intensity: calculateIntensity(minute, context),
        highlight: true,
        commentary,
        momentum: -30,
      });
    } else if (Math.random() < awayChance) {
      const player = getScorer(awaySquad);

      if (Math.random() < 0.3) {
        const commentary = generateNearMissCommentary(player, minute, context, false);
        events.push({
          id: generateEventId(),
          minute,
          type: 'miss',
          team: 'away',
          player,
          description: `${player.name} quase marca`,
          intensity: calculateIntensity(minute, context),
          highlight: false,
          commentary,
          momentum: 5,
        });
      } else if (Math.random() < 0.3) {
        const gk = homeSquad.find(p => p.position === 'GK') || homeSquad[0];
        const commentary = generateSaveCommentary(gk, minute, context, true);
        events.push({
          id: generateEventId(),
          minute,
          type: 'save',
          team: 'home',
          player: gk,
          description: `${gk.name} defende`,
          intensity: calculateIntensity(minute, context),
          highlight: true, // Trigger highlight overlay for great saves
          commentary,
          momentum: -10,
        });
      } else {
        const commentary = generateBuildupCommentary(player, minute, context, false);
        events.push({
          id: generateEventId(),
          minute,
          type: 'buildup',
          team: 'away',
          player,
          description: `${awayTeam} ataca`,
          intensity: 'low',
          highlight: false,
          commentary,
          momentum: -5,
        });
      }
    }

    if (Math.random() < MATCH_CONSTANTS.YELLOW_CARD_PROBABILITY * 0.5) {
      const isHome = Math.random() < 0.5;
      const player = getRandomPlayer(isHome ? homeSquad : awaySquad);
      const commentary = generateCardCommentary(player, minute, true, isHome);
      events.push({
        id: generateEventId(),
        minute,
        type: 'card',
        team: isHome ? 'home' : 'away',
        player,
        description: `Cartão amarelo para ${player.name}`,
        intensity: calculateIntensity(minute, context),
        highlight: false,
        commentary,
        momentum: 0,
      });
    }

    if (Math.random() < MATCH_CONSTANTS.RED_CARD_PROBABILITY * 0.3) {
      const isHome = Math.random() < 0.5;
      const player = getRandomPlayer(isHome ? homeSquad : awaySquad);
      const commentary = generateCardCommentary(player, minute, false, isHome);
      events.push({
        id: generateEventId(),
        minute,
        type: 'card',
        team: isHome ? 'home' : 'away',
        player,
        description: `Cartão vermelho para ${player.name}`,
        intensity: calculateIntensity(minute, context),
        highlight: true,
        commentary,
        momentum: isHome ? -15 : 15,
      });
    }

    if (minute % 10 === 0) {
      const isHome = Math.random() < 0.5;
      const commentary = generatePressureCommentary(minute, context, isHome);
      events.push({
        id: generateEventId(),
        minute,
        type: 'pressure',
        team: isHome ? 'home' : 'away',
        description: `Pressão do ${isHome ? homeTeam : awayTeam}`,
        intensity: calculateIntensity(minute, context),
        highlight: false,
        commentary,
        momentum: isHome ? 5 : -5,
      });
    }
  }

  const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : 'Empate';

  return { homeScore, awayScore, events, winner };
}

// Form update helper function
function updatePlayerForm(player: Player, change: number): void {
  const formLevels: FormState[] = ['cold', 'poor', 'average', 'good', 'hot'];
  const currentIndex = formLevels.indexOf(player.currentForm);
  const newIndex = Math.max(0, Math.min(4, currentIndex + change));
  player.currentForm = formLevels[newIndex];
}

// Post-match processing: form updates and fatigue recovery
export function processPostMatch(
  squad: { players: Player[] },
  homeScore: number,
  awayScore: number,
  isHome: boolean,
  playerRatings?: Record<string, number> // Optional: player ratings from match
): void {
  const teamScore = isHome ? homeScore : awayScore;
  const opponentScore = isHome ? awayScore : homeScore;
  const didWin = teamScore > opponentScore;
  const didDraw = teamScore === opponentScore;

  squad.players.forEach((player: Player) => {
    // 1. Base fatigue recovery: 30%
    let recovery = 30;

    // Injured players recover faster (40% total) and heal 1 week
    if (player.isInjured) {
      recovery += 10;
      player.injuryWeeksRemaining--;

      if (player.injuryWeeksRemaining <= 0) {
        player.isInjured = false;
        player.injuryType = null;
        player.injuryWeeksRemaining = 0;
      }
    }

    player.fatigue = Math.min(100, player.fatigue + recovery);

    // 2. Form updates based on match outcome
    if (teamScore > 0 && Math.random() < 0.3) {
      const scorer = squad.players[Math.floor(Math.random() * squad.players.length)];
      updatePlayerForm(scorer, 2);
    }

    if (didWin) {
      updatePlayerForm(player, 1);
    } else if (!didDraw) {
      updatePlayerForm(player, -1);
    }

    // 3. Form decay for benched players
    if (player.fatigue > 70) {
      updatePlayerForm(player, -1);
    }

    // 4. Reset weekly training count
    player.weeklyTrainingCount = 0;
  });
}

// Reset training budget for new week
export function resetWeeklyTraining(squad: { players: Player[]; weeklyTrainingBudget: number; currentWeek: number }): void {
  squad.weeklyTrainingBudget = 15;
  squad.currentWeek += 1;

  squad.players.forEach((player: Player) => {
    player.weeklyTrainingCount = 0;
  });
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
      weeklyTrainingBudget: 15,
      currentWeek: 1,
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

// ========================
// MINIMAX COMMENTARY SYSTEM
// ========================

export interface NarrativeNode {
  event: MatchEvent;
  children: NarrativeNode[];
  depth: number;
}

interface NarrativeContext {
  minute: number;
  homeScore: number;
  awayScore: number;
  tension: number;
  momentum: number;
  recentEventTypes: EventType[];
  goalsScored: number;
  nearMisses: number;
  isHome: boolean;
  homeTeam: string;
  awayTeam: string;
}

const MINIMAX_DEPTH = 3;
const BRANCH_FACTOR = 4;

function evaluateNarrative(
  node: NarrativeNode,
  context: NarrativeContext,
  isMaximizing: boolean
): number {
  const event = node.event;
  let score = 0;

  // 1. Tension scoring (higher in close games, especially late)
  const scoreDiff = Math.abs(context.homeScore - context.awayScore);
  const isLateGame = context.minute >= 70;
  const isCloseGame = scoreDiff <= 1;

  if (isLateGame && isCloseGame) {
    score += 30; // Critical moments
  } else if (isLateGame) {
    score += 15;
  } else if (isCloseGame) {
    score += 10;
  }

  // 2. Event type scoring (goals are best, but near-misses build tension)
  switch (event.type) {
    case 'goal':
      score += 25;
      // Bonus for dramatic goals (late, comeback, etc.)
      if (context.minute >= 80) score += 15;
      if (isCloseGame && context.minute >= 60) score += 10;
      break;
    case 'miss':
      score += 8; // Near-misses create tension
      if (context.minute >= 60) score += 5;
      break;
    case 'save':
      score += 5;
      if (event.intensity === 'dramatic') score += 10;
      break;
    case 'card':
      score += event.intensity === 'dramatic' ? 8 : 2;
      break;
    case 'pressure':
      score += event.intensity === 'high' ? 6 : 3;
      break;
    case 'buildup':
      score += 2; // Quiet buildup is okay
      break;
    default:
      score += 1;
  }

  // 3. Variety bonus (avoid repetitive events)
  const recentTypes = context.recentEventTypes.slice(-3);
  if (!recentTypes.includes(event.type)) {
    score += 5;
  } else {
    score -= 3; // Penalty for repetition
  }

  // 4. Momentum shift detection
  if (Math.abs(event.momentum) > 20) {
    score += 8; // Big momentum swings are dramatic
  }

  // 5. Penalty for unrealistic event sequences
  // (e.g., two goals in a row without any buildup)
  const lastEventType = context.recentEventTypes[context.recentEventTypes.length - 1];
  if (lastEventType === 'goal' && event.type === 'goal') {
    score -= 10; // Too many goals too quick
  }

  // 6. Home/away balance
  if (event.team === 'home' && context.isHome) {
    score += 2; // Slight bias toward home team drama
  } else if (event.team === 'away' && !context.isHome) {
    score += 2;
  }

  // 7. Intensity alignment with context
  if (event.intensity === 'dramatic' && (isLateGame || isCloseGame)) {
    score += 5;
  } else if (event.intensity === 'dramatic' && !isLateGame && !isCloseGame) {
    score -= 5; // Too dramatic too early
  }

  return score;
}

function generatePossibleEvents(
  homeTeam: string,
  awayTeam: string,
  homeSquad: Player[],
  awaySquad: Player[],
  context: NarrativeContext,
  isHomeTurn: boolean,
  settings: MatchSettings = MATCH_SETTINGS_DEFAULTS
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const squad = isHomeTurn ? homeSquad : awaySquad;
  const teamName = isHomeTurn ? homeTeam : awayTeam;
  const team: 'home' | 'away' = isHomeTurn ? 'home' : 'away';

  const densityConfig = EVENT_DENSITY_CONFIG[settings.eventDensity];
  const multiplier = densityConfig.eventMultiplier;

  const goalProb = (context.minute >= 60 ? 0.15 : 0.08) * multiplier;
  const missProb = (context.minute >= 60 ? 0.12 : 0.08) * multiplier;
  const saveProb = 0.10 * multiplier;
  const cardProb = 0.08 * multiplier;
  const pressureProb = 0.15 * multiplier;
  const buildupProb = 0.25 * multiplier;

  const rand = Math.random();

  const getScorer = (): Player => {
    return selectPlayerByAttribute(squad, 'sho', 'FWD');
  };

  const getGoalkeeper = (): Player => {
    const gk = squad.find(p => p.position === 'GK');
    return gk || squad[0];
  };

  const getIntensity = (): EventIntensity => {
    if (context.minute >= 75) return 'dramatic';
    if (context.minute >= 60 && Math.abs(context.homeScore - context.awayScore) <= 1) return 'high';
    if (context.minute >= 30) return 'medium';
    return 'low';
  };

  // Goal
  if (rand < goalProb) {
    const player = getScorer();
    const assist = Math.random() > 0.5 ? squad[Math.floor(Math.random() * squad.length)] : undefined;
    const commentary = generateGoalCommentary(player, assist, context.minute, {
      minute: context.minute,
      homeScore: context.homeScore,
      awayScore: context.awayScore,
      homeMomentum: context.momentum,
      awayMomentum: -context.momentum,
      tension: context.tension,
      eventCount: context.goalsScored + context.nearMisses,
      possession: { home: 50, away: 50 },
      homeTeam,
      awayTeam,
      isHome: context.isHome,
    }, isHomeTurn);

    events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      minute: context.minute,
      type: 'goal',
      team,
      player,
      assistPlayer: assist,
      description: `${player.name} marca para ${teamName}`,
      commentary,
      intensity: getIntensity(),
      highlight: true,
      momentum: 30,
    });
  }
  // Near miss
  else if (rand < goalProb + missProb) {
    const player = getScorer();
    const commentary = generateNearMissCommentary(player, context.minute, {
      minute: context.minute,
      homeScore: context.homeScore,
      awayScore: context.awayScore,
      homeMomentum: context.momentum,
      awayMomentum: -context.momentum,
      tension: context.tension,
      eventCount: context.goalsScored + context.nearMisses,
      possession: { home: 50, away: 50 },
      homeTeam,
      awayTeam,
      isHome: context.isHome,
    }, isHomeTurn);

    events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      minute: context.minute,
      type: 'miss',
      team,
      player,
      description: `${player.name} quase marca`,
      commentary,
      intensity: getIntensity(),
      highlight: getIntensity() === 'dramatic',
      momentum: -5,
    });
  }
  // Save
  else if (rand < goalProb + missProb + saveProb) {
    const gk = getGoalkeeper();
    const commentary = generateSaveCommentary(gk, context.minute, {
      minute: context.minute,
      homeScore: context.homeScore,
      awayScore: context.awayScore,
      homeMomentum: context.momentum,
      awayMomentum: -context.momentum,
      tension: context.tension,
      eventCount: context.goalsScored + context.nearMisses,
      possession: { home: 50, away: 50 },
      homeTeam,
      awayTeam,
      isHome: context.isHome,
    }, !isHomeTurn);

    events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      minute: context.minute,
      type: 'save',
      team: !isHomeTurn ? 'home' : 'away',
      player: gk,
      description: `${gk.name} defende`,
      commentary,
      intensity: getIntensity(),
      highlight: true, // Trigger highlight overlay for great saves
      momentum: isHomeTurn ? -10 : 10,
    });
  }
  // Card
  else if (rand < goalProb + missProb + saveProb + cardProb) {
    const player = squad[Math.floor(Math.random() * squad.length)];
    const commentary = generateCardCommentary(player, context.minute, true, isHomeTurn);
    const intensity = Math.random() < 0.3 ? 'high' : 'medium';

    events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      minute: context.minute,
      type: 'card',
      team,
      player,
      description: `Cartão amarelo para ${player.name}`,
      commentary,
      intensity,
      highlight: false,
      momentum: 0,
    });
  }
  // Pressure
  else if (rand < goalProb + missProb + saveProb + cardProb + pressureProb) {
    const commentary = generatePressureCommentary(context.minute, {
      minute: context.minute,
      homeScore: context.homeScore,
      awayScore: context.awayScore,
      homeMomentum: context.momentum,
      awayMomentum: -context.momentum,
      tension: context.tension,
      eventCount: context.goalsScored + context.nearMisses,
      possession: { home: 50, away: 50 },
      homeTeam,
      awayTeam,
      isHome: context.isHome,
    }, isHomeTurn);

    events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      minute: context.minute,
      type: 'pressure',
      team,
      description: `Pressão do ${teamName}`,
      commentary,
      intensity: getIntensity() === 'dramatic' ? 'high' : 'medium',
      highlight: false,
      momentum: isHomeTurn ? 5 : -5,
    });
  }
  // Buildup (default)
  else {
    const player = getScorer();
    const commentary = generateBuildupCommentary(player, context.minute, {
      minute: context.minute,
      homeScore: context.homeScore,
      awayScore: context.awayScore,
      homeMomentum: context.momentum,
      awayMomentum: -context.momentum,
      tension: context.tension,
      eventCount: context.goalsScored + context.nearMisses,
      possession: { home: 50, away: 50 },
      homeTeam,
      awayTeam,
      isHome: context.isHome,
    }, isHomeTurn);

    events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      minute: context.minute,
      type: 'buildup',
      team,
      player,
      description: `${teamName} ataca`,
      commentary,
      intensity: 'low',
      highlight: false,
      momentum: isHomeTurn ? 2 : -2,
    });
  }

  return events;
}

function minimax(
  depth: number,
  context: NarrativeContext,
  isMaximizing: boolean,
  homeTeam: string,
  awayTeam: string,
  homeSquad: Player[],
  awaySquad: Player[],
  settings: MatchSettings = MATCH_SETTINGS_DEFAULTS
): { score: number; events: MatchEvent[] } {
  // Base case: reached depth limit
  if (depth === 0) {
    return { score: 0, events: [] };
  }

  // Generate possible events for this turn
  const isHomeTurn = context.isHome;
  const possibleEvents = generatePossibleEvents(
    homeTeam,
    awayTeam,
    homeSquad,
    awaySquad,
    context,
    isHomeTurn,
    settings
  );

  // If no events generated, return empty
  if (possibleEvents.length === 0) {
    return { score: 0, events: [] };
  }

  // For each possible event, calculate score
  let bestScore = isMaximizing ? -Infinity : Infinity;
  let bestEvents: MatchEvent[] = [];
  let bestEvent = possibleEvents[0];

  for (const event of possibleEvents) {
    // Update context for next depth
    const newContext: NarrativeContext = {
      ...context,
      minute: context.minute + 1,
      homeScore: event.team === 'home' && event.type === 'goal'
        ? context.homeScore + 1 : context.homeScore,
      awayScore: event.team === 'away' && event.type === 'goal'
        ? context.awayScore + 1 : context.awayScore,
      momentum: context.momentum + event.momentum,
      tension: Math.min(100, context.tension + (event.type === 'goal' ? 20 : event.type === 'miss' ? 10 : 2)),
      recentEventTypes: [...context.recentEventTypes, event.type],
      goalsScored: context.goalsScored + (event.type === 'goal' ? 1 : 0),
      nearMisses: context.nearMisses + (event.type === 'miss' ? 1 : 0),
      isHome: !context.isHome,
    };

    // Evaluate this node
    const nodeScore = evaluateNarrative(
      { event, children: [], depth },
      context,
      isMaximizing
    );

    // Recursively get score from children
    const childResult = minimax(
      depth - 1,
      newContext,
      !isMaximizing,
      homeTeam,
      awayTeam,
      homeSquad,
      awaySquad,
      settings
    );

    const totalScore = nodeScore + childResult.score;

    // Choose best based on maximizing or minimizing
    if (isMaximizing) {
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestEvent = event;
        bestEvents = [event, ...childResult.events];
      }
    } else {
      if (totalScore < bestScore) {
        bestScore = totalScore;
        bestEvent = event;
        bestEvents = [event, ...childResult.events];
      }
    }
  }

  return { score: bestScore, events: bestEvents };
}

// Main function: Generate match with minimax narrative
export function simulateMatchWithNarrative(
  homeTeam: string,
  awayTeam: string,
  homeSquad: Player[],
  awaySquad: Player[],
  homeMorale: number,
  awayMorale: number,
  week?: number,
  settings: MatchSettings = MATCH_SETTINGS_DEFAULTS,
  isHome: boolean = true
): {
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  winner: string;
  isHome: boolean;
} {
  const isBigMatch = week ? week >= 28 : false;

  // Calculate team power
  const homePower = calculateTeamPower(homeSquad, SQUAD_CONSTANTS.FORMATION, homeMorale, SQUAD_CONSTANTS.MAX_FITNESS);
  const awayPower = calculateTeamPower(awaySquad, SQUAD_CONSTANTS.FORMATION, awayMorale, SQUAD_CONSTANTS.MAX_FITNESS);

  const homeAdvantage = 1.1;
  const finalHomePower = homePower * homeAdvantage;
  const finalAwayPower = awayPower;

  // Goal probability based on power
  const totalPower = finalHomePower + finalAwayPower;
  const homeGoalBaseProb = (finalHomePower / totalPower) * 0.35;
  const awayGoalBaseProb = (finalAwayPower / totalPower) * 0.25;

  let homeScore = 0;
  let awayScore = 0;
  const allEvents: MatchEvent[] = [];
  let momentum = 0;
  let tension = 20;

  // Initial context
  let context: NarrativeContext = {
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    tension: 20,
    momentum: 0,
    recentEventTypes: [],
    goalsScored: 0,
    nearMisses: 0,
    isHome: true,
    homeTeam,
    awayTeam,
  };

  // Generate events every 5 minutes to reduce commentary frequency
  for (let minute = 5; minute <= 90; minute += 5) {
    // Update context
    context = {
      ...context,
      minute,
      homeScore,
      awayScore,
      tension: Math.min(100, 20 + (minute / 90) * 60 + (Math.abs(homeScore - awayScore) <= 1 ? 20 : 0)),
      isHome: minute % 2 === 1, // Alternate possession
      homeTeam,
      awayTeam,
    };

    // Run minimax to get best event for this minute
    const result = minimax(
      MINIMAX_DEPTH,
      context,
      true,
      homeTeam,
      awayTeam,
      homeSquad,
      awaySquad,
      settings
    );

    // Use the first event from minimax result, or generate one if empty
    let event: MatchEvent | null = null;

    if (result.events.length > 0) {
      event = result.events[0];
    } else if (minute % 10 === 0) {
      // Fallback: generate a basic event (only every 10 minutes to reduce frequency)
      const isHomeTurn = minute % 2 === 1;
      const squad = isHomeTurn ? homeSquad : awaySquad;
      const teamName = isHomeTurn ? homeTeam : awayTeam;
      const team: 'home' | 'away' = isHomeTurn ? 'home' : 'away';

      const player = squad[Math.floor(Math.random() * squad.length)];
      const commentary = generateBuildupCommentary(player, minute, {
        minute: context.minute,
        homeScore: context.homeScore,
        awayScore: context.awayScore,
        homeMomentum: momentum,
        awayMomentum: -momentum,
        tension: context.tension,
        eventCount: allEvents.length,
        possession: { home: 50, away: 50 },
        homeTeam,
        awayTeam,
        isHome: isHomeTurn,
      }, isHomeTurn);

      event = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        minute,
        type: 'buildup',
        team,
        player,
        description: `${teamName} ataca`,
        commentary,
        intensity: 'low',
        highlight: false,
        momentum: isHomeTurn ? 2 : -2,
      };
    } else {
      // No event this minute - reduces frequency significantly
    }

    // Add halftime event BEFORE the continue check (so it always runs at minute 45)
    if (minute === 45) {
      const commentary = generateHalftimeCommentary({
        minute: 45,
        homeScore,
        awayScore,
        homeMomentum: momentum,
        awayMomentum: -momentum,
        tension: context.tension,
        eventCount: allEvents.length,
        possession: { home: 50, away: 50 },
        homeTeam,
        awayTeam,
        isHome: true,
      });

      allEvents.push({
        id: `evt_${Date.now()}_halftime`,
        minute: 45,
        type: 'halftime',
        team: 'home',
        description: 'Intervalo',
        commentary,
        intensity: 'medium',
        highlight: false,
        momentum: 0,
      });
    }

    // Apply event effects
    if (!event) continue; // Skip to next minute if no event
    if (event.type === 'goal') {
      if (event.team === 'home') {
        homeScore++;
        console.log('[DEBUG] Goal! Home team scores. Total homeScore:', homeScore);
      } else {
        awayScore++;
        console.log('[DEBUG] Goal! Away team scores. Total awayScore:', awayScore);
      }
      allEvents.push(event);
    } else if (event.type === 'miss' || event.type === 'save' || event.type === 'pressure') {
      // These build tension but don't score
      allEvents.push(event);
    } else if (event.type === 'card' || event.type === 'buildup') {
      allEvents.push(event);
    }

    // Update momentum
    momentum = Math.max(-50, Math.min(50, momentum + event.momentum));

    // Add some random events for variety if needed - only every 10 minutes
    if (minute % 10 === 0 && allEvents.filter(e => e.minute === minute).length === 0) {
      // Ensure at least one event per minute
      const isHomeTurn = minute % 2 === 1;
      const player = (isHomeTurn ? homeSquad : awaySquad)[Math.floor(Math.random() * 11)];
      const teamName = isHomeTurn ? homeTeam : awayTeam;

      const commentary = generateBuildupCommentary(player, minute, {
        minute: context.minute,
        homeScore: context.homeScore,
        awayScore: context.awayScore,
        homeMomentum: momentum,
        awayMomentum: -momentum,
        tension: context.tension,
        eventCount: allEvents.length,
        possession: { home: 50, away: 50 },
        homeTeam,
        awayTeam,
        isHome: isHomeTurn,
      }, isHomeTurn);

      allEvents.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        minute,
        type: 'buildup',
        team: isHomeTurn ? 'home' : 'away',
        player,
        description: `${teamName} controla a bola`,
        commentary,
        intensity: 'low',
        highlight: false,
        momentum: isHomeTurn ? 1 : -1,
      });
    }
  }

  // Calculate score from events BEFORE adding whistle (to include in commentary)
  const finalHomeScore = allEvents.filter(e => e.type === 'goal' && e.team === 'home').length;
  const finalAwayScore = allEvents.filter(e => e.type === 'goal' && e.team === 'away').length;

  // Add final whistle
  const finalCommentary = generateWhistleCommentary(finalHomeScore, finalAwayScore);
  allEvents.push({
    id: `evt_${Date.now()}_whistle`,
    minute: 90,
    type: 'whistle',
    team: 'home',
    description: 'Fim de jogo',
    commentary: finalCommentary,
    intensity: 'high',
    highlight: true,
    momentum: 0,
  });

  // Calculate score from events to ensure consistency (authoritative source)
  // Already calculated above before whistle commentary

  const winner = finalHomeScore > finalAwayScore ? homeTeam : finalAwayScore > finalHomeScore ? awayTeam : 'Empate';

  console.log('[DEBUG] Final scores:', { homeScore: finalHomeScore, awayScore: finalAwayScore, goalEvents: allEvents.filter(e => e.type === 'goal').length });

  return { homeScore: finalHomeScore, awayScore: finalAwayScore, events: allEvents, winner, isHome };
}
