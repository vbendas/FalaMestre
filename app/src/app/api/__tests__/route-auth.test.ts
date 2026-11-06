// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// These tests exercise the real auth-helpers (requireAuth, getAuthenticatedUser
// and the AUTH_DISABLED switch), so unlike body-limit.test.ts the mock sits one
// level down, on next-auth's getServerSession. `session.current` is the signed-in
// user the helpers will see.
const session = vi.hoisted(() => ({
  current: null as { user: { id: string } } | null,
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session.current),
}));

// authOptions only feeds the mocked getServerSession; stub it so the test does
// not drag in the Google provider.
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// A recording database: reads resolve to one saved game, writes are swallowed.
// The auth tests assert on what was and was not called, so every entry point
// is a spy.
const db = vi.hoisted(() => {
  // Both take the table they were reached through as their first argument, so
  // a route that reads more than one table (predictions/bet reads the
  // prediction and then the save) can be given a different row for each.
  const findFirst = vi.fn<(table: string, ...args: unknown[]) => Promise<unknown>>(
    async () => null
  );
  const findMany = vi.fn<(table: string, ...args: unknown[]) => Promise<unknown[]>>(
    async () => []
  );
  const insertValues = vi.fn(() => ({
    onConflictDoUpdate: vi.fn(async () => undefined),
    returning: vi.fn(async () => []),
  }));
  const insert = vi.fn(() => ({ values: insertValues }));
  // `where` answers both shapes of write: the legacy routes await it as the
  // statement itself, the versioned ones (commitSave) chain `.returning()`
  // and need a row back to count as having won the write.
  const updateWhere = vi.fn(() =>
    Object.assign(Promise.resolve(undefined), { returning: async () => [{ version: 2 }] })
  );
  const update = vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) }));
  // The batch migration lists save ids with a plain select; an empty store.
  const selectFrom = vi.fn(async () => []);
  const select = vi.fn(() => ({ from: selectFrom }));
  // Raw statements: the bet route places a bet in one statement that checks
  // the market open, takes the stake and records the bet together. Answered
  // as placed.
  const execute = vi.fn(async () => ({ rows: [{ bet_id: 'bet-1', money: 99_000, market_open: true }] }));
  return { findFirst, findMany, insert, update, select, selectFrom, execute };
});

vi.mock('@/db', () => ({
  db: {
    query: new Proxy({}, {
      get: (_target, table: string) => ({
        findFirst: (...args: unknown[]) => db.findFirst(table, ...args),
        findMany: (...args: unknown[]) => db.findMany(table, ...args),
      }),
    }),
    insert: db.insert,
    update: db.update,
    select: db.select,
    execute: db.execute,
  },
}));

import { POST as staffPOST } from '../staff/route';
import { GET as youthGET, POST as youthPOST } from '../youth/route';
import { GET as investmentGET, POST as investmentPOST } from '../investment/route';
import { POST as predictionsBetPOST } from '../predictions/bet/route';
import { GET as squadMigrateGET, POST as squadMigratePOST } from '../squad/migrate/route';
import { POST as squadTrainPOST } from '../squad/train/route';
import { POST as squadFormationPOST } from '../squad/formation/route';
import { POST as insightsPOST } from '../insights/route';

const SESSION_USER = 'user_session_1';
const OTHER_USER = 'user_other_2';
const CRON_SECRET = 'cron-secret-for-tests';
const ADMIN_SECRET = 'admin-secret-for-tests';

// predictions.id is a uuid column and the bet route refuses anything that is
// not one before it reads a thing, so the fixture has to carry a real uuid.
const OPEN_PREDICTION_ID = '11111111-1111-4111-8111-111111111111';

/** An open prediction the bet happy path can bet on. */
function openPrediction() {
  return {
    id: OPEN_PREDICTION_ID,
    matchId: 'match-10',
    homeTeam: 'Time de Teste',
    awayTeam: 'Rival FC',
    type: 'win_draw_loss',
    status: 'open',
    deadline: new Date(Date.now() + 60 * 60 * 1000),
    options: [
      { id: 'home', label: 'Casa', odds: 1.8, totalBets: 0 },
      { id: 'away', label: 'Fora', odds: 2.4, totalBets: 0 },
    ],
  };
}

/** One saved game with enough state and money for every happy path below. */
function savedGame() {
  return {
    userId: SESSION_USER,
    currentState: {
      user: { money: 10_000_000, team: 'Time de Teste', level: 1 },
      teamStats: { totalSpent: 0 },
      staff: { headCoach: null, scout: null, medicalStaff: null },
      facilities: { trainingCenter: 1, medicalCenter: 1, youthAcademy: 1, scoutOffice: 1 },
      // Full enough for insights' game context, which reads the season line by
      // line before any AI call.
      season: {
        week: 10,
        league: 'Serie D',
        division: 'Serie D',
        position: 8,
        points: 14,
        wins: 4, draws: 2, losses: 4,
        nextMatch: { opponent: 'Rival FC', isHome: true, competition: 'Serie D' },
      },
      // One rested, healthy player so squad-train's happy path has someone to
      // train; the squad fields are the ones the training budget checks read.
      squad: {
        players: [
          {
            id: 'player_1',
            name: 'Zé do Teste',
            position: 'MC',
            pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70,
            potential: 80,
            fatigue: 50,
            currentForm: 'average',
            weeklyTrainingCount: 0,
            isInjured: false,
            injuryWeeksRemaining: 0,
            injuryType: null,
          },
        ],
        formation: '4-4-2',
        morale: 70,
        fitness: 70,
        weeklyTrainingBudget: 15,
        currentWeek: 10,
      },
      youthAcademy: { nextIntakeWeek: 14, playersAvailable: [], trainingFocus: null, lastIntakeWeek: 6 },
    },
  };
}

function jsonRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function signIn(userId: string | null) {
  session.current = userId ? { user: { id: userId } } : null;
}

function dbReads() {
  return db.findFirst.mock.calls.length + db.findMany.mock.calls.length;
}

function dbWrites() {
  return db.insert.mock.calls.length + db.update.mock.calls.length + db.execute.mock.calls.length;
}

type AuthedRoute = {
  name: string;
  handler: (request: NextRequest) => Promise<Response>;
  /** Builds a request naming `userId`, or naming nobody when null. */
  request: (userId: string | null) => NextRequest;
  /** The route's pre-existing reply when no user is identified at all. */
  missingIdReply: { error: string };
  /** Status of that reply; 400 unless the route always answered 401. */
  missingIdStatus?: number;
  /** Whether the happy path writes to the database, not just reads. */
  mutates: boolean;
};

const youthUrl = (userId: string | null) =>
  userId ? `http://localhost/api/youth?userId=${userId}` : 'http://localhost/api/youth';

const AUTHED_ROUTES: AuthedRoute[] = [
  {
    name: 'staff POST',
    handler: staffPOST,
    request: (userId) =>
      jsonRequest('POST', 'http://localhost/api/staff', {
        ...(userId ? { userId } : {}),
        action: 'hire',
        role: 'headCoach',
        tier: 'rookie',
      }),
    missingIdReply: { error: 'userId required' },
    mutates: true,
  },
  {
    name: 'youth GET',
    handler: youthGET,
    request: (userId) => jsonRequest('GET', youthUrl(userId)),
    missingIdReply: { error: 'userId required' },
    mutates: false,
  },
  {
    name: 'youth POST',
    handler: youthPOST,
    request: (userId) => jsonRequest('POST', youthUrl(userId), { action: 'set-focus', focus: 'technical' }),
    missingIdReply: { error: 'userId required' },
    mutates: true,
  },
  {
    name: 'investment GET',
    handler: investmentGET,
    request: (userId) =>
      jsonRequest('GET', userId ? `http://localhost/api/investment?userId=${userId}` : 'http://localhost/api/investment'),
    missingIdReply: { error: 'User ID required' },
    mutates: false,
  },
  {
    name: 'investment POST',
    handler: investmentPOST,
    request: (userId) =>
      jsonRequest('POST', 'http://localhost/api/investment', {
        ...(userId ? { userId } : {}),
        option: 'clube_torcedores',
      }),
    missingIdReply: { error: 'User ID required' },
    mutates: true,
  },
  {
    name: 'predictions-bet POST',
    handler: predictionsBetPOST,
    request: (userId) =>
      jsonRequest('POST', 'http://localhost/api/predictions/bet', {
        ...(userId ? { userId } : {}),
        predictionId: OPEN_PREDICTION_ID,
        optionId: 'home',
        amount: 1000,
      }),
    missingIdReply: { error: 'User ID required' },
    mutates: true,
  },
  {
    name: 'squad-train POST',
    handler: squadTrainPOST,
    request: (userId) =>
      jsonRequest('POST', 'http://localhost/api/squad/train', {
        ...(userId ? { userId } : {}),
        playerId: 'player_1',
        focus: 'rest',
      }),
    missingIdReply: { error: 'User not identified' },
    missingIdStatus: 401,
    mutates: true,
  },
  {
    name: 'squad-formation POST',
    handler: squadFormationPOST,
    request: (userId) =>
      jsonRequest('POST', 'http://localhost/api/squad/formation', {
        ...(userId ? { userId } : {}),
        formation: '4-4-2',
      }),
    missingIdReply: { error: 'User not identified. Please provide userId or sign in.' },
    missingIdStatus: 401,
    mutates: true,
  },
  {
    name: 'squad-migrate POST',
    handler: squadMigratePOST,
    request: (userId) =>
      jsonRequest('POST', 'http://localhost/api/squad/migrate', {
        ...(userId ? { userId } : {}),
      }),
    missingIdReply: { error: 'User not identified' },
    missingIdStatus: 401,
    mutates: false,
  },
];

describe('session and ownership checks on the userId routes', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let previousAuthDisabled: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    previousAuthDisabled = process.env.AUTH_DISABLED;
    delete process.env.AUTH_DISABLED;
    signIn(null);
    db.findFirst.mockImplementation(async (table: string) =>
      table === 'predictions' ? openPrediction() : savedGame()
    );
    db.findMany.mockImplementation(async () => []);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
    if (previousAuthDisabled === undefined) {
      delete process.env.AUTH_DISABLED;
    } else {
      process.env.AUTH_DISABLED = previousAuthDisabled;
    }
  });

  it.each(AUTHED_ROUTES)('$name refuses a request with nobody signed in, before reading or writing anything', async (route) => {
    signIn(null);
    const request = route.request(SESSION_USER);

    const response = await route.handler(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized. Please sign in to continue.',
    });
    expect(request.bodyUsed).toBe(false);
    expect(dbReads()).toBe(0);
    expect(dbWrites()).toBe(0);
  });

  it.each(AUTHED_ROUTES)("$name refuses a signed-in user naming someone else's id and leaves that save untouched", async (route) => {
    signIn(SESSION_USER);

    const response = await route.handler(route.request(OTHER_USER));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(dbReads()).toBe(0);
    expect(dbWrites()).toBe(0);
  });

  it.each(AUTHED_ROUTES)('$name lets a signed-in user through on their own id', async (route) => {
    signIn(SESSION_USER);

    const response = await route.handler(route.request(SESSION_USER));

    expect(response.status).toBe(200);
    expect(dbReads()).toBeGreaterThan(0);
    if (route.mutates) {
      expect(dbWrites()).toBeGreaterThan(0);
    }
  });

  it.each(AUTHED_ROUTES)('$name with auth disabled in dev works off the id it is given', async (route) => {
    process.env.AUTH_DISABLED = 'true';
    signIn(null);

    const response = await route.handler(route.request(SESSION_USER));

    expect(response.status).toBe(200);
    expect(dbReads()).toBeGreaterThan(0);
  });

  // The dev fallback keeps each route's pre-existing reply for a request that
  // identifies nobody: no session (auth disabled) and no id in the body or
  // query string. With a session the id is redundant and the session user is
  // used, as on squad/train and the other authenticated routes.
  it.each(AUTHED_ROUTES)('$name still answers a request naming nobody with its old missing-id reply', async (route) => {
    process.env.AUTH_DISABLED = 'true';
    signIn(null);

    const response = await route.handler(route.request(null));

    expect(response.status).toBe(route.missingIdStatus ?? 400);
    await expect(response.json()).resolves.toEqual(route.missingIdReply);
    expect(dbWrites()).toBe(0);
  });
});

// Insights sits outside AUTHED_ROUTES because the route keeps an in-module,
// per-user cache: the matrix reuses one user id across tests, and a second
// 200 for the same id would come from that cache instead of the database.
// Each test that reaches game state uses its own id instead.
describe('session and ownership checks on insights', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let previousAuthDisabled: string | undefined;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  function insightsRequest(userId: string | null): NextRequest {
    return jsonRequest('POST', 'http://localhost/api/insights', userId ? { userId } : {});
  }

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    previousAuthDisabled = process.env.AUTH_DISABLED;
    delete process.env.AUTH_DISABLED;
    signIn(null);
    db.findFirst.mockImplementation(async () => savedGame());
    // If the test environment carries an OPENROUTER_API_KEY, the route would
    // call out to the AI; a failing fetch makes it fall back to rule-based
    // insights either way.
    fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 500 }));
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    fetchSpy.mockRestore();
    if (previousAuthDisabled === undefined) {
      delete process.env.AUTH_DISABLED;
    } else {
      process.env.AUTH_DISABLED = previousAuthDisabled;
    }
  });

  it('refuses a request with nobody signed in, before reading or writing anything', async () => {
    signIn(null);
    const request = insightsRequest('user_insights_1');

    const response = await insightsPOST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized. Please sign in to continue.',
    });
    expect(request.bodyUsed).toBe(false);
    expect(dbReads()).toBe(0);
  });

  it("refuses a signed-in user naming someone else's id without touching their insights", async () => {
    signIn('user_insights_2');

    const response = await insightsPOST(insightsRequest(OTHER_USER));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(dbReads()).toBe(0);
  });

  it('serves a signed-in user their own insights off the session id alone', async () => {
    signIn('user_insights_3');

    const response = await insightsPOST(insightsRequest(null));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ cached: false });
    expect(dbReads()).toBeGreaterThan(0);
  });

  it('with auth disabled in dev works off the id it is given', async () => {
    process.env.AUTH_DISABLED = 'true';
    signIn(null);

    const response = await insightsPOST(insightsRequest('user_insights_4'));

    expect(response.status).toBe(200);
    expect(dbReads()).toBeGreaterThan(0);
  });

  it('still answers a request naming nobody with the invalid-request reply', async () => {
    process.env.AUTH_DISABLED = 'true';
    signIn(null);

    const response = await insightsPOST(insightsRequest(null));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request' });
    expect(dbReads()).toBe(0);
  });
});

describe('batch migration GET behind the cron or admin secret', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let previousCronSecret: string | undefined;
  let previousAdminSecret: string | undefined;

  function migrateRequest(authorization?: string): NextRequest {
    return new NextRequest('http://localhost/api/squad/migrate', {
      method: 'GET',
      headers: authorization ? { authorization } : {},
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    previousCronSecret = process.env.CRON_SECRET;
    previousAdminSecret = process.env.ADMIN_SECRET;
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.ADMIN_SECRET = ADMIN_SECRET;
    db.findMany.mockImplementation(async () => []);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    if (previousCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousCronSecret;
    }
    if (previousAdminSecret === undefined) {
      delete process.env.ADMIN_SECRET;
    } else {
      process.env.ADMIN_SECRET = previousAdminSecret;
    }
  });

  const REFUSED = { error: 'Admin or cron auth required to run the batch migration' };

  it('refuses a request with no secret before touching any game state', async () => {
    const response = await squadMigrateGET(migrateRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(REFUSED);
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('refuses a wrong secret before touching any game state', async () => {
    const response = await squadMigrateGET(migrateRequest('Bearer not-the-secret'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(REFUSED);
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('runs the batch migration under the cron secret', async () => {
    const response = await squadMigrateGET(migrateRequest(`Bearer ${CRON_SECRET}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      total: 0,
      migrated: 0,
      alreadyUpToDate: 0,
      conflicts: 0,
      errors: 0,
    });
    expect(db.selectFrom).toHaveBeenCalledTimes(1);
  });

  it('runs the batch migration under the admin secret', async () => {
    const response = await squadMigrateGET(migrateRequest(`Bearer ${ADMIN_SECRET}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, total: 0 });
    expect(db.selectFrom).toHaveBeenCalledTimes(1);
  });
});
