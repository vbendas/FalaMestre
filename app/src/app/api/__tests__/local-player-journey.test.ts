// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { sql } from 'drizzle-orm';

/**
 * A new player on a checkout with nothing configured: no DATABASE_URL, auth
 * disabled, the assistant in mock mode. This is the zero-setup path, run
 * against a real embedded database rather than a mocked `@/db`, so a write
 * that fails for real is a failure here and not a warning nobody reads.
 *
 * The player creates a team, is loaded back, talks to the assistant once,
 * runs the client's migrate call, plays a match the way the match screen does
 * — every decision turn against `/api/match/decide` under a seed derived from
 * one match seed, then `/api/match/finalize` to bank it — and is loaded again
 * after the store has been closed and reopened from disk, the way a server
 * restart does it. The week has to have moved on by then: a match that does
 * not survive the reload is the bug this path exists to catch.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

type Routes = {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  conversationGET: typeof import('../conversation/route').GET;
  conversationPOST: typeof import('../conversation/route').POST;
  migrate: typeof import('../squad/migrate/route').POST;
  decide: typeof import('../match/decide/route').POST;
  finalize: typeof import('../match/finalize/route').POST;
};

let dataDir: string;
let routes: Routes;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let DECISION_TURNS: typeof import('@/lib/constants').DECISION_TURNS;
let deriveTurnSeed: typeof import('@/lib/match-seed').deriveTurnSeed;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-journey-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  vi.resetModules();
  local = await import('@/db/local');
  ({ db } = await import('@/db'));
  ({ DECISION_TURNS } = await import('@/lib/constants'));
  ({ deriveTurnSeed } = await import('@/lib/match-seed'));
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    conversationGET: (await import('../conversation/route')).GET,
    conversationPOST: (await import('../conversation/route')).POST,
    migrate: (await import('../squad/migrate/route')).POST,
    decide: (await import('../match/decide/route')).POST,
    finalize: (await import('../match/finalize/route')).POST,
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
  const response = await routes.conversationGET(
    new NextRequest(`http://localhost/api/conversation?userId=${userId}`),
  );
  expect(response.status).toBe(200);
  return response.json();
}

async function count(table: string): Promise<number> {
  const result = await db.execute(sql.raw(`select count(*)::int as n from "${table}"`));
  return (result.rows as { n: number }[])[0].n;
}

describe('new player on the embedded local store', () => {
  it('creates a team, chats, plays a match, and is all still there after a restart', async () => {
    // Onboarding.
    const created = await routes.createTeam(
      post('/api/onboarding/create-team', {
        teamName: 'Jornada FC',
        primaryColor: '#112233',
        secondaryColor: '#AABBCC',
        badgeStyle: 'shield',
      }),
    );
    expect(created.status).toBe(201);
    const { userId } = await created.json();
    expect(await count('users')).toBe(1);

    const fresh = await load(userId);
    expect(fresh.exists).toBe(true);
    expect(fresh.gameState.user.team).toBe('Jornada FC');
    expect(fresh.gameState.season.week).toBe(1);

    // One turn with the (mock) assistant: the reply, the history on the
    // save, the two conversation rows and the analytics event are all real
    // writes that the old mock database swallowed.
    const chat = await routes.conversationPOST(
      post('/api/conversation', { userId, message: 'Como está o time, mestre?', useMock: true }),
    );
    expect(chat.status).toBe(200);
    expect(typeof (await chat.json()).response).toBe('string');
    expect((await load(userId)).conversationHistory).toHaveLength(2);
    expect(await count('conversations')).toBe(2);
    expect(await count('analytics_events')).toBe(1);

    // The client fires this on every load.
    const migrated = await routes.migrate(post('/api/squad/migrate', { userId }));
    expect(migrated.status).toBe(200);

    // The match, played the way the screen plays it: one seed for the match,
    // every turn from kickoff under its derived seed, each turn's end state
    // feeding the next, every decision left to the timer.
    const state = (await load(userId)).gameState;
    const matchSeed = 'journey-match-1';
    const fixture = {
      week: state.season.week,
      opponent: state.season.nextMatch.opponent,
      isHome: state.season.nextMatch.isHome,
    };
    const decisions: Array<{ turnNumber: number; decisionId: null }> = [];
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
    for (let turnNumber = 0; turnNumber < DECISION_TURNS.length; turnNumber++) {
      const turn = await routes.decide(
        post('/api/match/decide', {
          userId,
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
      if (turnNumber < DECISION_TURNS.length - 1) {
        expect(body.nextTurn).toBeTruthy();
      } else {
        expect(body.nextTurn).toBeNull();
      }
    }

    // Finalizing is what makes the match count. The server replays the turns
    // from the seed and the decisions; the score the turns produced is sent
    // along as a claim it has to agree with, so a drifting client fails here
    // rather than banking a different match.
    const watched = { homeScore: prior.homeScore as number, awayScore: prior.awayScore as number };
    const settled = await routes.finalize(
      post('/api/match/finalize', {
        userId,
        seed: matchSeed,
        ...fixture,
        decisions,
        claimedScore: watched,
      }),
    );
    expect(settled.status).toBe(200);
    const result = await settled.json();
    expect(result.result).toMatchObject(watched);
    expect([0, 1, 3]).toContain(result.pointsEarned);
    expect(result.updatedGameState.season.week).toBe(2);

    const afterMatch = await load(userId);
    expect(afterMatch.gameState.season.week).toBe(2);
    expect(afterMatch.gameState.user.money).toBe(result.updatedGameState.user.money);
    expect(afterMatch.gameState.season.points).toBe(result.pointsEarned);
    expect(afterMatch.gameState.teamStats.matchesPlayed).toBe(1);
    // The fixture the player is now looking at is next week's, not the one
    // just played — the reload lands after the match, not before it.
    expect(afterMatch.gameState.season.nextMatch.opponent).toBe(result.nextMatch.opponent);
    expect(afterMatch.gameState.season.nextMatch.opponent).not.toBe(fixture.opponent);

    // Finalizing the same match again is refused, so a double submit or a
    // retry cannot bank it twice.
    const again = await routes.finalize(
      post('/api/match/finalize', { userId, seed: matchSeed, ...fixture, decisions }),
    );
    expect(again.status).toBe(409);
    expect((await load(userId)).gameState.season.week).toBe(2);

    // Back to the assistant, closing the loop: talk, play, talk. The reply
    // has to be about the save as it stands now — the second round, the new
    // fixture — not the game as it was before the match was banked.
    const newOpponent = afterMatch.gameState.season.nextMatch.opponent;
    const tableTalk = await routes.conversationPOST(
      post('/api/conversation', { userId, message: 'como está a classificação?', useMock: true }),
    );
    expect(tableTalk.status).toBe(200);
    const tableReply = await tableTalk.json();
    expect(tableReply.response).toContain('Rodada: 2/38');
    expect(tableReply.response).toContain(`Pontos: ${result.pointsEarned}`);
    expect(tableReply.response).toContain(`Próximo: ${newOpponent}`);
    expect(tableReply.response).not.toContain(fixture.opponent);

    const matchTalk = await routes.conversationPOST(
      post('/api/conversation', { userId, message: 'quem é o próximo adversário?', useMock: true }),
    );
    const matchReply = await matchTalk.json();
    expect(matchReply.response).toContain(newOpponent);
    expect(matchReply.response).not.toContain(fixture.opponent);
    expect(matchReply.actions).toContain('play_match');

    expect((await load(userId)).conversationHistory).toHaveLength(6);

    // Restart: close the store and reopen the directory from disk.
    await local.closeLocalDatabase();
    const afterRestart = await load(userId);
    expect(afterRestart.exists).toBe(true);
    expect(afterRestart.gameState.user.team).toBe('Jornada FC');
    expect(afterRestart.gameState.season.week).toBe(2);
    expect(afterRestart.gameState.user.money).toBe(result.updatedGameState.user.money);
    expect(afterRestart.conversationHistory).toHaveLength(6);
    expect(await count('conversations')).toBe(6);
  }, 60_000);
});
