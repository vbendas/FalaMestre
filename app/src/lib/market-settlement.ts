/**
 * Paying out a market: settling it against the real result of its match,
 * crediting each winning bet the return it was promised and recording that
 * each losing bet paid nothing.
 *
 * Where the result comes from. The save keeps a record, not scores, so the
 * score of every round is written into the save in the same commit as the
 * match (`recordRoundResult` in fixture-markets.ts) and copied onto the
 * market from there. Settlement never takes a score from whoever calls it:
 * a fixture market is settled against what was banked, or not at all.
 *
 * When it runs. Both when the match is banked and from a scheduled job:
 *
 *  - /api/match/finalize and /api/match settle the market they have just
 *    played, right after the commit (`settlePlayedFixtureAfterCommit`), so a
 *    winner is paid before the result screen asks for their balance.
 *  - The job (GET /api/predictions/settle, `settleDueMarkets`) is the
 *    backstop for whatever that left: a payout that failed, a settlement
 *    that never ran because the request died after the commit. Because the
 *    result is in the save, the job can always find it.
 *
 * Paying once, whatever happens. A bet is settled by one statement that
 * marks it settled, credits its payout and counts it in the bettor's
 * history together (`settleBet`), so a process dying anywhere leaves the
 * bet either fully settled or untouched, and the job finishes whatever is
 * untouched. Only an unsettled bet matches that statement, so two runs
 * landing together (a bank and the job, say) cannot both pay it.
 *
 * This used to be three writes: claim the bet, pay it, mark it settled. A
 * run that died after the claim left the bet claimed for ever, and nobody
 * could tell whether the payout had gone out. Nothing writes a claim any
 * more; for bets still carrying one:
 *  - a losing one moved no money whatever happened, so the job finishes it;
 *  - a winning one may or may not have been paid, so it is never paid or
 *    written off here. It is held: the job lists it in `needsReview`, the
 *    bets screen shows it as under review, and an operator settles it with
 *    `resolveHeldBet`, saying whether the old run paid it.
 */

import { and, asc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { gameStates, predictionHistory, predictions, userBets } from '@/db/schema';
import { PREDICTION_MARKET } from './constants';
import { bankedResult, fixtureMatchId, fixtureOfMatchId, isBefore } from './fixture-markets';
import { seasonNumber } from './constants';
import { settlePrediction } from './prediction-engine';
import { getLogger } from './request-context';
import type { Logger } from './logger';
import { loadSave } from './save-store';
import type { GameState, Prediction, PredictionOption } from './types';

type MarketRow = typeof predictions.$inferSelect;
export type Score = { homeScore: number; awayScore: number };

export interface SettleMarketResult {
  status: 'settled' | 'no_result' | 'not_found';
  predictionId: string;
  /** Whether the market was already settled when this run reached it. */
  alreadySettled: boolean;
  /** The settled options, each marked won or lost. Empty without a result. */
  options: PredictionOption[];
  /** Bets this run settled, winners and losers. */
  betsSettled: number;
  /** Money this run credited. */
  paid: number;
  /** Winning bets whose payout failed; still unsettled, for the next run. */
  failed: number;
  /** Bets another run had already settled. */
  skipped: number;
  /**
   * Winning bets left claimed by the old settlement code: held, unpaid and
   * unsettled, for an operator (see `resolveHeldBet`).
   */
  held: number;
}

/** A bet not yet settled; NULL is how rows from before the default read. */
const unsettled = sql`coalesce(${userBets.settled}, false) = false`;

function settledOptions(market: MarketRow, score: Score): PredictionOption[] {
  const side =
    score.homeScore > score.awayScore ? 'home' : score.homeScore < score.awayScore ? 'away' : 'draw';
  return settlePrediction(
    { ...(market as unknown as Prediction), options: market.options as PredictionOption[] },
    side,
    score.homeScore,
    score.awayScore
  ).options;
}

/**
 * Writes the result onto the market, once. A market that already has one
 * keeps it, so a second bank of the same round (which the save's version
 * check already refuses) or a caller with other scores cannot change it.
 * Also closes it to bets, in case nothing kicked it off first.
 */
export async function recordMarketResult(predictionId: string, score: Score): Promise<void> {
  await db
    .update(predictions)
    .set({
      homeScore: score.homeScore,
      awayScore: score.awayScore,
      status: sql`case when ${predictions.status} = 'settled' then 'settled' else 'closed' end`,
      kickedOffAt: sql`coalesce(${predictions.kickedOffAt}, now())`,
    })
    .where(and(eq(predictions.id, predictionId), isNull(predictions.homeScore)));
}

/**
 * Settles one market against the result recorded on it, and pays out every
 * bet on it that is not settled yet. Safe to run any number of times, and
 * concurrently: a bet is paid by exactly one run.
 */
export async function settleMarket(
  predictionId: string,
  log: Logger = getLogger('market-settlement')
): Promise<SettleMarketResult> {
  const result: SettleMarketResult = {
    status: 'settled',
    predictionId,
    alreadySettled: false,
    options: [],
    betsSettled: 0,
    paid: 0,
    failed: 0,
    skipped: 0,
    held: 0,
  };

  const market = await db.query.predictions.findFirst({ where: eq(predictions.id, predictionId) });
  if (!market) return { ...result, status: 'not_found' };
  if (market.homeScore === null || market.awayScore === null) return { ...result, status: 'no_result' };

  const options = settledOptions(market, { homeScore: market.homeScore, awayScore: market.awayScore });
  result.options = options;
  result.alreadySettled = market.status === 'settled';

  if (!result.alreadySettled) {
    await db
      .update(predictions)
      .set({ status: 'settled', settledAt: new Date(), options })
      .where(and(eq(predictions.id, predictionId), ne(predictions.status, 'settled')));
  }

  // In the order they were placed. The history a settled bet adds to is a
  // streak, and a streak depends on order: a win then a loss leaves none, a
  // loss then a win leaves one. Unordered, the table's own row order decided
  // it, and an UPDATE to a bet changes that order.
  const open = await db.query.userBets.findMany({
    where: and(eq(userBets.predictionId, predictionId), unsettled),
    orderBy: [asc(userBets.createdAt), asc(userBets.id)],
  });

  for (const bet of open) {
    const won = options.find(o => o.id === bet.optionId)?.result === 'won';
    let claim: ClaimHandling = 'unclaimed';
    if (bet.settlingAt) {
      if (won) {
        // Left claimed by the old code, which may or may not have paid it
        // before it died. Never paid or written off here: held for someone
        // who can find out (see the header).
        result.held++;
        continue;
      }
      // A losing bet was never going to move money, so the claim hides
      // nothing: finish it.
      claim = { claimed: true, credit: false };
    }
    try {
      const settled = await settleBet(bet.id, won, claim);
      if (!settled) {
        // Another run settled it first.
        result.skipped++;
        continue;
      }
      result.betsSettled++;
      result.paid += settled.payout;
    } catch (error) {
      // The statement did nothing at all: the bet is still unsettled and
      // unpaid, and the next run settles it.
      log.error('Settling a bet failed; it stays open for the next settlement', { betId: bet.id, error });
      result.failed++;
    }
  }

  return result;
}

/** The expert level a streak earns, as a SQL expression on that streak. */
function expertLevelFor(streak: ReturnType<typeof sql>) {
  const levels = [...PREDICTION_MARKET.EXPERT_LEVELS].sort((a, b) => b.minStreak - a.minStreak);
  const whens = levels.map(
    l => sql`when ${streak} >= ${sql.raw(String(l.minStreak))} then ${sql.raw(String(l.level))}`
  );
  return sql`case ${sql.join(whens, sql` `)} else 0 end`;
}

/**
 * Settles one bet in a single statement: marks it settled, credits the
 * payout to the bettor's save and counts it in their history, or does none
 * of it. Postgres applies all of a statement's data-modifying CTEs or none
 * of them, so a process dying at any point leaves the bet either settled,
 * paid and counted, or untouched; there is no moment in between to die in.
 *
 * That is also what makes it pay once. The bet's UPDATE only matches an
 * unsettled bet; a second run blocked on the same row re-reads it once the
 * first commits, finds it settled and matches nothing, so its payout and
 * history parts have no row to act on.
 *
 * The amounts are the ones settlement always used: a winner is paid its
 * `potential_win` if it still has a save to be paid into (otherwise it is
 * settled as won with 0 paid), a loser 0. The money is an increment on the
 * balance at that instant, bumping the save's version exactly as
 * adjustMoney does. The history update is the same counting that used to
 * run as a separate write afterwards, so a bet can no longer be paid
 * without being counted. Returns null if there was nothing to settle.
 */
type ClaimHandling = 'unclaimed' | { claimed: true; credit: boolean };

async function settleBet(
  betId: string,
  won: boolean,
  claim: ClaimHandling = 'unclaimed'
): Promise<{ payout: number } | null> {
  // A bet still carrying an old claim is only ever settled on purpose: a
  // losing one by the job, a winning one by an operator, who says whether
  // the money has to be credited now.
  const claimCondition =
    claim === 'unclaimed' ? sql`${userBets.settlingAt} is null` : sql`${userBets.settlingAt} is not null`;
  const credit = sql.raw(claim === 'unclaimed' || claim.credit ? 'true' : 'false');
  const wonSql = sql.raw(won ? 'true' : 'false');
  const point = sql.raw(won ? '1' : '0');
  const streak = won ? sql`coalesce(${predictionHistory.currentStreak}, 0) + 1` : sql`0`;
  const money = sql`(${gameStates.currentState}->'user'->>'money')::numeric`;

  const { rows } = (await db.execute(sql`
    with bet as (
      update ${userBets}
      set settled = true,
          won = ${wonSql},
          settled_at = now(),
          settling_at = null,
          payout = case
            when ${wonSql} and exists (select 1 from ${gameStates} where ${gameStates.userId} = ${userBets.userId})
            then ${userBets.potentialWin} else 0 end
      where ${userBets.id} = ${betId}::uuid
        and ${claimCondition}
      returning ${userBets.userId} as user_id, ${userBets.payout} as payout
    ),
    paid as (
      update ${gameStates}
      set current_state = jsonb_set(${gameStates.currentState}, '{user,money}', to_jsonb(${money} + bet.payout)),
          version = ${gameStates.version} + 1,
          updated_at = now()
      from bet
      where ${gameStates.userId} = bet.user_id and bet.payout > 0 and ${credit}
      returning 1
    ),
    counted as (
      insert into ${predictionHistory} (user_id, total_bets, correct_bets, current_streak, best_streak, total_winnings)
      select bet.user_id, 1, ${point}, ${point}, ${point}, bet.payout from bet
      on conflict (user_id) do update set
        correct_bets = coalesce(${predictionHistory.correctBets}, 0) + ${point},
        current_streak = ${streak},
        best_streak = greatest(coalesce(${predictionHistory.bestStreak}, 0), ${streak}),
        expert_level = ${expertLevelFor(streak)},
        total_winnings = coalesce(${predictionHistory.totalWinnings}, 0) + excluded.total_winnings,
        updated_at = now()
      returning 1
    )
    select payout::int as payout from bet
  `)) as { rows: Array<{ payout: number }> };

  return rows.length > 0 ? { payout: Number(rows[0].payout) } : null;
}

/**
 * Settles the market on `round` of this player's season against the score
 * the save banked for it. Does nothing if the save has no score for the
 * round (not played yet, or banked before scores were kept) or there is no
 * market on it.
 */
export async function settleFixtureFromSave(
  userId: string,
  state: GameState,
  round: number,
  log?: Logger
): Promise<SettleMarketResult | { status: 'no_result' | 'no_market' }> {
  const season = seasonNumber(state.season);
  const score = bankedResult(state, { season, round });
  if (!score) return { status: 'no_result' };

  const market = await db.query.predictions.findFirst({
    where: and(
      eq(predictions.userId, userId),
      eq(predictions.matchId, fixtureMatchId({ week: round, number: season }))
    ),
  });
  if (!market) return { status: 'no_market' };

  await recordMarketResult(market.id, score);
  return settleMarket(market.id, log);
}

/**
 * Settles the round a bank has just committed. The match has counted
 * whatever happens here, so a failure is logged and left for the scheduled
 * job, which finds the score in the save.
 */
export async function settlePlayedFixtureAfterCommit(userId: string, state: GameState): Promise<void> {
  const log = getLogger('market-settlement');
  try {
    const settled = await settleFixtureFromSave(userId, state, state.season.week - 1, log);
    if ('failed' in settled && settled.failed > 0) {
      log.warn('Settlement left bets open; the scheduled job will pay them', {
        failed: settled.failed,
      });
    }
  } catch (error) {
    log.warn('Could not settle the market on the match just banked; the scheduled job will', {
      error,
      round: state.season.week - 1,
    });
  }
}

export interface SweepResult {
  markets: number;
  betsSettled: number;
  paid: number;
  failed: number;
  /** Fixture markets closed and past their round, with no score to settle on. */
  unresolved: number;
  /** Bets carrying a claim from before settlement was one statement (see the header). */
  stuck: number;
  /** Those of them that won: held for an operator, by id. */
  needsReview: Array<{ betId: string; userId: string; predictionId: string; optionId: string; potentialWin: number }>;
}

/**
 * The scheduled job: settles every market that has a result and something
 * left to do, after first copying results the bank-time settlement did not
 * get to onto their markets from the saves.
 */
export async function settleDueMarkets(
  log: Logger = getLogger('market-settlement'),
  limit = 200
): Promise<SweepResult> {
  const sweep: SweepResult = {
    markets: 0, betsSettled: 0, paid: 0, failed: 0, unresolved: 0, stuck: 0, needsReview: [],
  };

  // 1. Closed fixture markets with no result yet: kicked off and maybe
  //    banked. The save says whether the round has been played.
  const unscored = await db
    .select({ id: predictions.id, userId: predictions.userId, matchId: predictions.matchId })
    .from(predictions)
    .where(
      and(
        isNotNull(predictions.userId),
        isNull(predictions.homeScore),
        eq(predictions.status, 'closed')
      )
    )
    .limit(limit);

  const saves = new Map<string, GameState | null>();
  for (const market of unscored as Array<{ id: string; userId: string; matchId: string }>) {
    const fixture = fixtureOfMatchId(market.matchId);
    if (fixture === null) continue;
    if (!saves.has(market.userId)) {
      saves.set(market.userId, (await loadSave(market.userId))?.state ?? null);
    }
    const state = saves.get(market.userId);
    // A fixture the save has not moved past is a match still being played.
    if (!state || !isBefore(fixture, { season: seasonNumber(state.season), round: state.season.week })) continue;
    const score = bankedResult(state, fixture);
    if (score) {
      await recordMarketResult(market.id, score);
    } else {
      sweep.unresolved++;
    }
  }

  // 2. Every market with a result and either its own status or a bet still
  //    to settle.
  const due = await db
    .select({ id: predictions.id })
    .from(predictions)
    .where(
      and(
        isNotNull(predictions.homeScore),
        sql`(${predictions.status} <> 'settled' or exists (
          select 1 from ${userBets}
          where ${userBets.predictionId} = ${predictions.id} and ${unsettled}
        ))`
      )
    )
    .limit(limit);

  for (const { id } of due as Array<{ id: string }>) {
    const settled = await settleMarket(id, log);
    sweep.markets++;
    sweep.betsSettled += settled.betsSettled;
    sweep.paid += settled.paid;
    sweep.failed += settled.failed;
  }

  const [{ count }] = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userBets)
    .where(and(unsettled, isNotNull(userBets.settlingAt)))) as Array<{ count: number }>;
  sweep.stuck = Number(count);

  // What is left claimed after the run is the winners: losers were finished
  // above. Named, so an operator can resolve each one.
  sweep.needsReview = (await db
    .select({
      betId: userBets.id,
      userId: userBets.userId,
      predictionId: userBets.predictionId,
      optionId: userBets.optionId,
      potentialWin: userBets.potentialWin,
    })
    .from(userBets)
    .where(and(unsettled, isNotNull(userBets.settlingAt)))
    .orderBy(asc(userBets.createdAt))
    .limit(50)) as SweepResult['needsReview'];

  return sweep;
}

export type ResolveHeldBetResult =
  | { status: 'resolved'; won: boolean; payout: number; credited: boolean }
  | { status: 'not_found' | 'not_held' | 'no_result' };

/**
 * An operator's answer for a bet the old settlement code left claimed:
 * whether that run paid it before it died. Settles it in one statement,
 * crediting the payout only if it was not paid, so the bet ends up paid
 * exactly once either way; counted in history like any settled bet. Only a
 * bet still held can be resolved, and only once.
 *
 * Nobody can work the answer out from the database: the old payout was an
 * increment on the save with no record of its own, and the save is written
 * by everything else too. It has to come from someone who can check, from
 * the logs of the run that died or with the player.
 */
export async function resolveHeldBet(betId: string, paidByOldRun: boolean): Promise<ResolveHeldBetResult> {
  const bet = await db.query.userBets.findFirst({ where: eq(userBets.id, betId) });
  if (!bet) return { status: 'not_found' };
  if (bet.settled || !bet.settlingAt) return { status: 'not_held' };
  const market = await db.query.predictions.findFirst({ where: eq(predictions.id, bet.predictionId) });
  if (!market || market.homeScore === null || market.awayScore === null) return { status: 'no_result' };

  const options = settledOptions(market, { homeScore: market.homeScore, awayScore: market.awayScore });
  const won = options.find(o => o.id === bet.optionId)?.result === 'won';
  // A losing bet was never paid, whatever the answer.
  const credit = won && !paidByOldRun;
  const settled = await settleBet(bet.id, won, { claimed: true, credit });
  if (!settled) return { status: 'not_held' };
  return { status: 'resolved', won, payout: settled.payout, credited: credit && settled.payout > 0 };
}
