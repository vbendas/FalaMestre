// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Where betting markets come from.
 *
 * Nothing used to create a market, so the bets screen always said there were
 * none open and the bet route never had anything to take a bet on. Every
 * player now has one open market, on the fixture their save is waiting on:
 * opened when the save is created and again every time a match is banked,
 * never twice for one fixture, and not at all once the season is over.
 *
 * Runs through the real routes against the real embedded Postgres, so "one
 * market" is counted in the table, not taken from a response.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

type Routes = {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  finalize: typeof import('../match/finalize/route').POST;
  match: typeof import('../match/route').POST;
  predictionsGET: typeof import('../predictions/route').GET;
  bet: typeof import('../predictions/bet/route').POST;
};

let dataDir: string;
let routes: Routes;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let schema: typeof import('@/db/schema');
let drizzle: typeof import('drizzle-orm');
let markets: typeof import('@/lib/fixture-markets');
let saveStore: typeof import('@/lib/save-store');
let DECISION_TURNS: typeof import('@/lib/constants').DECISION_TURNS;
let SEASON_LENGTH: number;
let PREDICTION_MARKET: typeof import('@/lib/constants').PREDICTION_MARKET;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-markets-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  vi.resetModules();
  local = await import('@/db/local');
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  drizzle = await import('drizzle-orm');
  markets = await import('@/lib/fixture-markets');
  saveStore = await import('@/lib/save-store');
  ({ DECISION_TURNS, SEASON_LENGTH, PREDICTION_MARKET } = await import('@/lib/constants'));
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    finalize: (await import('../match/finalize/route')).POST,
    match: (await import('../match/route')).POST,
    predictionsGET: (await import('../predictions/route')).GET,
    bet: (await import('../predictions/bet/route')).POST,
  };
  // The store opens, and migrates, on its first query. Paid here rather than
  // inside the first test, which would otherwise race the test timeout on a
  // loaded machine.
  await local.localDatabaseReady();
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

let requestCounter = 0;
function request(url: string, init: { method?: string; body?: unknown } = {}) {
  // A distinct client address per request keeps the rate limiter out of the way.
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.7.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
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
      body: {
        teamName: `Mercado FC ${teamCounter}`,
        primaryColor: '#112233',
        secondaryColor: '#AABBCC',
        badgeStyle: 'shield',
      },
    }),
  );
  expect(response.status).toBe(201);
  return (await response.json()).userId;
}

async function stateOf(userId: string) {
  const save = await saveStore.loadSave(userId);
  return save!.state;
}

/** Every market the player has, straight from the table. */
async function marketsOf(userId: string) {
  return db.query.predictions.findMany({
    where: drizzle.eq(schema.predictions.userId, userId),
  });
}

async function openMarketsOf(userId: string) {
  return (await marketsOf(userId)).filter((m: { status: string }) => m.status === 'open');
}

/** Banks whatever fixture the save is waiting on, through finalize. */
async function finalizeWeek(userId: string, seed: string) {
  const state = await stateOf(userId);
  const response = await routes.finalize(
    request('/api/match/finalize', {
      method: 'POST',
      body: {
        userId,
        seed,
        week: state.season.week,
        opponent: state.season.nextMatch.opponent,
        isHome: state.season.nextMatch.isHome,
        decisions: DECISION_TURNS.map((_, turnNumber) => ({ turnNumber, decisionId: null })),
      },
    }),
  );
  expect(response.status).toBe(200);
  return response.json();
}

/** Asserts the player has exactly one open market, on the fixture the save is waiting on. */
async function expectOneOpenMarketOnNextFixture(userId: string) {
  const state = await stateOf(userId);
  const open = await openMarketsOf(userId);
  expect(open).toHaveLength(1);

  const [market] = open;
  const fixture = state.season.nextMatch;
  expect(market.matchId).toBe(`round-${state.season.week}`);
  expect(market.homeTeam).toBe(fixture.isHome ? state.user.team : fixture.opponent);
  expect(market.awayTeam).toBe(fixture.isHome ? fixture.opponent : state.user.team);
  expect(market.type).toBe('win_draw_loss');

  // Priced by the engine: home, draw, away, each inside the engine's bounds.
  const options = market.options as Array<{ id: string; odds: number }>;
  expect(options.map(o => o.id)).toEqual([
    `${market.matchId}-home`,
    `${market.matchId}-draw`,
    `${market.matchId}-away`,
  ]);
  for (const option of options) {
    expect(option.odds).toBeGreaterThanOrEqual(PREDICTION_MARKET.ODDS.MIN);
    expect(option.odds).toBeLessThanOrEqual(PREDICTION_MARKET.ODDS.MAX);
  }

  // Taking bets: nothing on a clock closes it before the match is played.
  expect(new Date(market.deadline).getTime()).toBeGreaterThan(Date.now());
  return market;
}

describe('a new save', () => {
  it('leaves exactly one open market, on round 1', async () => {
    const userId = await newSave();

    const market = await expectOneOpenMarketOnNextFixture(userId);
    expect(market.matchId).toBe('round-1');
    expect(await marketsOf(userId)).toHaveLength(1);
  });
});

describe('a banked match', () => {
  it('through finalize, leaves exactly one open market, on the next fixture, and settles the one just played', async () => {
    const userId = await newSave();
    const [round1] = await openMarketsOf(userId);

    await finalizeWeek(userId, 'markets-finalize-1');

    const state = await stateOf(userId);
    expect(state.season.week).toBe(2);
    const round2 = await expectOneOpenMarketOnNextFixture(userId);
    expect(round2.matchId).toBe('round-2');

    // The market on the match just played no longer takes bets: it was
    // settled when the match was banked (see market-settlement.test.ts).
    const all = await marketsOf(userId);
    expect(all).toHaveLength(2);
    const played = all.find((m: { id: string }) => m.id === round1.id)!;
    expect(played.status).toBe('settled');
  });

  it('through /api/match, does the same', async () => {
    const userId = await newSave();

    const response = await routes.match(
      request('/api/match', { method: 'POST', body: { userId, seed: 'markets-match-1' } }),
    );
    expect(response.status).toBe(200);

    const round2 = await expectOneOpenMarketOnNextFixture(userId);
    expect(round2.matchId).toBe('round-2');
    expect(await marketsOf(userId)).toHaveLength(2);
  });

  it('keeps one open market per fixture across several weeks', async () => {
    const userId = await newSave();
    for (let round = 1; round <= 3; round++) {
      await finalizeWeek(userId, `markets-weeks-${round}`);
      await expectOneOpenMarketOnNextFixture(userId);
    }
    const all = await marketsOf(userId);
    expect(all.map((m: { matchId: string }) => m.matchId).sort()).toEqual([
      'round-1', 'round-2', 'round-3', 'round-4',
    ]);
  });
});

describe('opening a market more than once', () => {
  it('adds nothing for a fixture that already has one, however many times and however concurrently it runs', async () => {
    const userId = await newSave();
    const state = await stateOf(userId);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => markets.openFixtureMarket(userId, state)),
    );
    expect(results.every(r => r.status === 'exists')).toBe(true);

    // The board read opens the market too, as a backstop.
    for (let i = 0; i < 3; i++) {
      const response = await routes.predictionsGET(
        request(`/api/predictions?status=open&userId=${userId}`),
      );
      expect(response.status).toBe(200);
    }

    expect(await marketsOf(userId)).toHaveLength(1);
  });

  it('a save with no market yet gets exactly one from concurrent opens', async () => {
    const userId = await newSave();
    await db.delete(schema.predictions).where(drizzle.eq(schema.predictions.userId, userId));
    const state = await stateOf(userId);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => markets.openFixtureMarket(userId, state)),
    );
    expect(results.filter(r => r.status === 'created')).toHaveLength(1);
    await expectOneOpenMarketOnNextFixture(userId);
    expect(await marketsOf(userId)).toHaveLength(1);
  });

  it('is put back by the bets screen when the open after a commit did not happen', async () => {
    const userId = await newSave();
    await db.delete(schema.predictions).where(drizzle.eq(schema.predictions.userId, userId));

    const response = await routes.predictionsGET(
      request(`/api/predictions?status=open&userId=${userId}`),
    );
    const body = await response.json();
    expect(body.predictions).toHaveLength(1);
    await expectOneOpenMarketOnNextFixture(userId);
  });
});

describe('once the season is over', () => {
  it('banking the last round opens nothing, and closes the last market', async () => {
    const userId = await newSave();

    // Straight to the last round, rather than banking thirty-seven matches.
    const save = await saveStore.loadSave(userId);
    save!.state.season.week = SEASON_LENGTH;
    expect((await saveStore.commitSave(userId, save!.state, save!.version)).ok).toBe(true);
    // Last round's market, as the bets screen would open it.
    await routes.predictionsGET(request(`/api/predictions?status=open&userId=${userId}`));
    const [lastRound] = await openMarketsOf(userId);
    expect(lastRound.matchId).toBe(`round-${SEASON_LENGTH}`);

    const body = await finalizeWeek(userId, 'markets-last-round');
    expect(body.isSeasonEnd).toBe(true);

    expect(await openMarketsOf(userId)).toHaveLength(0);
    const all = await marketsOf(userId);
    expect(all.some((m: { matchId: string }) => m.matchId === `round-${SEASON_LENGTH + 1}`)).toBe(false);

    // Nor does anything else open one afterwards.
    const result = await markets.openFixtureMarket(userId, await stateOf(userId));
    expect(result.status).toBe('season_over');
    const response = await routes.predictionsGET(
      request(`/api/predictions?status=open&userId=${userId}`),
    );
    expect((await response.json()).predictions).toHaveLength(0);
    expect(await openMarketsOf(userId)).toHaveLength(0);
  });
});

describe('the bets screen', () => {
  it('is shown the player’s market, and a bet on it is taken at its odds', async () => {
    const userId = await newSave();
    const other = await newSave();

    const response = await routes.predictionsGET(
      request(`/api/predictions?status=open&userId=${userId}`),
    );
    const { predictions } = await response.json();
    // Only this player's market, not the other save's.
    expect(predictions).toHaveLength(1);
    expect(predictions[0].userId).toBe(userId);

    const market = predictions[0];
    const option = market.options[0];
    const before = (await stateOf(userId)).user.money;
    const amount = 20_000;

    const placed = await routes.bet(
      request('/api/predictions/bet', {
        method: 'POST',
        body: { userId, predictionId: market.id, optionId: option.id, amount },
      }),
    );
    expect(placed.status).toBe(200);
    const placedBody = await placed.json();
    expect(placedBody.potentialWin).toBe(Math.round(amount * option.odds));
    expect((await stateOf(userId)).user.money).toBe(before - amount);

    const bets = await db.query.userBets.findMany({
      where: drizzle.eq(schema.userBets.userId, userId),
    });
    expect(bets).toHaveLength(1);
    expect(bets[0]).toMatchObject({ predictionId: market.id, optionId: option.id, amount });

    // Someone else's market is not theirs to bet on.
    const otherMoney = (await stateOf(other)).user.money;
    const refused = await routes.bet(
      request('/api/predictions/bet', {
        method: 'POST',
        body: { userId: other, predictionId: market.id, optionId: option.id, amount },
      }),
    );
    expect(refused.status).toBe(404);
    expect((await stateOf(other)).user.money).toBe(otherMoney);
  });

  it('refuses a bet on a fixture that has already been played, even if its market was never closed', async () => {
    const userId = await newSave();
    const [round1] = await openMarketsOf(userId);

    await finalizeWeek(userId, 'markets-played-1');
    // As if the close after the commit had not run yet.
    await db
      .update(schema.predictions)
      .set({ status: 'open' })
      .where(drizzle.eq(schema.predictions.id, round1.id));

    const before = (await stateOf(userId)).user.money;
    const refused = await routes.bet(
      request('/api/predictions/bet', {
        method: 'POST',
        body: { userId, predictionId: round1.id, optionId: `${round1.matchId}-home`, amount: 20_000 },
      }),
    );
    expect(refused.status).toBe(409);
    expect((await stateOf(userId)).user.money).toBe(before);
  });
});
