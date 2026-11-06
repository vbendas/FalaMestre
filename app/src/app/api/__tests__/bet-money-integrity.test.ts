// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Money and bets cannot come apart, whenever the process dies.
 *
 * Paying a bet and marking it settled used to be separate writes (claim,
 * pay, mark), as did recording a bet and taking its stake (insert, debit).
 * A process dying between any two left one without the other: a bet
 * claimed for ever with nobody able to tell whether it was paid, or a bet
 * that settlement would pay with no stake ever taken.
 *
 * Each test here kills the process after N database writes, for every N
 * the operation has, by making every write from that point on throw (a
 * dead process writes nothing, its error handlers included). Then it lets
 * the scheduled settlement job run, as it would after a restart, and checks
 * the books: the money that moved matches the bets that exist and what they
 * paid, exactly once.
 *
 * Real routes against the real embedded Postgres.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const CRON_SECRET = 'integrity-cron-secret';

let dataDir: string;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let schema: typeof import('@/db/schema');
let drizzle: typeof import('drizzle-orm');
let saveStore: typeof import('@/lib/save-store');
let settlement: typeof import('@/lib/market-settlement');
let routes: {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  bet: typeof import('../predictions/bet/route').POST;
  settleJob: typeof import('../predictions/settle/route').GET;
};

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-integrity-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  process.env.CRON_SECRET = CRON_SECRET;
  vi.resetModules();
  local = await import('@/db/local');
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  drizzle = await import('drizzle-orm');
  saveStore = await import('@/lib/save-store');
  settlement = await import('@/lib/market-settlement');
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    bet: (await import('../predictions/bet/route')).POST,
    settleJob: (await import('../predictions/settle/route')).GET,
  };
  await local.localDatabaseReady();
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.restoreAllMocks();
  for (const level of ['warn', 'error', 'info', 'log'] as const) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

let requestCounter = 0;
function request(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.11.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

let teamCounter = 0;
async function newSave(): Promise<string> {
  teamCounter += 1;
  const response = await routes.createTeam(
    request('/api/onboarding/create-team', {
      method: 'POST',
      body: { teamName: `Caixa FC ${teamCounter}`, primaryColor: '#112233', secondaryColor: '#AABBCC', badgeStyle: 'shield' },
    }),
  );
  expect(response.status).toBe(201);
  return (await response.json()).userId;
}

async function moneyOf(userId: string): Promise<number> {
  return (await saveStore.loadSave(userId))!.state.user.money;
}

async function openMarketOf(userId: string) {
  const [market] = await db.query.predictions.findMany({
    where: drizzle.and(drizzle.eq(schema.predictions.userId, userId), drizzle.eq(schema.predictions.status, 'open')),
  });
  return market as typeof schema.predictions.$inferSelect;
}

async function betsOf(userId: string): Promise<Array<typeof schema.userBets.$inferSelect>> {
  return db.query.userBets.findMany({ where: drizzle.eq(schema.userBets.userId, userId) });
}

async function historyOf(userId: string) {
  return db.query.predictionHistory.findFirst({ where: drizzle.eq(schema.predictionHistory.userId, userId) });
}

function placeBet(userId: string, predictionId: string, optionId: string, amount: number) {
  return routes.bet(request('/api/predictions/bet', { method: 'POST', body: { userId, predictionId, optionId, amount } }));
}

async function runSettlementJob() {
  const response = await routes.settleJob(
    request('/api/predictions/settle', { headers: { authorization: `Bearer ${CRON_SECRET}` } }),
  );
  return { status: response.status, body: await response.json() };
}

const WRITES = ['insert', 'update', 'delete', 'execute'] as const;

/**
 * The process dies after `survive` more database writes: that many go
 * through, and every write from then on throws. Reads keep working; a dead
 * process makes none that matter, and it cannot write what it read.
 * Returns how many writes were attempted, so a caller knows when N has run
 * past the end of the operation.
 */
function dieAfterWrites(survive: number) {
  let attempted = 0;
  for (const method of WRITES) {
    const original = (db as Record<string, (...args: unknown[]) => unknown>)[method].bind(db);
    vi.spyOn(db as Record<string, (...args: unknown[]) => unknown>, method).mockImplementation((...args: unknown[]) => {
      attempted += 1;
      if (attempted > survive) throw new Error('the process died here');
      return original(...args);
    });
  }
  return {
    attempted: () => attempted,
    restart: () => {
      for (const method of WRITES) {
        (db as Record<string, { mockRestore?: () => void }>)[method].mockRestore?.();
      }
    },
  };
}

describe('settling a winning bet, with the process dying after each write in turn', () => {
  it('always ends, once the job has run, with the bet settled, paid exactly once and counted once', async () => {
    let survive = 0;
    for (;;) {
      const userId = await newSave();
      const market = await openMarketOf(userId);
      const placed = await placeBet(userId, market.id, `${market.matchId}-home`, 10_000);
      expect(placed.status).toBe(200);
      const { potentialWin } = await placed.json();
      // The match is over and home won; the result is on the market.
      await settlement.recordMarketResult(market.id, { homeScore: 2, awayScore: 0 });
      const before = await moneyOf(userId);

      const crash = dieAfterWrites(survive);
      await settlement.settleMarket(market.id).catch(() => {});
      const attempted = crash.attempted();
      crash.restart();

      const job = await runSettlementJob();
      const at = `process died after ${survive} write(s)`;
      expect(job.status, at).toBe(200);

      const [bet] = await betsOf(userId);
      expect(bet.settled, `${at}: the bet is settled`).toBe(true);
      expect(bet.won, at).toBe(true);
      expect(bet.payout, at).toBe(potentialWin);
      expect(await moneyOf(userId), `${at}: paid exactly once`).toBe(before + potentialWin);
      const history = await historyOf(userId);
      expect(history?.correctBets, `${at}: counted once`).toBe(1);
      expect(history?.totalWinnings, at).toBe(potentialWin);

      // A second job run after that changes nothing.
      await runSettlementJob();
      expect(await moneyOf(userId), at).toBe(before + potentialWin);

      if (attempted <= survive) break; // the run got through every write it makes
      survive += 1;
    }
  }, 60_000);

  it('leaves no bet that the job cannot finish', async () => {
    // What a claim that outlived its run looks like to the job: it is
    // reported, never finished. Every run above must leave none behind.
    const job = await runSettlementJob();
    expect(job.body.stuck).toBe(0);
  });
});

describe('placing a bet, with the process dying after each write in turn', () => {
  it('either takes the stake and records the bet, or does neither, and settlement agrees', async () => {
    let survive = 0;
    for (;;) {
      const userId = await newSave();
      const market = await openMarketOf(userId);
      const before = await moneyOf(userId);
      const amount = 10_000;

      const crash = dieAfterWrites(survive);
      await placeBet(userId, market.id, `${market.matchId}-home`, amount).catch(() => null);
      const attempted = crash.attempted();
      crash.restart();

      const at = `process died after ${survive} write(s)`;
      const bets = await betsOf(userId);
      expect(bets.length, at).toBeLessThanOrEqual(1);
      const recorded = bets.length === 1;
      expect(await moneyOf(userId), `${at}: stake taken if and only if the bet exists`).toBe(
        recorded ? before - amount : before,
      );
      expect((await historyOf(userId))?.totalBets ?? 0, `${at}: the bet is counted if and only if it exists`).toBe(
        recorded ? 1 : 0,
      );

      // Home wins. A bet with no stake behind it would now be paid for free.
      await settlement.recordMarketResult(market.id, { homeScore: 1, awayScore: 0 });
      await runSettlementJob();
      const payout = recorded ? bets[0].potentialWin : 0;
      expect(await moneyOf(userId), `${at}: settlement pays only a bet that was paid for`).toBe(
        before - (recorded ? amount : 0) + payout,
      );

      if (attempted <= survive) break;
      survive += 1;
    }
  }, 60_000);
});
