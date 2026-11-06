/**
 * One player's fixture, played through the real routes against the real
 * embedded Postgres, with the checks every journey test makes afterwards.
 *
 * The test file mocks next-auth (hoisted, so it has to live there) and calls
 * `openJourney` in its beforeAll. Everything here goes through route
 * handlers or reads the tables directly; nothing about money is taken from
 * a response alone.
 */

import { vi, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

export const CRON_SECRET = 'journey-cron-secret';
export const ADMIN_SECRET = 'journey-admin-secret';

type Json = Record<string, unknown>;
export type Score = { homeScore: number; awayScore: number };
export type BetRow = {
  id: string;
  userId: string;
  predictionId: string;
  optionId: string;
  amount: number;
  potentialWin: number;
  settled: boolean | null;
  won: boolean | null;
  payout: number | null;
  settledAt: Date | null;
  settlingAt: Date | null;
  createdAt: Date | null;
};
export type MarketRow = {
  id: string;
  userId: string | null;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  options: Array<{ id: string; label: string; odds: number; result?: string }>;
  homeScore: number | null;
  awayScore: number | null;
  kickedOffAt: Date | null;
};

export async function openJourney(name: string) {
  const dataDir = mkdtempSync(path.join(tmpdir(), `falamestre-${name}-`));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.ADMIN_SECRET = ADMIN_SECRET;
  vi.resetModules();

  const local = await import('@/db/local');
  const { db } = await import('@/db');
  const schema = await import('@/db/schema');
  const drizzle = await import('drizzle-orm');
  const saveStore = await import('@/lib/save-store');
  const settlement = await import('@/lib/market-settlement');
  const markets = await import('@/lib/fixture-markets');
  const constants = await import('@/lib/constants');
  const decisionEngine = await import('@/lib/decision-engine');
  const matchSeed = await import('@/lib/match-seed');
  const settle = await import('@/app/api/predictions/settle/route');
  const routes = {
    createTeam: (await import('@/app/api/onboarding/create-team/route')).POST,
    decide: (await import('@/app/api/match/decide/route')).POST,
    finalize: (await import('@/app/api/match/finalize/route')).POST,
    match: (await import('@/app/api/match/route')).POST,
    stream: (await import('@/app/api/match/stream/route')).POST,
    board: (await import('@/app/api/predictions/route')).GET,
    bet: (await import('@/app/api/predictions/bet/route')).POST,
    settleJob: settle.GET,
    settleOne: settle.POST,
  };
  await local.localDatabaseReady();
  const { DECISION_TURNS, PREDICTION_MARKET } = constants;

  let requestCounter = 0;
  function request(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    requestCounter += 1;
    return new NextRequest(`http://localhost${url}`, {
      method: init.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        // A distinct client address per request keeps the rate limiter out.
        'x-forwarded-for': `10.${30 + (name.length % 50)}.${Math.floor(requestCounter / 250) % 250}.${requestCounter % 250}`,
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  }
  const post = (url: string, body: unknown, headers?: Record<string, string>) =>
    request(url, { method: 'POST', body, headers });

  let teamCounter = 0;
  async function newSave(): Promise<string> {
    teamCounter += 1;
    const response = await routes.createTeam(
      post('/api/onboarding/create-team', {
        teamName: `${name} FC ${teamCounter}`,
        primaryColor: '#112233',
        secondaryColor: '#AABBCC',
        badgeStyle: 'shield',
      })
    );
    expect(response.status).toBe(201);
    return (await response.json()).userId;
  }

  const loadSave = async (userId: string) => (await saveStore.loadSave(userId))!;
  const stateOf = async (userId: string) => (await loadSave(userId)).state;
  const moneyOf = async (userId: string) => (await stateOf(userId)).user.money;

  async function marketsOf(userId: string): Promise<MarketRow[]> {
    return db.query.predictions.findMany({ where: drizzle.eq(schema.predictions.userId, userId) });
  }
  async function openMarketsOf(userId: string): Promise<MarketRow[]> {
    return (await marketsOf(userId)).filter(m => m.status === 'open');
  }
  async function marketById(id: string): Promise<MarketRow> {
    return db.query.predictions.findFirst({ where: drizzle.eq(schema.predictions.id, id) });
  }
  /** The one market open for the save's next fixture. */
  async function theOpenMarket(userId: string): Promise<MarketRow> {
    const open = await openMarketsOf(userId);
    expect(open, 'exactly one open market').toHaveLength(1);
    return open[0];
  }
  async function betsOf(userId: string): Promise<BetRow[]> {
    const rows: BetRow[] = await db.query.userBets.findMany({
      where: drizzle.eq(schema.userBets.userId, userId),
    });
    return rows.sort((a, b) => +new Date(a.createdAt!) - +new Date(b.createdAt!) || a.id.localeCompare(b.id));
  }
  async function historyOf(userId: string) {
    return db.query.predictionHistory.findFirst({
      where: drizzle.eq(schema.predictionHistory.userId, userId),
    });
  }
  /** The counted fields of a player's history; a player who never bet has none, i.e. zeros. */
  async function historyCounts(userId: string) {
    const row = await historyOf(userId);
    return {
      totalBets: row?.totalBets ?? 0,
      correctBets: row?.correctBets ?? 0,
      currentStreak: row?.currentStreak ?? 0,
      bestStreak: row?.bestStreak ?? 0,
      expertLevel: row?.expertLevel ?? 0,
      totalWinnings: row?.totalWinnings ?? 0,
    };
  }

  /** Ids and timestamps differ between two plays of the same football. */
  const IDENTITY_KEYS = new Set(['id', 'commentaryId', 'commentaryEventId', 'matchId', 'generatedAt', 'date', 'updatedAt']);
  function football(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(football);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !IDENTITY_KEYS.has(key))
          .map(([key, inner]) => [key, football(inner)])
      );
    }
    return value;
  }
  async function kickoffsOf(userId: string): Promise<Array<{
    userId: string; season: number; round: number; seed: string; mode: string;
    setup: Record<string, unknown>; decisions: Record<string, string | null>;
  }>> {
    return db.query.fixtureKickoffs.findMany({
      where: drizzle.eq(schema.fixtureKickoffs.userId, userId),
    });
  }

  async function placeBet(userId: string, predictionId: string, optionId: string, amount: number) {
    const response = await routes.bet(post('/api/predictions/bet', { userId, predictionId, optionId, amount }));
    return { status: response.status, body: (await response.json()) as Json };
  }

  /** Bets `amounts[i]` on the i-th option of the market (home, draw, away). */
  async function betOnEveryOutcome(userId: string, market: MarketRow, amounts = [10_000, 20_000, 30_000]) {
    for (const [i, option] of market.options.entries()) {
      if (amounts[i] === undefined) continue;
      const placed = await placeBet(userId, market.id, option.id, amounts[i]);
      expect(placed.status, `bet on ${option.id}`).toBe(200);
      expect(placed.body.potentialWin).toBe(Math.round(amounts[i] * option.odds));
    }
  }

  function kickoffPrior(state: { squad: { formation?: string; players: unknown[] } }) {
    return {
      homeScore: 0,
      awayScore: 0,
      homeMomentum: 0,
      awayMomentum: 0,
      tension: 30,
      formation: state.squad.formation || '4-3-3',
      mentality: 'balanced',
      hasRedCard: false,
      squad: state.squad.players,
    };
  }

  type Offered = Array<{ id: string } & Json>;
  type Pick = (turnNumber: number, offered: Offered) => (Json & { id: string }) | null;

  /**
   * Plays turns `from..to` (inclusive) of the fixture through decide, as the
   * match screen does, chaining each turn's end state into the next. `prior`
   * and `offered` continue a run that was interrupted.
   */
  async function playTurns(
    userId: string,
    opts: {
      pick?: Pick;
      clientSeed?: string;
      from?: number;
      to?: number;
      prior?: Json;
      offered?: Offered;
    } = {}
  ) {
    const state = await stateOf(userId);
    const pick = opts.pick ?? (() => null);
    const from = opts.from ?? 0;
    const to = opts.to ?? DECISION_TURNS.length - 1;
    let prior: Json = opts.prior ?? kickoffPrior(state);
    let offered: Offered =
      opts.offered ??
      (decisionEngine.buildDecisionTurn(0, 0, 0, state.squad.players, prior.formation as string, 'balanced', false)
        .options as unknown as Offered);
    const turns: Array<{ status: number; body: Json; sent: string | null; played: string | null }> = [];
    for (let turnNumber = from; turnNumber <= to; turnNumber++) {
      const decision = pick(turnNumber, offered);
      const response = await routes.decide(
        post('/api/match/decide', {
          userId,
          turnNumber,
          decision,
          priorState: prior,
          seed: matchSeed.deriveTurnSeed(opts.clientSeed ?? 'the-clients-own-seed', turnNumber),
        })
      );
      const body = (await response.json()) as Json;
      turns.push({ status: response.status, body, sent: decision?.id ?? null, played: (body.decisionId as string | null) ?? null });
      if (response.status !== 200) break;
      prior = { ...prior, ...(body.endState as Json), squad: (body.endState as Json)?.squad ?? prior.squad };
      offered = ((body.nextTurn as Json | null)?.options ?? []) as Offered;
    }
    return {
      turns,
      prior,
      offered,
      score: { homeScore: prior.homeScore as number, awayScore: prior.awayScore as number },
      decisions: turns.map(t => t.played),
    };
  }

  async function finalize(
    userId: string,
    opts: { decisions?: Array<string | null>; claimedScore?: Score; seed?: string } = {}
  ) {
    const state = await stateOf(userId);
    const decisions = opts.decisions ?? DECISION_TURNS.map(() => null);
    const response = await routes.finalize(
      post('/api/match/finalize', {
        userId,
        seed: opts.seed ?? 'the-clients-own-seed',
        week: state.season.week,
        opponent: state.season.nextMatch.opponent,
        isHome: state.season.nextMatch.isHome,
        decisions: decisions.map((decisionId, turnNumber) => ({ turnNumber, decisionId })),
        ...(opts.claimedScore ? { claimedScore: opts.claimedScore } : {}),
      })
    );
    return { status: response.status, body: (await response.json()) as Json };
  }

  async function streamFixture(userId: string) {
    const response = await routes.stream(post('/api/match/stream', { userId, seed: 'the-clients-own-seed' }));
    if (response.status !== 200) return { status: response.status, fulltime: null as Score | null, kickoff: null };
    const events = (await response.text())
      .split('\n')
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.slice(6)) as Json);
    return {
      status: 200,
      kickoff: events.find(e => e.type === 'kickoff') as Json,
      fulltime: events.find(e => e.type === 'fulltime') as unknown as Score,
    };
  }

  async function quickMatch(userId: string) {
    const response = await routes.match(post('/api/match', { userId, seed: 'the-clients-own-seed' }));
    return { status: response.status, body: (await response.json()) as Json };
  }

  async function runJob() {
    const response = await routes.settleJob(request('/api/predictions/settle', { headers: { authorization: `Bearer ${CRON_SECRET}` } }));
    return { status: response.status, body: (await response.json()) as Json };
  }

  async function readBoard(userId: string) {
    const response = await routes.board(request(`/api/predictions?status=open&userId=${userId}`));
    return (await response.json()) as Json & { predictions: MarketRow[]; bets: Json[] };
  }

  /** Which option of a result market a score makes the winner. */
  function winnerOf(market: MarketRow, score: Score) {
    const side = score.homeScore > score.awayScore ? 'home' : score.homeScore < score.awayScore ? 'away' : 'draw';
    return `${market.matchId}-${side}`;
  }

  /**
   * The prediction history these bets should leave, counted the way it has
   * been counted since settlement got its own history update: one bet
   * counted when placed; then, in the order the bets were settled, a win
   * adds a correct bet, extends the streak and adds its payout, a loss ends
   * the streak; the expert level follows the streak.
   */
  function expectedHistory(bets: BetRow[], before = { totalBets: 0, correctBets: 0, currentStreak: 0, bestStreak: 0, totalWinnings: 0 }) {
    const h = { ...before, totalBets: before.totalBets + bets.length, expertLevel: 0 };
    const inSettledOrder = bets
      .filter(b => b.settled)
      .sort((a, b) => +new Date(a.settledAt!) - +new Date(b.settledAt!));
    for (const bet of inSettledOrder) {
      if (!bet.settled) continue;
      if (bet.won) {
        h.correctBets += 1;
        h.currentStreak += 1;
        h.bestStreak = Math.max(h.bestStreak, h.currentStreak);
        h.totalWinnings += bet.payout ?? 0;
      } else {
        h.currentStreak = 0;
      }
    }
    for (const level of [...PREDICTION_MARKET.EXPERT_LEVELS].sort((a, b) => b.minStreak - a.minStreak)) {
      if (h.currentStreak >= level.minStreak) {
        h.expertLevel = level.level;
        break;
      }
    }
    return h;
  }

  /**
   * The books for one player, from the tables alone: every real (money) has
   * to be accounted for by a stake taken, a payout made or a match banked.
   *
   *   money = start − Σ stakes + Σ payouts + Δ match earnings − Δ wages
   *
   * and every settled bet paid exactly what its result says: its promised
   * return if its option won, nothing otherwise.
   */
  async function expectBooksBalance(
    userId: string,
    start: { money: number; totalEarnings: number; totalSpent: number },
    label = ''
  ) {
    const state = await stateOf(userId);
    const bets = await betsOf(userId);
    const stakes = bets.reduce((sum, b) => sum + b.amount, 0);
    const payouts = bets.reduce((sum, b) => sum + (b.settled ? (b.payout ?? 0) : 0), 0);
    const earned = state.teamStats.totalEarnings - start.totalEarnings;
    const spent = state.teamStats.totalSpent - start.totalSpent;
    expect(state.user.money, `${label} money = start − stakes + payouts + earnings − wages`).toBe(
      start.money - stakes + payouts + earned - spent
    );
    for (const bet of bets.filter(b => b.settled)) {
      const market = await marketById(bet.predictionId);
      expect(market.homeScore, `${label} a settled bet has a result`).not.toBeNull();
      const won = winnerOf(market, { homeScore: market.homeScore!, awayScore: market.awayScore! }) === bet.optionId;
      expect(bet.won, `${label} bet on ${bet.optionId} won?`).toBe(won);
      expect(bet.payout, `${label} bet on ${bet.optionId} paid`).toBe(won ? bet.potentialWin : 0);
    }
    return { state, bets };
  }

  async function booksStart(userId: string) {
    const state = await stateOf(userId);
    return {
      money: state.user.money,
      totalEarnings: state.teamStats.totalEarnings,
      totalSpent: state.teamStats.totalSpent,
    };
  }

  async function close() {
    await local.closeLocalDatabase();
    rmSync(dataDir, { recursive: true, force: true });
  }

  return {
    db, schema, drizzle, saveStore, settlement, markets, constants, decisionEngine, matchSeed, routes,
    DECISION_TURNS, request, post, newSave, loadSave, stateOf, moneyOf, marketsOf, openMarketsOf,
    marketById, theOpenMarket, betsOf, historyOf, historyCounts, football, kickoffsOf, placeBet, betOnEveryOutcome, kickoffPrior,
    playTurns, finalize, streamFixture, quickMatch, runJob, readBoard, winnerOf, expectedHistory,
    expectBooksBalance, booksStart, close,
  };
}

export type Journey = Awaited<ReturnType<typeof openJourney>>;

const WRITES = ['insert', 'update', 'delete', 'execute'] as const;

/**
 * Kills the process after `survive` more database writes: that many go
 * through, and every write after them throws, as a dead process writes
 * nothing more (its error handlers included). Reads keep working. `restart`
 * brings the database back, as a new process would find it.
 */
export function dieAfterWrites(db: unknown, survive: number) {
  const target = db as Record<string, (...args: unknown[]) => unknown>;
  let attempted = 0;
  const spies = WRITES.map(method => {
    const original = target[method].bind(target);
    return vi.spyOn(target, method).mockImplementation((...args: unknown[]) => {
      attempted += 1;
      if (attempted > survive) throw new Error('the process died here');
      return original(...args);
    });
  });
  return {
    attempted: () => attempted,
    restart: () => spies.forEach(spy => spy.mockRestore()),
  };
}
