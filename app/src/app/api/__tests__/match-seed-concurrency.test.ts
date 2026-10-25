// @vitest-environment node
/**
 * Seeding is process-global: rng.ts keeps one module-level source, and
 * `withSeed` swaps it in and out. That is the reason the match routes keep
 * every random draw inside a single *synchronous* block between awaits rather
 * than wrapping the handler — a scope held across an `await` would still be
 * installed while another request ran, and the two would share a stream.
 *
 * These tests make that failure mode reachable if it ever returns: several
 * requests with different seeds are parked at the same await by a barrier in
 * the database mock, released together, and then left to overlap again at the
 * narrator's simulated latency. Each response must still equal what the same
 * seed produces when it runs on its own.
 *
 * Their sensitivity was checked by mutation: replacing the routes' synchronous
 * `withSeed` with a variant that installs the seed, awaits, and only then
 * draws makes the match and unseeded-batch cases fail, and doing the same to
 * the wording choice in `callAIMock` makes the narration case fail. Note that
 * merely leaving a scope installed after it returns does *not* trip them —
 * every seeded block reinstalls its own source on entry, so the previous
 * value cannot matter. What these tests pin down is that no draw happens
 * across an await, which is the property the design actually relies on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import type { GameState } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(async () => null),
  getAuthenticatedUser: vi.fn(async () => null),
  getRequestUserId: vi.fn(async () => null),
}));

const USER_ID = 'user_abc123def';

const fixtureState: GameState = withSeed('fixture', () =>
  createInitialGameState(USER_ID, BRAZILIAN_TEAMS[0].name)
);
fixtureState.season.nextMatch = {
  opponent: BRAZILIAN_TEAMS[1].name,
  isHome: true,
  date: '2026-01-01T00:00:00.000Z',
  competition: 'Liga Mestre',
};

/**
 * Releases callers only once `size` of them are waiting, so every request in
 * a batch is suspended at the database await at the same moment.
 */
class Barrier {
  private size = 1;
  private waiting: Array<() => void> = [];

  setSize(size: number) {
    this.size = size;
    this.waiting = [];
  }

  async arrive(): Promise<void> {
    if (this.size <= 1) return;
    if (this.waiting.length + 1 >= this.size) {
      const release = this.waiting;
      this.waiting = [];
      for (const resume of release) resume();
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }
}

const barrier = new Barrier();

vi.mock('@/db', () => ({
  db: {
    query: {
      gameStates: {
        findFirst: vi.fn(async () => {
          await barrier.arrive();
          return { currentState: structuredClone(fixtureState) };
        }),
      },
    },
    update: () => ({
      set: () => ({
        where: async () => {
          // The write lands after the seeded block; yielding here gives the
          // other in-flight handlers another chance to interleave.
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { rows: [] };
        },
      }),
    }),
  },
}));

import { POST as matchPOST } from '../match/route';
import { POST as decidePOST } from '../match/decide/route';
import { POST as streamPOST } from '../match/stream/route';

let requestCounter = 0;
function post(url: string, body: unknown): NextRequest {
  requestCounter += 1;
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.2.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
  });
}

const IDENTITY_KEYS = new Set([
  'id',
  'commentaryId',
  'commentaryEventId',
  'matchId',
  'generatedAt',
  'date',
  'updatedAt',
]);

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

/** Distinct seeds whose matches differ, so a swapped stream would show up. */
const SEEDS = ['alpha', 'bravo', 'charlie', 'delta'];

beforeEach(() => {
  vi.stubEnv('USE_MOCK_AI', 'true');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  barrier.setSize(1);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('overlapping requests with different seeds', () => {
  it('match: each concurrent response equals its solo run', async () => {
    // Baselines first, one at a time, with the barrier open.
    barrier.setSize(1);
    const solo = new Map<string, unknown>();
    for (const seed of SEEDS) {
      const response = await matchPOST(post('http://localhost/api/match', { userId: USER_ID, seed }));
      solo.set(seed, stripIdentity(await response.json()));
    }

    // Now the same seeds in flight together, all parked at the database await.
    barrier.setSize(SEEDS.length);
    const responses = await Promise.all(
      SEEDS.map((seed) => matchPOST(post('http://localhost/api/match', { userId: USER_ID, seed })))
    );
    const concurrent = await Promise.all(responses.map((r) => r.json()));

    SEEDS.forEach((seed, i) => {
      expect(concurrent[i].seed).toBe(seed);
      expect(stripIdentity(concurrent[i])).toEqual(solo.get(seed));
    });

    // Guard the guard: the seeds must actually produce different matches,
    // otherwise the comparison above would pass even with a leak.
    const distinct = new Set(concurrent.map((r) => JSON.stringify(stripIdentity(r))));
    expect(distinct.size).toBe(SEEDS.length);
  }, 30_000);

  it('match: narration survives overlapping at the AI await', async () => {
    barrier.setSize(1);
    const soloNarration = new Map<string, string>();
    for (const seed of SEEDS) {
      const response = await matchPOST(post('http://localhost/api/match', { userId: USER_ID, seed }));
      soloNarration.set(seed, (await response.json()).narration);
    }

    barrier.setSize(SEEDS.length);
    const responses = await Promise.all(
      SEEDS.map((seed) => matchPOST(post('http://localhost/api/match', { userId: USER_ID, seed })))
    );
    const bodies = await Promise.all(responses.map((r) => r.json()));

    SEEDS.forEach((seed, i) => {
      expect(bodies[i].narration).toBe(soloNarration.get(seed));
    });
  }, 30_000);

  it('match: an unseeded request in the batch does not disturb the seeded ones', async () => {
    barrier.setSize(1);
    const response = await matchPOST(post('http://localhost/api/match', { userId: USER_ID, seed: 'alpha' }));
    const soloAlpha = stripIdentity(await response.json());

    // Three unseeded matches alongside one seeded match: the unseeded ones
    // draw from Math.random while the seeded one holds its scope.
    barrier.setSize(4);
    const [seeded, ...unseeded] = await Promise.all([
      matchPOST(post('http://localhost/api/match', { userId: USER_ID, seed: 'alpha' })),
      matchPOST(post('http://localhost/api/match', { userId: USER_ID })),
      matchPOST(post('http://localhost/api/match', { userId: USER_ID })),
      matchPOST(post('http://localhost/api/match', { userId: USER_ID })),
    ]);

    const seededBody = await seeded.json();
    expect(stripIdentity(seededBody)).toEqual(soloAlpha);

    // Each unseeded request still reports its own distinct drawn seed.
    const drawn = await Promise.all(unseeded.map(async (r) => (await r.json()).seed));
    expect(new Set(drawn).size).toBe(drawn.length);
  }, 30_000);

  it('decide: each concurrent response equals its solo run', async () => {
    const body = (seed: string) => ({
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
      seed,
    });

    barrier.setSize(1);
    const solo = new Map<string, unknown>();
    for (const seed of SEEDS) {
      const response = await decidePOST(post('http://localhost/api/match/decide', body(seed)));
      solo.set(seed, stripIdentity(await response.json()));
    }

    barrier.setSize(SEEDS.length);
    const responses = await Promise.all(
      SEEDS.map((seed) => decidePOST(post('http://localhost/api/match/decide', body(seed))))
    );
    const concurrent = await Promise.all(responses.map((r) => r.json()));

    SEEDS.forEach((seed, i) => {
      expect(concurrent[i].seed).toBe(seed);
      expect(stripIdentity(concurrent[i])).toEqual(solo.get(seed));
    });
  }, 30_000);

  it('stream: each concurrent stream equals its solo run', async () => {
    async function readStream(response: Response) {
      const text = await response.text();
      return text
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
    }

    // The stream route rate-limits at 10/min per address, so keep the batch
    // small and give every request its own address (post() already does).
    const streamSeeds = SEEDS.slice(0, 3);

    barrier.setSize(1);
    const solo = new Map<string, unknown>();
    for (const seed of streamSeeds) {
      const response = await streamPOST(post('http://localhost/api/match/stream', { userId: USER_ID, seed }));
      solo.set(seed, stripIdentity(await readStream(response)));
    }

    barrier.setSize(streamSeeds.length);
    const responses = await Promise.all(
      streamSeeds.map((seed) =>
        streamPOST(post('http://localhost/api/match/stream', { userId: USER_ID, seed }))
      )
    );
    const concurrent = await Promise.all(responses.map(readStream));

    streamSeeds.forEach((seed, i) => {
      expect(concurrent[i][0]).toMatchObject({ type: 'kickoff', seed });
      expect(stripIdentity(concurrent[i])).toEqual(solo.get(seed));
    });
  }, 30_000);

  it('all three routes overlapping at once keep their seeds apart', async () => {
    const decideBody = {
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
      seed: 'mixed',
    };

    barrier.setSize(1);
    const soloMatch = stripIdentity(
      await (await matchPOST(post('http://localhost/api/match', { userId: USER_ID, seed: 'mixed' }))).json()
    );
    const soloDecide = stripIdentity(
      await (await decidePOST(post('http://localhost/api/match/decide', decideBody))).json()
    );

    // The same seed on three different routes at once: each route's draws are
    // its own, so none of them should shift.
    barrier.setSize(3);
    const [matchRes, decideRes, streamRes] = await Promise.all([
      matchPOST(post('http://localhost/api/match', { userId: USER_ID, seed: 'mixed' })),
      decidePOST(post('http://localhost/api/match/decide', decideBody)),
      streamPOST(post('http://localhost/api/match/stream', { userId: USER_ID, seed: 'mixed' })),
    ]);

    expect(stripIdentity(await matchRes.json())).toEqual(soloMatch);
    expect(stripIdentity(await decideRes.json())).toEqual(soloDecide);
    expect(streamRes.status).toBe(200);
  }, 30_000);
});
