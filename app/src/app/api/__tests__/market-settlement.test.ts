// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Bets paying out.
 *
 * When a match is banked its market settles against the real result: the
 * winning bet is credited exactly the return it was promised, a losing one
 * nothing. A market stops taking bets the moment its match kicks off, so a
 * player watching the score turn by turn cannot bet on it. Settlement also
 * runs from a scheduled job, with no player signed in, and running it again
 * (or several at once) pays nobody twice.
 *
 * Real routes against the real embedded Postgres; money is read from the
 * save and bets from the table, never from a response alone.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const CRON_SECRET = 'settlement-cron-secret';
const ADMIN_SECRET = 'settlement-admin-secret';

type Routes = {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  decide: typeof import('../match/decide/route').POST;
  finalize: typeof import('../match/finalize/route').POST;
  match: typeof import('../match/route').POST;
  board: typeof import('../predictions/route').GET;
  bet: typeof import('../predictions/bet/route').POST;
  settleJob: typeof import('../predictions/settle/route').GET;
  settleOne: typeof import('../predictions/settle/route').POST;
};

let dataDir: string;
let routes: Routes;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let schema: typeof import('@/db/schema');
let drizzle: typeof import('drizzle-orm');
let saveStore: typeof import('@/lib/save-store');
let settlement: typeof import('@/lib/market-settlement');
let DECISION_TURNS: typeof import('@/lib/constants').DECISION_TURNS;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-settlement-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.ADMIN_SECRET = ADMIN_SECRET;
  vi.resetModules();
  local = await import('@/db/local');
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  drizzle = await import('drizzle-orm');
  saveStore = await import('@/lib/save-store');
  settlement = await import('@/lib/market-settlement');
  ({ DECISION_TURNS } = await import('@/lib/constants'));
  const settle = await import('../predictions/settle/route');
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    decide: (await import('../match/decide/route')).POST,
    finalize: (await import('../match/finalize/route')).POST,
    match: (await import('../match/route')).POST,
    board: (await import('../predictions/route')).GET,
    bet: (await import('../predictions/bet/route')).POST,
    settleJob: settle.GET,
    settleOne: settle.POST,
  };
  await local.localDatabaseReady();
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

let requestCounter = 0;
function request(
  url: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.8.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const asJob = { authorization: `Bearer ${CRON_SECRET}` };

let teamCounter = 0;
async function newSave(): Promise<string> {
  teamCounter += 1;
  const response = await routes.createTeam(
    request('/api/onboarding/create-team', {
      method: 'POST',
      body: {
        teamName: `Liquida FC ${teamCounter}`,
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
  return (await saveStore.loadSave(userId))!.state;
}

async function openMarket(userId: string) {
  const markets = await db.query.predictions.findMany({
    where: drizzle.and(
      drizzle.eq(schema.predictions.userId, userId),
      drizzle.eq(schema.predictions.status, 'open'),
    ),
  });
  expect(markets).toHaveLength(1);
  return markets[0] as typeof schema.predictions.$inferSelect & {
    options: Array<{ id: string; label: string; odds: number }>;
  };
}

async function betsOf(userId: string): Promise<Array<typeof schema.userBets.$inferSelect>> {
  return db.query.userBets.findMany({ where: drizzle.eq(schema.userBets.userId, userId) });
}

function placeBet(userId: string, predictionId: string, optionId: string, amount: number) {
  return routes.bet(
    request('/api/predictions/bet', {
      method: 'POST',
      body: { userId, predictionId, optionId, amount },
    }),
  );
}

/** Banks the fixture the save is waiting on through finalize, with no turns played first. */
async function finalize(userId: string, seed: string) {
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

/** The option a score makes the winner of a result market. */
function winningOptionId(matchId: string, score: { homeScore: number; awayScore: number }) {
  const side =
    score.homeScore > score.awayScore ? 'home' : score.homeScore < score.awayScore ? 'away' : 'draw';
  return `${matchId}-${side}`;
}

/**
 * A banked match with a bet on each of the three outcomes, so exactly one
 * bet wins and two lose whatever the score. Different stakes keep them
 * apart in the arithmetic.
 */
async function bankWithABetOnEveryOutcome(seed: string) {
  const userId = await newSave();
  const market = await openMarket(userId);
  const stakes: Record<string, number> = {};
  const promised: Record<string, number> = {};
  for (const [i, option] of market.options.entries()) {
    const amount = 10_000 * (i + 1);
    const placed = await placeBet(userId, market.id, option.id, amount);
    expect(placed.status).toBe(200);
    stakes[option.id] = amount;
    promised[option.id] = (await placed.json()).potentialWin;
    expect(promised[option.id]).toBe(Math.round(amount * option.odds));
  }

  const banked = await finalize(userId, seed);
  const score = { homeScore: banked.result.homeScore, awayScore: banked.result.awayScore };
  return {
    userId,
    market,
    stakes,
    promised,
    score,
    winner: winningOptionId(market.matchId, score),
    // The balance the bank committed, before any payout landed on top.
    committedMoney: banked.updatedGameState.user.money as number,
  };
}

describe('a banked match settles its market against the real result', () => {
  it('pays a winning bet exactly the return it was promised', async () => {
    const { userId, market, promised, score, winner, committedMoney } =
      await bankWithABetOnEveryOutcome('settle-win-1');

    const settled = await db.query.predictions.findFirst({
      where: drizzle.eq(schema.predictions.id, market.id),
    });
    expect(settled!.status).toBe('settled');
    expect({ homeScore: settled!.homeScore, awayScore: settled!.awayScore }).toEqual(score);

    const bet = (await betsOf(userId)).find(b => b.optionId === winner)!;
    expect(bet).toMatchObject({ settled: true, won: true, payout: promised[winner] });
    // On the save: the bank's own balance plus that return, and nothing else.
    expect((await stateOf(userId)).user.money).toBe(committedMoney + promised[winner]);
  });

  it('pays a losing bet nothing', async () => {
    const { userId, winner, promised, committedMoney } = await bankWithABetOnEveryOutcome('settle-lose-1');

    const losers = (await betsOf(userId)).filter(b => b.optionId !== winner);
    expect(losers).toHaveLength(2);
    for (const bet of losers) {
      expect(bet).toMatchObject({ settled: true, won: false, payout: 0 });
    }
    // Only the winner's return was added; the losers' stakes stay gone.
    expect((await stateOf(userId)).user.money).toBe(committedMoney + promised[winner]);
  });

  it('settles a match banked through /api/match the same way', async () => {
    const userId = await newSave();
    const market = await openMarket(userId);
    for (const option of market.options) {
      expect((await placeBet(userId, market.id, option.id, 10_000)).status).toBe(200);
    }

    const response = await routes.match(
      request('/api/match', { method: 'POST', body: { userId, seed: 'settle-match-1' } }),
    );
    expect(response.status).toBe(200);
    const { result } = await response.json();

    const winner = winningOptionId(market.matchId, result);
    const bets = await betsOf(userId);
    expect(bets.every(b => b.settled)).toBe(true);
    expect(bets.filter(b => b.won).map(b => b.optionId)).toEqual([winner]);
    expect(bets.find(b => b.optionId === winner)!.payout).toBe(Math.round(10_000 * market.options.find(o => o.id === winner)!.odds));
  });

  it('shows the player what they bet, what is open and what each settled bet paid', async () => {
    const { userId, market, promised, stakes, winner, score } = await bankWithABetOnEveryOutcome('settle-board-1');
    // A bet on the next fixture, still open.
    const next = await openMarket(userId);
    expect((await placeBet(userId, next.id, next.options[0].id, 10_000)).status).toBe(200);

    const response = await routes.board(request(`/api/predictions?status=open&userId=${userId}`));
    const { bets } = await response.json();
    expect(bets).toHaveLength(4);

    const open = bets.filter((b: { status: string }) => b.status === 'open');
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ predictionId: next.id, amount: 10_000, payout: null });

    const played = bets.filter((b: { predictionId: string }) => b.predictionId === market.id);
    expect(played).toHaveLength(3);
    for (const bet of played) {
      const won = bet.optionId === winner;
      expect(bet).toMatchObject({
        status: won ? 'won' : 'lost',
        amount: stakes[bet.optionId],
        payout: won ? promised[bet.optionId] : 0,
        score,
        homeTeam: market.homeTeam,
        awayTeam: market.awayTeam,
      });
    }
  });
});

describe('kickoff closes the market', () => {
  /** Plays the first decision turn, as the match screen does at kickoff. */
  async function kickOff(userId: string) {
    const state = await stateOf(userId);
    const response = await routes.decide(
      request('/api/match/decide', {
        method: 'POST',
        body: {
          userId,
          turnNumber: 0,
          decision: null,
          priorState: {
            homeScore: 0,
            awayScore: 0,
            homeMomentum: 0,
            awayMomentum: 0,
            tension: 30,
            formation: state.squad.formation || '4-3-3',
            mentality: 'balanced',
            hasRedCard: false,
            squad: state.squad.players,
          },
          seed: 'kickoff-seed:turn:0',
        },
      }),
    );
    expect(response.status).toBe(200);
  }

  it('refuses a bet once the first turn has been played, and takes nothing', async () => {
    const userId = await newSave();
    const market = await openMarket(userId);
    // Placed before kickoff: stands.
    expect((await placeBet(userId, market.id, market.options[0].id, 10_000)).status).toBe(200);

    await kickOff(userId);

    const closed = await db.query.predictions.findFirst({
      where: drizzle.eq(schema.predictions.id, market.id),
    });
    expect(closed!.status).toBe('closed');
    expect(closed!.kickedOffAt).not.toBeNull();

    const before = (await stateOf(userId)).user.money;
    const refused = await placeBet(userId, market.id, market.options[1].id, 10_000);
    expect(refused.status).toBe(409);
    expect((await stateOf(userId)).user.money).toBe(before);
    expect(await betsOf(userId)).toHaveLength(1);

    // And the bets screen no longer offers it.
    const board = await (await routes.board(request(`/api/predictions?status=open&userId=${userId}`))).json();
    expect(board.predictions).toHaveLength(0);
    expect(board.bets.map((b: { status: string }) => b.status)).toEqual(['in_play']);
  });

  it('refuses a bet whose check saw the market open but whose insert lands after kickoff', async () => {
    const userId = await newSave();
    const market = await openMarket(userId);
    await kickOff(userId);

    // The bet route's read, a moment old: still open.
    const stale = { ...market, status: 'open' };
    vi.spyOn(db.query.predictions, 'findFirst').mockResolvedValueOnce(stale);

    const before = (await stateOf(userId)).user.money;
    const refused = await placeBet(userId, market.id, market.options[0].id, 10_000);
    expect(refused.status).toBe(409);
    expect((await stateOf(userId)).user.money).toBe(before);
    expect(await betsOf(userId)).toHaveLength(0);
  });
});

describe('settling again', () => {
  it('pays nobody twice, from the job, from an operator, or from a repeated bank', async () => {
    const { userId, market, score, promised, winner, committedMoney } =
      await bankWithABetOnEveryOutcome('settle-again-1');
    const paidOnce = committedMoney + promised[winner];
    expect((await stateOf(userId)).user.money).toBe(paidOnce);
    const betsAfterBank = await betsOf(userId);

    // The scheduled job, signed out, twice.
    for (let i = 0; i < 2; i++) {
      const job = await routes.settleJob(request('/api/predictions/settle', { headers: asJob }));
      expect(job.status).toBe(200);
    }
    // An operator naming the market with its real score.
    const operator = await routes.settleOne(
      request('/api/predictions/settle', {
        method: 'POST',
        headers: { authorization: `Bearer ${ADMIN_SECRET}` },
        body: { predictionId: market.id, ...score },
      }),
    );
    expect(operator.status).toBe(200);
    expect((await operator.json()).totalPayouts).toBe(0);
    // The bank-time settlement itself, run again.
    await settlement.settlePlayedFixtureAfterCommit(userId, await stateOf(userId));

    expect((await stateOf(userId)).user.money).toBe(paidOnce);
    expect(await betsOf(userId)).toEqual(betsAfterBank);
  });

  it('refuses an operator score that disagrees with the banked result', async () => {
    const { userId, market, score, promised, winner, committedMoney } =
      await bankWithABetOnEveryOutcome('settle-again-2');
    const wrong = { homeScore: score.homeScore + 1, awayScore: score.awayScore };

    const refused = await routes.settleOne(
      request('/api/predictions/settle', {
        method: 'POST',
        headers: asJob,
        body: { predictionId: market.id, ...wrong },
      }),
    );
    expect(refused.status).toBe(409);
    expect((await stateOf(userId)).user.money).toBe(committedMoney + promised[winner]);
  });

  it('when the bank did not settle, the job does from the save, and concurrent runs pay once', async () => {
    const { userId, market, promised, winner, committedMoney } = await bankWithABetOnEveryOutcome('settle-again-3');

    // Put things back as if settlement had never run after the bank: the
    // market closed with no result on it, every bet unsettled, no payout.
    await db
      .update(schema.predictions)
      .set({ status: 'closed', homeScore: null, awayScore: null, settledAt: null })
      .where(drizzle.eq(schema.predictions.id, market.id));
    await db
      .update(schema.userBets)
      .set({ settled: false, won: null, payout: null, settledAt: null, settlingAt: null })
      .where(drizzle.eq(schema.userBets.predictionId, market.id));
    expect((await saveStore.adjustMoney(userId, -promised[winner])).ok).toBe(true);
    expect((await stateOf(userId)).user.money).toBe(committedMoney);

    // Six runs at once: the job, an operator-less direct run, and the bank's.
    const runs = await Promise.all([
      routes.settleJob(request('/api/predictions/settle', { headers: asJob })),
      routes.settleJob(request('/api/predictions/settle', { headers: asJob })),
      routes.settleJob(request('/api/predictions/settle', { headers: asJob })),
      settlement.settleDueMarkets(),
      settlement.settleDueMarkets(),
      stateOf(userId).then(state => settlement.settlePlayedFixtureAfterCommit(userId, state)),
    ]);
    for (const run of runs.slice(0, 3) as Response[]) expect(run.status).toBe(200);

    expect((await stateOf(userId)).user.money).toBe(committedMoney + promised[winner]);
    const bets = await betsOf(userId);
    expect(bets.every(b => b.settled)).toBe(true);
    expect(bets.filter(b => b.won).map(b => b.optionId)).toEqual([winner]);
    expect(bets.find(b => b.won)!.payout).toBe(promised[winner]);
  });
});

describe('the settle route', () => {
  it('runs as a scheduled job with no player signed in, and refuses without the job secret', async () => {
    const job = await routes.settleJob(request('/api/predictions/settle', { headers: asJob }));
    expect(job.status).toBe(200);
    expect(await job.json()).toMatchObject({ success: true, failed: 0 });

    const refused = await routes.settleJob(request('/api/predictions/settle'));
    expect(refused.status).toBe(401);
    const wrong = await routes.settleJob(
      request('/api/predictions/settle', { headers: { authorization: 'Bearer nope' } }),
    );
    expect(wrong.status).toBe(401);
  });

  it('will not settle a fixture that has not been played', async () => {
    const userId = await newSave();
    const market = await openMarket(userId);
    expect((await placeBet(userId, market.id, market.options[0].id, 10_000)).status).toBe(200);
    const before = (await stateOf(userId)).user.money;

    const refused = await routes.settleOne(
      request('/api/predictions/settle', {
        method: 'POST',
        headers: asJob,
        body: { predictionId: market.id, homeScore: 3, awayScore: 0 },
      }),
    );
    expect(refused.status).toBe(409);
    expect((await openMarket(userId)).id).toBe(market.id);
    expect((await stateOf(userId)).user.money).toBe(before);
    expect((await betsOf(userId))[0].settled).toBe(false);
  });
});
