// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/**
 * A fixture is played once, and the player cannot pick how it goes.
 *
 * The client used to choose the match seed, and everything about a match
 * follows from its seed. So a player could find a winning seed before
 * kickoff (the stream route plays the fixture under any seed and shows the
 * full time score, without banking or closing the market) and bet on it;
 * or, not liking how a match was going, abandon it and play the same
 * fixture again under a new seed, a different decision, or a different
 * squad, and bank whichever run went their way.
 *
 * Real routes against the real embedded Postgres.
 */

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => null),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

let dataDir: string;
let local: typeof import('@/db/local');
let db: typeof import('@/db').db;
let schema: typeof import('@/db/schema');
let drizzle: typeof import('drizzle-orm');
let saveStore: typeof import('@/lib/save-store');
let buildDecisionTurn: typeof import('@/lib/decision-engine').buildDecisionTurn;
let DECISION_TURNS: typeof import('@/lib/constants').DECISION_TURNS;
let routes: {
  createTeam: typeof import('../onboarding/create-team/route').POST;
  decide: typeof import('../match/decide/route').POST;
  finalize: typeof import('../match/finalize/route').POST;
  match: typeof import('../match/route').POST;
  stream: typeof import('../match/stream/route').POST;
  bet: typeof import('../predictions/bet/route').POST;
  invest: typeof import('../investment/route').POST;
};

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-seed-integrity-'));
  delete process.env.DATABASE_URL;
  delete process.env.OPENROUTER_API_KEY;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_DISABLED = 'true';
  process.env.USE_MOCK_AI = 'true';
  vi.resetModules();
  local = await import('@/db/local');
  ({ db } = await import('@/db'));
  schema = await import('@/db/schema');
  drizzle = await import('drizzle-orm');
  saveStore = await import('@/lib/save-store');
  ({ buildDecisionTurn } = await import('@/lib/decision-engine'));
  ({ DECISION_TURNS } = await import('@/lib/constants'));
  routes = {
    createTeam: (await import('../onboarding/create-team/route')).POST,
    decide: (await import('../match/decide/route')).POST,
    finalize: (await import('../match/finalize/route')).POST,
    match: (await import('../match/route')).POST,
    stream: (await import('../match/stream/route')).POST,
    bet: (await import('../predictions/bet/route')).POST,
    invest: (await import('../investment/route')).POST,
  };
  await local.localDatabaseReady();
}, 60_000);

afterAll(async () => {
  await local.closeLocalDatabase();
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.restoreAllMocks();
  for (const level of ['warn', 'error', 'info', 'log'] as const) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

let requestCounter = 0;
function post(url: string, body: unknown) {
  requestCounter += 1;
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.12.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
    body: JSON.stringify(body),
  });
}

let teamCounter = 0;
async function newSave(): Promise<string> {
  teamCounter += 1;
  const response = await routes.createTeam(
    post('/api/onboarding/create-team', {
      teamName: `Semente FC ${teamCounter}`,
      primaryColor: '#112233',
      secondaryColor: '#AABBCC',
      badgeStyle: 'shield',
    }),
  );
  expect(response.status).toBe(201);
  return (await response.json()).userId;
}

async function stateOf(userId: string) {
  return (await saveStore.loadSave(userId))!.state;
}

async function openMarketOf(userId: string) {
  const [market] = await db.query.predictions.findMany({
    where: drizzle.and(drizzle.eq(schema.predictions.userId, userId), drizzle.eq(schema.predictions.status, 'open')),
  });
  return market as typeof schema.predictions.$inferSelect | undefined;
}

/** Ids and timestamps differ between two plays of the same football. */
const IDENTITY_KEYS = new Set(['id', 'commentaryId', 'commentaryEventId', 'matchId', 'generatedAt', 'date', 'updatedAt']);
function football(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(football);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !IDENTITY_KEYS.has(key))
        .map(([key, inner]) => [key, football(inner)]),
    );
  }
  return value;
}

type Decision = { id: string } | null;

/**
 * Plays the fixture turn by turn, the way the match screen does: one seed
 * for the match (the client's), each turn chained from the last. `pick`
 * chooses the decision at each turn from what was offered.
 */
async function playTurns(
  userId: string,
  clientSeed: string,
  pick: (turnNumber: number, offered: Array<{ id: string }>) => Decision = () => null,
) {
  const state = await stateOf(userId);
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
  const turns: Array<{ events: unknown; endState: Record<string, unknown>; played: string | null }> = [];
  let offered = buildDecisionTurn(0, 0, 0, state.squad.players, prior.formation as string, 'balanced', false).options;
  for (let turnNumber = 0; turnNumber < DECISION_TURNS.length; turnNumber++) {
    const decision = pick(turnNumber, offered);
    const response = await routes.decide(
      post('/api/match/decide', {
        userId,
        turnNumber,
        decision,
        priorState: prior,
        seed: `${clientSeed}:turn:${turnNumber}`,
      }),
    );
    expect(response.status, `turn ${turnNumber}`).toBe(200);
    const body = await response.json();
    turns.push({
      events: football(body.events),
      endState: body.endState,
      played: body.turnResult?.wasDefault ? null : (body.turnResult?.decision?.id ?? null),
    });
    prior = { ...prior, ...body.endState, squad: body.endState?.squad ?? prior.squad };
    offered = body.nextTurn?.options ?? [];
  }
  const last = turns.at(-1)!.endState;
  return { turns, score: { homeScore: last.homeScore as number, awayScore: last.awayScore as number } };
}

async function finalize(
  userId: string,
  clientSeed: string,
  decisions: Array<string | null> = DECISION_TURNS.map(() => null),
  claimedScore?: { homeScore: number; awayScore: number },
) {
  const state = await stateOf(userId);
  return routes.finalize(
    post('/api/match/finalize', {
      userId,
      seed: clientSeed,
      week: state.season.week,
      opponent: state.season.nextMatch.opponent,
      isHome: state.season.nextMatch.isHome,
      decisions: decisions.map((decisionId, turnNumber) => ({ turnNumber, decisionId })),
      ...(claimedScore ? { claimedScore } : {}),
    }),
  );
}

async function streamFixture(userId: string, clientSeed: string) {
  const response = await routes.stream(post('/api/match/stream', { userId, seed: clientSeed }));
  if (response.status !== 200) return { status: response.status, fulltime: null };
  const events = (await response.text())
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => JSON.parse(line.slice(6)) as Record<string, unknown>);
  return { status: 200, fulltime: events.find(e => e.type === 'fulltime') as { homeScore: number; awayScore: number } };
}

describe('the client does not choose the seed', () => {
  it('a banked match is not played under the seed the client sent', async () => {
    const quick = await newSave();
    const match = await routes.match(post('/api/match', { userId: quick, seed: 'chosen-by-the-client' }));
    expect(match.status).toBe(200);
    expect((await match.json()).seed).not.toBe('chosen-by-the-client');

    const turns = await newSave();
    const finalized = await finalize(turns, 'chosen-by-the-client-too');
    expect(finalized.status).toBe(200);
    expect((await finalized.json()).seed).not.toBe('chosen-by-the-client-too');
  });

  it('the stream cannot foretell the fixture while its market is still taking bets', async () => {
    const userId = await newSave();
    const market = (await openMarketOf(userId))!;

    // Watch the fixture played out to full time, then back the result.
    const watched = await streamFixture(userId, 'oracle-seed');
    expect(watched.status).toBe(200);
    const side =
      watched.fulltime!.homeScore > watched.fulltime!.awayScore ? 'home'
        : watched.fulltime!.homeScore < watched.fulltime!.awayScore ? 'away' : 'draw';
    const bet = await routes.bet(
      post('/api/predictions/bet', { userId, predictionId: market.id, optionId: `${market.matchId}-${side}`, amount: 10_000 }),
    );
    expect(bet.status, 'a bet on a result already watched').toBe(409);

    // And what was watched is what is banked: the stream is the match.
    const banked = await routes.match(post('/api/match', { userId, seed: 'oracle-seed' }));
    expect(banked.status).toBe(200);
    const { result } = await banked.json();
    expect({ homeScore: result.homeScore, awayScore: result.awayScore }).toEqual({
      homeScore: watched.fulltime!.homeScore,
      awayScore: watched.fulltime!.awayScore,
    });
  }, 30_000);
});

describe('an abandoned match cannot be replayed differently', () => {
  it('under a new seed: the second run is the same match, and that is what is banked', async () => {
    const userId = await newSave();
    const first = await playTurns(userId, 'first-attempt');
    // Abandoned. The screen starts the fixture again with a fresh seed.
    const second = await playTurns(userId, 'second-attempt');

    expect(second.turns.map(t => t.events)).toEqual(first.turns.map(t => t.events));
    const banked = await finalize(userId, 'second-attempt');
    expect(banked.status).toBe(200);
    const { result } = await banked.json();
    expect({ homeScore: result.homeScore, awayScore: result.awayScore }).toEqual(first.score);
  });

  it('with a different decision: the turn is played as it was the first time', async () => {
    const userId = await newSave();
    let firstChoice = '';
    const first = await playTurns(userId, 'decision-attempt', (turn, offered) => {
      if (turn !== 0) return null;
      firstChoice = offered[0].id;
      return offered[0];
    });
    let secondChoice = '';
    const second = await playTurns(userId, 'decision-attempt', (turn, offered) => {
      if (turn !== 0) return null;
      secondChoice = offered[1].id;
      return offered[1];
    });
    expect(secondChoice).not.toBe(firstChoice);

    expect(second.turns[0].played, 'turn 0 is held to the decision first played').toBe(firstChoice);
    expect(second.turns.map(t => t.events)).toEqual(first.turns.map(t => t.events));

    // Finalize sent the second choice; the first is what counts.
    const banked = await finalize(userId, 'decision-attempt', [secondChoice, null, null, null, null, null]);
    expect(banked.status).toBe(200);
    const body = await banked.json();
    expect(body.turnHistory[0].decision.id).toBe(firstChoice);
    expect({ homeScore: body.result.homeScore, awayScore: body.result.awayScore }).toEqual(first.score);
  });

  it('after raising morale mid-match: the bank is the match that was watched', async () => {
    // Several fixtures: a morale change moves most matches, not every one.
    for (let attempt = 0; attempt < 8; attempt++) {
      const userId = await newSave();
      const watched = await playTurns(userId, `morale-attempt-${attempt}`);
      const [kickoff] = await db.query.fixtureKickoffs.findMany({
        where: drizzle.eq(schema.fixtureKickoffs.userId, userId),
      });
      const moraleAtKickoff = (kickoff.setup as { userMorale: number }).userMorale;

      // Not liking it, the player backs the fan club before banking: morale
      // is what the replay is most sensitive to, and the bonus counts at once.
      const bought = await routes.invest(post('/api/investment', { userId, option: 'clube_torcedores' }));
      expect(bought.status).toBe(200);
      // And the squad's own morale moves as far as it goes, as anything that
      // writes the save mid-match could move it. Two points from the fan club
      // alone leave many matches exactly as they were, which let a replay
      // that read morale from the save at bank time pass this check on
      // fixtures it happened not to move; thirty points move nearly all.
      const save = (await saveStore.loadSave(userId))!;
      save.state.squad.morale = moraleAtKickoff >= 65 ? 30 : 100;
      expect((await saveStore.commitSave(userId, save.state, save.version)).ok).toBe(true);

      const banked = await finalize(userId, `morale-attempt-${attempt}`);
      expect(banked.status).toBe(200);
      const body = await banked.json();
      expect(
        football(body.segments.map((s: { events: unknown }) => s.events)),
        `fixture ${attempt}: banked as watched`,
      ).toEqual(watched.turns.map(t => t.events));
    }
  });

  it('by asking finalize for the score under other decisions: every ask gets the same replay', async () => {
    const bogus = { homeScore: 99, awayScore: 99 };
    // Several fixtures, since a first-turn decision moves the score of only
    // some matches; on each, a score that cannot be right is answered with
    // the replayed one, without banking.
    for (let attempt = 0; attempt < 8; attempt++) {
      const userId = await newSave();
      const state = await stateOf(userId);
      const offered = buildDecisionTurn(0, 0, 0, state.squad.players, state.squad.formation || '4-3-3', 'balanced', false).options;
      const scores = new Set<string>();
      for (const firstTurn of [null, ...offered.map(o => o.id)]) {
        const refused = await finalize(userId, `oracle-decisions-${attempt}`, [firstTurn, null, null, null, null, null], bogus);
        expect(refused.status).toBe(409);
        scores.add(JSON.stringify((await refused.json()).replayed));
      }
      expect(scores.size, `fixture ${attempt}: the replies are one match, not a menu of them`).toBe(1);
      expect((await stateOf(userId)).season.week).toBe(1);

      // Whether or not this fixture's score happens to move with the first
      // decision, the first ask fixed it: banking now with a different one
      // plays the timer's default, as asked first, and lands on that score.
      const banked = await finalize(userId, `oracle-decisions-${attempt}`, [offered[0].id, null, null, null, null, null]);
      expect(banked.status).toBe(200);
      const body = await banked.json();
      expect(body.turnHistory[0].wasDefault, `fixture ${attempt}: the first ask's decision stands`).toBe(true);
      expect(JSON.stringify({ homeScore: body.result.homeScore, awayScore: body.result.awayScore })).toBe([...scores][0]);
    }
  });

  it('by switching between watching the whole match and playing it turn by turn', async () => {
    const userId = await newSave();
    expect((await streamFixture(userId, 'switch-seed')).status).toBe(200);

    const state = await stateOf(userId);
    const turn = await routes.decide(
      post('/api/match/decide', {
        userId,
        turnNumber: 0,
        decision: null,
        priorState: {
          homeScore: 0, awayScore: 0, homeMomentum: 0, awayMomentum: 0, tension: 30,
          formation: state.squad.formation || '4-3-3', mentality: 'balanced', hasRedCard: false,
          squad: state.squad.players,
        },
      }),
    );
    expect(turn.status, 'the fixture has already been played out in full').toBe(409);
  }, 30_000);
});
