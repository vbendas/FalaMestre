/**
 * Where betting markets come from: one market on the result of the fixture a
 * player's save is waiting on, priced by the prediction engine.
 *
 * Nothing used to create a market, so the bets screen always said there were
 * none open and the bet route never had anything to take a bet on. A market
 * now opens:
 *
 *  - when a save is created (/api/onboarding/create-team), for round 1;
 *  - every time a match is banked (/api/match/finalize and /api/match), for
 *    the fixture the bookkeeping has just written;
 *  - whenever the bets screen reads the board (GET /api/predictions), as a
 *    backstop. The two places above open the market only after the save is
 *    committed, and a failure there must not undo a match that has already
 *    counted, so it is logged and left; the screen's read then puts the
 *    market there. It also covers saves made before markets existed.
 *
 * A save's fixture is its season and round, so a market is keyed on the
 * player and `round-<week>` (`s<n>-round-<week>` from the second season on,
 * see fixtureMatchId). The unique index on (user_id, match_id) is what
 * makes opening idempotent: every caller inserts, and whichever lands second
 * inserts nothing. Once the season is over there is no fixture, and nothing
 * is opened.
 *
 * A market stops taking bets when its fixture kicks off (`kickOffFixture` in
 * fixture-kickoff.ts), which is the first time the server plays any of the
 * match: a decision turn, a one-shot /api/match or its stream, or a
 * finalize sent without turns.
 * Turn-by-turn matches show the score as they go, so a market left open
 * until the bank took bets on a score the player was watching.
 *
 * Markets on rounds the save has already played are also closed by the
 * open, as a backstop; paying them out is src/lib/market-settlement.ts's
 * job. That close only ever reaches rounds *before* the save's current one,
 * so a caller holding a save read a moment ago cannot close the market a
 * newer bank has just opened.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { predictions } from '@/db/schema';
import { isSeasonOver, seasonNumber } from './constants';
import { generateSquad } from './game-engine';
import { calculateTeamPowerRating, createPrediction } from './prediction-engine';
import { getLogger } from './request-context';
import type { GameState, PredictionType, Squad } from './types';

/** The one market type opened on every fixture. */
export const FIXTURE_MARKET_TYPE: PredictionType = 'win_draw_loss';

/**
 * A fixture is played when the player plays it, not at a time on the clock,
 * so a fixture market has no clock deadline: it closes when the match is
 * banked. The column is NOT NULL, hence a date no save will reach.
 */
export const FIXTURE_MARKET_NO_DEADLINE = new Date('9999-12-31T23:59:59.000Z');

/**
 * The opponent's morale as the odds assume it: the middle of the range
 * `rollOpponentMorale` draws from when the match is actually played.
 */
const ASSUMED_OPPONENT_MORALE = 70;

type MarketRow = typeof predictions.$inferInsert;

/** A fixture: which season of the save, and which round of it. */
export type FixtureId = { season: number; round: number };

/**
 * The match id of the fixture a save is waiting on. Every season reuses
 * rounds 1 to 38, so the season is part of it: `round-<week>` for the first
 * season (the id markets have always had), `s<n>-round-<week>` after it.
 * Without the season, a second season's round 1 was the first season's: the
 * market already existed (settled), so none opened, and the kickoff already
 * existed, so the match replayed last season's seed and decisions.
 */
export function fixtureMatchId(season: { week: number; number?: number }): string {
  const n = seasonNumber(season);
  return n > 1 ? `s${n}-round-${season.week}` : `round-${season.week}`;
}

/** The fixture a fixture market's match id names, or null for any other id. */
export function fixtureOfMatchId(matchId: string): FixtureId | null {
  const match = /^(?:s(\d+)-)?round-(\d+)$/.exec(matchId);
  if (!match) return null;
  return { season: match[1] ? Number(match[1]) : 1, round: Number(match[2]) };
}

/** Whether fixture `a` comes before fixture `b` in a save's career. */
export function isBefore(a: FixtureId, b: FixtureId): boolean {
  return a.season < b.season || (a.season === b.season && a.round < b.round);
}

/**
 * Where a save keeps the score of a round it banked (`season.results`):
 * the round alone for the first season, as it always has, `<n>:<round>` for
 * later ones, so a new season's round never reads or overwrites an old one.
 */
export function resultKey(season: number, round: number): string {
  return season > 1 ? `${season}:${round}` : String(round);
}

/** The score a save banked for a fixture, if it has one. */
export function bankedResult(
  state: Pick<GameState, 'season'>,
  fixture: FixtureId
): { homeScore: number; awayScore: number } | null {
  return state.season.results?.[resultKey(fixture.season, fixture.round)] ?? null;
}

/**
 * Writes the score of the round `state` is about to bank into the save, so
 * it is committed with the match. Call it after the bookkeeping has run, on
 * the state that will be committed: the bookkeeping has already moved the
 * week on, so the round just played is `week - 1`.
 */
export function recordRoundResult(
  state: GameState,
  round: number,
  score: { homeScore: number; awayScore: number }
): void {
  state.season.results = {
    ...(state.season.results ?? {}),
    [resultKey(seasonNumber(state.season), round)]: { homeScore: score.homeScore, awayScore: score.awayScore },
  };
}

/**
 * The market on the fixture `state` is waiting on, ready to insert, or null
 * once the season is over and there is no fixture.
 */
export function buildFixtureMarket(userId: string, state: GameState): MarketRow | null {
  if (isSeasonOver(state.season)) return null;

  const fixture = state.season.nextMatch;
  const userTeam = state.user.team;
  const homeTeam = fixture.isHome ? userTeam : fixture.opponent;
  const awayTeam = fixture.isHome ? fixture.opponent : userTeam;

  const userSquad = state.squad;
  // The opponent is regenerated for every match it plays (see /api/match and
  // match-replay), so a fresh squad here is as close as the odds can get.
  const opponentSquad: Squad = {
    players: generateSquad(fixture.opponent),
    formation: '4-3-3',
    morale: ASSUMED_OPPONENT_MORALE,
    fitness: userSquad.fitness,
    weeklyTrainingBudget: 0,
    currentWeek: state.season.week,
  };

  // The save keeps a record, not a sequence of results, so neither side
  // gets a form adjustment beyond what the power rating already applies.
  const userSide = {
    teamName: userTeam,
    averageRating: calculateTeamPowerRating(userSquad),
    lastFiveResults: [],
    homeAdvantage: fixture.isHome,
    keyPlayersAvailable: 1,
  };
  const opponentSide = {
    teamName: fixture.opponent,
    averageRating: calculateTeamPowerRating(opponentSquad),
    lastFiveResults: [],
    homeAdvantage: !fixture.isHome,
    keyPlayersAvailable: 1,
  };

  const matchId = fixtureMatchId(state.season);
  const matchDate = fixture.date ? new Date(fixture.date) : new Date();
  const prediction = createPrediction(matchId, homeTeam, awayTeam, FIXTURE_MARKET_TYPE, matchDate, {
    matchup: {
      home: fixture.isHome ? userSide : opponentSide,
      away: fixture.isHome ? opponentSide : userSide,
      homeMorale: fixture.isHome ? userSquad.morale : ASSUMED_OPPONENT_MORALE,
    },
    deadline: FIXTURE_MARKET_NO_DEADLINE,
  });

  // `id` and `createdAt` are the database's to assign.
  return {
    userId,
    matchId,
    homeTeam: prediction.homeTeam,
    awayTeam: prediction.awayTeam,
    type: prediction.type,
    options: prediction.options,
    entryCost: prediction.entryCost,
    deadline: new Date(prediction.deadline),
    status: 'open',
    matchDate,
  };
}

export type OpenFixtureMarketResult =
  | { status: 'created' | 'exists'; matchId: string; closed: number }
  | { status: 'season_over'; closed: number };

/**
 * Makes sure the fixture `state` is waiting on has its market, and that no
 * earlier round's market is still taking bets. Safe to run any number of
 * times, from anywhere, concurrently.
 */
export async function openFixtureMarket(
  userId: string,
  state: GameState
): Promise<OpenFixtureMarketResult> {
  const closed = await closePlayedMarkets(userId, {
    season: seasonNumber(state.season),
    round: state.season.week,
  });

  const row = buildFixtureMarket(userId, state);
  if (!row) return { status: 'season_over', closed };

  const inserted = await db
    .insert(predictions)
    .values(row)
    .onConflictDoNothing({ target: [predictions.userId, predictions.matchId] })
    .returning({ id: predictions.id });

  return { status: inserted.length > 0 ? 'created' : 'exists', matchId: row.matchId, closed };
}

/**
 * `openFixtureMarket` for a caller that has already committed the save and
 * must not fail because of the market: a banked match has counted whatever
 * happens here. A failure is logged, and the next read of the bets screen
 * opens the market instead.
 */
export async function openFixtureMarketAfterCommit(userId: string, state: GameState): Promise<void> {
  try {
    await openFixtureMarket(userId, state);
  } catch (error) {
    getLogger('fixture-markets').warn(
      'Could not open the market for the next fixture; the bets screen will open it',
      { error, week: state.season.week }
    );
  }
}

/**
 * Closes the player's open fixture markets on fixtures before `current`:
 * earlier rounds of this season, and anything left open from an earlier
 * season.
 */
async function closePlayedMarkets(userId: string, current: FixtureId): Promise<number> {
  const open = await db
    .select({ id: predictions.id, matchId: predictions.matchId })
    .from(predictions)
    .where(and(eq(predictions.userId, userId), eq(predictions.status, 'open')));

  const played = open
    .filter((market: { matchId: string }) => {
      const fixture = fixtureOfMatchId(market.matchId);
      return fixture !== null && isBefore(fixture, current);
    })
    .map((market: { id: string }) => market.id);

  if (played.length === 0) return 0;

  await db
    .update(predictions)
    .set({ status: 'closed' })
    .where(and(inArray(predictions.id, played), eq(predictions.status, 'open')));

  return played.length;
}
