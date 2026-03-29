/**
 * Prediction Market Engine
 * Handles dynamic odds calculation, bet placement, and prediction settling
 */

import { generateId } from './utils';
import { PREDICTION_MARKET, MATCH_CONSTANTS } from './constants';
import type { 
  Prediction, 
  UserBet, 
  PredictionHistory,
  PredictionType,
  Squad
} from './types';

export interface TeamPowerContext {
  teamName: string;
  averageRating: number;
  lastFiveResults: ('W' | 'D' | 'L')[];
  homeAdvantage: boolean;
  keyPlayersAvailable: number; // 0-1 percentage
}

export interface HeadToHeadRecord {
  homeWins: number;
  awayWins: number;
  draws: number;
  totalMatches: number;
}

function calculateTeamPowerRating(squad: Squad): number {
  const players = squad.players;
  if (players.length === 0) return 60;
  
  const avgPace = players.reduce((sum, p) => sum + p.pac, 0) / players.length;
  const avgShooting = players.reduce((sum, p) => sum + p.sho, 0) / players.length;
  const avgPassing = players.reduce((sum, p) => sum + p.pas, 0) / players.length;
  const avgDefense = players.reduce((sum, p) => sum + p.def, 0) / players.length;
  const avgDribbling = players.reduce((sum, p) => sum + p.dri, 0) / players.length;
  const avgPhysical = players.reduce((sum, p) => sum + p.phy, 0) / players.length;
  
  const overall = (
    avgPace * 0.15 +
    avgShooting * 0.25 +
    avgPassing * 0.2 +
    avgDefense * 0.15 +
    avgDribbling * 0.1 +
    avgPhysical * 0.15
  );
  
  const formMultiplier = getFormMultiplier(['W', 'W', 'D', 'W', 'L']); // Default form
  const moraleMultiplier = 0.85 + (squad.morale / 100) * 0.15;
  const fitnessMultiplier = 0.85 + (squad.fitness / 100) * 0.15;
  
  return Math.round(overall * formMultiplier * moraleMultiplier * fitnessMultiplier);
}

function getFormMultiplier(lastFiveResults: ('W' | 'D' | 'L')[]): number {
  if (lastFiveResults.length === 0) return 1.0;
  
  const wins = lastFiveResults.filter(r => r === 'W').length;
  const draws = lastFiveResults.filter(r => r === 'D').length;
  const points = wins * 3 + draws * 1;
  const maxPoints = lastFiveResults.length * 3;
  
  return 0.8 + (points / maxPoints) * 0.4;
}

function calculateHomeAdvantage(isHome: boolean, morale: number): number {
  let advantage = isHome ? MATCH_CONSTANTS.HOME_ADVANTAGE_MULTIPLIER : 1.0;
  
  if (morale >= 80) {
    advantage *= 1.05;
  } else if (morale <= 50) {
    advantage *= 0.95;
  }
  
  return advantage;
}

function calculateHeadToHeadPower(
  teamAPower: number, 
  teamBPower: number, 
  h2h: HeadToHeadRecord
): number {
  if (h2h.totalMatches === 0) return 1.0;
  
  const teamAWins = h2h.homeWins;
  const teamBWins = h2h.awayWins;
  const draws = h2h.draws;
  
  const teamAPerformance = (teamAWins * 1.0 + draws * 0.5) / h2h.totalMatches;
  const teamBPerformance = (teamBWins * 1.0 + draws * 0.5) / h2h.totalMatches;
  
  if (teamAPerformance > teamBPerformance) {
    return 1.0 + (teamAPerformance - teamBPerformance) * 0.3;
  }
  
  return 1.0 - (teamBPerformance - teamAPerformance) * 0.3;
}

export function calculateDynamicOdds(
  homeTeam: TeamPowerContext,
  awayTeam: TeamPowerContext,
  homeSquadMorale: number
): { homeOdds: number; drawOdds: number; awayOdds: number } {
  const homePower = homeTeam.averageRating;
  const awayPower = awayTeam.averageRating;
  
  const formMultiplier = getFormMultiplier(homeTeam.lastFiveResults);
  const awayFormMultiplier = getFormMultiplier(awayTeam.lastFiveResults);
  
  const homeAdvantage = calculateHomeAdvantage(true, homeSquadMorale);
  
  const h2hRecord: HeadToHeadRecord = {
    homeWins: Math.floor(Math.random() * 5),
    awayWins: Math.floor(Math.random() * 5),
    draws: Math.floor(Math.random() * 3),
    totalMatches: 10
  };
  const h2hMultiplier = calculateHeadToHeadPower(homePower, awayPower, h2hRecord);
  
  const adjustedHomePower = homePower * formMultiplier * homeAdvantage * h2hMultiplier;
  const adjustedAwayPower = awayPower * awayFormMultiplier;
  
  const powerRatio = adjustedHomePower / adjustedAwayPower;
  
  const baseOdds = PREDICTION_MARKET.ODDS.BASE;
  const minOdds = PREDICTION_MARKET.ODDS.MIN;
  const maxOdds = PREDICTION_MARKET.ODDS.MAX;
  
  let homeOdds = baseOdds / powerRatio;
  let awayOdds = baseOdds * powerRatio;
  
  homeOdds = Math.max(minOdds, Math.min(maxOdds, homeOdds));
  awayOdds = Math.max(minOdds, Math.min(maxOdds, awayOdds));
  
  const drawOdds = (homeOdds + awayOdds) / 2;
  
  return {
    homeOdds: Math.round(homeOdds * 100) / 100,
    drawOdds: Math.round(drawOdds * 100) / 100,
    awayOdds: Math.round(awayOdds * 100) / 100
  };
}

export function createPrediction(
  matchId: string,
  homeTeam: string,
  awayTeam: string,
  type: PredictionType,
  matchDate: Date
): Prediction {
  const odds = calculateDynamicOdds(
    { teamName: homeTeam, averageRating: 75, lastFiveResults: ['W', 'W', 'D', 'W', 'L'], homeAdvantage: true, keyPlayersAvailable: 1 },
    { teamName: awayTeam, averageRating: 72, lastFiveResults: ['W', 'L', 'W', 'D', 'L'], homeAdvantage: false, keyPlayersAvailable: 0.9 },
    75
  );
  
  const entryCost = PREDICTION_MARKET.ENTRY_COSTS[type];
  const deadline = new Date(matchDate);
  deadline.setHours(deadline.getHours() - PREDICTION_MARKET.PREDICTION_WINDOW_HOURS);
  
  const prediction: Prediction = {
    id: generateId('pred'),
    matchId,
    homeTeam,
    awayTeam,
    type,
    options: [
      {
        id: `${matchId}-home`,
        label: homeTeam,
        odds: odds.homeOdds,
        totalBets: 0,
        result: 'pending'
      },
      {
        id: `${matchId}-draw`,
        label: 'Empate',
        odds: odds.drawOdds,
        totalBets: 0,
        result: 'pending'
      },
      {
        id: `${matchId}-away`,
        label: awayTeam,
        odds: odds.awayOdds,
        totalBets: 0,
        result: 'pending'
      }
    ],
    entryCost,
    deadline: deadline.toISOString(),
    status: 'open',
    matchDate: matchDate.toISOString(),
    createdAt: new Date().toISOString()
  };
  
  return prediction;
}

export function calculatePotentialWin(
  amount: number,
  odds: number,
  streak: number
): number {
  let payout = amount * odds;
  
  const streakMultiplier = Object.entries(PREDICTION_MARKET.STREAK_MULTIPLIERS)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .find(([streakThreshold]) => streak >= Number(streakThreshold));
  
  if (streakMultiplier) {
    payout *= streakMultiplier[1];
  }
  
  return Math.round(payout);
}

export function placeBet(
  prediction: Prediction,
  optionId: string,
  userId: string,
  amount: number
): UserBet {
  const option = prediction.options.find(o => o.id === optionId);
  if (!option) {
    throw new Error('Invalid option ID');
  }
  
  if (amount < PREDICTION_MARKET.MIN_BET_AMOUNT || amount > PREDICTION_MARKET.MAX_BET_AMOUNT) {
    throw new Error(`Bet amount must be between ${PREDICTION_MARKET.MIN_BET_AMOUNT} and ${PREDICTION_MARKET.MAX_BET_AMOUNT}`);
  }
  
  const potentialWin = calculatePotentialWin(amount, option.odds, 0);
  
  const bet: UserBet = {
    id: generateId('bet'),
    userId,
    predictionId: prediction.id,
    optionId,
    amount,
    potentialWin,
    settled: false,
    createdAt: new Date().toISOString()
  };
  
  option.totalBets += amount;
  
  return bet;
}

export function settlePrediction(
  prediction: Prediction,
  actualResult: 'home' | 'draw' | 'away',
  homeScore: number,
  awayScore: number
): Prediction {
  const winner = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
  
  prediction.options = prediction.options.map(option => {
    const isWinner = (
      (option.id.includes('home') && winner === 'home') ||
      (option.id.includes('draw') && winner === 'draw') ||
      (option.id.includes('away') && winner === 'away')
    );
    
    return {
      ...option,
      result: isWinner ? 'won' : 'lost'
    };
  });
  
  prediction.status = 'settled';
  prediction.settledAt = new Date().toISOString();
  
  return prediction;
}

export function calculateUserBetOutcome(
  bet: UserBet,
  prediction: Prediction
): { won: boolean; payout: number } {
  const option = prediction.options.find(o => o.id === bet.optionId);
  
  if (!option || option.result !== 'won') {
    return { won: false, payout: 0 };
  }
  
  const won = option.result === 'won';
  const payout = won ? bet.potentialWin : 0;
  
  return { won, payout };
}

export function updatePredictionHistory(
  history: PredictionHistory,
  betWon: boolean,
  winnings: number
): PredictionHistory {
  const newStreak = betWon ? history.currentStreak + 1 : 0;
  const newBestStreak = Math.max(history.bestStreak, newStreak);
  
  let newExpertLevel = history.expertLevel;
  for (const level of PREDICTION_MARKET.EXPERT_LEVELS.slice().reverse()) {
    if (newStreak >= level.minStreak) {
      newExpertLevel = level.level;
      break;
    }
  }
  
  return {
    userId: history.userId,
    totalBets: history.totalBets + 1,
    correctBets: history.correctBets + (betWon ? 1 : 0),
    currentStreak: newStreak,
    bestStreak: newBestStreak,
    expertLevel: newExpertLevel,
    totalWinnings: history.totalWinnings + winnings,
    lastBetAt: new Date().toISOString(),
  };
}

export function getExpertLevelName(level: number): string {
  const expertLevel = PREDICTION_MARKET.EXPERT_LEVELS.find(l => l.level === level);
  return expertLevel?.name || 'Iniciante';
}

export function getExpertDiscount(expertLevel: number): number {
  return expertLevel * PREDICTION_MARKET.EXPERT_DISCOUNT_PER_LEVEL;
}

export function getStreakMultiplier(streak: number): number {
  const multiplier = Object.entries(PREDICTION_MARKET.STREAK_MULTIPLIERS)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .find(([threshold]) => streak >= Number(threshold));
  
  return multiplier ? Number(multiplier[1]) : 1.0;
}