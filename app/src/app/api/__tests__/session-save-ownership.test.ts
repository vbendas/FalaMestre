// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// A signed-in player's save has to be keyed on the session user id. These tests
// use a Google-shaped subject id — a long run of digits, nothing like the
// `user_xxxxxxxxx` ids onboarding generates locally — because an id that merely
// looked like a game id was what hid this: ownership checks compared two ids
// that could never match, and the player was refused on their own save.
const session = vi.hoisted(() => ({
  current: null as { user: { id: string; email?: string; name?: string } } | null,
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session.current),
}));

vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const db = vi.hoisted(() => {
  const findFirst = vi.fn<() => Promise<unknown>>(async () => null);
  const insertValues = vi.fn(async (_values: Record<string, unknown>) => undefined);
  const insert = vi.fn(() => ({ values: insertValues }));
  // `where` is awaitable for the chat append and offers `.returning()` for
  // the guarded save write, which needs one row back to count as a success.
  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() =>
        Object.assign(Promise.resolve(undefined), { returning: async () => [{ version: 2 }] })
      ),
    })),
  }));
  return { findFirst, insert, insertValues, update };
});

vi.mock('@/db', () => ({
  db: {
    query: new Proxy({}, { get: () => ({ findFirst: db.findFirst, findMany: vi.fn(async () => []) }) }),
    insert: db.insert,
    update: db.update,
  },
}));

import { POST as createTeamPOST } from '../onboarding/create-team/route';
import { GET as conversationGET } from '../conversation/route';
import { POST as squadMigratePOST } from '../squad/migrate/route';

const GOOGLE_USER = '109427834512345678901';

function signIn(user: { id: string; email?: string; name?: string } | null) {
  session.current = user ? { user } : null;
}

function createTeamRequest() {
  return new NextRequest('http://localhost/api/onboarding/create-team', {
    method: 'POST',
    body: JSON.stringify({
      teamName: 'Dragões do Cerrado',
      primaryColor: '#112233',
      secondaryColor: '#445566',
      badgeStyle: 'shield',
    }),
    headers: { 'content-type': 'application/json' },
  });
}

/** The values passed to the insert into `game_states`, if there was one. */
function insertedGameState(): { userId: string; team: string } | undefined {
  return db.insertValues.mock.calls
    .map((call) => call[0] as { userId?: string; team?: string; currentState?: unknown })
    .find((values) => values?.currentState !== undefined) as
    | { userId: string; team: string }
    | undefined;
}

describe('a signed-in player owns their save', () => {
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
    db.findFirst.mockImplementation(async () => null);
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

  it('onboarding creates the save under the session user, not a fresh local id', async () => {
    signIn({ id: GOOGLE_USER, email: 'player@example.com', name: 'Player' });

    const response = await createTeamPOST(createTeamRequest());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      userId: GOOGLE_USER,
      team: 'Dragões do Cerrado',
    });
    expect(insertedGameState()?.userId).toBe(GOOGLE_USER);
  });

  it('onboarding records the account email for the session user', async () => {
    signIn({ id: GOOGLE_USER, email: 'player@example.com', name: 'Player' });

    await createTeamPOST(createTeamRequest());

    const userRow = db.insertValues.mock.calls
      .map((call) => call[0] as { id?: string; email?: string })
      .find((values) => values?.id === GOOGLE_USER);
    expect(userRow?.email).toBe('player@example.com');
  });

  it('onboarding hands back the save a session user already has instead of a second one', async () => {
    signIn({ id: GOOGLE_USER, email: 'player@example.com' });
    db.findFirst.mockImplementation(async () => ({ userId: GOOGLE_USER, team: 'Velha Guarda' }));

    const response = await createTeamPOST(createTeamRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      userId: GOOGLE_USER,
      team: 'Velha Guarda',
      alreadyExisted: true,
    });
    expect(insertedGameState()).toBeUndefined();
  });

  it('the conversation load returns the session user their own save', async () => {
    signIn({ id: GOOGLE_USER });
    db.findFirst.mockImplementation(async () => ({
      userId: GOOGLE_USER,
      currentState: { user: { money: 1000 } },
      conversationHistory: [],
    }));

    const response = await conversationGET(
      new NextRequest(`http://localhost/api/conversation?userId=${GOOGLE_USER}`)
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ exists: true });
  });

  it('the conversation load refuses a caller with no session at all', async () => {
    // It used to hand back whatever save the id in the query string pointed
    // at, with nobody signed in.
    signIn(null);

    const response = await conversationGET(
      new NextRequest(`http://localhost/api/conversation?userId=${GOOGLE_USER}`)
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized. Please sign in to continue.',
    });
    expect(db.findFirst).not.toHaveBeenCalled();
  });

  it("the conversation load still refuses a session user asking for someone else's save", async () => {
    signIn({ id: GOOGLE_USER });

    const response = await conversationGET(
      new NextRequest('http://localhost/api/conversation?userId=user_abcdefghi')
    );

    expect(response.status).toBe(403);
    expect(db.findFirst).not.toHaveBeenCalled();
  });

  it('onboarding with auth on refuses an unsigned visitor, whose team could never be played', async () => {
    signIn(null);

    const response = await createTeamPOST(createTeamRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized. Please sign in to continue.',
    });
    expect(insertedGameState()).toBeUndefined();
  });

  it('onboarding with auth disabled in dev keeps creating a local save id', async () => {
    process.env.AUTH_DISABLED = 'true';
    signIn(null);

    const response = await createTeamPOST(createTeamRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.userId).toMatch(/^user_[a-z0-9]{9}$/);
    // No session, so no existence check short-circuits the create.
    expect(insertedGameState()?.userId).toBe(body.userId);
  });

  it('the load-time squad migrate call succeeds with the id the client now resolves', async () => {
    // useGameState fires this on every load with the id usePlayerId resolved,
    // which for a signed-in player is the session user id.
    signIn({ id: GOOGLE_USER });
    db.findFirst.mockImplementation(async () => ({
      userId: GOOGLE_USER,
      // squad.weeklyTrainingBudget is missing, so the migration has work to do
      // and the update must land on the session user's row.
      currentState: { squad: { players: [] } },
    }));

    const response = await squadMigratePOST(
      new NextRequest('http://localhost/api/squad/migrate', {
        method: 'POST',
        body: JSON.stringify({ userId: GOOGLE_USER }),
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(db.update).toHaveBeenCalled();
  });

  it('the load-time squad migrate call refuses a stale local id once signed in', async () => {
    signIn({ id: GOOGLE_USER });

    const response = await squadMigratePOST(
      new NextRequest('http://localhost/api/squad/migrate', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user_abcdefghi' }),
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(db.findFirst).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('the conversation load works off the id it is given with auth disabled', async () => {
    process.env.AUTH_DISABLED = 'true';
    signIn(null);
    db.findFirst.mockImplementation(async () => ({
      userId: 'user_abcdefghi',
      currentState: { user: { money: 1000 } },
      conversationHistory: [],
    }));

    const response = await conversationGET(
      new NextRequest('http://localhost/api/conversation?userId=user_abcdefghi')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ exists: true });
  });
});
