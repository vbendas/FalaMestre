// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * The stake only moves when there is a bet to show for it.
 *
 * Placing a bet used to take the money off the save *before* it looked at the
 * prediction, so a bet on one that did not exist, or that had already closed,
 * charged the player and then failed. Worse, a failed debit was logged and
 * swallowed, so the bet was recorded anyway and the stake was never taken.
 *
 * Every refusal below is checked the same way: the balance is exactly what it
 * was, and no bet row was written. Then one good bet, to show the debit does
 * happen and is for exactly the stake. It runs against a real embedded
 * database, so a write that lands when it should not is a failure here.
 */

let session: { user: { id: string } } | null = null;

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const USER_ID = 'bettor_abc123';
const OTHER_USER_ID = 'bystander_xyz789';
const STARTING_MONEY = 500_000;

// A well-formed uuid that is deliberately not in the predictions table.
const ABSENT_UUID = '00000000-0000-4000-8000-000000000999';

const OPTIONS = [
  { id: 'home', label: 'Casa', odds: 1.8, totalBets: 0 },
  { id: 'away', label: 'Fora', odds: 2.4, totalBets: 0 },
];

let dataDir: string;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let schema: typeof import('@/db/schema');
let betPOST: typeof import('../predictions/bet/route').POST;
let eq: typeof import('drizzle-orm').eq;
let createInitialGameState: typeof import('@/lib/game-engine').createInitialGameState;

/** The ids of the predictions seeded once in beforeAll. */
const seeded: Record<'open' | 'closed' | 'settled' | 'expired', string> = {
  open: '',
  closed: '',
  settled: '',
  expired: '',
};

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-bet-'));
  delete process.env.DATABASE_URL;
  delete process.env.AUTH_DISABLED;
  process.env.PGLITE_DATA_DIR = dataDir;
  vi.resetModules();

  local = await import('@/db/local');
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  ({ eq } = await import('drizzle-orm'));
  ({ createInitialGameState } = await import('@/lib/game-engine'));
  betPOST = (await import('../predictions/bet/route')).POST;

  const hour = 60 * 60 * 1000;
  const future = new Date(Date.now() + hour);
  const past = new Date(Date.now() - hour);

  const rows = await db.insert(schema.predictions).values([
    { matchId: 'm-open', homeTeam: 'A', awayTeam: 'B', type: 'win_draw_loss',
      options: OPTIONS, entryCost: 0, deadline: future, status: 'open', matchDate: future },
    { matchId: 'm-closed', homeTeam: 'A', awayTeam: 'B', type: 'win_draw_loss',
      options: OPTIONS, entryCost: 0, deadline: future, status: 'closed', matchDate: future },
    { matchId: 'm-settled', homeTeam: 'A', awayTeam: 'B', type: 'win_draw_loss',
      options: OPTIONS, entryCost: 0, deadline: past, status: 'settled', matchDate: past },
    // Still flagged open, but the deadline has gone by.
    { matchId: 'm-expired', homeTeam: 'A', awayTeam: 'B', type: 'win_draw_loss',
      options: OPTIONS, entryCost: 0, deadline: past, status: 'open', matchDate: past },
  ]).returning();

  seeded.open = rows[0].id;
  seeded.closed = rows[1].id;
  seeded.settled = rows[2].id;
  seeded.expired = rows[3].id;
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

/** A fresh save at STARTING_MONEY before every test. */
beforeEach(async () => {
  session = { user: { id: USER_ID } };

  for (const id of [USER_ID, OTHER_USER_ID]) {
    const state = createInitialGameState(id, 'Flamengo');
    state.user.money = STARTING_MONEY;

    await db.insert(schema.gameStates).values({
      userId: id,
      team: state.user.team,
      currentState: state,
    }).onConflictDoUpdate({
      target: schema.gameStates.userId,
      set: { currentState: state },
    });
  }

  await db.delete(schema.userBets).where(eq(schema.userBets.userId, USER_ID));
  await db.delete(schema.predictionHistory).where(eq(schema.predictionHistory.userId, USER_ID));
});

let requestCounter = 0;
function bet(body: unknown): NextRequest {
  // A distinct client address per request keeps the rate limiter out of the way.
  requestCounter += 1;
  return new NextRequest('http://localhost/api/predictions/bet', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.4.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
    body: JSON.stringify(body),
  });
}

async function balanceOf(userId: string): Promise<number> {
  const row = await db.query.gameStates.findFirst({
    where: eq(schema.gameStates.userId, userId),
  });
  return row!.currentState.user.money;
}

async function betCount(userId: string): Promise<number> {
  const rows = await db.query.userBets.findMany({
    where: eq(schema.userBets.userId, userId),
  });
  return rows.length;
}

describe('placing a bet', () => {
  it('debits exactly the stake once the bet is recorded', async () => {
    const response = await betPOST(
      bet({ userId: USER_ID, predictionId: seeded.open, optionId: 'home', amount: 25_000 })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      newBalance: STARTING_MONEY - 25_000,
    });

    // The reported balance is the stored one, not a number invented in the reply.
    expect(await balanceOf(USER_ID)).toBe(STARTING_MONEY - 25_000);
    expect(await betCount(USER_ID)).toBe(1);
  });

  // Each case is a bet the route must turn away. The invariant is the same
  // for all of them, so they share one body.
  const refusals: { name: string; body: () => unknown; status: number }[] = [
    {
      name: 'an id that is not a uuid',
      body: () => ({ userId: USER_ID, predictionId: 'none', optionId: 'home', amount: 10_000 }),
      status: 400,
    },
    {
      name: 'a prediction that does not exist',
      body: () => ({ userId: USER_ID, predictionId: ABSENT_UUID, optionId: 'home', amount: 10_000 }),
      status: 404,
    },
    {
      name: 'a prediction that is closed',
      body: () => ({ userId: USER_ID, predictionId: seeded.closed, optionId: 'home', amount: 10_000 }),
      status: 409,
    },
    {
      name: 'a prediction that is already settled',
      body: () => ({ userId: USER_ID, predictionId: seeded.settled, optionId: 'home', amount: 10_000 }),
      status: 409,
    },
    {
      name: 'a prediction whose deadline has passed',
      body: () => ({ userId: USER_ID, predictionId: seeded.expired, optionId: 'home', amount: 10_000 }),
      status: 409,
    },
    {
      name: 'an option the prediction does not offer',
      body: () => ({ userId: USER_ID, predictionId: seeded.open, optionId: 'nonsense', amount: 10_000 }),
      status: 400,
    },
    {
      name: 'a stake larger than the balance',
      body: () => ({ userId: USER_ID, predictionId: seeded.open, optionId: 'home', amount: STARTING_MONEY + 1 }),
      status: 400,
    },
    {
      // This one used to *credit* the player: the funds check passed and the
      // subtraction of a negative went the wrong way.
      name: 'a negative stake',
      body: () => ({ userId: USER_ID, predictionId: seeded.open, optionId: 'home', amount: -10_000 }),
      status: 400,
    },
    {
      name: 'a fractional stake',
      body: () => ({ userId: USER_ID, predictionId: seeded.open, optionId: 'home', amount: 1.5 }),
      status: 400,
    },
  ];

  for (const { name, body, status } of refusals) {
    it(`refuses ${name} and leaves the balance where it was`, async () => {
      const before = await balanceOf(USER_ID);

      const response = await betPOST(bet(body()));

      expect(response.status).toBe(status);
      expect(await balanceOf(USER_ID)).toBe(before);
      expect(await betCount(USER_ID)).toBe(0);
    });
  }

  it('refuses a bet naming someone else and leaves both balances alone', async () => {
    const response = await betPOST(
      bet({ userId: OTHER_USER_ID, predictionId: seeded.open, optionId: 'home', amount: 10_000 })
    );

    expect(response.status).toBe(403);
    expect(await balanceOf(USER_ID)).toBe(STARTING_MONEY);
    expect(await balanceOf(OTHER_USER_ID)).toBe(STARTING_MONEY);
    expect(await betCount(OTHER_USER_ID)).toBe(0);
  });

  it('refuses a signed-out bet and takes nothing', async () => {
    session = null;

    const response = await betPOST(
      bet({ userId: USER_ID, predictionId: seeded.open, optionId: 'home', amount: 10_000 })
    );

    expect(response.status).toBe(401);
    expect(await balanceOf(USER_ID)).toBe(STARTING_MONEY);
    expect(await betCount(USER_ID)).toBe(0);
  });
});
