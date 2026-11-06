/**
 * Everything that happens to a saved game *because* a match was played:
 * points, the win/draw/loss record, gate receipts, staff wages, morale, the
 * league position and next week's fixture.
 *
 * This used to live inline in /api/match, which simulated its own match and
 * then did the bookkeeping in the same breath. /api/match/finalize settles a
 * match the player actually watched turn by turn, and must leave the save in
 * exactly the same shape, so the bookkeeping moved here and both routes call
 * it with nothing but the final score.
 *
 * `applyMatchOutcome` mutates the game state in place — the routes save the
 * same object they loaded — and is *synchronous* on purpose: it draws from
 * `random()` for the rival table and the next fixture, so a caller that wants
 * a reproducible match wraps it in the same `withSeed` scope as the
 * simulation (see rng.ts for why the scope cannot span an await).
 */

import { GameState } from './types';
import { isSeasonOver } from './constants';
import { BRAZILIAN_TEAMS } from './game-engine';
import { calculateMatchEarnings, calculateWeeklyStaffWages } from './economy';
import { pickNextFixture, simulateRivalStandings } from './match-setup';
import { NO_INVESTMENT_BONUSES, type InvestmentBonuses } from './investment-bonuses';

/** The result of the match, as both routes can describe it. */
export interface MatchOutcome {
  homeScore: number;
  awayScore: number;
  /** The winning team's name, or 'Empate' for a draw. */
  winner: string;
}

export interface MatchBookkeepingInput {
  /** The side the user played against. */
  opponentTeam: string;
  /** Whether the user's team was at home. */
  isHome: boolean;
  outcome: MatchOutcome;
  /**
   * What the player's active investments add to the gate and the prize.
   * Omitted, the match pays exactly what it always paid.
   */
  bonuses?: InvestmentBonuses;
}

export interface MatchBookkeepingResult {
  pointsEarned: number;
  matchResult: 'win' | 'draw' | 'loss';
  matchEarnings: number;
  weeklyWages: number;
  /** The league position the user ends the week in. */
  position: number;
  /** True when this match was the last of the season. */
  isSeasonEnd: boolean;
}

/** The result of the match from the user's point of view. */
export function resolveMatchResult(
  userTeam: string,
  winner: string
): 'win' | 'draw' | 'loss' {
  if (winner === userTeam) return 'win';
  if (winner === 'Empate') return 'draw';
  return 'loss';
}

/**
 * Applies a finished match to the saved game, in place, and reports the
 * numbers a response needs. Must run inside the caller's seeded scope when the
 * match is meant to be reproducible.
 */
export function applyMatchOutcome(
  gameState: GameState,
  { opponentTeam, isHome, outcome, bonuses = NO_INVESTMENT_BONUSES }: MatchBookkeepingInput
): MatchBookkeepingResult {
  const { homeScore, awayScore, winner } = outcome;

  const pointsEarned = winner === gameState.user.team ? 3 : winner === 'Empate' ? 1 : 0;
  const matchResult = resolveMatchResult(gameState.user.team, winner);

  // Ensure stadium exists for old game states
  if (!gameState.stadium) {
    gameState.stadium = { level: 0, capacity: 0, amenities: 0, ticketPrice: 0, maintenanceLevel: 1 };
  }

  // Ensure division exists for old game states
  if (!gameState.season.division) {
    gameState.season.division = 'Serie D';
  }

  // Calculate money earned from match, including whatever the player's
  // active investments are worth on it.
  const matchEarnings = calculateMatchEarnings(
    gameState.season.division,
    matchResult,
    isHome,
    gameState.stadium,
    bonuses
  );

  // Update win/draw/loss record
  if (matchResult === 'win') {
    gameState.season.wins++;
  } else if (matchResult === 'draw') {
    gameState.season.draws++;
  } else {
    gameState.season.losses++;
  }

  gameState.season.week++;
  gameState.season.points += pointsEarned;

  // Update club money with match earnings
  gameState.user.money = (gameState.user.money || 0) + matchEarnings;

  // Ensure staff exists for old game states
  if (!gameState.staff) {
    gameState.staff = { headCoach: null, scout: null, medicalStaff: null };
  }

  // Calculate and deduct weekly staff wages
  const weeklyWages = calculateWeeklyStaffWages(gameState.staff);
  if (weeklyWages > 0) {
    gameState.user.money -= weeklyWages;
    if (gameState.teamStats) {
      gameState.teamStats.totalSpent += weeklyWages;
    }
  }

  // Ensure teamStats exists for old game states
  if (!gameState.teamStats) {
    gameState.teamStats = { totalEarnings: 0, totalSpent: 0, matchesPlayed: 0, championshipsWon: 0, promotionCount: 0 };
  }

  // Update team stats
  gameState.teamStats.totalEarnings += matchEarnings;
  gameState.teamStats.matchesPlayed += 1;

  gameState.squad.morale = Math.max(30, Math.min(100, gameState.squad.morale + (pointsEarned * 5 - 5)));

  // Calculate realistic league position based on points and other teams' performance
  // Simulate other 19 teams' performance
  const otherTeams = BRAZILIAN_TEAMS.filter((t) => t.name !== gameState.user.team);
  const simulatedStandings = simulateRivalStandings(otherTeams, gameState.season.week);

  // Add user's team and sort by points
  const allStandings = [
    ...simulatedStandings,
    { name: gameState.user.team, points: gameState.season.points },
  ].sort((a, b) => b.points - a.points);

  // Find user's position
  const userPosition = allStandings.findIndex((t) => t.name === gameState.user.team) + 1;
  gameState.season.position = userPosition;

  // Check if season is complete (SEASON_LENGTH rounds in Liga Mestre)
  const isSeasonEnd = isSeasonOver(gameState.season);

  if (isSeasonEnd) {
    // Season complete - generate summary instead of next match
    gameState.season.nextMatch = {
      opponent: 'Temporada Completa',
      isHome: false,
      date: new Date().toISOString(),
      competition: 'Fim da Temporada',
    };
    gameState.context.availableActions = ['view_final_standings', 'new_season'];
  } else {
    // Generate next match - filter out user's team and current opponent to avoid self-play
    const fixture = pickNextFixture(BRAZILIAN_TEAMS, gameState.user.team, opponentTeam);
    gameState.season.nextMatch = {
      opponent: fixture.opponent,
      isHome: fixture.isHome,
      date: new Date().toISOString(),
      competition: 'Liga Mestre',
    };
  }

  gameState.context.lastAction = 'match_completed';
  gameState.context.narrative.lastEvent = `Jogo contra ${opponentTeam}: ${homeScore}x${awayScore}`;
  gameState.context.narrative.momentum =
    matchResult === 'win' ? 'home' : matchResult === 'draw' ? 'neutral' : 'away';

  return {
    pointsEarned,
    matchResult,
    matchEarnings,
    weeklyWages,
    position: userPosition,
    isSeasonEnd,
  };
}
