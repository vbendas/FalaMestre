/**
 * The repair tool for betting: what an operator points at a database after a
 * bad deploy or an outage. It walks every save and every fixture market, says
 * what is out of step, and, when asked, puts right the part it safely can.
 *
 * It finds four things:
 *
 *  - `missing_market`: a save whose current fixture has no market (the season
 *    is not over). Fixed by opening it, exactly as a new save or a banked
 *    match opens one (`openFixtureMarket`): priced now, one per fixture.
 *  - `unsettled_with_result`: a market whose match has a result (on the
 *    market, or banked in the save and not yet copied onto the market) that
 *    is not settled, or has bets still waiting on it. Fixed by recording the
 *    result if it is only in the save and running settlement
 *    (`settleMarket`), which pays each bet once and never twice.
 *  - `held_winner`: a winning bet the old settlement code left claimed.
 *    Never fixed here: nobody can tell from the database whether that run
 *    paid it. Reported with the id and the route an operator resolves it
 *    through (`resolveHeldBet`).
 *  - `banked_without_result`: a fixture the save has moved past whose market
 *    is still waiting on a score the save never stored (banked before scores
 *    were kept, or by a write that skipped the bookkeeping). Never fixed:
 *    the score is gone and cannot be invented. Reported, with the stakes
 *    still riding on it.
 *
 * Everything it changes it changes through the same functions the routes
 * use, so a repair leaves the database exactly as a healthy run would have.
 * Each fix is idempotent, so a run that dies part way is finished by the
 * next one, and a run on a healthy database changes nothing.
 */

import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { gameStates, predictions, userBets } from '@/db/schema';
import { isSeasonOver, seasonNumber } from './constants';
import {
  bankedResult,
  fixtureMatchId,
  fixtureOfMatchId,
  isBefore,
  openFixtureMarket,
  type FixtureId,
} from './fixture-markets';
import { recordMarketResult, settleMarket } from './market-settlement';
import { settlePrediction } from './prediction-engine';
import type { GameState, Prediction, PredictionOption } from './types';

export type FindingKind = 'missing_market' | 'unsettled_with_result' | 'held_winner' | 'banked_without_result';

export interface Finding {
  kind: FindingKind;
  userId: string;
  /** The fixture concerned, as its market id names it. */
  matchId: string;
  /** The market, where there is one. */
  predictionId?: string;
  /** For a held winner: the bet. */
  betId?: string;
  /** What is at stake: unsettled bets on the market and their stakes. */
  openBets: number;
  stakes: number;
  /** One line saying what is wrong. */
  problem: string;
  /** One line saying what the tool does, or what a person has to do. */
  action: string;
  /** Whether `repairBetting({ fix: true })` puts this right. */
  fixable: boolean;
}

export interface RepairReport {
  findings: Finding[];
  /** Fixable findings this run put right (empty without `fix`). */
  fixed: Finding[];
  /** Fixable findings whose fix threw; the error is logged by the caller. */
  failed: Array<{ finding: Finding; error: unknown }>;
  /** Saves and markets looked at. */
  scanned: { saves: number; markets: number };
}

type MarketRow = typeof predictions.$inferSelect;
type BetRow = typeof userBets.$inferSelect;

const unsettled = sql`coalesce(${userBets.settled}, false) = false`;

function isWinner(market: MarketRow, bet: BetRow): boolean {
  const options = settlePrediction(
    { ...(market as unknown as Prediction), options: market.options as PredictionOption[] },
    'home',
    market.homeScore!,
    market.awayScore!
  ).options;
  return options.find(o => o.id === bet.optionId)?.result === 'won';
}

/** Looks, and changes nothing. */
export async function inspectBetting(): Promise<{ findings: Finding[]; scanned: RepairReport['scanned'] }> {
  const findings: Finding[] = [];

  const saves = (await db
    .select({ userId: gameStates.userId, state: gameStates.currentState })
    .from(gameStates)) as Array<{ userId: string; state: GameState }>;
  const stateOf = new Map(saves.map(s => [s.userId, s.state]));

  const markets = (await db
    .select()
    .from(predictions)
    .where(isNotNull(predictions.userId))) as MarketRow[];
  const marketsOf = new Map<string, MarketRow[]>();
  for (const m of markets) {
    const list = marketsOf.get(m.userId!) ?? [];
    list.push(m);
    marketsOf.set(m.userId!, list);
  }

  const openBets = (await db
    .select()
    .from(userBets)
    .where(unsettled)) as BetRow[];
  const openBetsOn = new Map<string, BetRow[]>();
  for (const b of openBets) {
    const list = openBetsOn.get(b.predictionId) ?? [];
    list.push(b);
    openBetsOn.set(b.predictionId, list);
  }
  const stakesOf = (bets: BetRow[]) => bets.reduce((sum, b) => sum + b.amount, 0);

  // 1. Every save's current fixture has a market.
  for (const { userId, state } of saves) {
    if (!state?.season || isSeasonOver(state.season)) continue;
    const matchId = fixtureMatchId(state.season);
    if (!(marketsOf.get(userId) ?? []).some(m => m.matchId === matchId)) {
      findings.push({
        kind: 'missing_market',
        userId,
        matchId,
        openBets: 0,
        stakes: 0,
        problem: `the save is waiting on ${matchId} and there is no market on it; the bets screen shows nothing to bet on`,
        action: 'open the market, priced on the squad as it stands now',
        fixable: true,
      });
    }
  }

  // 2, 3, 4. Every fixture market against its save.
  for (const market of markets) {
    const fixture = fixtureOfMatchId(market.matchId);
    const state = stateOf.get(market.userId!);
    const bets = openBetsOn.get(market.id) ?? [];
    const held = bets.filter(b => b.settlingAt);
    const free = bets.filter(b => !b.settlingAt);

    const onMarket: { homeScore: number; awayScore: number } | null =
      market.homeScore !== null && market.awayScore !== null
        ? { homeScore: market.homeScore, awayScore: market.awayScore }
        : null;
    const inSave = fixture && state ? bankedResult(state, fixture) : null;
    const result = onMarket ?? inSave;

    if (result) {
      if (market.status !== 'settled' || free.length > 0) {
        findings.push({
          kind: 'unsettled_with_result',
          userId: market.userId!,
          matchId: market.matchId,
          predictionId: market.id,
          openBets: free.length,
          stakes: stakesOf(free),
          problem: onMarket
            ? `${market.matchId} finished ${result.homeScore}-${result.awayScore} but is ${market.status} with ${free.length} bet(s) waiting`
            : `${market.matchId} was banked ${result.homeScore}-${result.awayScore} in the save but the market never got the result`,
          action: `${onMarket ? '' : 'record the result on the market, then '}settle it: pay each winning bet its promised return once, the others nothing`,
          fixable: true,
        });
      }
      for (const bet of held) {
        const marketWithResult = { ...market, ...result };
        if (!isWinner(marketWithResult, bet)) continue; // settlement finishes held losers itself
        findings.push({
          kind: 'held_winner',
          userId: bet.userId,
          matchId: market.matchId,
          predictionId: market.id,
          betId: bet.id,
          openBets: 1,
          stakes: bet.amount,
          problem: `bet ${bet.id} on ${bet.optionId} won ${bet.potentialWin} but was claimed by the old settlement code, which may or may not have paid it before it died`,
          action: `find out from the logs of that run or with the player, then POST /api/predictions/resolve { betId, paidByOldRun } with the admin secret; never paid by this tool`,
          fixable: false,
        });
      }
      continue;
    }

    // No result anywhere. Fine while the fixture is still being played; not
    // fine once the save has moved past it.
    if (!fixture || !state) continue;
    const current: FixtureId = { season: seasonNumber(state.season), round: state.season.week };
    if (isBefore(fixture, current)) {
      findings.push({
        kind: 'banked_without_result',
        userId: market.userId!,
        matchId: market.matchId,
        predictionId: market.id,
        openBets: bets.length,
        stakes: stakesOf(bets),
        problem: `the save is past ${market.matchId} (now on round ${current.round}) but stored no score for it, so its ${bets.length} bet(s) can never be settled on a result`,
        action: 'nothing automatic: the score is not recoverable. An operator has to decide whether to void the bets (refund the stakes); there is no route for that yet',
        fixable: false,
      });
    }
  }

  return { findings, scanned: { saves: saves.length, markets: markets.length } };
}

export interface RepairOptions {
  /** Put right what can be; without it the tool only reports. */
  fix?: boolean;
  /** Told about each fix that threw. */
  onError?: (finding: Finding, error: unknown) => void;
}

/**
 * Reports, and with `fix` repairs, the fixable findings. Safe to run again
 * at any time: a repaired finding is not found by the next run, and a run
 * that died part way left each finding either repaired or untouched.
 */
export async function repairBetting({ fix = false, onError }: RepairOptions = {}): Promise<RepairReport> {
  const { findings, scanned } = await inspectBetting();
  const report: RepairReport = { findings, fixed: [], failed: [], scanned };
  if (!fix) return report;

  for (const finding of findings) {
    if (!finding.fixable) continue;
    try {
      if (finding.kind === 'missing_market') {
        const [save] = (await db
          .select({ state: gameStates.currentState })
          .from(gameStates)
          .where(eq(gameStates.userId, finding.userId))) as Array<{ state: GameState }>;
        if (save) await openFixtureMarket(finding.userId, save.state);
      } else if (finding.kind === 'unsettled_with_result') {
        const [market] = (await db
          .select()
          .from(predictions)
          .where(and(eq(predictions.id, finding.predictionId!), isNull(predictions.homeScore)))) as MarketRow[];
        if (market) {
          const fixture = fixtureOfMatchId(market.matchId)!;
          const [save] = (await db
            .select({ state: gameStates.currentState })
            .from(gameStates)
            .where(eq(gameStates.userId, market.userId!))) as Array<{ state: GameState }>;
          const score = save && bankedResult(save.state, fixture);
          if (score) await recordMarketResult(market.id, score);
        }
        await settleMarket(finding.predictionId!);
      }
      report.fixed.push(finding);
    } catch (error) {
      report.failed.push({ finding, error });
      onError?.(finding, error);
    }
  }
  return report;
}

/** The report as an operator reads it on a terminal. */
export function formatReport(report: RepairReport, { fix }: { fix: boolean }): string {
  const lines: string[] = [];
  lines.push(`Scanned ${report.scanned.saves} save(s) and ${report.scanned.markets} fixture market(s).`);
  if (report.findings.length === 0) {
    lines.push('Nothing out of step: every save has its market, every finished match is settled, no bet is held.');
    return lines.join('\n');
  }

  const titles: Record<FindingKind, string> = {
    missing_market: 'Saves whose current fixture has no market',
    unsettled_with_result: 'Markets with a result and bets still unsettled',
    held_winner: 'Winning bets held for an operator',
    banked_without_result: 'Rounds banked without a stored result',
  };
  const fixedIds = new Set(report.fixed);
  const failedIds = new Map(report.failed.map(f => [f.finding, f.error]));
  for (const kind of Object.keys(titles) as FindingKind[]) {
    const group = report.findings.filter(f => f.kind === kind);
    if (group.length === 0) continue;
    lines.push('', `${titles[kind]}: ${group.length}`);
    for (const f of group.slice(0, 20)) {
      const status = fixedIds.has(f) ? 'FIXED' : failedIds.has(f) ? 'FAILED' : f.fixable ? (fix ? 'SKIPPED' : 'WOULD FIX') : 'NEEDS A PERSON';
      lines.push(`  [${status}] ${f.userId} ${f.matchId}${f.betId ? ` bet ${f.betId}` : ''}${f.stakes ? ` (${f.openBets} bet(s), R$ ${f.stakes.toLocaleString('pt-BR')} staked)` : ''}`);
      lines.push(`      ${f.problem}`);
      lines.push(`      -> ${f.action}`);
      const error = failedIds.get(f);
      if (error) lines.push(`      !! ${error instanceof Error ? error.message : String(error)}`);
    }
    if (group.length > 20) lines.push(`  ... and ${group.length - 20} more`);
  }

  const fixable = report.findings.filter(f => f.fixable).length;
  const manual = report.findings.length - fixable;
  lines.push('');
  if (fix) {
    lines.push(`Fixed ${report.fixed.length} of ${fixable} fixable finding(s)${report.failed.length ? `, ${report.failed.length} failed (run again)` : ''}.`);
  } else {
    lines.push(`${fixable} finding(s) would be fixed with --fix.`);
  }
  if (manual > 0) lines.push(`${manual} finding(s) need a person; this tool never pays a held winner or invents a score.`);
  return lines.join('\n');
}
