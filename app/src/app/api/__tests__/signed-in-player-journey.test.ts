// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * One signed-in player, one Google-style id, walked through the whole path in
 * order: create the team, load it, change something, and the migrate call the
 * client fires on every load.
 *
 * Every piece has its own test, but nothing ran them as one player, and that
 * is exactly what hid the original bug: onboarding minted a local
 * `user_xxxxxxxxx` id, the client then loaded under the session id, and the
 * save created in step one was invisible from step two onwards. Each step here
 * reads what the previous step actually wrote, through a stateful store rather
 * than a canned row, so an id that stops matching breaks this test.
 */
const session = vi.hoisted(() => ({
  current: null as { user: { id: string; email?: string; name?: string } } | null,
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session.current),
}));

vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// `eq(column, value)` becomes a marker the store can read back, so a query
// built for one user id can never be answered with another user's row. The
// `sql` tag keeps its string values the same way: the conversation route
// appends to the history with
// `sql\`history || ${JSON.stringify(newMessages)}::jsonb\``, so the one
// string among the tag's values is the JSON of the messages being appended,
// and the store below replays the append on its own rows.
vi.mock('drizzle-orm', () => ({
  eq: (_column: unknown, value: unknown) => ({ value }),
  // The guarded save write (commitSave) wraps `eq(userId)` and `eq(version)`
  // in `and(...)`; the first condition is the row's id, which is all the
  // store below needs.
  and: (...conditions: Array<{ value: unknown }>) => ({ value: conditions[0]?.value }),
  sql: (_strings: TemplateStringsArray, ...values: unknown[]) => ({
    appendJson: values.find((v): v is string => typeof v === 'string'),
  }),
}));

/** Rows the routes have actually written, keyed exactly as the routes key them. */
const store = vi.hoisted(() => ({
  games: new Map<string, Record<string, unknown>>(),
  users: new Map<string, Record<string, unknown>>(),
}));

vi.mock('@/db', () => {
  type Where = { value: string };

  return {
    db: {
      query: {
        gameStates: {
          findFirst: async ({ where }: { where: Where }) => store.games.get(where.value),
        },
      },
      // A game-state row carries `currentState`, a user row an `id`. Anything
      // else (conversation logs, analytics) has no reader in this journey and
      // is dropped.
      insert: () => ({
        values: async (values: Record<string, unknown>) => {
          if ('currentState' in values) {
            store.games.set(values.userId as string, { ...values });
          } else if ('id' in values) {
            store.users.set(values.id as string, { ...values });
          }
        },
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => ({
          // The guarded write (commitSave) passes `and(eq(userId), eq(version))`
          // and chains `.returning()`; the chat append passes `eq(userId)` and
          // awaits the statement. One `where` serves both: it applies the
          // patch to the row and is both awaitable and `.returning()`-able.
          where: ({ value }: Where) => {
            const apply = async () => {
              const existing = store.games.get(value);
              if (!existing) return [];
              const next = { ...existing };
              for (const [key, patchValue] of Object.entries(patch)) {
                const append = (patchValue as { appendJson?: string } | null)?.appendJson;
                if (key === 'version') {
                  // `version + 1`, replayed on the stored row.
                  next.version = ((next.version as number | undefined) ?? 1) + 1;
                } else if (append !== undefined) {
                  // The SQL-level append, replayed on the stored array.
                  const current = (next[key] as unknown[] | undefined) ?? [];
                  next[key] = [...current, ...JSON.parse(append)];
                } else {
                  next[key] = patchValue;
                }
              }
              store.games.set(value, next);
              return [{ version: next.version ?? 1 }];
            };
            const pending = apply();
            return Object.assign(pending, { returning: () => pending });
          },
        }),
      }),
    },
  };
});

import { POST as createTeamPOST } from '../onboarding/create-team/route';
import { GET as conversationGET, POST as conversationPOST } from '../conversation/route';
import { POST as squadFormationPOST } from '../squad/formation/route';
import { POST as squadMigratePOST } from '../squad/migrate/route';

/** A Google subject id: digits only, nothing like a local `user_` game id. */
const GOOGLE_USER = '109427834512345678901';
/** What this browser had in localStorage from playing before signing in. */
const STALE_LOCAL_ID = 'user_abc123xyz';

const TEAM_NAME = 'Dragões do Cerrado';

function signIn(user: { id: string; email?: string; name?: string } | null) {
  session.current = user ? { user } : null;
}

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const createTeamRequest = () =>
  jsonRequest('http://localhost/api/onboarding/create-team', {
    teamName: TEAM_NAME,
    primaryColor: '#112233',
    secondaryColor: '#445566',
    badgeStyle: 'shield',
  });

/** The row as it stands in the database right now, if there is one. */
function savedGame(userId: string) {
  return store.games.get(userId) as
    | { team: string; currentState: { squad: { formation: string } } }
    | undefined;
}

describe('one signed-in player, end to end', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let previousAuthDisabled: string | undefined;

  beforeEach(() => {
    store.games.clear();
    store.users.clear();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    previousAuthDisabled = process.env.AUTH_DISABLED;
    delete process.env.AUTH_DISABLED;
    signIn(null);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
    infoSpy.mockRestore();
    if (previousAuthDisabled === undefined) {
      delete process.env.AUTH_DISABLED;
    } else {
      process.env.AUTH_DISABLED = previousAuthDisabled;
    }
  });

  it('signs in, creates a team, loads it, changes it, and migrates it — all on one id', async () => {
    // Step 0: signed out, auth on. Neither creating nor loading is allowed,
    // and nothing is written, so the player is sent to sign in having designed
    // nothing.
    const refusedCreate = await createTeamPOST(createTeamRequest());
    expect(refusedCreate.status).toBe(401);

    const refusedLoad = await conversationGET(
      new NextRequest(`http://localhost/api/conversation?userId=${STALE_LOCAL_ID}`)
    );
    expect(refusedLoad.status).toBe(401);
    expect(store.games.size).toBe(0);

    // Step 1: signed in, onboarding creates the save under the session user.
    signIn({ id: GOOGLE_USER, email: 'player@example.com', name: 'Player' });

    const created = await createTeamPOST(createTeamRequest());
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      success: true,
      userId: GOOGLE_USER,
      team: TEAM_NAME,
    });
    // The save, and the account row beside it, belong to the session user.
    expect([...store.games.keys()]).toEqual([GOOGLE_USER]);
    expect(store.users.get(GOOGLE_USER)).toMatchObject({ email: 'player@example.com' });

    // Step 2: the client loads the save under the id it resolves from the
    // session. This is the call that used to come back 403 or empty.
    const loaded = await conversationGET(
      new NextRequest(`http://localhost/api/conversation?userId=${GOOGLE_USER}`)
    );
    expect(loaded.status).toBe(200);
    const loadedBody = await loaded.json();
    expect(loadedBody.exists).toBe(true);
    expect(loadedBody.gameState.user.team).toBe(TEAM_NAME);

    const formationBefore = savedGame(GOOGLE_USER)!.currentState.squad.formation;
    const newFormation = formationBefore === '4-4-2' ? '3-5-2' : '4-4-2';

    // Step 3: one change, and it lands on this player's own row.
    const changed = await squadFormationPOST(
      jsonRequest('http://localhost/api/squad/formation', {
        userId: GOOGLE_USER,
        formation: newFormation,
      })
    );
    expect(changed.status).toBe(200);
    await expect(changed.json()).resolves.toMatchObject({ success: true, formation: newFormation });
    expect(savedGame(GOOGLE_USER)!.currentState.squad.formation).toBe(newFormation);

    // Step 4: the migrate call the client fires on every load.
    const migrated = await squadMigratePOST(
      jsonRequest('http://localhost/api/squad/migrate', { userId: GOOGLE_USER })
    );
    expect(migrated.status).toBe(200);
    await expect(migrated.json()).resolves.toMatchObject({ success: true });

    // Step 5: the player talks to the assistant — the half of the chat the
    // journey never exercised. The reply lands, the exchange is written to
    // this player's own save, and it comes back on the next load.
    const chat = await conversationPOST(
      jsonRequest('http://localhost/api/conversation', {
        userId: GOOGLE_USER,
        message: 'Como está o time, mestre?',
        useMock: true,
      })
    );
    expect(chat.status).toBe(200);
    const chatBody = await chat.json();
    expect(typeof chatBody.response).toBe('string');
    expect(chatBody.persisted).toBe(true);

    // Step 6: the next load still sees one save, this player's, with the
    // change from step 3 and the conversation from step 5 intact, and no
    // second row created anywhere along the way.
    const reloaded = await conversationGET(
      new NextRequest(`http://localhost/api/conversation?userId=${GOOGLE_USER}`)
    );
    expect(reloaded.status).toBe(200);
    const reloadedBody = await reloaded.json();
    expect(reloadedBody.exists).toBe(true);
    expect(reloadedBody.gameState.squad.formation).toBe(newFormation);
    expect(reloadedBody.conversationHistory).toHaveLength(2);
    expect(reloadedBody.conversationHistory[0]).toMatchObject({
      role: 'user',
      content: 'Como está o time, mestre?',
    });
    expect(reloadedBody.conversationHistory[1].role).toBe('ai');
    expect([...store.games.keys()]).toEqual([GOOGLE_USER]);
  });

  it('refuses every step of that path under the local id left in localStorage', async () => {
    // Same player, now sending the id they had before signing in. Each route
    // refuses it rather than reading, writing or quietly using the session's
    // own save instead.
    signIn({ id: GOOGLE_USER, email: 'player@example.com' });
    await createTeamPOST(createTeamRequest());
    const before = JSON.stringify(savedGame(GOOGLE_USER));

    const load = await conversationGET(
      new NextRequest(`http://localhost/api/conversation?userId=${STALE_LOCAL_ID}`)
    );
    expect(load.status).toBe(403);

    const formation = await squadFormationPOST(
      jsonRequest('http://localhost/api/squad/formation', {
        userId: STALE_LOCAL_ID,
        formation: '3-4-3',
      })
    );
    expect(formation.status).toBe(403);

    const migrate = await squadMigratePOST(
      jsonRequest('http://localhost/api/squad/migrate', { userId: STALE_LOCAL_ID })
    );
    expect(migrate.status).toBe(403);

    const chat = await conversationPOST(
      jsonRequest('http://localhost/api/conversation', {
        userId: STALE_LOCAL_ID,
        message: 'oi',
        useMock: true,
      })
    );
    expect(chat.status).toBe(403);

    expect(store.games.has(STALE_LOCAL_ID)).toBe(false);
    expect(JSON.stringify(savedGame(GOOGLE_USER))).toBe(before);
  });

  it('walks the same path with auth disabled in dev, on a local id and no session', async () => {
    process.env.AUTH_DISABLED = 'true';
    signIn(null);

    const created = await createTeamPOST(createTeamRequest());
    expect(created.status).toBe(201);
    const { userId } = await created.json();
    expect(userId).toMatch(/^user_[a-z0-9]{9}$/);

    const loaded = await conversationGET(
      new NextRequest(`http://localhost/api/conversation?userId=${userId}`)
    );
    expect(loaded.status).toBe(200);
    await expect(loaded.json()).resolves.toMatchObject({ exists: true });

    const changed = await squadFormationPOST(
      jsonRequest('http://localhost/api/squad/formation', { userId, formation: '3-5-2' })
    );
    expect(changed.status).toBe(200);
    expect(savedGame(userId)!.currentState.squad.formation).toBe('3-5-2');

    const migrated = await squadMigratePOST(
      jsonRequest('http://localhost/api/squad/migrate', { userId })
    );
    expect(migrated.status).toBe(200);
  });
});
