// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * What the chat screen needs from /api/conversation, against a real embedded
 * database: every turn is appended to the stored conversation and comes back
 * on the next load, the reply carries the actions the screen shows under it,
 * and the message limit the route enforces is enforced.
 *
 * The last case is the one that made wiring the screen unsafe. Talking to the
 * assistant never changes the game, but the route used to re-save the state
 * it had read before the AI call, so a save committed meanwhile — a match
 * banked in another tab, a transfer — was reverted by the next chat. Here a
 * match is banked while a chat is in flight: the week must still have moved.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

/**
 * The assistant is the real mock, with one addition: a test can hold its
 * reply open. That is what makes the race below a fact rather than a timing
 * guess — the competing save is committed while the route is provably
 * between reading the state and writing.
 */
const gate: {
  release: (() => void) | null;
  held: Promise<void> | null;
  entered: boolean;
} = { release: null, held: null, entered: false };

function holdTheAssistant() {
  gate.entered = false;
  gate.held = new Promise<void>((resolve) => {
    gate.release = resolve;
  });
}

vi.mock('@/lib/ai-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai-service')>();
  return {
    ...actual,
    callAIMock: async (...args: Parameters<typeof actual.callAIMock>) => {
      gate.entered = true;
      if (gate.held) await gate.held;
      return actual.callAIMock(...args);
    },
  };
});

let dataDir: string;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let routes: {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  get: typeof import('../conversation/route').GET;
  post: typeof import('../conversation/route').POST;
};

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-chat-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  vi.resetModules();
  local = await import('@/db/local');
  ({ db } = await import('@/db'));
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    get: (await import('../conversation/route')).GET,
    post: (await import('../conversation/route')).POST,
  };
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

function post(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function load(userId: string) {
  const response = await routes.get(
    new NextRequest(`http://localhost/api/conversation?userId=${userId}`),
  );
  expect(response.status).toBe(200);
  return response.json();
}

async function newPlayer(teamName: string): Promise<string> {
  const created = await routes.createTeam(
    post('/api/onboarding/create-team', {
      teamName,
      primaryColor: '#112233',
      secondaryColor: '#AABBCC',
      badgeStyle: 'shield',
    }),
  );
  expect(created.status).toBe(201);
  return (await created.json()).userId;
}

describe('the chat screen against /api/conversation', () => {
  it('keeps every turn of the conversation across a reload', async () => {
    const userId = await newPlayer('Papo FC');

    const first = await routes.post(
      post('/api/conversation', { userId, message: 'Como está o time, mestre?' }),
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(typeof firstBody.response).toBe('string');
    expect(firstBody.response.length).toBeGreaterThan(0);
    // The chips the screen renders under the reply.
    expect(Array.isArray(firstBody.actions)).toBe(true);

    const second = await routes.post(
      post('/api/conversation', { userId, message: 'E o próximo jogo?' }),
    );
    expect(second.status).toBe(200);

    // What a reload shows: both turns, oldest first, each reply carrying the
    // actions it was sent with.
    const reloaded = await load(userId);
    const history = reloaded.conversationHistory;
    expect(history).toHaveLength(4);
    expect(history.map((m: { role: string }) => m.role)).toEqual(['user', 'ai', 'user', 'ai']);
    expect(history[0].content).toBe('Como está o time, mestre?');
    expect(history[1].content).toBe(firstBody.response);
    expect(history[1].actions).toEqual(firstBody.actions);
    expect(history[2].content).toBe('E o próximo jogo?');
    // The restart in the middle closes and reopens the embedded store, which
    // re-runs its migrations; under the full suite, with several stores
    // opening in parallel, that can take longer than the default 10s.
  }, 30_000);

  it('refuses a message longer than the route accepts', async () => {
    const userId = await newPlayer('Limite FC');

    const response = await routes.post(
      post('/api/conversation', { userId, message: 'a'.repeat(2001) }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/2000/);
    expect((await load(userId)).conversationHistory).toHaveLength(0);
  });

  it('tells the player when the mock answered for a live model that failed', async () => {
    const userId = await newPlayer('Queda FC');

    // A key is configured, so the route tries the live model — which cannot
    // answer here (ai-service read the key at import time and has none), so
    // the mock stands in. That substitution is what has to be visible.
    process.env.OPENROUTER_API_KEY = 'sk-not-a-real-key';
    try {
      const response = await routes.post(
        post('/api/conversation', { userId, message: 'Fale do elenco', useMock: false }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.source).toBe('fallback');
      expect(typeof body.response).toBe('string');

      // And it is still visible after a reload, not just in the live reply.
      const history = (await load(userId)).conversationHistory;
      expect(history[1].source).toBe('fallback');
    } finally {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it('marks a reply the mock was meant to give as the mock, not a failure', async () => {
    const userId = await newPlayer('Mock FC');
    const response = await routes.post(
      post('/api/conversation', { userId, message: 'Fale do elenco', useMock: true }),
    );
    expect((await response.json()).source).toBe('mock');
  });

  it('tells the player when the exchange could not be saved', async () => {
    const userId = await newPlayer('Perda FC');
    const { db: database } = await import('@/db');

    // The reply is produced, the write is not. The player must not be shown
    // an answer that looks like history and is gone after a reload.
    const broken = vi.spyOn(database, 'update').mockImplementationOnce(() => {
      throw new Error('write failed');
    });
    const response = await routes.post(post('/api/conversation', { userId, message: 'Fala!' }));
    broken.mockRestore();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.response).toBe('string');
    expect(body.persisted).toBe(false);

    // And the save really did not keep it, which is what the flag claims.
    expect((await load(userId)).conversationHistory).toHaveLength(0);
  });

  it('reports a saved exchange as saved', async () => {
    const userId = await newPlayer('Guardado FC');
    const response = await routes.post(post('/api/conversation', { userId, message: 'Fala!' }));
    expect((await response.json()).persisted).toBe(true);
    expect((await load(userId)).conversationHistory).toHaveLength(2);
  });

  it('refuses a message from someone with no save instead of inventing a team', async () => {
    const userId = 'user_zzz999yyy';
    expect((await load(userId)).exists).toBe(false);

    const response = await routes.post(post('/api/conversation', { userId, message: 'oi' }));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('no_save');

    // No save was conjured up — the player still goes through onboarding and
    // picks their own club.
    expect((await load(userId)).exists).toBe(false);
  });

  it('keeps two tabs talking at once in order, each reply under its own message', async () => {
    const userId = await newPlayer('Duas Abas FC');
    const [first, second] = await Promise.all([
      routes.post(post('/api/conversation', { userId, message: 'mensagem da aba UM' })),
      routes.post(post('/api/conversation', { userId, message: 'mensagem da aba DOIS' })),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const history = (await load(userId)).conversationHistory;
    expect(history).toHaveLength(4);
    // Strictly alternating: a pair is appended in one write, so no reply can
    // be separated from the message it answers.
    expect(history.map((m: { role: string }) => m.role)).toEqual(['user', 'ai', 'user', 'ai']);
    const sent = [history[0].content, history[2].content].sort();
    expect(sent).toEqual(['mensagem da aba DOIS', 'mensagem da aba UM']);
  });

  it('logs the real counters, not the money and the week', async () => {
    const userId = await newPlayer('Telemetria FC');
    const { db: database } = await import('@/db');
    const { analyticsEvents } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await routes.post(post('/api/conversation', { userId, message: 'Fala!' }));

    const rows = await database
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.userId, userId));
    const context = (rows[0].properties as { gameContext: Record<string, number> }).gameContext;
    const state = (await load(userId)).gameState;

    expect(context.points).toBe(state.season.points);
    expect(context.matchesPlayed).toBe(state.teamStats.matchesPlayed);
    expect(context.money).toBe(state.user.money);
    expect(context.week).toBe(state.season.week);
    // A save that has played nothing reports nothing played, whatever round
    // it is on.
    expect(context.matchesPlayed).toBe(0);
  });

  it('does not revert a save that was committed while the reply was in flight', async () => {
    const userId = await newPlayer('Corrida FC');
    const { gameStates } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const before = (await load(userId)).gameState;
    expect(before.season.week).toBe(1);

    // The chat turn and a save committed underneath it, as two tabs would do
    // it. The write below stands in for whatever else moves the save on — a
    // match being banked is the usual one.
    holdTheAssistant();
    const chat = routes.post(post('/api/conversation', { userId, message: 'Boa, mestre!' }));
    // The route has read the save and is inside the AI call.
    await vi.waitUntil(() => gate.entered, { timeout: 5000 });

    const moved = { ...before, season: { ...before.season, week: 7, points: 3 } };
    await db
      .update(gameStates)
      .set({ currentState: moved, updatedAt: new Date() })
      .where(eq(gameStates.userId, userId));

    gate.release?.();
    expect((await chat).status).toBe(200);
    gate.held = null;

    const after = await load(userId);
    expect(after.gameState.season.week).toBe(7);
    expect(after.gameState.season.points).toBe(3);
    // And the conversation turn itself still landed.
    expect(after.conversationHistory).toHaveLength(2);
  });
});
