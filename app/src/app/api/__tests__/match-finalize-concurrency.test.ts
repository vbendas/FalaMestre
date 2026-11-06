// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Two tabs, one save, both finishing a match at the same moment.
 *
 * Before the write was guarded on the week, both requests read the pre-match
 * save, both passed the fixture check and both wrote: both players were told
 * their match counted, and the save kept whichever wrote last. The other
 * match — its score, its points, its gate receipts — vanished without anyone
 * being told.
 *
 * This runs against the real embedded Postgres rather than a mocked `@/db`,
 * because the guard is a condition inside the UPDATE (a JSON path cast on
 * `current_state`) and a hand-written mock cannot tell us whether Postgres
 * agrees with it.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

type Routes = {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  conversationGET: typeof import('../conversation/route').GET;
  decide: typeof import('../match/decide/route').POST;
  finalize: typeof import('../match/finalize/route').POST;
};

let dataDir: string;
let routes: Routes;
let local: typeof import('@/db/local');
let DECISION_TURNS: typeof import('@/lib/constants').DECISION_TURNS;
let deriveTurnSeed: typeof import('@/lib/match-seed').deriveTurnSeed;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-concurrency-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  vi.resetModules();
  local = await import('@/db/local');
  ({ DECISION_TURNS } = await import('@/lib/constants'));
  ({ deriveTurnSeed } = await import('@/lib/match-seed'));
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    conversationGET: (await import('../conversation/route')).GET,
    decide: (await import('../match/decide/route')).POST,
    finalize: (await import('../match/finalize/route')).POST,
  };
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

let requestCounter = 0;
function post(url: string, body: unknown) {
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // A distinct client address per request keeps the rate limiter out of
      // the way; these tests send a lot of finalize calls.
      'x-forwarded-for': `10.7.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
    body: JSON.stringify(body),
  });
}

async function load(userId: string) {
  const response = await routes.conversationGET(
    new NextRequest(`http://localhost/api/conversation?userId=${userId}`),
  );
  return (await response.json()).gameState;
}

/** A new save, and the fixture it is waiting on. */
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
  const state = await load(userId);
  return {
    userId,
    fixture: {
      week: state.season.week,
      opponent: state.season.nextMatch.opponent,
      isHome: state.season.nextMatch.isHome,
    },
  };
}

/** Plays all six turns under one match seed, as the match screen does. */
async function playMatch(userId: string, seed: string) {
  const state = await load(userId);
  let prior: Record<string, unknown> = {
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
  const decisions: Array<{ turnNumber: number; decisionId: null }> = [];

  for (let turnNumber = 0; turnNumber < DECISION_TURNS.length; turnNumber++) {
    const turn = await routes.decide(
      post('/api/match/decide', {
        userId,
        turnNumber,
        decision: null,
        priorState: prior,
        seed: deriveTurnSeed(seed, turnNumber),
      }),
    );
    expect(turn.status).toBe(200);
    const body = await turn.json();
    decisions.push({ turnNumber, decisionId: null });
    prior = { ...prior, ...body.endState, squad: body.endState?.squad ?? prior.squad };
  }

  return {
    decisions,
    score: { homeScore: prior.homeScore as number, awayScore: prior.awayScore as number },
  };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('two finalize calls racing for the same save', () => {
  it('banks one match and tells the other it lost the race', async () => {
    const { userId, fixture } = await newPlayer('Corrida FC');
    const before = await load(userId);

    // Two matches of the same fixture, played under different seeds — two
    // tabs, each with its own match in progress.
    const tabA = await playMatch(userId, 'race-a');
    const tabB = await playMatch(userId, 'race-b');

    const [a, b] = await Promise.all([
      routes.finalize(post('/api/match/finalize', { userId, seed: 'race-a', ...fixture, decisions: tabA.decisions })),
      routes.finalize(post('/api/match/finalize', { userId, seed: 'race-b', ...fixture, decisions: tabB.decisions })),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = a.status === 200 ? await a.json() : await b.json();
    const loser = a.status === 409 ? await a.json() : await b.json();
    expect(loser.error).toBe('Fixture mismatch');

    // Exactly one match reached the save, and it is the one whose caller was
    // told it counted.
    const after = await load(userId);
    expect(after.season.week).toBe(before.season.week + 1);
    expect(after.teamStats.matchesPlayed).toBe(before.teamStats.matchesPlayed + 1);
    expect(after.season.points).toBe(before.season.points + winner.pointsEarned);
    expect(after.season.wins + after.season.draws + after.season.losses).toBe(1);
    expect(after.season.nextMatch.opponent).toBe(winner.nextMatch.opponent);
    expect(after.user.money).toBe(winner.updatedGameState.user.money);
  }, 60_000);

  it('still banks exactly one match when four tabs pile in at once', async () => {
    const { userId, fixture } = await newPlayer('Quatro Abas FC');
    const seeds = ['q1', 'q2', 'q3', 'q4'];
    const plays = [];
    for (const seed of seeds) {
      plays.push({ seed, ...(await playMatch(userId, seed)) });
    }

    const responses = await Promise.all(
      plays.map((play) =>
        routes.finalize(
          post('/api/match/finalize', { userId, seed: play.seed, ...fixture, decisions: play.decisions }),
        ),
      ),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(3);

    const after = await load(userId);
    expect(after.season.week).toBe(fixture.week + 1);
    expect(after.teamStats.matchesPlayed).toBe(1);
  }, 60_000);

  it('rejects a finalize for a week the save has already left', async () => {
    const { userId, fixture } = await newPlayer('Semana Velha FC');
    const play = await playMatch(userId, 'stale-1');

    const first = await routes.finalize(
      post('/api/match/finalize', { userId, seed: 'stale-1', ...fixture, decisions: play.decisions }),
    );
    expect(first.status).toBe(200);

    // The same submission again: the week has moved, so the pre-write check
    // catches it before any replay happens.
    const again = await routes.finalize(
      post('/api/match/finalize', { userId, seed: 'stale-1', ...fixture, decisions: play.decisions }),
    );
    expect(again.status).toBe(409);
    expect((await again.json()).expected.week).toBe(fixture.week + 1);

    const after = await load(userId);
    expect(after.teamStats.matchesPlayed).toBe(1);
  }, 60_000);
});
