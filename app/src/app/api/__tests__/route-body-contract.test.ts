// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import type { GameState } from '@/lib/types';
import { INVESTMENT_PRODUCTS } from '@/lib/investments';

/**
 * Every route that takes a body, from both sides, one route at a time.
 *
 * `body-schema.test.ts` proves the routes all refuse alike. It cannot prove
 * they still work, because it mocks the database to throw: every call in it
 * is meant to be turned away at the body, so a schema that had quietly been
 * tightened into refusing everything would pass it from end to end.
 *
 * So each route here gets two calls against a real save in a real database:
 *
 *  - a body its schema turns away, checked for the shared refusal and the
 *    field named; and
 *  - the body the screen really sends, checked for going through *and* for
 *    having done what it used to do — the money moved, the player arrived,
 *    the formation changed. A 200 on its own would not notice a route that
 *    parsed the body and then acted on nothing.
 *
 * Where a body nests, the field has to be named by its whole path, so the
 * caller is pointed at the value and not at the object around it. The
 * squad inside a decision turn's prior state is the deep case and gets its
 * own block.
 *
 * Real embedded Postgres, real save-store, real rate limiter, mock AI. Only
 * next-auth's session lookup is replaced.
 */

let session: { user: { id: string; email: string; name: string } } | null = null;
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

function signIn(userId: string | null) {
  session = userId ? { user: { id: userId, email: 'contract@example.test', name: 'Contract' } } : null;
}

const CRON_SECRET = 'contract-cron-secret';
const ADMIN_SECRET = 'contract-admin-secret';

type Routes = {
  conversation: typeof import('../conversation/route').POST;
  conversationGET: typeof import('../conversation/route').GET;
  createTeam: typeof import('../onboarding/create-team/route').POST;
  dailyReward: typeof import('../daily-reward/route').POST;
  facilities: typeof import('../facilities/upgrade/route').POST;
  insights: typeof import('../insights/route').POST;
  investment: typeof import('../investment/route').POST;
  investmentGET: typeof import('../investment/route').GET;
  investmentClaim: typeof import('../investment/claim/route').POST;
  match: typeof import('../match/route').POST;
  decide: typeof import('../match/decide/route').POST;
  finalize: typeof import('../match/finalize/route').POST;
  stream: typeof import('../match/stream/route').POST;
  bet: typeof import('../predictions/bet/route').POST;
  settle: typeof import('../predictions/settle/route').POST;
  resolve: typeof import('../predictions/resolve/route').POST;
  formation: typeof import('../squad/formation/route').POST;
  migrate: typeof import('../squad/migrate/route').POST;
  train: typeof import('../squad/train/route').POST;
  stadium: typeof import('../stadium/upgrade/route').POST;
  staff: typeof import('../staff/route').POST;
  tickets: typeof import('../tournaments/tickets/route').POST;
  buy: typeof import('../transfer/buy/route').POST;
  sell: typeof import('../transfer/sell/route').POST;
  youth: typeof import('../youth/route').POST;
};

let dataDir: string;
let routes: Routes;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let schema: typeof import('@/db/schema');
let saveStore: typeof import('@/lib/save-store');
let DECISION_TURNS: typeof import('@/lib/constants').DECISION_TURNS;
let deriveTurnSeed: typeof import('@/lib/match-seed').deriveTurnSeed;
let generateYouthIntake: typeof import('@/lib/youth-generator').generateYouthIntake;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-contract-'));
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
  saveStore = await import('@/lib/save-store');
  ({ DECISION_TURNS } = await import('@/lib/constants'));
  ({ deriveTurnSeed } = await import('@/lib/match-seed'));
  ({ generateYouthIntake } = await import('@/lib/youth-generator'));
  routes = {
    conversation: (await import('../conversation/route')).POST,
    conversationGET: (await import('../conversation/route')).GET,
    createTeam: (await import('../onboarding/create-team/route')).POST,
    dailyReward: (await import('../daily-reward/route')).POST,
    facilities: (await import('../facilities/upgrade/route')).POST,
    insights: (await import('../insights/route')).POST,
    investment: (await import('../investment/route')).POST,
    investmentGET: (await import('../investment/route')).GET,
    investmentClaim: (await import('../investment/claim/route')).POST,
    match: (await import('../match/route')).POST,
    decide: (await import('../match/decide/route')).POST,
    finalize: (await import('../match/finalize/route')).POST,
    stream: (await import('../match/stream/route')).POST,
    bet: (await import('../predictions/bet/route')).POST,
    settle: (await import('../predictions/settle/route')).POST,
    resolve: (await import('../predictions/resolve/route')).POST,
    formation: (await import('../squad/formation/route')).POST,
    migrate: (await import('../squad/migrate/route')).POST,
    train: (await import('../squad/train/route')).POST,
    stadium: (await import('../stadium/upgrade/route')).POST,
    staff: (await import('../staff/route')).POST,
    tickets: (await import('../tournaments/tickets/route')).POST,
    buy: (await import('../transfer/buy/route')).POST,
    sell: (await import('../transfer/sell/route')).POST,
    youth: (await import('../youth/route')).POST,
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
  signIn(null);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// Plumbing

let requestCounter = 0;
function post(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Each call from its own address, so the real rate limiter never trips.
      'x-forwarded-for': `10.22.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

type Refusal = { status: number; error?: string; message?: string; field?: string; keys: string[] };

/** Sends a body, expects the shared refusal, and returns it for inspection. */
async function refusalFrom(
  handler: (request: NextRequest) => Promise<Response>,
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<Refusal> {
  const response = await handler(post(url, body, headers));
  const payload = (await response.json()) as Record<string, unknown>;
  return {
    status: response.status,
    error: payload.error as string | undefined,
    message: payload.message as string | undefined,
    field: payload.field as string | undefined,
    keys: Object.keys(payload).sort(),
  };
}

/**
 * The one shape every route answers a bad body with, and the field it must
 * name — by its whole path, with the leaf mentioned in the sentence.
 */
function expectRefused(refusal: Refusal, field: string) {
  expect(refusal.status).toBe(400);
  expect(refusal.error).toBe('Validation failed');
  expect(refusal.keys).toEqual(['error', 'field', 'message']);
  expect(refusal.field).toBe(field);
  const leaf = field.slice(field.lastIndexOf('.') + 1);
  expect(refusal.message).toContain(leaf);
}

async function load(userId: string): Promise<GameState> {
  const response = await routes.conversationGET(
    new NextRequest(`http://localhost/api/conversation?userId=${userId}`)
  );
  return (await response.json()).gameState;
}

const SPENDING_MONEY = 50_000_000;

/** A fresh signed-out player with a save and enough money to act. */
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
    state.user.money = SPENDING_MONEY;
  });
  return { userId, state: await load(userId) };
}

/** A write to the save outside any route, for seeding a test's preconditions. */
async function seed(userId: string, change: (state: GameState) => void) {
  const save = await saveStore.loadSave(userId);
  change(save!.state);
  expect((await saveStore.commitSave(userId, save!.state, save!.version)).ok).toBe(true);
}

/** A whole player, as the transfer market describes one. */
function signing(id: string) {
  return {
    id,
    name: 'Reforço',
    position: 'MID',
    pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70,
    potential: 75,
    consistency: 70,
    bigMatchPlayer: 60,
    leadership: 50,
    injuryProneness: 30,
  };
}

/** The prior state the match screen sends on the first turn. */
function firstTurnState(state: GameState) {
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

async function openPrediction() {
  const [row] = await db
    .insert(schema.predictions)
    .values({
      matchId: `contract-${randomUUID()}`,
      homeTeam: 'Casa',
      awayTeam: 'Fora',
      type: 'win_draw_loss',
      options: [
        { id: 'home', label: 'Casa', odds: 1.8, totalBets: 0 },
        { id: 'away', label: 'Fora', odds: 2.2, totalBets: 0 },
      ],
      entryCost: 0,
      deadline: new Date(Date.now() + 3_600_000),
      status: 'open',
      matchDate: new Date(Date.now() + 3_600_000),
    })
    .returning({ id: schema.predictions.id });
  return row.id;
}

// ---------------------------------------------------------------------------

describe('coverage', () => {
  it('has a block for every route that takes a body', async () => {
    // A route takes a body exactly when it calls readBody — the one way in —
    // and every one of those must have a block below, so a new route cannot
    // arrive with no proof that it refuses a bad body and accepts a good one.
    //
    // The check lives in scripts/check-route-bodies.mjs, which CI also runs
    // as its own step so the failure arrives with the fix spelled out rather
    // than as one red assertion in eleven hundred. Imported rather than
    // reimplemented so the two cannot drift.
    const { routesMissingContractTests } = await import('../../../../scripts/check-route-bodies.mjs');

    expect(routesMissingContractTests()).toEqual([]);
  });
});

describe('conversation', () => {
  const URL = '/api/conversation';

  it('refuses a message that is only whitespace, naming it', async () => {
    const { userId } = await newPlayer('Conversa FC');
    expectRefused(await refusalFrom(routes.conversation, URL, { userId, message: '   ' }), 'message');
  });

  it('answers the message the chat screen sends and keeps it in the history', async () => {
    const { userId } = await newPlayer('Conversa Boa FC');

    const response = await routes.conversation(post(URL, { userId, message: 'olá treinador' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.response).toBe('string');
    expect(body.response.length).toBeGreaterThan(0);

    const row = await db.query.gameStates.findFirst({
      where: eq(schema.gameStates.userId, userId),
    });
    expect(JSON.stringify(row?.conversationHistory ?? [])).toContain('olá treinador');
  });
});

describe('daily-reward', () => {
  const URL = '/api/daily-reward';

  it('refuses a missing userId, naming it rather than answering User not found', async () => {
    expectRefused(await refusalFrom(routes.dailyReward, URL, {}), 'userId');
  });

  it('pays the reward and credits it to the balance', async () => {
    const { userId, state } = await newPlayer('Diária FC');

    const response = await routes.dailyReward(post(URL, { userId }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.rewardAmount).toBeGreaterThan(0);
    expect((await load(userId)).user.money).toBe(state.user.money + body.rewardAmount);
  });
});

describe('facilities/upgrade', () => {
  const URL = '/api/facilities/upgrade';

  it('refuses a facility the game does not have, naming the field', async () => {
    const { userId } = await newPlayer('Instalações FC');
    const refusal = await refusalFrom(routes.facilities, URL, { userId, facilityType: 'training' });
    expectRefused(refusal, 'facilityType');
    expect(refusal.message).toContain('trainingCenter');
  });

  it('upgrades the facility the screen names and charges for it', async () => {
    const { userId, state } = await newPlayer('Instalações Boas FC');
    const before = state.facilities.trainingCenter;

    const response = await routes.facilities(post(URL, { userId, facilityType: 'trainingCenter' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.newFacilityLevel).toBe(before + 1);
    const after = await load(userId);
    expect(after.facilities.trainingCenter).toBe(before + 1);
    expect(after.user.money).toBeLessThan(state.user.money);
  });
});

describe('insights', () => {
  const URL = '/api/insights';

  it('refuses a userId of the wrong type, naming it', async () => {
    expectRefused(await refusalFrom(routes.insights, URL, { userId: 42 }), 'userId');
  });

  it('answers the dashboard card with insights', async () => {
    const { userId } = await newPlayer('Análise FC');

    const response = await routes.insights(post(URL, { userId }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.insights)).toBe(true);
  });
});

describe('investment', () => {
  const URL = '/api/investment';

  it('refuses a product it does not sell, naming the ones it does', async () => {
    const { userId } = await newPlayer('Investe FC');
    const refusal = await refusalFrom(routes.investment, URL, { userId, option: 'Z' });
    expectRefused(refusal, 'option');
    expect(refusal.message).toContain('clube_torcedores');
  });

  it('refuses the retired A, B and C tiers', async () => {
    // They were the whole of what the route sold, and the screen flattened
    // five of its seven cards onto 'C'. Nothing sells them now.
    const { userId } = await newPlayer('Investe Antigo FC');
    for (const option of ['A', 'B', 'C']) {
      expectRefused(await refusalFrom(routes.investment, URL, { userId, option }), 'option');
    }
  });

  it('charges every card the price the card shows', async () => {
    // The drift this route carried: the screen printed seven prices, the
    // route knew three, and a card could be bought at a price it never
    // showed. Each product is bought and the debit checked against the
    // catalogue the screen renders from.
    for (const product of INVESTMENT_PRODUCTS) {
      const { userId, state } = await newPlayer(`Catalogo ${product.id} FC`);
      await seed(userId, (save) => {
        save.user.money = product.cost + 1_000;
      });

      const response = await routes.investment(post(URL, { option: product.id, userId }));
      expect(response.status).toBe(200);

      const rows = await db.query.fanClubInvestments.findMany({
        where: eq(schema.fanClubInvestments.userId, userId),
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].option).toBe(product.id);
      expect(rows[0].amount).toBe(product.cost);
      expect(rows[0].yieldPerDay).toBe(product.dailyYield);
      expect((await load(userId)).user.money).toBe(1_000);
      expect(state).toBeDefined();
    }
  });

  it('takes the option the screen sends and reports the new balance', async () => {
    const { userId, state } = await newPlayer('Investe Bem FC');

    const response = await routes.investment(post(URL, { option: 'clube_torcedores', userId }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.newBalance).toBe(state.user.money - 50_000);
  });

  it('records the investment and takes the money from the save', async () => {
    // For a long time it did neither: the insert minted an `inv_...` id for
    // what is a uuid column and raised every time, into a catch that logged
    // 'Investment recorded in memory' at info and answered success, and the
    // save was never debited at all. The row and the debit are the whole
    // point of the route, so both are checked against storage, not the reply.
    const { userId, state } = await newPlayer('Investe de Verdade FC');

    expect((await routes.investment(post(URL, { option: 'clube_torcedores', userId }))).status).toBe(200);

    const rows = await db.query.fanClubInvestments.findMany({
      where: eq(schema.fanClubInvestments.userId, userId),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].option).toBe('clube_torcedores');
    expect(rows[0].amount).toBe(50_000);
    expect((await load(userId)).user.money).toBe(state.user.money - 50_000);
  });

  it('answers a failed investment as a failure, never a success', async () => {
    // The debit is floored at zero, so a balance that moved under the cost
    // between the friendly check and the write refuses — and takes the row
    // it had already recorded back out with it.
    const { userId } = await newPlayer('Investe Pobre FC');
    await seed(userId, (save) => {
      save.user.money = 50_000; // exactly the cost; drain it below after the check
    });
    // Two at once: both pass the friendly check against 50_000, only one can
    // be paid for. The floor on the debit is what refuses the other.
    const [a, b] = await Promise.all([
      routes.investment(post(URL, { option: 'clube_torcedores', userId })),
      routes.investment(post(URL, { option: 'clube_torcedores', userId })),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    const refused = a.status === 400 ? a : b;
    expect((await refused.json()).error).toContain('Insufficient funds');
    const rows = await db.query.fanClubInvestments.findMany({
      where: eq(schema.fanClubInvestments.userId, userId),
    });
    expect(rows).toHaveLength(1);
    expect((await load(userId)).user.money).toBe(0);
  });
});

describe('investment GET', () => {
  it('answers with what the player owns and what it has earned', async () => {
    // The screen had no way to ask for either: it hard-coded an empty list
    // of active investments, and the unclaimed yields the daily cron writes
    // were only reachable from a dashboard card that is never rendered.
    const { userId } = await newPlayer('Carteira FC');
    signIn(userId);
    await seed(userId, (save) => {
      save.user.money = 1_000_000;
    });

    expect((await routes.investment(post('/api/investment', { option: 'infraestrutura', userId }))).status)
      .toBe(200);

    const investments = await db.query.fanClubInvestments.findMany({
      where: eq(schema.fanClubInvestments.userId, userId),
    });
    await db.insert(schema.investmentYields).values({
      userId,
      investmentId: investments[0].id,
      amount: 4_200,
      createdAt: new Date(),
      claimed: false,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const response = await routes.investmentGET(
      new NextRequest(`http://localhost/api/investment?userId=${userId}`)
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.activeCount).toBe(1);
    expect(body.investments[0]).toMatchObject({
      option: 'infraestrutura',
      name: 'Infraestrutura',
      amount: 500_000,
    });
    expect(body.pendingYieldTotal).toBe(4_200);
    expect(body.pendingYields).toHaveLength(1);
  });

  it('names a row from the retired tiers as something other than a bare letter', async () => {
    // Nothing sells 'A' any more, but rows bought under it are still owned
    // and still have to read as a club the player recognises.
    const { userId } = await newPlayer('Carteira Antiga FC');
    signIn(userId);
    await db.insert(schema.fanClubInvestments).values({
      userId,
      option: 'A',
      amount: 50_000,
      startDate: new Date(),
      unlockDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      yieldPerDay: 10_000,
      moraleBoost: 2,
      revenueBoostPerMatch: 15_000,
      active: true,
    });

    const body = await (await routes.investmentGET(
      new NextRequest(`http://localhost/api/investment?userId=${userId}`)
    )).json();

    expect(body.investments[0]).toMatchObject({
      option: 'A',
      name: 'Clube de Torcedores',
      yieldPerDay: 10_000,
    });
  });
});

describe('investment/claim', () => {
  const URL = '/api/investment/claim';

  it('refuses a claimAll that is not a boolean, naming it', async () => {
    const { userId } = await newPlayer('Resgate FC');
    signIn(userId);
    expectRefused(await refusalFrom(routes.investmentClaim, URL, { claimAll: 'yes please' }), 'claimAll');
  });

  it('claims the yields and credits them', async () => {
    const { userId, state } = await newPlayer('Resgate Bom FC');
    signIn(userId);
    await db.insert(schema.investmentYields).values({
      userId,
      investmentId: randomUUID(),
      amount: 7_500,
      claimed: false,
      expiryDate: new Date(Date.now() + 86_400_000),
    });

    const response = await routes.investmentClaim(post(URL, { claimAll: true }));

    expect(response.status).toBe(200);
    expect((await response.json()).claimed).toBe(7_500);
    expect((await load(userId)).user.money).toBe(state.user.money + 7_500);
  });
});

describe('match', () => {
  const URL = '/api/match';

  it('refuses a seed that is neither a token nor an integer, naming it', async () => {
    const { userId } = await newPlayer('Partida FC');
    expectRefused(await refusalFrom(routes.match, URL, { userId, seed: 1.5 }), 'seed');
  });

  it('simulates the fixture and banks it', async () => {
    const { userId, state } = await newPlayer('Partida Boa FC');

    const response = await routes.match(post(URL, { userId, seed: 'contract-match' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    // Played under the seed the server drew at kickoff, reported once banked;
    // the one sent is ignored (fixture-kickoff.ts).
    expect(body.seed).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(body.seed).not.toBe('contract-match');
    expect(typeof body.result.homeScore).toBe('number');
    expect((await load(userId)).season.week).toBe(state.season.week + 1);
  });
});

describe('match/decide', () => {
  const URL = '/api/match/decide';

  it('refuses a turn number past the end of the match, naming it', async () => {
    const { userId, state } = await newPlayer('Decide FC');
    const refusal = await refusalFrom(routes.decide, URL, {
      userId,
      turnNumber: DECISION_TURNS.length,
      decision: null,
      priorState: firstTurnState(state),
    });
    expectRefused(refusal, 'turnNumber');
  });

  it('plays the turn the match screen sends and returns the state for the next one', async () => {
    const { userId, state } = await newPlayer('Decide Bem FC');

    const response = await routes.decide(
      post(URL, {
        userId,
        turnNumber: 0,
        decision: null,
        priorState: firstTurnState(state),
        seed: deriveTurnSeed('contract-decide', 0),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(typeof body.endState.homeScore).toBe('number');
    expect(body.endState.squad).toHaveLength(state.squad.players.length);
    // No seed in the reply: a turn's seed names the fixture's, and knowing
    // that is knowing every remaining turn (fixture-kickoff.ts).
    expect(body.seed).toBeUndefined();
    expect(body.decisionId).toBeNull();
  });

  it('plays a turn carrying a whole decision option, as the screen sends it', async () => {
    const { userId, state } = await newPlayer('Decide Tático FC');

    const response = await routes.decide(
      post(URL, {
        userId,
        turnNumber: 1,
        decision: {
          id: 'turn_1_instr_high_press',
          label: 'Pressão alta',
          description: 'Subir a linha e sufocar a saída de bola.',
          icon: '🔥',
          action: 'tactical_instruction',
          category: 'instruction',
          tacticalInstruction: 'high_press',
        },
        priorState: firstTurnState(state),
        seed: 'contract-tactic',
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).turnResult.decision.id).toBe('turn_1_instr_high_press');
  });
});

describe('match/finalize', () => {
  const URL = '/api/match/finalize';

  it('refuses a missing seed, naming it: there is nothing to replay without one', async () => {
    const { userId, state } = await newPlayer('Encerra FC');
    expectRefused(
      await refusalFrom(routes.finalize, URL, {
        userId,
        week: state.season.week,
        opponent: state.season.nextMatch.opponent,
        isHome: state.season.nextMatch.isHome,
        decisions: [{ turnNumber: 0, decisionId: null }],
      }),
      'seed'
    );
  });

  it('banks the match the screen played and moves the season on', async () => {
    const { userId, state } = await newPlayer('Encerra Bem FC');
    const seedValue = 'contract-finalize';

    let prior: Record<string, unknown> = firstTurnState(state);
    const decisions: Array<{ turnNumber: number; decisionId: null }> = [];
    for (let turnNumber = 0; turnNumber < DECISION_TURNS.length; turnNumber++) {
      const turn = await routes.decide(
        post('/api/match/decide', {
          userId,
          turnNumber,
          decision: null,
          priorState: prior,
          seed: deriveTurnSeed(seedValue, turnNumber),
        })
      );
      expect(turn.status).toBe(200);
      prior = (await turn.json()).endState;
      decisions.push({ turnNumber, decisionId: null });
    }

    const response = await routes.finalize(
      post(URL, {
        userId,
        seed: seedValue,
        week: state.season.week,
        opponent: state.season.nextMatch.opponent,
        isHome: state.season.nextMatch.isHome,
        decisions,
        claimedScore: { homeScore: prior.homeScore, awayScore: prior.awayScore },
      })
    );

    expect(response.status).toBe(200);
    expect((await load(userId)).season.week).toBe(state.season.week + 1);
  });
});

describe('match/stream', () => {
  const URL = '/api/match/stream';

  it('refuses a seed that is an object, naming it', async () => {
    const { userId } = await newPlayer('Transmite FC');
    expectRefused(await refusalFrom(routes.stream, URL, { userId, seed: { nested: true } }), 'seed');
  });

  it('streams the match the screen asked for', async () => {
    const { userId } = await newPlayer('Transmite Bem FC');

    const response = await routes.stream(post(URL, { userId, opponent: 'Rival FC' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const text = await response.text();
    const events = text
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6)) as { type?: string });
    expect(events[0].type).toBe('kickoff');
  });
});

describe('onboarding/create-team', () => {
  const URL = '/api/onboarding/create-team';

  it('refuses a colour that is not a hex triplet, naming it', async () => {
    expectRefused(
      await refusalFrom(routes.createTeam, URL, {
        teamName: 'Cores Erradas',
        primaryColor: 'vermelho',
        secondaryColor: '#AABBCC',
        badgeStyle: 'shield',
      }),
      'primaryColor'
    );
  });

  it('creates the team the onboarding screen submits', async () => {
    const response = await routes.createTeam(
      post(URL, {
        teamName: 'Dragões do Cerrado',
        primaryColor: '#FFD700',
        secondaryColor: '#1a1a2e',
        badgeStyle: 'shield',
      })
    );

    expect(response.status).toBe(201);
    const { userId } = await response.json();
    expect((await load(userId)).user.team).toBe('Dragões do Cerrado');
  });
});

describe('predictions/bet', () => {
  const URL = '/api/predictions/bet';

  it('refuses a predictionId that is not a uuid, naming it', async () => {
    const { userId } = await newPlayer('Aposta FC');
    const refusal = await refusalFrom(routes.bet, URL, {
      userId,
      predictionId: 'match-3',
      optionId: 'home',
      amount: 50_000,
    });
    expectRefused(refusal, 'predictionId');
  });

  it('refuses a negative stake, naming the amount rather than crediting it', async () => {
    const { userId } = await newPlayer('Aposta Negativa FC');
    const predictionId = await openPrediction();
    expectRefused(
      await refusalFrom(routes.bet, URL, { userId, predictionId, optionId: 'home', amount: -50_000 }),
      'amount'
    );
  });

  it('places the bet the screen sends and takes the stake', async () => {
    const { userId, state } = await newPlayer('Aposta Boa FC');
    const predictionId = await openPrediction();

    const response = await routes.bet(
      post(URL, { predictionId, optionId: 'home', amount: 50_000, userId })
    );

    expect(response.status).toBe(200);
    expect((await load(userId)).user.money).toBe(state.user.money - 50_000);
    const bets = await db.query.userBets.findMany({ where: eq(schema.userBets.userId, userId) });
    expect(bets).toHaveLength(1);
    expect(bets[0].predictionId).toBe(predictionId);
  });
});

describe('predictions/settle', () => {
  const URL = '/api/predictions/settle';
  const CRON = { authorization: `Bearer ${CRON_SECRET}` };

  it('refuses a missing score, naming the one that is missing', async () => {
    const { userId } = await newPlayer('Liquida FC');
    signIn(userId);
    const predictionId = await openPrediction();
    expectRefused(
      await refusalFrom(routes.settle, URL, { predictionId, homeScore: 2 }, CRON),
      'awayScore'
    );
  });

  it('settles the prediction and pays the winning bet', async () => {
    const { userId, state } = await newPlayer('Liquida Bem FC');
    const predictionId = await openPrediction();
    const placed = await routes.bet(
      post('/api/predictions/bet', { userId, predictionId, optionId: 'home', amount: 10_000 })
    );
    expect(placed.status).toBe(200);
    const { potentialWin } = await placed.json();

    signIn(userId);
    const response = await routes.settle(
      post(URL, { predictionId, homeScore: 2, awayScore: 0 }, CRON)
    );

    expect(response.status).toBe(200);
    expect((await load(userId)).user.money).toBe(state.user.money - 10_000 + potentialWin);
  });
});

describe('predictions/resolve', () => {
  const URL = '/api/predictions/resolve';
  const ADMIN = { authorization: `Bearer ${ADMIN_SECRET}` };

  /** A winning bet the old settlement code claimed and never finished. */
  async function heldWinningBet(name: string) {
    const { userId, state } = await newPlayer(name);
    const predictionId = await openPrediction();
    const placed = await routes.bet(
      post('/api/predictions/bet', { userId, predictionId, optionId: 'home', amount: 10_000 })
    );
    expect(placed.status).toBe(200);
    const { potentialWin } = await placed.json();
    const [bet] = await db.query.userBets.findMany({ where: eq(schema.userBets.userId, userId) });
    await db.update(schema.userBets).set({ settlingAt: new Date() }).where(eq(schema.userBets.id, bet.id));
    await db
      .update(schema.predictions)
      .set({ status: 'closed', homeScore: 2, awayScore: 0 })
      .where(eq(schema.predictions.id, predictionId));
    return { userId, state, betId: bet.id as string, potentialWin: potentialWin as number };
  }

  it('refuses an answer that is not true or false, naming it', async () => {
    const { betId } = await heldWinningBet('Revisa FC');
    expectRefused(await refusalFrom(routes.resolve, URL, { betId, paidByOldRun: 'no' }, ADMIN), 'paidByOldRun');
  });

  it('settles the held bet as the operator says, crediting it if the old run had not', async () => {
    const { userId, state, betId, potentialWin } = await heldWinningBet('Revisa Bem FC');

    const response = await routes.resolve(post(URL, { betId, paidByOldRun: false }, ADMIN));

    expect(response.status).toBe(200);
    expect((await load(userId)).user.money).toBe(state.user.money - 10_000 + potentialWin);
  });
});

describe('squad/formation', () => {
  const URL = '/api/squad/formation';

  it('refuses a formation the game does not have, naming it', async () => {
    const { userId } = await newPlayer('Esquema FC');
    const refusal = await refusalFrom(routes.formation, URL, { userId, formation: '9-0-1' });
    expectRefused(refusal, 'formation');
    expect(refusal.message).toContain('4-4-2');
  });

  it('changes to the formation the squad screen picked', async () => {
    const { userId, state } = await newPlayer('Esquema Bom FC');
    const next = state.squad.formation === '4-4-2' ? '4-3-3' : '4-4-2';

    const response = await routes.formation(post(URL, { userId, formation: next }));

    expect(response.status).toBe(200);
    expect((await load(userId)).squad.formation).toBe(next);
  });
});

describe('squad/migrate', () => {
  const URL = '/api/squad/migrate';

  it('refuses a userId of the wrong type, naming it', async () => {
    expectRefused(await refusalFrom(routes.migrate, URL, { userId: 42 }), 'userId');
  });

  it('migrates the save the loading screen asks it to', async () => {
    const { userId } = await newPlayer('Migra FC');

    const response = await routes.migrate(post(URL, { userId }));

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });
});

describe('squad/train', () => {
  const URL = '/api/squad/train';

  it('refuses a training focus the game does not have, naming it', async () => {
    const { userId, state } = await newPlayer('Treina FC');
    const refusal = await refusalFrom(routes.train, URL, {
      userId,
      playerId: state.squad.players[0].id,
      focus: 'juggling',
    });
    expectRefused(refusal, 'focus');
    expect(refusal.message).toContain('technical');
  });

  it('runs the session the squad screen asked for and spends from the budget', async () => {
    const { userId, state } = await newPlayer('Treina Bem FC');
    const playerId = state.squad.players[0].id;

    const response = await routes.train(post(URL, { userId, playerId, focus: 'technical' }));

    expect(response.status).toBe(200);
    const after = await load(userId);
    expect(after.squad.weeklyTrainingBudget).toBe(state.squad.weeklyTrainingBudget - 1);
    expect(after.squad.players.find((p) => p.id === playerId)!.weeklyTrainingCount).toBe(1);
  });
});

describe('stadium/upgrade', () => {
  const URL = '/api/stadium/upgrade';

  it('refuses a missing userId, naming it rather than answering User not found', async () => {
    expectRefused(await refusalFrom(routes.stadium, URL, {}), 'userId');
  });

  it('upgrades the stadium the screen asked for and charges for it', async () => {
    const { userId, state } = await newPlayer('Estádio FC');

    const response = await routes.stadium(post(URL, { userId: state.user.id }));

    expect(response.status).toBe(200);
    const after = await load(userId);
    expect(after.stadium.level).toBe(state.stadium.level + 1);
    expect(after.stadium.capacity).toBeGreaterThan(state.stadium.capacity);
    expect(after.user.money).toBeLessThan(state.user.money);
  });
});

describe('staff', () => {
  const URL = '/api/staff';

  it('refuses a role the game does not have, naming it', async () => {
    const { userId } = await newPlayer('Comissão FC');
    const refusal = await refusalFrom(routes.staff, URL, {
      userId,
      action: 'hire',
      role: 'wizard',
      tier: 'rookie',
    });
    expectRefused(refusal, 'role');
  });

  it('refuses a hire with no tier, naming it rather than charging the elite price', async () => {
    const { userId } = await newPlayer('Comissão Sem Nível FC');
    expectRefused(
      await refusalFrom(routes.staff, URL, { userId, action: 'hire', role: 'headCoach' }),
      'tier'
    );
  });

  it('hires at the tier the screen chose, and charges that tier', async () => {
    const { userId, state } = await newPlayer('Comissão Boa FC');

    const response = await routes.staff(post(URL, { userId, action: 'hire', role: 'headCoach', tier: 'rookie' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cost).toBe(50_000);
    expect(body.staff.level).toBeLessThanOrEqual(10);
    const after = await load(userId);
    expect(after.staff.headCoach).not.toBeNull();
    expect(after.user.money).toBe(state.user.money - 50_000);
  });

  it('fires without a tier, which is the body the screen sends', async () => {
    const { userId } = await newPlayer('Comissão Demite FC');
    expect((await routes.staff(post(URL, { userId, action: 'hire', role: 'scout', tier: 'rookie' }))).status).toBe(200);

    const response = await routes.staff(post(URL, { userId, action: 'fire', role: 'scout' }));

    expect(response.status).toBe(200);
    expect((await load(userId)).staff.scout).toBeNull();
  });
});

describe('tournaments/tickets', () => {
  const URL = '/api/tournaments/tickets';

  it('refuses a method that was never an earning method, naming it', async () => {
    const { userId } = await newPlayer('Bilhete FC');
    signIn(userId);
    expectRefused(await refusalFrom(routes.tickets, URL, { method: 'daily_login' }), 'method');
  });

  it('awards the ticket for a method the game has', async () => {
    const { userId } = await newPlayer('Bilhete Bom FC');
    signIn(userId);

    const response = await routes.tickets(post(URL, { method: 'WIN_5_MATCHES_STREAK' }));

    expect(response.status).toBe(200);
    expect((await response.json()).ticketsEarned).toBe(1);
    const rows = await db.query.tournamentTickets.findMany({
      where: eq(schema.tournamentTickets.userId, userId),
    });
    expect(rows).toHaveLength(1);
  });
});

describe('transfer/buy', () => {
  const URL = '/api/transfer/buy';

  it('refuses a signing with no ratings, naming the first one missing', async () => {
    const { userId } = await newPlayer('Compra FC');
    expectRefused(
      await refusalFrom(routes.buy, URL, {
        userId,
        player: { id: 'ghost', name: 'Sem Atributos', position: 'MID' },
      }),
      'player.pac'
    );
  });

  it('signs the player and takes the fee', async () => {
    const { userId, state } = await newPlayer('Compra Boa FC');

    const response = await routes.buy(post(URL, { userId, player: signing('contract-buy'), sellValue: 2_000 }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.purchaseValue).toBe(1_000);
    const after = await load(userId);
    expect(after.squad.players.some((p) => p.id === 'contract-buy')).toBe(true);
    expect(after.user.money).toBe(state.user.money - 1_000);
  });
});

describe('transfer/sell', () => {
  const URL = '/api/transfer/sell';

  it('refuses an empty playerId, naming it', async () => {
    const { userId } = await newPlayer('Venda FC');
    expectRefused(await refusalFrom(routes.sell, URL, { userId, playerId: '' }), 'playerId');
  });

  it('sells the player and pays for him', async () => {
    const { userId, state } = await newPlayer('Venda Boa FC');
    const sold = state.squad.players[0];

    const response = await routes.sell(post(URL, { userId, playerId: sold.id }));

    expect(response.status).toBe(200);
    const { sellValue } = await response.json();
    const after = await load(userId);
    expect(after.squad.players.some((p) => p.id === sold.id)).toBe(false);
    expect(after.user.money).toBe(state.user.money + sellValue);
  });
});

describe('youth', () => {
  const url = (userId: string) => `/api/youth?userId=${userId}`;

  it('refuses a sign with no prospect named, naming playerId not the player', async () => {
    const { userId } = await newPlayer('Base FC');
    expectRefused(await refusalFrom(routes.youth, url(userId), { action: 'sign' }), 'playerId');
  });

  it('refuses an action the academy does not have, naming it', async () => {
    const { userId } = await newPlayer('Base Estranha FC');
    expectRefused(await refusalFrom(routes.youth, url(userId), { action: 'clone' }), 'action');
  });

  it('generates an intake, as the academy screen asks on arrival', async () => {
    const { userId } = await newPlayer('Base Boa FC');

    const response = await routes.youth(post(url(userId), { action: 'generate' }));

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  it('signs the prospect the screen picked', async () => {
    const { userId, state } = await newPlayer('Base Promove FC');
    const prospects = generateYouthIntake(1, 1);
    await seed(userId, (save) => {
      save.youthAcademy = {
        playersAvailable: prospects,
        nextIntakeWeek: save.season.week + 4,
        trainingFocus: null,
        lastIntakeWeek: save.season.week,
      };
    });

    const response = await routes.youth(post(url(userId), { action: 'sign', playerId: prospects[0].id }));

    expect(response.status).toBe(200);
    const after = await load(userId);
    expect(after.squad.players).toHaveLength(state.squad.players.length + 1);
  });

  it('sets the training focus the screen chose, and clears it with null', async () => {
    const { userId } = await newPlayer('Base Foco FC');

    expect((await routes.youth(post(url(userId), { action: 'set-focus', focus: 'technical' }))).status).toBe(200);
    expect((await load(userId)).youthAcademy!.trainingFocus).toBe('technical');

    expect((await routes.youth(post(url(userId), { action: 'set-focus', focus: null }))).status).toBe(200);
    expect((await load(userId)).youthAcademy!.trainingFocus).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('a field nested inside the body', () => {
  /**
   * The deep case. `priorState.squad` is an array of players inside an
   * object inside the body, and a bad rating on one of them has to be
   * reported as the rating on that player — `priorState.squad.3.pac` —
   * rather than as "priorState" or "squad", neither of which tells the
   * caller which of eleven players to look at.
   */
  it('is named by its whole path, down through an array index', async () => {
    const { userId, state } = await newPlayer('Aninhado FC');
    const squad = state.squad.players.map((player, index) =>
      index === 3 ? { ...player, pac: 'muito rápido' } : player
    );

    const refusal = await refusalFrom(routes.decide, '/api/match/decide', {
      userId,
      turnNumber: 0,
      decision: null,
      priorState: { ...firstTurnState(state), squad },
    });

    expectRefused(refusal, 'priorState.squad.3.pac');
  });

  it('names the player whose hidden attribute is missing, not the squad', async () => {
    const { userId, state } = await newPlayer('Aninhado Oculto FC');
    const squad = state.squad.players.map((player, index) => {
      if (index !== 0) return player;
      const { consistency: _dropped, ...rest } = player;
      return rest;
    });

    const refusal = await refusalFrom(routes.decide, '/api/match/decide', {
      userId,
      turnNumber: 0,
      decision: null,
      priorState: { ...firstTurnState(state), squad },
    });

    expectRefused(refusal, 'priorState.squad.0.consistency');
  });

  it('names a bad field on the prior state itself', async () => {
    const { userId, state } = await newPlayer('Aninhado Mental FC');

    const refusal = await refusalFrom(routes.decide, '/api/match/decide', {
      userId,
      turnNumber: 0,
      decision: null,
      priorState: { ...firstTurnState(state), mentality: 'furioso' },
    });

    expectRefused(refusal, 'priorState.mentality');
  });

  it('names a bad field inside the decision option', async () => {
    const { userId, state } = await newPlayer('Aninhada Decisão FC');

    const refusal = await refusalFrom(routes.decide, '/api/match/decide', {
      userId,
      turnNumber: 0,
      decision: {
        id: 'turn_0_instr_bogus',
        label: 'Algo',
        description: 'd',
        icon: '🔥',
        action: 'tactical_instruction',
        category: 'instruction',
        tacticalInstruction: 'teleport_the_ball',
      },
      priorState: firstTurnState(state),
    });

    expectRefused(refusal, 'decision.tacticalInstruction');
  });

  it('names the turn inside the decision list a finalize sends', async () => {
    const { userId, state } = await newPlayer('Aninhada Súmula FC');

    const refusal = await refusalFrom(routes.finalize, '/api/match/finalize', {
      userId,
      seed: 'nested',
      week: state.season.week,
      opponent: state.season.nextMatch.opponent,
      isHome: state.season.nextMatch.isHome,
      decisions: [
        { turnNumber: 0, decisionId: null },
        { turnNumber: 1, decisionId: null },
        { turnNumber: 99, decisionId: null },
      ],
    });

    expectRefused(refusal, 'decisions.2.turnNumber');
  });

  it('names the score inside a claimed result', async () => {
    const { userId, state } = await newPlayer('Aninhado Placar FC');

    const refusal = await refusalFrom(routes.finalize, '/api/match/finalize', {
      userId,
      seed: 'nested-score',
      week: state.season.week,
      opponent: state.season.nextMatch.opponent,
      isHome: state.season.nextMatch.isHome,
      decisions: [{ turnNumber: 0, decisionId: null }],
      claimedScore: { homeScore: 1, awayScore: -4 },
    });

    expectRefused(refusal, 'claimedScore.awayScore');
  });

  it('names the rating inside a signing', async () => {
    const { userId } = await newPlayer('Aninhada Compra FC');

    const refusal = await refusalFrom(routes.buy, '/api/transfer/buy', {
      userId,
      player: { ...signing('nested-buy'), sho: 'brilhante' },
    });

    expectRefused(refusal, 'player.sho');
  });
});
