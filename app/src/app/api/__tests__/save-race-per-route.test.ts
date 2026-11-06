// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import type { GameState } from '@/lib/types';

/**
 * Every route that writes the game state, made to lose a race, one at a time.
 *
 * A route loads the save, changes it, writes it back. The window is between
 * the load and the write, and this file lands a competing write in exactly
 * that window: the database's own `findFirst` on `game_states` is wrapped,
 * and the test arms a one-shot hook that runs a training session for the
 * player the moment the route under test has read their save. The route then
 * carries on with a copy that is already stale.
 *
 * What each test checks is the same: the training is still in the save
 * afterwards (`weeklyTrainingBudget` went from 15 to 14 and stayed there),
 * and the route either refused with the shared 409 or, for the money-only
 * writers that increment inside the UPDATE, landed on top without touching
 * what the training did.
 *
 * Everything this file interposes, it interposes at the database: the hook
 * sits on the save table's reads, and the failed payout further down is a
 * constraint on the row. Nothing here touches `save-store`, so the same file
 * runs unchanged against the routes as they were before the version column
 * (those read through the same `findFirst` and `findMany`), and that run is
 * how the fix was shown to catch the bug.
 *
 * Real embedded Postgres throughout; the guard is SQL.
 */

const hooks = vi.hoisted(() => ({
  /** Runs once the route has read `userId`'s save. Return true when handled. */
  afterRead: null as null | ((userId: string) => Promise<boolean>),
}));

vi.mock('@/db', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/db')>();
  const table = real.db.query.gameStates;
  const findFirst = table.findFirst.bind(table);
  const findMany = table.findMany.bind(table);

  // Disarmed while the hook runs: the competing write reads the save too,
  // and must not trigger itself.
  async function afterRows(rows: Array<{ userId?: string }>) {
    const hook = hooks.afterRead;
    if (!hook) return;
    hooks.afterRead = null;
    for (const row of rows) {
      if (row?.userId && (await hook(row.userId))) return;
    }
    hooks.afterRead = hook;
  }

  table.findFirst = async (...args: unknown[]) => {
    const row = await findFirst(...args);
    if (row) await afterRows([row]);
    return row;
  };
  table.findMany = async (...args: unknown[]) => {
    const rows = await findMany(...args);
    await afterRows(rows);
    return rows;
  };
  return real;
});

let session: { user: { id: string; email: string; name: string } } | null = null;
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

function signIn(userId: string | null) {
  session = userId ? { user: { id: userId, email: 'race@example.test', name: 'Race' } } : null;
}

type Routes = {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  conversationGET: typeof import('../conversation/route').GET;
  decide: typeof import('../match/decide/route').POST;
  finalize: typeof import('../match/finalize/route').POST;
  match: typeof import('../match/route').POST;
  train: typeof import('../squad/train/route').POST;
  buy: typeof import('../transfer/buy/route').POST;
  sell: typeof import('../transfer/sell/route').POST;
  formation: typeof import('../squad/formation/route').POST;
  staff: typeof import('../staff/route').POST;
  youth: typeof import('../youth/route').POST;
  dailyReward: typeof import('../daily-reward/route').POST;
  stadium: typeof import('../stadium/upgrade/route').POST;
  facilities: typeof import('../facilities/upgrade/route').POST;
  bet: typeof import('../predictions/bet/route').POST;
  settle: typeof import('../predictions/settle/route').POST;
  claim: typeof import('../investment/claim/route').POST;
  migratePOST: typeof import('../squad/migrate/route').POST;
  migrateGET: typeof import('../squad/migrate/route').GET;
};

const CRON_SECRET = 'race-cron-secret';
const ADMIN = 'race-admin';

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
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-race-'));
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
  ({ DECISION_TURNS } = await import('@/lib/constants'));
  ({ deriveTurnSeed } = await import('@/lib/match-seed'));
  ({ generateYouthIntake } = await import('@/lib/youth-generator'));
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    conversationGET: (await import('../conversation/route')).GET,
    decide: (await import('../match/decide/route')).POST,
    finalize: (await import('../match/finalize/route')).POST,
    match: (await import('../match/route')).POST,
    train: (await import('../squad/train/route')).POST,
    buy: (await import('../transfer/buy/route')).POST,
    sell: (await import('../transfer/sell/route')).POST,
    formation: (await import('../squad/formation/route')).POST,
    staff: (await import('../staff/route')).POST,
    youth: (await import('../youth/route')).POST,
    dailyReward: (await import('../daily-reward/route')).POST,
    stadium: (await import('../stadium/upgrade/route')).POST,
    facilities: (await import('../facilities/upgrade/route')).POST,
    bet: (await import('../predictions/bet/route')).POST,
    settle: (await import('../predictions/settle/route')).POST,
    claim: (await import('../investment/claim/route')).POST,
    migratePOST: (await import('../squad/migrate/route')).POST,
    migrateGET: (await import('../squad/migrate/route')).GET,
  };
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  hooks.afterRead = null;
  signIn(null);
  if (process.env.RACE_TEST_VERBOSE) return;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  // A hook that never fired means the route under test never read the save
  // where the test expected it to, and the race was not provoked.
  expect(hooks.afterRead).toBeNull();
});

// ---------------------------------------------------------------------------
// Plumbing

let requestCounter = 0;
function request(url: string, init: { method?: 'GET' | 'POST'; body?: unknown; headers?: Record<string, string> } = {}) {
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.11.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
      ...(init.headers ?? {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const post = (url: string, body: unknown, headers?: Record<string, string>) => request(url, { body, headers });

async function load(userId: string) {
  const response = await routes.conversationGET(request(`/api/conversation?userId=${userId}`));
  return (await response.json()).gameState;
}

async function versionOf(userId: string): Promise<number> {
  const row = await db.query.gameStates.findFirst({ where: eq(schema.gameStates.userId, userId) });
  return row!.version;
}

async function newPlayer(teamName: string) {
  const created = await routes.createTeam(
    post('/api/onboarding/create-team', {
      teamName,
      primaryColor: '#112233',
      secondaryColor: '#AABBCC',
      badgeStyle: 'shield',
    }),
  );
  expect(created.status).toBe(201);
  const { userId } = await created.json();
  return { userId, state: await load(userId) };
}

/** A write to the save outside any route, for seeding a test's preconditions. */
async function seed(userId: string, change: (state: GameState) => void) {
  const save = await saveStore.loadSave(userId);
  change(save!.state);
  const committed = await saveStore.commitSave(userId, save!.state, save!.version);
  expect(committed.ok).toBe(true);
}

/**
 * The competing write: a technical training session for the second player,
 * which takes the weekly budget from 15 to 14. Nothing else in this file
 * touches that field, so `budgetOf` reads as "is the training still there".
 */
async function training(userId: string, state: { squad: { players: Array<{ id: string }> } }) {
  const response = await routes.train(
    post('/api/squad/train', { userId, playerId: state.squad.players[1].id, focus: 'technical' }),
  );
  expect(response.status).toBe(200);
}

/** Arms the training to land right after the route under test reads `userId`'s save. */
function trainingAfterRead(userId: string, state: { squad: { players: Array<{ id: string }> } }) {
  hooks.afterRead = async (readUserId) => {
    if (readUserId !== userId) return false;
    await training(userId, state);
    return true;
  };
}

/**
 * For the money-only writers. Their write is an increment with no read of
 * the save in front of it, so there is no window for the hook to land in:
 * if the route returned without reading the save, the training lands now,
 * the latest moment it can relative to that write. (The routes as they were
 * before the version column did read the save first; against them the hook
 * fires mid-route, which is how this file showed the fix catches the bug.)
 */
async function trainingAtTheLatest(userId: string, state: { squad: { players: Array<{ id: string }> } }) {
  if (hooks.afterRead) {
    hooks.afterRead = null;
    await training(userId, state);
  }
}

async function budgetOf(userId: string): Promise<number> {
  return (await load(userId)).squad.weeklyTrainingBudget;
}

async function expectConflict(response: Response) {
  expect(response.status).toBe(409);
  expect((await response.json()).error).toBe(saveStore.SAVE_CONFLICT_ERROR);
}

function recruit(id: string) {
  return { id, name: `Reforço ${id}`, position: 'MID', age: 24, pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70, overall: 70, potential: 75, consistency: 70, bigMatchPlayer: 60, leadership: 50, value: 100, wage: 1, injuryProneness: 10 };
}

async function openPrediction() {
  const [row] = await db
    .insert(schema.predictions)
    .values({
      matchId: `race-${randomUUID()}`,
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

/** Places a bet for `amount` on the home side; returns the potential win. */
async function placeBet(userId: string, predictionId: string, amount: number): Promise<number> {
  const response = await routes.bet(post('/api/predictions/bet', { userId, predictionId, optionId: 'home', amount }));
  expect(response.status).toBe(200);
  return (await response.json()).potentialWin;
}

function settle(predictionId: string, homeScore = 2, awayScore = 0) {
  return routes.settle(
    post('/api/predictions/settle', { predictionId, homeScore, awayScore }, { authorization: `Bearer ${CRON_SECRET}` }),
  );
}

async function betRows(userId: string) {
  return db.query.userBets.findMany({ where: eq(schema.userBets.userId, userId) });
}

/** Plays all six turns under one match seed, as the match screen does. */
async function playMatch(userId: string, seed: string) {
  const state = await load(userId);
  let prior: Record<string, unknown> = {
    homeScore: 0, awayScore: 0, homeMomentum: 0, awayMomentum: 0, tension: 30,
    formation: state.squad.formation || '4-3-3', mentality: 'balanced', hasRedCard: false,
    squad: state.squad.players,
  };
  const decisions: Array<{ turnNumber: number; decisionId: null }> = [];
  for (let turnNumber = 0; turnNumber < DECISION_TURNS.length; turnNumber++) {
    const turn = await routes.decide(
      post('/api/match/decide', { userId, turnNumber, decision: null, priorState: prior, seed: deriveTurnSeed(seed, turnNumber) }),
    );
    expect(turn.status).toBe(200);
    const body = await turn.json();
    decisions.push({ turnNumber, decisionId: null });
    prior = { ...prior, ...body.endState, squad: body.endState?.squad ?? prior.squad };
  }
  return {
    decisions,
    fixture: { week: state.season.week, opponent: state.season.nextMatch.opponent, isHome: state.season.nextMatch.isHome },
  };
}

// ---------------------------------------------------------------------------
// Routes that load, change and commit: each loses, and the training stands.

describe('a training session lands while the route is holding the save', () => {
  it('squad/train: the second session is refused and the first stands', async () => {
    const { userId, state } = await newPlayer('Treino FC');
    trainingAfterRead(userId, state);

    const response = await routes.train(post('/api/squad/train', { userId, playerId: state.squad.players[0].id, focus: 'technical' }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    const after = await load(userId);
    expect(after.squad.players[0].weeklyTrainingCount).toBe(0);
    expect(after.squad.players[1].weeklyTrainingCount).toBe(1);
    expect(await versionOf(userId)).toBe(2);
  }, 60_000);

  it('transfer/buy is refused; the training stands and nobody was signed', async () => {
    const { userId, state } = await newPlayer('Compra FC');
    trainingAfterRead(userId, state);

    const response = await routes.buy(post('/api/transfer/buy', { userId, player: recruit('race-buy'), sellValue: 2_000 }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    const after = await load(userId);
    expect(after.squad.players.some((p: { id: string }) => p.id === 'race-buy')).toBe(false);
    expect(after.user.money).toBe(state.user.money);
  }, 60_000);

  it('transfer/sell is refused; the training stands and the player is still there', async () => {
    const { userId, state } = await newPlayer('Venda FC');
    trainingAfterRead(userId, state);

    const response = await routes.sell(post('/api/transfer/sell', { userId, playerId: state.squad.players[0].id }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    const after = await load(userId);
    expect(after.squad.players).toHaveLength(state.squad.players.length);
    expect(after.user.money).toBe(state.user.money);
  }, 60_000);

  it('squad/formation is refused; the training stands and the formation is unchanged', async () => {
    const { userId, state } = await newPlayer('Esquema FC');
    const other = state.squad.formation === '4-4-2' ? '4-3-3' : '4-4-2';
    trainingAfterRead(userId, state);

    const response = await routes.formation(post('/api/squad/formation', { userId, formation: other }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    expect((await load(userId)).squad.formation).toBe(state.squad.formation);
  }, 60_000);

  it('staff hire is refused; the training stands and no one was hired or paid', async () => {
    const { userId, state } = await newPlayer('Comissão FC');
    trainingAfterRead(userId, state);

    const response = await routes.staff(post('/api/staff', { userId, action: 'hire', role: 'scout', tier: 'rookie' }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    const after = await load(userId);
    expect(after.staff.scout).toBeNull();
    expect(after.user.money).toBe(state.user.money);
  }, 60_000);

  it('staff fire is refused; the training stands and the coach keeps the job', async () => {
    const { userId, state } = await newPlayer('Demissão FC');
    await seed(userId, (s) => { s.staff.headCoach = { name: 'Técnico Fixo', level: 5, role: 'headCoach', specialty: 'tactical', weeklyWage: 100, hiredAt: 1 }; });
    trainingAfterRead(userId, state);

    const response = await routes.staff(post('/api/staff', { userId, action: 'fire', role: 'headCoach' }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    expect((await load(userId)).staff.headCoach?.name).toBe('Técnico Fixo');
  }, 60_000);

  it('youth set-focus is refused; the training stands and the focus is unset', async () => {
    const { userId, state } = await newPlayer('Base Foco FC');
    trainingAfterRead(userId, state);

    const response = await routes.youth(post(`/api/youth?userId=${userId}`, { action: 'set-focus', focus: 'technical' }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    expect((await load(userId)).youthAcademy.trainingFocus).toBeNull();
  }, 60_000);

  it('youth intake is refused; the training stands and no intake was generated', async () => {
    const { userId, state } = await newPlayer('Base Peneira FC');
    await seed(userId, (s) => { s.youthAcademy.nextIntakeWeek = 0; });
    trainingAfterRead(userId, state);

    const response = await routes.youth(post(`/api/youth?userId=${userId}`, { action: 'generate' }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    expect((await load(userId)).youthAcademy.playersAvailable).toHaveLength(0);
  }, 60_000);

  it('youth sign is refused; the training stands and the prospect is still waiting', async () => {
    const { userId, state } = await newPlayer('Base Contrato FC');
    const prospects = generateYouthIntake(1, 1);
    await seed(userId, (s) => { s.youthAcademy.playersAvailable = prospects; });
    trainingAfterRead(userId, state);

    const response = await routes.youth(post(`/api/youth?userId=${userId}`, { action: 'sign', playerId: prospects[0].id }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    const after = await load(userId);
    expect(after.youthAcademy.playersAvailable).toHaveLength(prospects.length);
    expect(after.squad.players).toHaveLength(state.squad.players.length);
  }, 60_000);

  it('youth reject is refused; the training stands and the prospect is still waiting', async () => {
    const { userId, state } = await newPlayer('Base Dispensa FC');
    const prospects = generateYouthIntake(1, 1);
    await seed(userId, (s) => { s.youthAcademy.playersAvailable = prospects; });
    trainingAfterRead(userId, state);

    const response = await routes.youth(post(`/api/youth?userId=${userId}`, { action: 'reject', playerId: prospects[0].id }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    expect((await load(userId)).youthAcademy.playersAvailable).toHaveLength(prospects.length);
  }, 60_000);

  it('daily-reward is refused; the training stands and nothing was credited', async () => {
    const { userId, state } = await newPlayer('Prêmio FC');
    trainingAfterRead(userId, state);

    const response = await routes.dailyReward(post('/api/daily-reward', { userId }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    expect((await load(userId)).user.money).toBe(state.user.money);
  }, 60_000);

  it('stadium/upgrade is refused; the training stands and the stadium is as it was', async () => {
    const { userId, state } = await newPlayer('Estádio FC');
    trainingAfterRead(userId, state);

    const response = await routes.stadium(post('/api/stadium/upgrade', { userId }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    const after = await load(userId);
    expect(after.stadium.level).toBe(state.stadium.level);
    expect(after.user.money).toBe(state.user.money);
  }, 60_000);

  it('facilities/upgrade is refused; the training stands and the facility is as it was', async () => {
    const { userId, state } = await newPlayer('Instalações FC');
    // The cheapest facility costs more than a new save holds.
    const funded = await saveStore.adjustMoney(userId, 1_000_000);
    expect(funded.ok).toBe(true);
    trainingAfterRead(userId, state);

    const response = await routes.facilities(post('/api/facilities/upgrade', { userId, facilityType: 'medicalCenter' }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    const after = await load(userId);
    expect(after.facilities.medicalCenter).toBe(state.facilities.medicalCenter);
    expect(after.user.money).toBe(state.user.money + 1_000_000);
  }, 60_000);

  it('match (whole simulation) is refused; the training stands and the week has not moved', async () => {
    const { userId, state } = await newPlayer('Simulação FC');
    trainingAfterRead(userId, state);

    const response = await routes.match(post('/api/match', { userId, seed: 'race-sim' }));

    await expectConflict(response);
    expect(await budgetOf(userId)).toBe(14);
    const after = await load(userId);
    expect(after.season.week).toBe(state.season.week);
    expect(after.teamStats.matchesPlayed).toBe(0);
  }, 60_000);

  it('match/finalize is refused as a save conflict, keeps the training, and goes through on a retry', async () => {
    const { userId, state } = await newPlayer('Banco FC');
    const play = await playMatch(userId, 'race-fin');
    trainingAfterRead(userId, state);

    const first = await routes.finalize(post('/api/match/finalize', { userId, seed: 'race-fin', ...play.fixture, decisions: play.decisions }));

    // The week did not move, so this is not a fixture mismatch: the same
    // match can be finalized again against the fresh save.
    await expectConflict(first);
    expect(await budgetOf(userId)).toBe(14);
    expect((await load(userId)).season.week).toBe(state.season.week);

    const retry = await routes.finalize(post('/api/match/finalize', { userId, seed: 'race-fin', ...play.fixture, decisions: play.decisions }));
    expect(retry.status).toBe(200);
    const after = await load(userId);
    expect(after.season.week).toBe(state.season.week + 1);
    expect(after.squad.weeklyTrainingBudget).toBe(14);
  }, 60_000);

  it('match/finalize losing to another finalize still answers fixture mismatch with the new fixture', async () => {
    const { userId } = await newPlayer('Duas Abas FC');
    const a = await playMatch(userId, 'tab-a');
    const b = await playMatch(userId, 'tab-b');
    hooks.afterRead = async (readUserId) => {
      if (readUserId !== userId) return false;
      const other = await routes.finalize(post('/api/match/finalize', { userId, seed: 'tab-b', ...b.fixture, decisions: b.decisions }));
      expect(other.status).toBe(200);
      return true;
    };

    const response = await routes.finalize(post('/api/match/finalize', { userId, seed: 'tab-a', ...a.fixture, decisions: a.decisions }));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('Fixture mismatch');
    expect(body.expected.week).toBe(a.fixture.week + 1);
    expect((await load(userId)).teamStats.matchesPlayed).toBe(1);
  }, 60_000);

  it('squad/migrate (one save) retries on the fresh copy; the training stands and the migration lands', async () => {
    const { userId, state } = await newPlayer('Migra FC');
    await db
      .update(schema.gameStates)
      .set({ currentState: sql`${schema.gameStates.currentState} #- '{squad,currentWeek}'` })
      .where(eq(schema.gameStates.userId, userId));
    const base = await versionOf(userId);
    trainingAfterRead(userId, state);

    const response = await routes.migratePOST(post('/api/squad/migrate', { userId }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ message: 'Migration completed' });
    const after = await load(userId);
    expect(after.squad.weeklyTrainingBudget).toBe(14);
    expect(after.squad.currentWeek).toBe(1);
    // The training, then the migration: two writes, the first attempt's miss not among them.
    expect(await versionOf(userId)).toBe(base + 2);
  }, 60_000);

  it('squad/migrate (batch) retries the one save that moved; the training stands', async () => {
    const { userId, state } = await newPlayer('Lote FC');
    await db
      .update(schema.gameStates)
      .set({ currentState: sql`${schema.gameStates.currentState} #- '{squad,currentWeek}'` })
      .where(eq(schema.gameStates.userId, userId));
    trainingAfterRead(userId, state);

    const response = await routes.migrateGET(request('/api/squad/migrate', { headers: { authorization: `Bearer ${CRON_SECRET}` } }));

    const after = await load(userId);
    expect(after.squad.weeklyTrainingBudget).toBe(14);
    expect(after.squad.currentWeek).toBe(1);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conflicts).toBe(0);
    expect(body.migrated).toBeGreaterThanOrEqual(1);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Money-only writers: the increment lands on top of the training.

describe('a training session lands while a money-only writer is holding the save', () => {
  it('predictions/bet debits the stake on top of the training rather than over it', async () => {
    const { userId, state } = await newPlayer('Aposta FC');
    const predictionId = await openPrediction();
    trainingAfterRead(userId, state);

    const response = await routes.bet(post('/api/predictions/bet', { userId, predictionId, optionId: 'home', amount: 10_000 }));

    expect(response.status).toBe(200);
    const after = await load(userId);
    expect(after.squad.weeklyTrainingBudget).toBe(14);
    expect(after.user.money).toBe(state.user.money - 10_000);
    expect((await response.json()).newBalance).toBe(state.user.money - 10_000);
  }, 60_000);

  it('predictions/settle pays a bettor who is mid-action: the payout and the action both stand', async () => {
    const { userId, state } = await newPlayer('Pagamento FC');
    const predictionId = await openPrediction();
    const potentialWin = await placeBet(userId, predictionId, 10_000);
    // Settlement needs a signed-in admin; the bettor's training does not
    // belong to that session, so the hook steps out of it while it trains.
    hooks.afterRead = async (readUserId) => {
      if (readUserId !== userId) return false;
      signIn(null);
      await training(userId, state);
      signIn(ADMIN);
      return true;
    };
    signIn(ADMIN);

    const response = await settle(predictionId);
    signIn(null);
    await trainingAtTheLatest(userId, state);

    expect(response.status).toBe(200);
    const after = await load(userId);
    expect(after.squad.weeklyTrainingBudget).toBe(14);
    expect(after.user.money).toBe(state.user.money - 10_000 + potentialWin);
  }, 60_000);

  it('a bettor whose action read the save before the payout is refused, and the payout stands', async () => {
    const { userId, state } = await newPlayer('Meio Lance FC');
    const predictionId = await openPrediction();
    const potentialWin = await placeBet(userId, predictionId, 10_000);
    // The bettor's own training reads the save; settlement pays while it is in flight.
    hooks.afterRead = async (readUserId) => {
      if (readUserId !== userId) return false;
      signIn(ADMIN);
      const paid = await settle(predictionId);
      expect(paid.status).toBe(200);
      signIn(null);
      return true;
    };

    const response = await routes.train(post('/api/squad/train', { userId, playerId: state.squad.players[0].id, focus: 'technical' }));

    await expectConflict(response);
    const after = await load(userId);
    expect(after.user.money).toBe(state.user.money - 10_000 + potentialWin);
    expect(after.squad.weeklyTrainingBudget).toBe(15);
  }, 60_000);

  it('investment/claim credits the yield on top of the training rather than over it', async () => {
    const owner = `race-claim-${randomUUID().slice(0, 8)}`;
    signIn(owner);
    const { userId, state } = await newPlayer('Torcida FC');
    expect(userId).toBe(owner);
    await db.insert(schema.investmentYields).values({
      investmentId: randomUUID(),
      userId,
      amount: 7_500,
      claimed: false,
      expiryDate: new Date(Date.now() + 86_400_000),
    });
    trainingAfterRead(userId, state);

    const response = await routes.claim(post('/api/investment/claim', { claimAll: true }));
    await trainingAtTheLatest(userId, state);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ claimed: 7_500 });
    const after = await load(userId);
    expect(after.squad.weeklyTrainingBudget).toBe(14);
    expect(after.user.money).toBe(state.user.money + 7_500);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Settlement that cannot pay

describe('a payout that fails during settlement', () => {
  it('leaves the bet unsettled so settling again pays it', async () => {
    const { userId, state } = await newPlayer('Calote FC');
    const predictionId = await openPrediction();
    const potentialWin = await placeBet(userId, predictionId, 10_000);
    signIn(ADMIN);

    // The payout fails at the database: a check constraint that no write to
    // this player's row can satisfy. NOT VALID so the row as it stands is
    // left alone; only the next UPDATE trips it. Dropped again below.
    // DDL takes no bind parameters; the id is one this test generated.
    await db.execute(sql.raw(`alter table game_states add constraint race_block_payout check (user_id <> '${userId}') not valid`));
    let failed: Response;
    try {
      failed = await settle(predictionId);
    } finally {
      await db.execute(sql`alter table game_states drop constraint race_block_payout`);
    }
    expect(failed.status).toBeGreaterThanOrEqual(500);

    // Nothing was paid, and the bet still says so.
    expect((await load(userId)).user.money).toBe(state.user.money - 10_000);
    const [bet] = await betRows(userId);
    expect(bet.settled).toBe(false);

    const again = await settle(predictionId);
    expect(again.status).toBe(200);
    expect((await load(userId)).user.money).toBe(state.user.money - 10_000 + potentialWin);
    const [paidBet] = await betRows(userId);
    expect(paidBet.settled).toBe(true);
    expect(paidBet.won).toBe(true);

    // And a third run finds nothing left to pay, and pays nothing twice.
    const third = await settle(predictionId);
    expect(third.status).toBe(200);
    expect((await load(userId)).user.money).toBe(state.user.money - 10_000 + potentialWin);
  }, 60_000);
});
