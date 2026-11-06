// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * A whole season banked through /api/match/finalize, week by week, checking
 * that the save still adds up at the end of it.
 *
 * Each match on its own is covered elsewhere. What nothing covered is the
 * accumulation: thirty-eight weeks of points, record, money, wages and league
 * position, every one of them written by the same bookkeeping, and then the
 * season closing on the last week. A rounding slip, a double-counted payout or
 * an off-by-one on the final round shows up here and nowhere else.
 *
 * Runs against the real embedded Postgres: every week is read back from the
 * save the previous week wrote.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

type Routes = {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  conversationGET: typeof import('../conversation/route').GET;
  finalize: typeof import('../match/finalize/route').POST;
  decide: typeof import('../match/decide/route').POST;
  match: typeof import('../match/route').POST;
  staff: typeof import('../staff/route').POST;
};

let dataDir: string;
let routes: Routes;
let local: typeof import('@/db/local');
let DECISION_TURNS: typeof import('@/lib/constants').DECISION_TURNS;
let SEASON_LENGTH: number;
let BRAZILIAN_TEAMS: typeof import('@/lib/game-engine').BRAZILIAN_TEAMS;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-season-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  vi.resetModules();
  local = await import('@/db/local');
  ({ DECISION_TURNS, SEASON_LENGTH } = await import('@/lib/constants'));
  ({ BRAZILIAN_TEAMS } = await import('@/lib/game-engine'));
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    conversationGET: (await import('../conversation/route')).GET,
    finalize: (await import('../match/finalize/route')).POST,
    decide: (await import('../match/decide/route')).POST,
    match: (await import('../match/route')).POST,
    staff: (await import('../staff/route')).POST,
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
      // A season is far more requests than the rate limit allows from one
      // address, so each gets its own.
      'x-forwarded-for': `10.${Math.floor(requestCounter / 62500) + 20}.${Math.floor(requestCounter / 250) % 250}.${requestCounter % 250}`,
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

/** Every turn left to its default, which is all finalize needs to replay it. */
const DECISIONS = () =>
  DECISION_TURNS.map((_, turnNumber) => ({ turnNumber, decisionId: null }));

/** Finalizes whatever fixture the save is waiting on. */
async function playWeek(userId: string, seed: string) {
  const state = await load(userId);
  const response = await routes.finalize(
    post('/api/match/finalize', {
      userId,
      seed,
      week: state.season.week,
      opponent: state.season.nextMatch.opponent,
      isHome: state.season.nextMatch.isHome,
      decisions: DECISIONS(),
    }),
  );
  return { status: response.status, body: await response.json(), fixture: state.season.nextMatch };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('a whole season through finalize', () => {
  it('keeps the table, the record and the money adding up, week after week', async () => {
    const created = await routes.createTeam(
      post('/api/onboarding/create-team', {
        teamName: 'Maratona FC',
        primaryColor: '#112233',
        secondaryColor: '#AABBCC',
        badgeStyle: 'shield',
      }),
    );
    expect(created.status).toBe(201);
    const { userId } = await created.json();

    // A head coach on the payroll, so the weekly wage really is deducted
    // thirty-eight times. Without staff every wage is zero and the money
    // arithmetic below would only be checking the gate receipts.
    const hired = await routes.staff(
      post('/api/staff', { userId, action: 'hire', role: 'headCoach', tier: 'rookie' }),
    );
    expect(hired.status).toBe(200);

    const start = await load(userId);
    expect(start.season.week).toBe(1);
    expect(start.staff.headCoach).toBeTruthy();

    let expectedPoints = 0;
    let expectedWins = 0;
    let expectedDraws = 0;
    let expectedLosses = 0;
    let expectedMoney = start.user.money;
    let expectedEarnings = start.teamStats.totalEarnings;
    const results: string[] = [];

    for (let round = 1; round <= SEASON_LENGTH; round++) {
      const { status, body, fixture } = await playWeek(userId, `season-${round}`);
      expect(status, `round ${round}`).toBe(200);

      // What the response claims about this week.
      expect(body.pointsEarned).toBe(
        body.matchResult === 'win' ? 3 : body.matchResult === 'draw' ? 1 : 0
      );
      expectedPoints += body.pointsEarned;
      if (body.matchResult === 'win') expectedWins += 1;
      else if (body.matchResult === 'draw') expectedDraws += 1;
      else expectedLosses += 1;
      expectedMoney += body.earnings.amount - body.wages;
      expectedEarnings += body.earnings.amount;
      results.push(body.matchResult);

      // What the save holds after it.
      const after = await load(userId);
      expect(after.season.week, `week after round ${round}`).toBe(round + 1);
      expect(after.season.points).toBe(expectedPoints);
      expect(after.season.wins).toBe(expectedWins);
      expect(after.season.draws).toBe(expectedDraws);
      expect(after.season.losses).toBe(expectedLosses);
      expect(after.user.money).toBe(expectedMoney);
      expect(after.teamStats.totalEarnings).toBe(expectedEarnings);
      expect(after.teamStats.matchesPlayed).toBe(round);

      // The table only ever puts the player somewhere in the league. The
      // league is the built-in rivals plus the player: an onboarded team is
      // not one of `BRAZILIAN_TEAMS`, so nothing is filtered out of the
      // standings and there is one more row than there are rivals.
      expect(after.season.position).toBeGreaterThanOrEqual(1);
      expect(after.season.position).toBeLessThanOrEqual(BRAZILIAN_TEAMS.length + 1);

      // Morale stays inside its band however the season is going.
      expect(after.squad.morale).toBeGreaterThanOrEqual(30);
      expect(after.squad.morale).toBeLessThanOrEqual(100);

      // The fixture always moves on, and never to the side just played.
      if (round < SEASON_LENGTH) {
        expect(after.season.nextMatch.opponent).not.toBe(fixture.opponent);
        expect(after.season.nextMatch.opponent).not.toBe(after.user.team);
        expect(after.season.nextMatch.competition).toBe('Liga Mestre');
      }
    }

    const final = await load(userId);

    // The coach was paid every week, and every payment came out of the same
    // balance the gate receipts went into.
    expect(final.staff.headCoach).toBeTruthy();
    const wagesPaid = start.user.money + expectedEarnings - start.teamStats.totalEarnings - final.user.money;
    expect(wagesPaid).toBeGreaterThan(0);

    // The record and the points are two views of the same 38 matches.
    expect(expectedWins + expectedDraws + expectedLosses).toBe(SEASON_LENGTH);
    expect(final.season.points).toBe(expectedWins * 3 + expectedDraws);
    expect(final.teamStats.matchesPlayed).toBe(SEASON_LENGTH);
    expect(final.user.money).toBe(expectedMoney);

    // A season of defaults is football, not a fixed outcome: it should not be
    // 38 of the same result.
    expect(new Set(results).size).toBeGreaterThan(1);
  }, 180_000);

  it('closes the season on the last round instead of drawing another fixture', async () => {
    const created = await routes.createTeam(
      post('/api/onboarding/create-team', {
        teamName: 'Fim de Temporada FC',
        primaryColor: '#112233',
        secondaryColor: '#AABBCC',
        badgeStyle: 'shield',
      }),
    );
    const { userId } = await created.json();

    // Straight to the last round; the accumulation is the other test's job.
    for (let round = 1; round < SEASON_LENGTH; round++) {
      const { status } = await playWeek(userId, `run-${round}`);
      expect(status, `round ${round}`).toBe(200);
    }

    const beforeLast = await load(userId);
    expect(beforeLast.season.week).toBe(SEASON_LENGTH);
    expect(beforeLast.season.nextMatch.competition).toBe('Liga Mestre');

    const last = await playWeek(userId, 'last-round');
    expect(last.status).toBe(200);
    expect(last.body.isSeasonEnd).toBe(true);

    const closed = await load(userId);
    expect(closed.season.week).toBe(SEASON_LENGTH + 1);
    expect(closed.teamStats.matchesPlayed).toBe(SEASON_LENGTH);
    expect(closed.season.nextMatch.opponent).toBe('Temporada Completa');
    expect(closed.season.nextMatch.competition).toBe('Fim da Temporada');
    expect(closed.context.availableActions).toEqual(['view_final_standings', 'new_season']);

    // The closed-season placeholder is not a fixture. Sending it back — which
    // is what the screen did, because it looked like any other opponent —
    // used to bank a thirty-ninth match, move the week to 40 and pay out
    // again, for ever.
    const afterTheEnd = await playWeek(userId, 'thirty-ninth');
    expect(afterTheEnd.status).toBe(409);
    expect(afterTheEnd.body.error).toBe('Season complete');

    const untouched = await load(userId);
    expect(untouched.season.week).toBe(SEASON_LENGTH + 1);
    expect(untouched.teamStats.matchesPlayed).toBe(SEASON_LENGTH);
    expect(untouched.season.points).toBe(closed.season.points);
    expect(untouched.user.money).toBe(closed.user.money);
  }, 180_000);

  it('refuses a decision turn and a one-request match once the season is over', async () => {
    const created = await routes.createTeam(
      post('/api/onboarding/create-team', {
        teamName: 'Sem Rodadas FC',
        primaryColor: '#112233',
        secondaryColor: '#AABBCC',
        badgeStyle: 'shield',
      }),
    );
    const { userId } = await created.json();

    for (let round = 1; round <= SEASON_LENGTH; round++) {
      const { status } = await playWeek(userId, `fill-${round}`);
      expect(status, `round ${round}`).toBe(200);
    }

    const closed = await load(userId);

    // Playing the turns of a match that can never be banked is refused up
    // front rather than after ninety minutes.
    const turn = await routes.decide(
      post('/api/match/decide', {
        userId,
        turnNumber: 0,
        decision: null,
        priorState: {
          homeScore: 0,
          awayScore: 0,
          homeMomentum: 0,
          awayMomentum: 0,
          tension: 30,
          formation: closed.squad.formation || '4-3-3',
          mentality: 'balanced',
          hasRedCard: false,
          squad: closed.squad.players,
        },
      }),
    );
    expect(turn.status).toBe(409);
    expect((await turn.json()).error).toBe('Season complete');

    // And so is the one-request route, which banks a match through the same
    // bookkeeping.
    const oneShot = await routes.match(post('/api/match', { userId }));
    expect(oneShot.status).toBe(409);
    expect((await oneShot.json()).error).toBe('Season complete');

    const untouched = await load(userId);
    expect(untouched.season.week).toBe(SEASON_LENGTH + 1);
    expect(untouched.teamStats.matchesPlayed).toBe(SEASON_LENGTH);
  }, 180_000);
});
