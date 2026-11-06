// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * A signed-in player, on a Google-style session id, playing a match the way
 * the match screen plays it: six /api/match/decide calls under seeds derived
 * from one match seed, then /api/match/finalize.
 *
 * `local-player-journey.test.ts` covers the same path with auth off and a
 * locally minted id. This one exists because the signed-in path has its own
 * failure: the session id and the id in the request body are different
 * strings, and the match routes check one against the other. Nothing played a
 * signed-in player through a match, so a change that let one player finalize
 * another's fixture — or stopped a signed-in player finalizing their own —
 * would not have been caught.
 *
 * Runs against the real embedded Postgres, so the save it reads back is the
 * one the routes actually wrote.
 */

const session = vi.hoisted(() => ({
  current: null as { user: { id: string; email?: string } } | null,
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => session.current),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

type Routes = {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  conversationGET: typeof import('../conversation/route').GET;
  decide: typeof import('../match/decide/route').POST;
  finalize: typeof import('../match/finalize/route').POST;
};

/** A Google subject id: digits only, nothing like a local `user_` game id. */
const SIGNED_IN = '109427834512345678901';
const OTHER_PLAYER = '987654321098765432109';
const TEAM = 'Dragões do Cerrado';

let dataDir: string;
let routes: Routes;
let local: typeof import('@/db/local');
let DECISION_TURNS: typeof import('@/lib/constants').DECISION_TURNS;
let deriveTurnSeed: typeof import('@/lib/match-seed').deriveTurnSeed;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-signed-in-match-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.AUTH_DISABLED;
  process.env.PGLITE_DATA_DIR = dataDir;
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

function signIn(userId: string | null) {
  session.current = userId ? { user: { id: userId, email: 'player@example.com' } } : null;
}

let requestCounter = 0;
function post(url: string, body: unknown) {
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.5.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
    body: JSON.stringify(body),
  });
}

async function load(userId: string) {
  const response = await routes.conversationGET(
    new NextRequest(`http://localhost/api/conversation?userId=${userId}`),
  );
  expect(response.status).toBe(200);
  return (await response.json()).gameState;
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  signIn(SIGNED_IN);
});

describe('a signed-in player plays a match the way the screen does', () => {
  it('banks the match on the session id and lands on the next week after a reload', async () => {
    const created = await routes.createTeam(
      post('/api/onboarding/create-team', {
        teamName: TEAM,
        primaryColor: '#112233',
        secondaryColor: '#445566',
        badgeStyle: 'shield',
      }),
    );
    expect(created.status).toBe(201);
    const { userId } = await created.json();
    // The save belongs to the session, not to any id the client made up.
    expect(userId).toBe(SIGNED_IN);

    const before = await load(SIGNED_IN);
    expect(before.user.team).toBe(TEAM);
    const fixture = {
      week: before.season.week,
      opponent: before.season.nextMatch.opponent,
      isHome: before.season.nextMatch.isHome,
    };

    // The match, turn by turn, under one match seed.
    const matchSeed = 'signed-in-match';
    let prior: Record<string, unknown> = {
      homeScore: 0,
      awayScore: 0,
      homeMomentum: 0,
      awayMomentum: 0,
      tension: 30,
      formation: before.squad.formation || '4-3-3',
      mentality: 'balanced',
      hasRedCard: false,
      squad: before.squad.players,
    };
    const decisions: Array<{ turnNumber: number; decisionId: string | null }> = [];

    for (let turnNumber = 0; turnNumber < DECISION_TURNS.length; turnNumber++) {
      const turn = await routes.decide(
        post('/api/match/decide', {
          userId: SIGNED_IN,
          turnNumber,
          decision: null,
          priorState: prior,
          seed: deriveTurnSeed(matchSeed, turnNumber),
        }),
      );
      expect(turn.status, `decision turn ${turnNumber}`).toBe(200);
      const body = await turn.json();
      decisions.push({ turnNumber, decisionId: null });
      prior = { ...prior, ...body.endState, squad: body.endState?.squad ?? prior.squad };
    }

    const watched = { homeScore: prior.homeScore as number, awayScore: prior.awayScore as number };
    const settled = await routes.finalize(
      post('/api/match/finalize', {
        userId: SIGNED_IN,
        seed: matchSeed,
        ...fixture,
        decisions,
        claimedScore: watched,
      }),
    );
    expect(settled.status).toBe(200);
    const result = await settled.json();
    expect(result.result).toMatchObject(watched);

    // The save moved on, under the session id, and a reload proves it.
    const after = await load(SIGNED_IN);
    expect(after.season.week).toBe(fixture.week + 1);
    expect(after.teamStats.matchesPlayed).toBe(1);
    expect(after.season.points).toBe(result.pointsEarned);
    expect(after.season.nextMatch.opponent).not.toBe(fixture.opponent);
    expect(after.user.money).toBe(result.updatedGameState.user.money);

    // And it survives the store being closed and reopened from disk.
    await local.closeLocalDatabase();
    const afterRestart = await load(SIGNED_IN);
    expect(afterRestart.season.week).toBe(fixture.week + 1);
    expect(afterRestart.teamStats.matchesPlayed).toBe(1);
  }, 60_000);

  it('refuses to let one signed-in player finalize another player\'s fixture', async () => {
    const before = await load(SIGNED_IN);
    const fixture = {
      week: before.season.week,
      opponent: before.season.nextMatch.opponent,
      isHome: before.season.nextMatch.isHome,
    };
    const decisions = DECISION_TURNS.map((_, turnNumber) => ({ turnNumber, decisionId: null }));

    // Someone else is signed in, naming this player's save in the body.
    signIn(OTHER_PLAYER);
    const stolen = await routes.finalize(
      post('/api/match/finalize', { userId: SIGNED_IN, seed: 'thief', ...fixture, decisions }),
    );
    expect(stolen.status).toBe(403);

    // A decision turn is refused the same way, so the match cannot even be
    // played on someone else's save.
    const stolenTurn = await routes.decide(
      post('/api/match/decide', {
        userId: SIGNED_IN,
        turnNumber: 0,
        decision: null,
        seed: 'thief:turn:0',
        priorState: {
          homeScore: 0,
          awayScore: 0,
          homeMomentum: 0,
          awayMomentum: 0,
          tension: 30,
          formation: '4-3-3',
          mentality: 'balanced',
          hasRedCard: false,
          squad: before.squad.players,
        },
      }),
    );
    expect(stolenTurn.status).toBe(403);

    signIn(SIGNED_IN);
    const untouched = await load(SIGNED_IN);
    expect(untouched.season.week).toBe(before.season.week);
    expect(untouched.teamStats.matchesPlayed).toBe(before.teamStats.matchesPlayed);
  }, 60_000);

  it('refuses a finalize with nobody signed in, and leaves the save alone', async () => {
    const before = await load(SIGNED_IN);
    const decisions = DECISION_TURNS.map((_, turnNumber) => ({ turnNumber, decisionId: null }));

    signIn(null);
    const refused = await routes.finalize(
      post('/api/match/finalize', {
        userId: SIGNED_IN,
        seed: 'signed-out',
        week: before.season.week,
        opponent: before.season.nextMatch.opponent,
        isHome: before.season.nextMatch.isHome,
        decisions,
      }),
    );
    expect(refused.status).toBe(401);

    signIn(SIGNED_IN);
    const untouched = await load(SIGNED_IN);
    expect(untouched.season.week).toBe(before.season.week);
    expect(untouched.teamStats.matchesPlayed).toBe(before.teamStats.matchesPlayed);
  }, 60_000);
});
