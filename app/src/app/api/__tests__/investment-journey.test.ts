// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, cpSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { eq, and, lte } from 'drizzle-orm';
import type { GameState } from '@/lib/types';

/**
 * One investment, lived from the purchase to the day after it closes.
 *
 * investment-lifecycle.test.ts checks each guarantee on its own, with rows
 * planted by hand and dates relative to whenever the suite happens to run.
 * That leaves the joins between the parts unproven: that the route's own
 * `unlockDate` is the one the cron closes on, that the days the cron pays
 * are the days the screen offers, that the money the claim credits is the
 * money the screen promised, and that the bonus a match and a training
 * session feel is gone the moment the lock is over.
 *
 * So this file buys through the real route and then moves the clock. The
 * system clock is faked (Date only — timers stay real, PGlite needs them) so
 * a day passes in a line and nothing here depends on the wall clock. Every
 * date the investment code decides on comes from `new Date()` in JS and is
 * passed into the query as a parameter, so faking Date puts the whole
 * lifecycle under the test's control; the database's own `now()` is only
 * ever used for audit columns nothing reads.
 *
 * Real embedded Postgres, real save-store, real cron routes. Only next-auth
 * is replaced.
 */

let session: { user: { id: string; email: string; name: string } } | null = null;
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const CRON_SECRET = 'journey-cron-secret';

let dataDir: string;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let schema: typeof import('@/db/schema');
let saveStore: typeof import('@/lib/save-store');
let loadInvestmentBonuses: typeof import('@/lib/investment-bonuses-store').loadInvestmentBonuses;

let routes: {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  investment: typeof import('../investment/route').POST;
  investmentGET: typeof import('../investment/route').GET;
  claim: typeof import('../investment/claim/route').POST;
  dailyYield: typeof import('../cron/daily-yield/route').GET;
  expireYields: typeof import('../cron/expire-yields/route').GET;
  match: typeof import('../match/route').POST;
  train: typeof import('../squad/train/route').POST;
};

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-journey-'));
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
  saveStore = await import('@/lib/save-store');
  ({ loadInvestmentBonuses } = await import('@/lib/investment-bonuses-store'));
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    investment: (await import('../investment/route')).POST,
    investmentGET: (await import('../investment/route')).GET,
    claim: (await import('../investment/claim/route')).POST,
    dailyYield: (await import('../cron/daily-yield/route')).GET,
    expireYields: (await import('../cron/expire-yields/route')).GET,
    match: (await import('../match/route')).POST,
    train: (await import('../squad/train/route')).POST,
  };
  // The embedded Postgres opens lazily, on the first query. Paying for the
  // boot and the migrations here, under beforeAll's 60s budget, keeps the
  // file's first test from timing out when the whole suite competes for CPU.
  await db.query.users.findMany();
}, 60_000);

afterAll(async () => {
  vi.useRealTimers();
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
      // Each call from its own address, so the real rate limiter never trips.
      'x-forwarded-for': `10.77.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
    body: JSON.stringify(body),
  });
}

function cron(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

/**
 * Moves the clock. Only Date is faked: PGlite and the routes' own timeouts
 * need setTimeout to keep working, and nothing in the investment path reads
 * the time any other way.
 */
function clockAt(iso: string) {
  vi.setSystemTime(new Date(iso));
}

async function newPlayer(teamName: string, money = 10_000_000) {
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
    state.user.money = money;
  });
  return userId as string;
}

async function seed(userId: string, change: (state: GameState) => void) {
  const save = await saveStore.loadSave(userId);
  change(save!.state);
  expect((await saveStore.commitSave(userId, save!.state, save!.version)).ok).toBe(true);
}

/** Puts a captured state back verbatim, whatever the save has become since. */
async function restore(userId: string, snapshot: GameState) {
  const save = await saveStore.loadSave(userId);
  const committed = await saveStore.commitSave(
    userId,
    JSON.parse(JSON.stringify(snapshot)) as GameState,
    save!.version
  );
  expect(committed.ok).toBe(true);
}

async function stateOf(userId: string): Promise<GameState> {
  return (await saveStore.loadSave(userId))!.state;
}

async function money(userId: string): Promise<number> {
  return (await stateOf(userId)).user.money;
}

async function screen(userId: string) {
  const response = await routes.investmentGET(
    new NextRequest(`http://localhost/api/investment?userId=${userId}`)
  );
  expect(response.status).toBe(200);
  return response.json();
}

/** Only the columns these tests read; the driver's row type is untyped here. */
type YieldRow = {
  id: string;
  amount: number;
  claimed: boolean;
  expired: boolean;
  yieldDate: string | null;
  expiryDate: Date;
};

type InvestmentRow = {
  id: string;
  option: string;
  active: boolean;
  unlockDate: Date;
};

async function yieldRows(userId: string): Promise<YieldRow[]> {
  return db.query.investmentYields.findMany({
    where: eq(schema.investmentYields.userId, userId),
  }) as Promise<YieldRow[]>;
}

async function investmentRows(userId: string): Promise<InvestmentRow[]> {
  return db.query.fanClubInvestments.findMany({
    where: eq(schema.fanClubInvestments.userId, userId),
  }) as Promise<InvestmentRow[]>;
}

// ---------------------------------------------------------------------------
// The journey

/**
 * Bought at 10:00 on the 1st. `clube_torcedores` runs 3 days, so its lock
 * ends at 10:00 on the 4th; `staff_esportivo` runs 14, ending 10:00 on the
 * 15th. The cron runs at midnight UTC, as a daily cron does, which puts the
 * interesting boundary on the 4th: midnight on the 4th is still inside the
 * lock and must pay, midnight on the 5th is outside it and must close.
 */
const BOUGHT_AT = '2031-03-01T10:00:00.000Z';
const CLUBE_COST = 50_000;
const STAFF_COST = 400_000;
const DAILY_YIELD = 10_000;

describe('one player, from buying to the day after the lock ends', () => {
  let userId: string;
  /** The save exactly as it stood before the first match, to replay it. */
  let beforeMatch: GameState;
  let investedMatchEarnings: number;
  let investedTrainingGain: number;
  let startingMoney: number;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    clockAt(BOUGHT_AT);
    userId = await newPlayer('Jornada FC');
    await seed(userId, (state) => {
      // The player the training checks measure, pinned to a rating where a
      // +20% training speed shows up in a whole-number gain. Squads are
      // rolled unseeded at onboarding, and for a player rated 75 or more the
      // gain rounds to the same integer with or without the bonus (75-79:
      // 3 and 3, 80-84: 2 and 2, 85+: the minimum of 1 both times), so the
      // "smaller without the bonus" check failed whenever the roll put the
      // first player there.
      const measured = state.squad.players[0];
      for (const attribute of ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const) {
        measured[attribute] = 70;
      }
      measured.potential = 85;
      measured.currentForm = 'average';

      // A gate to collect, so the flat +15.000/jogo has somewhere to land:
      // it only applies to a home match with a stadium (see
      // calculateMatchEarnings).
      //
      // 8.000 seats rather than a rounder 20.000 because the gate is carried
      // as a float and only the total is floored: 20.000 x R$50 x 0,7 comes
      // out as 489999.99999999994, and the invested and uninvested totals
      // then land either side of a binary exponent boundary, so the two
      // floors differ by a cruzeiro. That wobble is in the match economy, not
      // in the investment, and is reported rather than papered over — these
      // figures keep it out of the way so the assertion below can be exact.
      state.stadium = { level: 3, capacity: 8_000, amenities: 0, ticketPrice: 50, maintenanceLevel: 1 };
      state.season.division = 'Serie D';
      // Morale pinned at the ceiling on purpose. The fan club's +2 is
      // clamped away at 100, so the two matches below simulate identically
      // from the same seed and the whole difference in what they pay is the
      // money bonus. Morale reaching the simulation is covered separately,
      // in investment-bonuses.test.ts.
      state.squad.morale = 100;
    });
    startingMoney = await money(userId);
  }, 60_000);

  it('buys both products through the route, at the catalogue price', async () => {
    for (const option of ['clube_torcedores', 'staff_esportivo']) {
      const response = await routes.investment(post('/api/investment', { option, userId }));
      expect(response.status).toBe(200);
    }

    expect(await money(userId)).toBe(startingMoney - CLUBE_COST - STAFF_COST);

    const rows = await investmentRows(userId);
    expect(rows).toHaveLength(2);
    // The lock the route wrote is the one every later step turns on.
    const clube = rows.find((r) => r.option === 'clube_torcedores')!;
    const staff = rows.find((r) => r.option === 'staff_esportivo')!;
    expect(clube.unlockDate.toISOString()).toBe('2031-03-04T10:00:00.000Z');
    expect(staff.unlockDate.toISOString()).toBe('2031-03-15T10:00:00.000Z');
  }, 30_000);

  it('pays once a day for each day the lock is still running', async () => {
    // Midnights on the 2nd, 3rd and 4th: all three inside a lock that ends
    // at 10:00 on the 4th.
    for (const day of ['2031-03-02', '2031-03-03', '2031-03-04']) {
      clockAt(`${day}T00:00:00.000Z`);
      const body = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();
      expect(body.yieldsCreated).toBe(1);
      expect(body.investmentsClosed).toBe(0);
    }

    const rows = await yieldRows(userId);
    // One row per day, and only for the product that pays: staff_esportivo
    // yields nothing and must not leave an empty row behind.
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.yieldDate).sort()).toEqual(['2031-03-02', '2031-03-03', '2031-03-04']);
    expect(rows.every((r) => r.amount === DAILY_YIELD)).toBe(true);
  }, 30_000);

  it('shows the player exactly what has accrued, and pays exactly that', async () => {
    clockAt('2031-03-04T09:00:00.000Z');

    const before = await screen(userId);
    expect(before.activeCount).toBe(2);
    expect(before.pendingYieldTotal).toBe(3 * DAILY_YIELD);

    const balanceBefore = await money(userId);
    const claimed = await (await routes.claim(post('/api/investment/claim', { claimAll: true, userId }))).json();

    // What the screen offered, what the route said it paid, and what the
    // save actually gained are one number.
    expect(claimed.claimed).toBe(before.pendingYieldTotal);
    expect(await money(userId)).toBe(balanceBefore + before.pendingYieldTotal);

    const after = await screen(userId);
    expect(after.pendingYieldTotal).toBe(0);
  }, 30_000);

  it('a second claim right after pays nothing more', async () => {
    const balanceBefore = await money(userId);
    const response = await routes.claim(post('/api/investment/claim', { claimAll: true, userId }));

    expect(response.status).toBe(400);
    expect(await money(userId)).toBe(balanceBefore);
  }, 30_000);

  it('is still boosting a real match on the last day of the lock', async () => {
    clockAt('2031-03-04T09:30:00.000Z');

    const bonuses = await loadInvestmentBonuses(userId);
    expect(bonuses.revenuePerMatch).toBe(15_000);
    expect(bonuses.trainingSpeedPercent).toBe(20);

    beforeMatch = await stateOf(userId);
    const played = await routes.match(post('/api/match', { userId, seed: 'journey-seed' }));
    expect(played.status).toBe(200);
    investedMatchEarnings = (await played.json()).earnings.amount;
    expect(investedMatchEarnings).toBeGreaterThan(0);
  }, 30_000);

  it('is still speeding up a real training session on the last day of the lock', async () => {
    await restore(userId, beforeMatch);
    // Pinned so the session is arithmetic, not a dice roll: the gain is
    // floor((base + rand*base) * speed), and the injury roll that follows
    // reads the same stub (99 → no injury).
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      investedTrainingGain = await trainOnce(userId);
    } finally {
      random.mockRestore();
    }
    expect(investedTrainingGain).toBeGreaterThan(0);
  }, 30_000);

  it('closes on the first run after the lock ends, paying nothing more', async () => {
    clockAt('2031-03-05T00:00:00.000Z');
    const body = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();

    expect(body.investmentsClosed).toBe(1);
    // staff_esportivo is still running, and still yields nothing.
    expect(body.yieldsCreated).toBe(0);
    expect(await yieldRows(userId)).toHaveLength(3);

    const rows = await investmentRows(userId);
    expect(rows.find((r) => r.option === 'clube_torcedores')!.active).toBe(false);
    expect(rows.find((r) => r.option === 'staff_esportivo')!.active).toBe(true);
  }, 30_000);

  it('the same match, replayed from the same seed, now pays the bonus back', async () => {
    expect((await loadInvestmentBonuses(userId)).revenuePerMatch).toBe(0);

    await restore(userId, beforeMatch);
    const played = await routes.match(post('/api/match', { userId, seed: 'journey-seed' }));
    expect(played.status).toBe(200);
    const closedEarnings = (await played.json()).earnings.amount;

    // Same save, same seed, same simulated match: the only thing that moved
    // is the investment, so the whole gap is the flat +15.000/jogo it was
    // paying while it ran.
    expect(investedMatchEarnings - closedEarnings).toBe(15_000);
  }, 30_000);

  it('keeps the training bonus, whose own lock has not ended', async () => {
    await restore(userId, beforeMatch);
    expect((await loadInvestmentBonuses(userId)).trainingSpeedPercent).toBe(20);

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      expect(await trainOnce(userId)).toBe(investedTrainingGain);
    } finally {
      random.mockRestore();
    }
  }, 30_000);

  it('loses the training bonus the run after its own lock ends', async () => {
    clockAt('2031-03-16T00:00:00.000Z');
    const body = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();
    expect(body.investmentsClosed).toBe(1);
    expect((await loadInvestmentBonuses(userId)).trainingSpeedPercent).toBe(0);

    await restore(userId, beforeMatch);
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const plainGain = await trainOnce(userId);
      // The identical session, from the identical save, with the identical
      // dice: a smaller gain is the bonus and nothing else.
      expect(plainGain).toBeLessThan(investedTrainingGain);
    } finally {
      random.mockRestore();
    }
  }, 30_000);

  it('leaves nothing owned, nothing pending and nothing further to pay', async () => {
    const view = await screen(userId);
    expect(view.activeCount).toBe(0);
    expect(view.pendingYieldTotal).toBe(0);

    // Every day of both locks, paid once, and the three it paid are the
    // three the player already has.
    const rows = await yieldRows(userId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.claimed)).toBe(true);
    expect(rows.every((r) => !r.expired)).toBe(true);

    const totalPaid = rows.reduce((sum, r) => sum + r.amount, 0);
    expect(totalPaid).toBe(3 * DAILY_YIELD);
  }, 30_000);

  /** Trains one player one session and returns the gain on the first attribute. */
  async function trainOnce(forUser: string): Promise<number> {
    const state = await stateOf(forUser);
    const player = state.squad.players[0];
    const response = await routes.train(
      post('/api/squad/train', { userId: forUser, playerId: player.id, focus: 'technical' })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.gains).toBeDefined();
    return Object.values(body.gains as Record<string, number>)[0];
  }
});

// ---------------------------------------------------------------------------

describe('two yield runs at the same moment', () => {
  it('pays the day once even when both runs start together', async () => {
    clockAt('2031-05-02T00:00:00.000Z');
    const userId = await newPlayer('Simultâneo FC');
    clockAt('2031-05-01T10:00:00.000Z');
    expect(
      (await routes.investment(post('/api/investment', { option: 'clube_torcedores', userId }))).status
    ).toBe(200);

    clockAt('2031-05-02T00:00:00.000Z');
    const [a, b] = await Promise.all([
      routes.dailyYield(cron('/api/cron/daily-yield')),
      routes.dailyYield(cron('/api/cron/daily-yield')),
    ]);
    const bodies = await Promise.all([a.json(), b.json()]);

    // Between them exactly one row was written: the unique index on
    // (investment, day) is what decides it, not which run got there first.
    const createdForThisPlayer = await yieldRows(userId);
    expect(createdForThisPlayer).toHaveLength(1);
    expect(bodies.reduce((sum, body) => sum + body.yieldsCreated, 0)).toBe(1);
    expect(bodies.reduce((sum, body) => sum + body.yieldsAlreadyPaid, 0)).toBe(1);
  }, 30_000);

  it('closes a past-lock investment once even when both runs start together', async () => {
    clockAt('2031-05-01T10:00:00.000Z');
    const userId = await newPlayer('Fecha Junto FC');
    expect(
      (await routes.investment(post('/api/investment', { option: 'clube_torcedores', userId }))).status
    ).toBe(200);

    clockAt('2031-05-10T00:00:00.000Z');
    // The cron closes every past-lock investment in the database, not just
    // this player's, so what is owed has to be counted before the run for
    // the total below to mean anything.
    const dueToClose = (await db.query.fanClubInvestments.findMany({
      where: and(
        eq(schema.fanClubInvestments.active, true),
        lte(schema.fanClubInvestments.unlockDate, new Date())
      ),
    })).length;
    expect(dueToClose).toBeGreaterThanOrEqual(1);

    const [a, b] = await Promise.all([
      routes.dailyYield(cron('/api/cron/daily-yield')),
      routes.dailyYield(cron('/api/cron/daily-yield')),
    ]);
    const bodies = await Promise.all([a.json(), b.json()]);

    const mine = (await investmentRows(userId))[0];
    expect(mine.active).toBe(false);
    // Each row was closed by one run and not the other: the two runs between
    // them report exactly the number that were open, never double.
    expect(bodies.reduce((sum, body) => sum + body.investmentsClosed, 0)).toBe(dueToClose);
    // And a closed investment is never paid on the way out.
    expect(await yieldRows(userId)).toHaveLength(0);
  }, 30_000);
});

// ---------------------------------------------------------------------------

describe('a yield run near midnight UTC', () => {
  it('pays once for a day however late in it the run fires', async () => {
    clockAt('2031-06-01T10:00:00.000Z');
    const userId = await newPlayer('Meia-Noite FC');
    expect(
      (await routes.investment(post('/api/investment', { option: 'clube_torcedores', userId }))).status
    ).toBe(200);

    // The first instant of the 2nd and the last: the same UTC day either
    // way, so the second run pays nothing.
    clockAt('2031-06-02T00:00:00.000Z');
    const first = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();
    clockAt('2031-06-02T23:59:59.999Z');
    const second = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();

    expect(first.yieldsCreated).toBe(1);
    expect(second.yieldsCreated).toBe(0);
    const rows = await yieldRows(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].yieldDate).toBe('2031-06-02');
  }, 30_000);

  it('treats the far side of midnight as the next day, and pays it', async () => {
    clockAt('2031-07-01T10:00:00.000Z');
    const userId = await newPlayer('Virada FC');
    expect(
      (await routes.investment(post('/api/investment', { option: 'clube_torcedores', userId }))).status
    ).toBe(200);

    // A run that slips past midnight is a run for the new day, and the new
    // day is owed. Two payments a tenth of a second apart look alarming and
    // are correct: the guarantee is one payment per UTC day, and these are
    // two days. A schedule that drifts across midnight will pay on the
    // calendar, not on the interval.
    clockAt('2031-07-02T23:59:59.900Z');
    const before = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();
    clockAt('2031-07-03T00:00:00.100Z');
    const after = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();

    expect(before.yieldsCreated).toBe(1);
    expect(after.yieldsCreated).toBe(1);
    const rows = await yieldRows(userId);
    expect(rows.map((r) => r.yieldDate).sort()).toEqual(['2031-07-02', '2031-07-03']);
  }, 30_000);

  it('does not pay a day whose midnight falls after the lock ends', async () => {
    clockAt('2031-08-01T10:00:00.000Z');
    const userId = await newPlayer('Ultimo Dia FC');
    expect(
      (await routes.investment(post('/api/investment', { option: 'clube_torcedores', userId }))).status
    ).toBe(200);

    // Lock ends 10:00 on the 4th. Midnight on the 4th is inside it; one
    // second past 10:00 on the 4th is not.
    clockAt('2031-08-04T00:00:00.000Z');
    expect((await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json()).yieldsCreated).toBe(1);
    clockAt('2031-08-04T10:00:01.000Z');
    const past = await (await routes.dailyYield(cron('/api/cron/daily-yield'))).json();

    expect(past.investmentsClosed).toBe(1);
    // Closed on this run, so not paid on it — even though the day it fell on
    // had not been paid for yet at that hour.
    expect(await yieldRows(userId)).toHaveLength(1);
  }, 30_000);
});

// ---------------------------------------------------------------------------

describe('the screen never shows a total the claim will not pay', () => {
  it('holds across claimed, swept, expiring and live yields at once', async () => {
    clockAt('2031-09-01T10:00:00.000Z');
    const userId = await newPlayer('Coerente FC');
    expect(
      (await routes.investment(post('/api/investment', { option: 'clube_torcedores', userId }))).status
    ).toBe(200);
    const investment = (await investmentRows(userId))[0];

    // One of each kind the claim path can meet.
    await db.insert(schema.investmentYields).values([
      // Already claimed.
      {
        investmentId: investment.id, userId, amount: 1_000, createdAt: new Date(),
        claimed: true, claimedAt: new Date(), expiryDate: new Date('2031-09-20T00:00:00.000Z'),
        yieldDate: '2031-08-20',
      },
      // Already swept by the expiry cron.
      {
        investmentId: investment.id, userId, amount: 2_000, createdAt: new Date(),
        claimed: false, expired: true, expiryDate: new Date('2031-08-25T00:00:00.000Z'),
        yieldDate: '2031-08-21',
      },
      // Past its window but not yet swept — the one the screen used to
      // offer and the claim used to consume for nothing.
      {
        investmentId: investment.id, userId, amount: 4_000, createdAt: new Date(),
        claimed: false, expiryDate: new Date('2031-08-31T23:00:00.000Z'),
        yieldDate: '2031-08-22',
      },
      // Live.
      {
        investmentId: investment.id, userId, amount: 8_000, createdAt: new Date(),
        claimed: false, expiryDate: new Date('2031-09-08T00:00:00.000Z'),
        yieldDate: '2031-08-23',
      },
      // Live, expiring in a minute.
      {
        investmentId: investment.id, userId, amount: 16_000, createdAt: new Date(),
        claimed: false, expiryDate: new Date('2031-09-01T10:01:00.000Z'),
        yieldDate: '2031-08-24',
      },
    ]);

    const view = await screen(userId);
    expect(view.pendingYieldTotal).toBe(24_000);

    const balanceBefore = await money(userId);
    const claimed = await (await routes.claim(post('/api/investment/claim', { claimAll: true, userId }))).json();

    expect(claimed.claimed).toBe(view.pendingYieldTotal);
    expect(await money(userId)).toBe(balanceBefore + view.pendingYieldTotal);
    // The one past its window was neither offered nor consumed: it is still
    // there, unclaimed, for the sweep to book as a loss.
    const stranded = (await yieldRows(userId)).find((r) => r.amount === 4_000)!;
    expect(stranded.claimed).toBe(false);
    expect(stranded.expired).toBe(false);
  }, 30_000);

  it('offers nothing once the sweep has run over everything', async () => {
    clockAt('2031-09-20T00:00:00.000Z');
    const userId = await newPlayer('Varrido FC');
    expect(
      (await routes.investment(post('/api/investment', { option: 'clube_torcedores', userId }))).status
    ).toBe(200);
    const investment = (await investmentRows(userId))[0];
    await db.insert(schema.investmentYields).values({
      investmentId: investment.id, userId, amount: 5_000, createdAt: new Date(),
      claimed: false, expiryDate: new Date('2031-09-19T00:00:00.000Z'), yieldDate: '2031-09-12',
    });

    expect((await screen(userId)).pendingYieldTotal).toBe(0);
    await routes.expireYields(cron('/api/cron/expire-yields'));

    expect((await screen(userId)).pendingYieldTotal).toBe(0);
    const balanceBefore = await money(userId);
    const response = await routes.claim(post('/api/investment/claim', { claimAll: true, userId }));
    expect(response.status).toBe(400);
    expect(await money(userId)).toBe(balanceBefore);
  }, 30_000);
});

// ---------------------------------------------------------------------------

/**
 * The migration, run over a database the old daily job had already been
 * writing to — including the thing the old job did wrong: paying the same
 * investment more than once for one day.
 *
 * This opens its own PGlite instance rather than the app's, so it can stop
 * at 0001, write the legacy rows, and then let 0002 land on them.
 */
describe('0002 over a database written by the old job', () => {
  let migrationDir: string;
  let legacyMigrationsDir: string;
  let probeDataDir: string;

  beforeAll(() => {
    migrationDir = path.resolve(process.cwd(), 'drizzle');
    legacyMigrationsDir = mkdtempSync(path.join(tmpdir(), 'falamestre-mig-'));
    probeDataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-migdata-'));

    // A copy of the migrations folder as it stood before 0002: 0002 and
    // everything after it gone. Dropping 0002 alone is not that: the
    // migrator applies only what is newer than the last migration it
    // recorded, so a later one applied here would make it skip 0002 below.
    cpSync(migrationDir, legacyMigrationsDir, { recursive: true });
    const journal = JSON.parse(
      readFileSync(path.join(legacyMigrationsDir, 'meta', '_journal.json'), 'utf8')
    );
    const cutoff = journal.entries.find((e: { tag: string }) => e.tag === '0002_investment_yield_ledger').idx;
    for (const entry of journal.entries.filter((e: { idx: number }) => e.idx >= cutoff)) {
      rmSync(path.join(legacyMigrationsDir, `${entry.tag}.sql`));
    }
    journal.entries = journal.entries.filter((e: { idx: number }) => e.idx < cutoff);
    writeFileSync(path.join(legacyMigrationsDir, 'meta', '_journal.json'), JSON.stringify(journal));
  });

  afterAll(() => {
    rmSync(legacyMigrationsDir, { recursive: true, force: true });
    rmSync(probeDataDir, { recursive: true, force: true });
  });

  it('applies cleanly and leaves every legacy yield readable and payable', async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');

    const client = await PGlite.create(probeDataDir);
    try {
      // --- the database as the old job left it -----------------------------
      await migrate(drizzle({ client, schema }), { migrationsFolder: legacyMigrationsDir });

      // The old insert: no yield_date, no expired, and — the bug — the same
      // investment paid three times for one day because the job ran three
      // times that day.
      const investmentId = '22222222-2222-2222-2222-222222222222';
      for (let i = 0; i < 3; i++) {
        await client.query(
          `INSERT INTO investment_yields (investment_id, user_id, amount, created_at, claimed, expiry_date)
           VALUES ($1, $2, $3, $4, false, $5)`,
          [investmentId, 'user_legado', 10_000, '2031-02-10T06:00:00Z', '2031-02-17T06:00:00Z']
        );
      }
      // And an ordinary single payment on another day.
      await client.query(
        `INSERT INTO investment_yields (investment_id, user_id, amount, created_at, claimed, expiry_date)
         VALUES ($1, $2, $3, $4, false, $5)`,
        [investmentId, 'user_legado', 10_000, '2031-02-11T06:00:00Z', '2031-02-18T06:00:00Z']
      );

      // --- the migration ---------------------------------------------------
      // A duplicated day is exactly what would break a unique index, so this
      // not throwing is the claim being tested.
      await migrate(drizzle({ client, schema }), { migrationsFolder: migrationDir });

      const rows = (await client.query(
        `SELECT amount, claimed, expired, yield_date FROM investment_yields ORDER BY created_at, yield_date NULLS LAST`
      )).rows as Array<{ amount: number; claimed: boolean; expired: boolean; yield_date: Date | string | null }>;

      // Straight off the driver rather than through Drizzle, so a date
      // column arrives as a Date; the app reads these through Drizzle, which
      // maps them to 'YYYY-MM-DD'.
      const asDay = (value: Date | string | null) =>
        value === null ? null : (value instanceof Date ? value.toISOString().slice(0, 10) : value);

      // Nothing was dropped or silently paid: four rows in, four rows out,
      // all still unclaimed, none marked expired, all still worth 10.000.
      expect(rows).toHaveLength(4);
      expect(rows.every((r) => r.claimed === false)).toBe(true);
      expect(rows.every((r) => r.expired === false)).toBe(true);
      expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBe(40_000);

      // Each day the old job paid is now claimed by exactly one row, so the
      // new job cannot pay that day again. The duplicates it left keep their
      // money and stay out of the index.
      const dated = rows.filter((r) => r.yield_date !== null).map((r) => asDay(r.yield_date)).sort();
      expect(dated).toEqual(['2031-02-10', '2031-02-11']);
      expect(rows.filter((r) => r.yield_date === null)).toHaveLength(2);

      // The index is real and enforcing from here on.
      await expect(client.query(
        `INSERT INTO investment_yields (investment_id, user_id, amount, created_at, claimed, expiry_date, yield_date)
         VALUES ($1, $2, $3, $4, false, $5, $6)`,
        [investmentId, 'user_legado', 10_000, '2031-02-10T07:00:00Z', '2031-02-17T07:00:00Z', '2031-02-10']
      )).rejects.toThrow();
    } finally {
      await client.close();
    }
  }, 60_000);
});
