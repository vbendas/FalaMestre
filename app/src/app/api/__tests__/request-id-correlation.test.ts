// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Every line a request produces, from the route down into the storage and
 * formation code, carries that request's ID.
 *
 * The routes have logged through the request logger for a while; what this
 * pins down is the layer underneath. The embedded database opens itself on
 * the first query with no request in hand, so its line must show up under
 * the ID of the request that triggered it; a match, which used to print a
 * debug line per goal, must write nothing that is not stamped; and two
 * requests running at once must not pick up each other's ID.
 *
 * Runs against the real embedded Postgres so the database line is the real
 * one, not a mock's.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

type Routes = {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  conversationPOST: typeof import('../conversation/route').POST;
  match: typeof import('../match/route').POST;
};

let dataDir: string;
let routes: Routes;
let local: typeof import('@/db/local');

type Line = Record<string, unknown> & { requestId?: string; scope?: string; message?: string };
let captured: Line[];
let rawCalls: unknown[][];

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-reqid-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  process.env.LOG_LEVEL = 'debug';
  vi.resetModules();
  local = await import('@/db/local');
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    conversationPOST: (await import('../conversation/route')).POST,
    match: (await import('../match/route')).POST,
  };
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  delete process.env.LOG_LEVEL;
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  captured = [];
  rawCalls = [];
  const capture = (...args: unknown[]) => {
    rawCalls.push(args);
    if (args.length === 1 && typeof args[0] === 'string') {
      try {
        captured.push(JSON.parse(args[0]));
        return;
      } catch {
        // Not one of ours; left in rawCalls to fail the assertion below.
      }
    }
  };
  vi.spyOn(console, 'log').mockImplementation(capture);
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
  vi.spyOn(console, 'debug').mockImplementation(capture);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function post(url: string, body: unknown, requestId: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
    body: JSON.stringify(body),
  });
}

/** Every console call was a JSON line, and every line carries `requestId`. */
function expectAllLinesBelongTo(requestId: string) {
  expect(rawCalls).toHaveLength(captured.length);
  expect(captured.length).toBeGreaterThan(0);
  for (const line of captured) {
    expect(line.requestId).toBe(requestId);
  }
}

describe('request ID correlation', () => {
  it('stamps the database open, triggered inside the first request, with that request', async () => {
    const created = await routes.createTeam(
      post(
        '/api/onboarding/create-team',
        { teamName: 'Rastro FC', primaryColor: '#112233', secondaryColor: '#AABBCC', badgeStyle: 'shield' },
        'corr-create-0001',
      ),
    );
    expect(created.status).toBe(201);

    expectAllLinesBelongTo('corr-create-0001');
    expect(captured).toContainEqual(
      expect.objectContaining({ scope: 'db', message: 'Using embedded local database', dataDir }),
    );
  }, 60_000);

  it('stamps everything a one-shot match writes with that request', async () => {
    const created = await routes.createTeam(
      post(
        '/api/onboarding/create-team',
        { teamName: 'Pista FC', primaryColor: '#112233', secondaryColor: '#AABBCC', badgeStyle: 'shield' },
        'corr-create-0002',
      ),
    );
    const { userId } = await created.json();
    captured = [];
    rawCalls = [];

    const played = await routes.match(post('/api/match', { userId }, 'corr-match-0002'));
    expect(played.status).toBe(200);

    expectAllLinesBelongTo('corr-match-0002');
    expect(captured.map((line) => line.message)).toEqual(['Enhanced script generated', 'Request completed']);
    expect(captured.every((line) => line.route === 'match')).toBe(true);
  }, 60_000);

  it('keeps two requests apart when their library calls interleave', async () => {
    const created = await routes.createTeam(
      post(
        '/api/onboarding/create-team',
        { teamName: 'Dupla FC', primaryColor: '#112233', secondaryColor: '#AABBCC', badgeStyle: 'shield' },
        'corr-create-0003',
      ),
    );
    const { userId } = await created.json();
    captured = [];
    rawCalls = [];

    const [a, b] = await Promise.all([
      routes.conversationPOST(
        post('/api/conversation', { userId, message: 'Como está o time?', useMock: true }, 'corr-chat-aaaa'),
      ),
      routes.conversationPOST(
        post('/api/conversation', { userId, message: 'Quem é o próximo rival?', useMock: true }, 'corr-chat-bbbb'),
      ),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    expect(rawCalls).toHaveLength(captured.length);
    const ids = new Set(captured.map((line) => line.requestId));
    expect(ids).toEqual(new Set(['corr-chat-aaaa', 'corr-chat-bbbb']));
    for (const id of ids) {
      expect(captured.filter((line) => line.requestId === id).length).toBeGreaterThan(0);
    }
  }, 60_000);
});
