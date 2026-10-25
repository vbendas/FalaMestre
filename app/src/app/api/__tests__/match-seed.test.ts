// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import type { GameState } from '@/lib/types';

// Auth runs before the body is read; stub it so these tests reach the match.
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(async () => null),
  getAuthenticatedUser: vi.fn(async () => null),
  getRequestUserId: vi.fn(async () => null),
}));

// The real mock narrator runs: its wording follows the seed, so narration is
// compared like the rest of the response rather than stubbed out.

// Each request gets its own deep copy of the saved game: the match route
// mutates the state it loads, and a replay must start from the same state.
const USER_ID = 'user_abc123def';
const USER_TEAM = BRAZILIAN_TEAMS[0].name;
const fixtureState: GameState = withSeed('fixture', () => createInitialGameState(USER_ID, USER_TEAM));
fixtureState.season.nextMatch = {
  opponent: BRAZILIAN_TEAMS[1].name,
  isHome: true,
  date: '2026-01-01T00:00:00.000Z',
  competition: 'Liga Mestre',
};

vi.mock('@/db', () => ({
  db: {
    query: {
      gameStates: {
        findFirst: vi.fn(async () => ({ currentState: structuredClone(fixtureState) })),
      },
    },
    update: () => ({ set: () => ({ where: async () => ({ rows: [] }) }) }),
  },
}));

import { POST as matchPOST } from '../match/route';
import { POST as decidePOST } from '../match/decide/route';
import { POST as streamPOST } from '../match/stream/route';

let requestCounter = 0;
function post(url: string, body: unknown): NextRequest {
  // A distinct client address per request keeps the in-memory rate limiter
  // out of the way.
  requestCounter += 1;
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.0.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
  });
}

/**
 * Keys that are identity or wall-clock rather than match content.
 *
 * Event ids are deliberately outside the seeded stream (see rng.ts): an id is
 * identity, not content. `commentaryId`/`commentaryEventId` are references to
 * those ids, `matchId` and `generatedAt` embed Date.now(), and `date` is the
 * wall-clock time a fixture was scheduled. Narration is *not* in this list —
 * it follows the seed and is compared.
 */
const IDENTITY_KEYS = new Set([
  'id',
  'commentaryId',
  'commentaryEventId',
  'matchId',
  'generatedAt',
  'date',
  'updatedAt',
]);

/** Recursively drops ids and timestamps so two replays can be compared. */
function stripIdentity(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripIdentity);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (IDENTITY_KEYS.has(key)) continue;
      out[key] = stripIdentity(inner);
    }
    return out;
  }
  return value;
}

const SEED_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

const BAD_SEEDS: Array<{ label: string; seed: unknown }> = [
  { label: 'an object', seed: { nested: true } },
  { label: 'an array', seed: [1, 2] },
  { label: 'a boolean', seed: true },
  { label: 'an empty string', seed: '' },
  { label: 'a string with spaces', seed: 'not a seed' },
  { label: 'an over-long string', seed: 'x'.repeat(65) },
  { label: 'a fractional number', seed: 1.5 },
  { label: 'an unsafe integer', seed: 2 ** 53 },
  { label: 'null', seed: null },
];

beforeEach(() => {
  vi.stubEnv('USE_MOCK_AI', 'true');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/match seed', () => {
  const URL = 'http://localhost/api/match';

  async function play(body: Record<string, unknown>) {
    const response = await matchPOST(post(URL, { userId: USER_ID, ...body }));
    return { status: response.status, json: await response.json() };
  }

  it('replays the same match for the same seed, ignoring ids and timestamps', async () => {
    const first = await play({ seed: 'replay-me' });
    const second = await play({ seed: 'replay-me' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.json.seed).toBe('replay-me');
    expect(second.json.seed).toBe('replay-me');
    expect(first.json.result.events.length).toBeGreaterThan(0);
    expect(stripIdentity(first.json)).toEqual(stripIdentity(second.json));
  });

  it('covers the visual script and the next fixture, not just the score', async () => {
    const first = await play({ seed: 42 });
    const second = await play({ seed: 42 });

    expect(first.json.seed).toBe(42);
    expect(first.json.matchScript._enhanced.movements.length).toBeGreaterThan(0);
    expect(stripIdentity(first.json.matchScript)).toEqual(stripIdentity(second.json.matchScript));
    expect(first.json.nextMatch.opponent).toBe(second.json.nextMatch.opponent);
    expect(first.json.nextMatch.isHome).toBe(second.json.nextMatch.isHome);
    expect(first.json.updatedGameState.season.position).toBe(second.json.updatedGameState.season.position);
  });

  it('narrates identically on a replay', async () => {
    const first = await play({ seed: 'narration-replay' });
    const second = await play({ seed: 'narration-replay' });

    expect(typeof first.json.narration).toBe('string');
    expect(first.json.narration.length).toBeGreaterThan(0);
    expect(first.json.narration).toBe(second.json.narration);
  });

  it('still varies its narration across different seeds', async () => {
    // The mock narrator picks between a handful of variants, so a few seeds
    // are enough to show the wording is not simply pinned to one string.
    const narrations = new Set<string>();
    for (const seed of ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']) {
      narrations.add((await play({ seed })).json.narration);
    }
    expect(narrations.size).toBeGreaterThan(1);
  }, 20_000); // eight matches, each paying the mock narrator's simulated latency

  it('plays unseeded when no seed is sent and reports the seed it drew', async () => {
    const first = await play({});
    const second = await play({});

    expect(first.status).toBe(200);
    expect(typeof first.json.seed).toBe('string');
    expect(first.json.seed).toMatch(SEED_PATTERN);
    expect(first.json.seed).not.toBe(second.json.seed);
  });

  it('replays a match from the seed an unseeded response reported', async () => {
    const original = await play({});
    const replay = await play({ seed: original.json.seed });

    expect(replay.json.seed).toBe(original.json.seed);
    expect(stripIdentity(replay.json)).toEqual(stripIdentity(original.json));
  });

  it.each(BAD_SEEDS)('rejects $label as a seed with 400', async ({ seed }) => {
    const { status, json } = await play({ seed });

    expect(status).toBe(400);
    expect(json.error).toBe('Validation failed');
    expect(json.field).toBe('seed');
  });
});

describe('POST /api/match/decide seed', () => {
  const URL = 'http://localhost/api/match/decide';

  function decisionBody(extra: Record<string, unknown>) {
    return {
      userId: USER_ID,
      turnNumber: 1,
      decision: null,
      priorState: {
        homeScore: 0,
        awayScore: 0,
        homeMomentum: 0,
        awayMomentum: 0,
        tension: 30,
        formation: '4-3-3',
        mentality: 'balanced',
        hasRedCard: false,
        squad: fixtureState.squad.players,
      },
      ...extra,
    };
  }

  async function decide(extra: Record<string, unknown>) {
    const response = await decidePOST(post(URL, decisionBody(extra)));
    return { status: response.status, json: await response.json() };
  }

  it('replays the same segment for the same seed, ignoring event ids', async () => {
    const first = await decide({ seed: 'turn-seed' });
    const second = await decide({ seed: 'turn-seed' });

    expect(first.status).toBe(200);
    expect(first.json.seed).toBe('turn-seed');
    expect(second.json.seed).toBe('turn-seed');
    expect(stripIdentity(first.json)).toEqual(stripIdentity(second.json));
  });

  it('reports a drawn seed when none is sent, and that seed replays', async () => {
    const original = await decide({});
    expect(original.status).toBe(200);
    expect(original.json.seed).toMatch(SEED_PATTERN);

    const replay = await decide({ seed: original.json.seed });
    expect(stripIdentity(replay.json)).toEqual(stripIdentity(original.json));
  });

  it('accepts an integer seed', async () => {
    const { status, json } = await decide({ seed: 7 });
    expect(status).toBe(200);
    expect(json.seed).toBe(7);
  });

  it.each(BAD_SEEDS)('rejects $label as a seed with 400', async ({ seed }) => {
    const { status, json } = await decide({ seed });

    expect(status).toBe(400);
    expect(json.error).toBe('Validation failed');
    expect(json.message).toMatch(/seed/);
  });
});

describe('POST /api/match/stream seed', () => {
  const URL = 'http://localhost/api/match/stream';

  /** Reads the whole SSE body and parses each `data:` line. */
  async function streamAll(body: Record<string, unknown>) {
    const response = await streamPOST(post(URL, { userId: USER_ID, ...body }));
    if (response.status !== 200) {
      return { status: response.status, json: await response.json(), events: [] as Array<Record<string, unknown>> };
    }
    const text = await response.text();
    const events = text
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
    return { status: response.status, json: null, events };
  }

  it('reports the seed on the existing kickoff event', async () => {
    const { status, events } = await streamAll({ seed: 'stream-seed' });

    expect(status).toBe(200);
    expect(events[0]).toEqual({ type: 'kickoff', minute: 0, seed: 'stream-seed' });
    expect(events.filter((e) => e.type === 'kickoff')).toHaveLength(1);
    expect(events.at(-1)?.type).toBe('fulltime');
  });

  it('replays the same stream for the same seed, ignoring event ids', async () => {
    const first = await streamAll({ seed: 'stream-seed' });
    const second = await streamAll({ seed: 'stream-seed' });

    expect(first.events.length).toBeGreaterThan(2);
    expect(stripIdentity(first.events)).toEqual(stripIdentity(second.events));
  });

  it('draws and reports a seed when none is sent', async () => {
    const { status, events } = await streamAll({});

    expect(status).toBe(200);
    expect(events[0].type).toBe('kickoff');
    expect(events[0].seed).toMatch(SEED_PATTERN);
  });

  it.each(BAD_SEEDS)('rejects $label as a seed with 400', async ({ seed }) => {
    const { status, json } = await streamAll({ seed });

    expect(status).toBe(400);
    expect(json.error).toBe('Validation failed');
    expect(json.field).toBe('seed');
  });
});
