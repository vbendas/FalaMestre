// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { eq } from 'drizzle-orm';
import type { GameState } from '@/lib/types';

/**
 * The life of an investment, end to end: bought, paid daily, closed when its
 * printed duration is over, its yields claimed exactly once or lost in the
 * open.
 *
 * Each test here pins one of the ways the lifecycle used to leak money, in
 * either direction:
 *
 *  - nothing ever closed an investment, so every purchase paid and boosted
 *    for ever;
 *  - the daily cron paid everyone again if it ran twice in a day, and wrote
 *    a 0-amount row every day for the six products with no yield;
 *  - the claim route marked a just-expired yield claimed while paying nothing
 *    for it;
 *  - the expiry sweep booked lost money as claimed, with a timestamp, and
 *    judged expiry by recomputing seven days from createdAt instead of
 *    reading the expiryDate every other path reads;
 *  - with auth off (dev), claiming demanded a session that buying did not.
 *
 * Real embedded Postgres, real save-store. Only next-auth is replaced.
 */

let session: { user: { id: string; email: string; name: string } } | null = null;
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const CRON_SECRET = 'lifecycle-cron-secret';

let dataDir: string;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let schema: typeof import('@/db/schema');
let saveStore: typeof import('@/lib/save-store');
let loadInvestmentBonuses: typeof import('@/lib/investment-bonuses-store').loadInvestmentBonuses;
let NO_INVESTMENT_BONUSES: typeof import('@/lib/investment-bonuses').NO_INVESTMENT_BONUSES;

let routes: {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  investment: typeof import('../investment/route').POST;
  investmentGET: typeof import('../investment/route').GET;
  claim: typeof import('../investment/claim/route').POST;
  dailyYield: typeof import('../cron/daily-yield/route').GET;
  expireYields: typeof import('../cron/expire-yields/route').GET;
};

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-lifecycle-'));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  process.env.CRON_SECRET = CRON_SECRET;
  vi.resetModules();
  local = await import('@/db/local');
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  saveStore = await import('@/lib/save-store');
  ({ loadInvestmentBonuses } = await import('@/lib/investment-bonuses-store'));
  ({ NO_INVESTMENT_BONUSES } = await import('@/lib/investment-bonuses'));
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    investment: (await import('../investment/route')).POST,
    investmentGET: (await import('../investment/route')).GET,
    claim: (await import('../investment/claim/route')).POST,
    dailyYield: (await import('../cron/daily-yield/route')).GET,
    expireYields: (await import('../cron/expire-yields/route')).GET,
  };
  // The embedded Postgres opens lazily, on the first query. Paying for the
  // boot and the migrations here, under beforeAll's 60s budget, keeps the
  // file's first test from timing out when the whole suite competes for CPU.
  await db.query.users.findMany();
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  session = null;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// Plumbing

let requestCounter = 0;
function post(url: string, body: unknown): NextRequest {
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.44.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
    body: JSON.stringify(body),
  });
}

function cron(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function newPlayer(teamName: string) {
  const created = await routes.createTeam(
    post('/api/onboarding/create-team', {
      teamName,
      primaryColor: '#112233',
      secondaryColor: '#AABBCC',
      badgeStyle: 'shield',
    })
  );
  expect(created.status).toBe(201);
  const { userId } = await created.json();
  await seed(userId, (state) => {
    state.user.money = 10_000_000;
  });
  return userId as string;
}

async function seed(userId: string, change: (state: GameState) => void) {
  const save = await saveStore.loadSave(userId);
  change(save!.state);
  expect((await saveStore.commitSave(userId, save!.state, save!.version)).ok).toBe(true);
}

async function money(userId: string): Promise<number> {
  const save = await saveStore.loadSave(userId);
  return save!.state.user.money;
}

/** A stored investment, written directly, with full control over its dates. */
async function storedInvestment(userId: string, overrides: Partial<{
  option: string;
  amount: number;
  yieldPerDay: number;
  unlockDate: Date;
  active: boolean;
}> = {}) {
  const inserted = await db.insert(schema.fanClubInvestments).values({
    userId,
    option: overrides.option ?? 'clube_torcedores',
    amount: overrides.amount ?? 50_000,
    startDate: new Date(Date.now() - 10 * DAY_MS),
    unlockDate: overrides.unlockDate ?? new Date(Date.now() + 2 * DAY_MS),
    yieldPerDay: overrides.yieldPerDay ?? 10_000,
    moraleBoost: 2,
    revenueBoostPerMatch: 15_000,
    active: overrides.active ?? true,
  }).returning();
  return inserted[0];
}

async function yieldRows(userId: string) {
  return db.query.investmentYields.findMany({
    where: eq(schema.investmentYields.userId, userId),
  });
}

// ---------------------------------------------------------------------------

describe('closing an investment when its lock is over', () => {
  it('the daily run closes a past-lock investment without paying it once more', async () => {
    const userId = await newPlayer('Encerra FC');
    // Ten days past its lock: bought long before anything closed investments.
    const row = await storedInvestment(userId, { unlockDate: new Date(Date.now() - 10 * DAY_MS) });

    const response = await routes.dailyYield(cron('/api/cron/daily-yield'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.investmentsClosed).toBeGreaterThanOrEqual(1);

    const stored = await db.query.fanClubInvestments.findMany({
      where: eq(schema.fanClubInvestments.id, row.id),
    });
    expect(stored[0].active).toBe(false);
    expect(await yieldRows(userId)).toHaveLength(0);
  }, 30_000);

  it('a past-lock investment stops boosting and stops being listed before any cron runs', async () => {
    // The cron is what flips `active`, so between the lock ending and the
    // next run the row is still flagged active. The readers must not believe
    // the flag.
    const userId = await newPlayer('Expira FC');
    await storedInvestment(userId, {
      option: 'infraestrutura',
      unlockDate: new Date(Date.now() - 60_000),
      yieldPerDay: 0,
    });

    expect(await loadInvestmentBonuses(userId)).toEqual(NO_INVESTMENT_BONUSES);

    const body = await (await routes.investmentGET(
      new NextRequest(`http://localhost/api/investment?userId=${userId}`)
    )).json();
    expect(body.activeCount).toBe(0);
  }, 30_000);

  it('a still-running investment keeps paying and boosting', async () => {
    const userId = await newPlayer('Segue FC');
    await storedInvestment(userId, { unlockDate: new Date(Date.now() + 2 * DAY_MS) });

    await routes.dailyYield(cron('/api/cron/daily-yield'));

    expect(await yieldRows(userId)).toHaveLength(1);
    expect((await loadInvestmentBonuses(userId)).moralePercent).toBe(2);
  }, 30_000);
});

describe('paying a day exactly once', () => {
  it('a second run on the same day pays nobody again', async () => {
    const userId = await newPlayer('Uma Vez FC');
    await storedInvestment(userId);

    const first = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();
    const second = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();

    expect(first.yieldsCreated).toBeGreaterThanOrEqual(1);
    expect(second.yieldsCreated).toBe(0);
    expect(second.yieldsAlreadyPaid).toBeGreaterThanOrEqual(1);
    expect(await yieldRows(userId)).toHaveLength(1);
  }, 30_000);

  it('writes no row at all for a product that pays no daily yield', async () => {
    const userId = await newPlayer('Sem Rendimento FC');
    await storedInvestment(userId, { option: 'infraestrutura', yieldPerDay: 0 });

    await routes.dailyYield(cron('/api/cron/daily-yield'));

    expect(await yieldRows(userId)).toHaveLength(0);
  }, 30_000);
});

describe('the expiry sweep', () => {
  it('judges by the row expiryDate and books the loss as expired, not claimed', async () => {
    const userId = await newPlayer('Varrida FC');
    const investment = await storedInvestment(userId);
    // Created just now but already past its window — the case the old sweep,
    // which recomputed seven days from createdAt, would have left alone for
    // a week while the claim route already refused it.
    await db.insert(schema.investmentYields).values({
      investmentId: investment.id,
      userId,
      amount: 10_000,
      createdAt: new Date(),
      claimed: false,
      expiryDate: new Date(Date.now() - 60_000),
    });

    const body = await (await routes.expireYields(cron('/api/cron/expire-yields'))).json();

    expect(body.expiredCount).toBe(1);
    expect(body.totalLost).toBe(10_000);
    const rows = await yieldRows(userId);
    expect(rows[0].expired).toBe(true);
    expect(rows[0].claimed).toBe(false);
    expect(rows[0].claimedAt).toBeNull();
  }, 30_000);

  it('leaves a yield still inside its window alone', async () => {
    const userId = await newPlayer('Dentro do Prazo FC');
    const investment = await storedInvestment(userId);
    await db.insert(schema.investmentYields).values({
      investmentId: investment.id,
      userId,
      amount: 10_000,
      createdAt: new Date(Date.now() - 10 * DAY_MS), // old, but window still open
      claimed: false,
      expiryDate: new Date(Date.now() + DAY_MS),
    });

    await routes.expireYields(cron('/api/cron/expire-yields'));

    const rows = await yieldRows(userId);
    expect(rows[0].expired).toBe(false);
    expect(rows[0].claimed).toBe(false);
  }, 30_000);
});

describe('claiming', () => {
  it('works with auth off, off the same userId the purchase used', async () => {
    const userId = await newPlayer('Dev Resgata FC');
    expect(
      (await routes.investment(post('/api/investment', { option: 'clube_torcedores', userId }))).status
    ).toBe(200);
    const investment = (await db.query.fanClubInvestments.findMany({
      where: eq(schema.fanClubInvestments.userId, userId),
    }))[0];
    await db.insert(schema.investmentYields).values({
      investmentId: investment.id,
      userId,
      amount: 10_000,
      createdAt: new Date(),
      claimed: false,
      expiryDate: new Date(Date.now() + 7 * DAY_MS),
    });
    const before = await money(userId);

    const response = await routes.claim(post('/api/investment/claim', { claimAll: true, userId }));

    expect(response.status).toBe(200);
    expect((await response.json()).claimed).toBe(10_000);
    expect(await money(userId)).toBe(before + 10_000);
  }, 30_000);

  it('refuses a claim for someone else even with a userId in the body', async () => {
    const userId = await newPlayer('Dono FC');
    session = { user: { id: userId, email: 'x@example.test', name: 'Dono' } };

    const response = await routes.claim(
      post('/api/investment/claim', { claimAll: true, userId: 'user_outroalguem' })
    );

    expect(response.status).toBe(403);
  }, 30_000);

  it('never consumes a yield that expired between the screen and the press', async () => {
    const userId = await newPlayer('Quase FC');
    const investment = await storedInvestment(userId);
    await db.insert(schema.investmentYields).values([
      {
        investmentId: investment.id,
        userId,
        amount: 10_000,
        createdAt: new Date(),
        claimed: false,
        expiryDate: new Date(Date.now() + 7 * DAY_MS),
      },
      {
        // Expired after the screen loaded it. The old loop marked this row
        // claimed and paid nothing for it.
        investmentId: investment.id,
        userId,
        amount: 99_999,
        createdAt: new Date(),
        claimed: false,
        expiryDate: new Date(Date.now() - 60_000),
        yieldDate: '2020-01-01',
      },
    ]);
    const before = await money(userId);

    const response = await routes.claim(post('/api/investment/claim', { claimAll: true, userId }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.claimed).toBe(10_000);
    expect(body.expired).toBe(1);
    expect(await money(userId)).toBe(before + 10_000);

    // The expired row is untouched — not claimed, not swept — and the loss,
    // when the sweep takes it, is booked as expired.
    const expiredRow = (await yieldRows(userId)).find((y: { amount: number }) => y.amount === 99_999)!;
    expect(expiredRow.claimed).toBe(false);
    expect(expiredRow.expired).toBe(false);
  }, 30_000);

  it('refuses a named yield that has expired, in words, consuming nothing', async () => {
    const userId = await newPlayer('Nomeado FC');
    const investment = await storedInvestment(userId);
    const inserted = await db.insert(schema.investmentYields).values({
      investmentId: investment.id,
      userId,
      amount: 10_000,
      createdAt: new Date(),
      claimed: false,
      expiryDate: new Date(Date.now() - 60_000),
    }).returning();

    const response = await routes.claim(
      post('/api/investment/claim', { yieldId: inserted[0].id, userId })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('expired');
    const rows = await yieldRows(userId);
    expect(rows[0].claimed).toBe(false);
  }, 30_000);

  it('pays a yield once even when two claims race for it', async () => {
    const userId = await newPlayer('Corrida FC');
    const investment = await storedInvestment(userId);
    await db.insert(schema.investmentYields).values({
      investmentId: investment.id,
      userId,
      amount: 10_000,
      createdAt: new Date(),
      claimed: false,
      expiryDate: new Date(Date.now() + 7 * DAY_MS),
    });
    const before = await money(userId);

    const [a, b] = await Promise.all([
      routes.claim(post('/api/investment/claim', { claimAll: true, userId })),
      routes.claim(post('/api/investment/claim', { claimAll: true, userId })),
    ]);

    // Both may answer 200 (the loser claims zero rows) or the loser may
    // refuse for having found nothing pending; what cannot happen is the
    // money arriving twice.
    const bodies = await Promise.all([a.json(), b.json()]);
    const paid = bodies
      .filter((body) => body.success)
      .reduce((sum, body) => sum + (body.claimed ?? 0), 0);
    expect(paid).toBe(10_000);
    expect(await money(userId)).toBe(before + 10_000);
  }, 30_000);
});
