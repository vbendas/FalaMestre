// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { buildDecisionTurn } from '@/lib/decision-engine';
import { deriveTurnSeed } from '@/lib/match-replay';
import { DECISION_TURNS } from '@/lib/constants';
import type { DecisionOption, DecisionTurn, GameState, Player, TurnMentality } from '@/lib/types';

// Auth runs before the body is read; stub it so these tests reach the match.
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(async () => null),
  getAuthenticatedUser: vi.fn(async () => null),
  getRequestUserId: vi.fn(async () => null),
}));

const USER_ID = 'user_abc123def';
const USER_TEAM = BRAZILIAN_TEAMS[0].name;
const OPPONENT = BRAZILIAN_TEAMS[1].name;
const KICKOFF_WEEK = 3;

/** The saved game every test starts from: week 3, at home to OPPONENT. */
function freshState(): GameState {
  const state = withSeed('fixture', () => createInitialGameState(USER_ID, USER_TEAM));
  state.season.week = KICKOFF_WEEK;
  state.season.nextMatch = {
    opponent: OPPONENT,
    isHome: true,
    date: '2026-01-01T00:00:00.000Z',
    competition: 'Liga Mestre',
  };
  return state;
}

// A stateful save: finalize writes to it, so a second finalize sees the
// advanced week — which is the whole point of the fixture guard.
let saved: GameState = freshState();

vi.mock('@/db', () => ({
  db: {
    query: {
      gameStates: {
        findFirst: vi.fn(async () => ({ currentState: structuredClone(saved) })),
      },
    },
    update: () => ({
      set: (values: { currentState: GameState }) => ({
        // The route guards its write on the week still being the one the match
        // was played in, and reads back the rows it changed. Nothing here
        // interleaves two requests, so the guard always holds and the mock
        // reports one row; whether Postgres agrees with the condition itself
        // is covered against the real database in
        // match-finalize-concurrency.test.ts.
        where: () => ({
          returning: async () => {
            saved = structuredClone(values.currentState);
            return [{ userId: USER_ID }];
          },
        }),
      }),
    }),
  },
}));

// The fixture's seed and setup come from its kickoff (fixture-kickoff.ts),
// which writes to tables this mocked database does not have. The fake keeps
// the same contract in memory and lets these tests choose the seed; the real
// module is tested against the embedded database.
vi.mock('@/lib/fixture-kickoff', async () => (await import('@/test/fake-kickoff')).fakeKickoffModule);

import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { fakeKickoffOf, resetFakeKickoffs, seedFixtureFor } from '@/test/fake-kickoff';
import { POST as finalizePOST } from '../match/finalize/route';
import { POST as decidePOST } from '../match/decide/route';

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
      'x-forwarded-for': `10.2.${Math.floor(requestCounter / 250)}.${requestCounter % 250}`,
    },
  });
}

const FINALIZE_URL = 'http://localhost/api/match/finalize';
const DECIDE_URL = 'http://localhost/api/match/decide';

/** The fixture fields every well-formed finalize carries. */
function fixtureFields() {
  return { userId: USER_ID, week: KICKOFF_WEEK, opponent: OPPONENT, isHome: true };
}

/**
 * Finalizes the fixture. The route ignores the seed in the body and replays
 * under the fixture's kickoff seed; for a fixture not kicked off yet, these
 * tests make the kickoff draw the seed they name, so a finalize sent with
 * seed S replays the match S plays.
 */
async function finalize(body: Record<string, unknown>) {
  const seed = body.seed;
  if ((typeof seed === 'string' || typeof seed === 'number') && !fakeKickoffOf(USER_ID, KICKOFF_WEEK)) {
    seedFixtureFor(USER_ID, seed);
  }
  const response = await finalizePOST(post(FINALIZE_URL, { ...fixtureFields(), ...body }));
  return { status: response.status, json: await response.json() };
}

interface PriorState {
  homeScore: number;
  awayScore: number;
  homeMomentum: number;
  awayMomentum: number;
  tension: number;
  formation: string;
  mentality: TurnMentality;
  hasRedCard: boolean;
  squad: Player[];
}

function initialPriorState(state: GameState): PriorState {
  return {
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
}

/**
 * Plays a whole match the way the match screen would once it drives the turns
 * from one match seed: six /api/match/decide calls, each under
 * deriveTurnSeed(matchSeed, turnNumber), chaining the end state the way the
 * client does, and answering each prompt with the option `pick` chooses.
 *
 * Returns the score the player would have watched, plus the decision ids to
 * send to finalize.
 */
async function playWatchedMatch(
  matchSeed: string | number,
  pick: (turn: DecisionTurn, turnNumber: number) => DecisionOption | null
) {
  // The fixture kicks off under this seed at the first turn.
  seedFixtureFor(USER_ID, matchSeed);
  const state = structuredClone(saved);
  let priorState = initialPriorState(state);
  let offered: DecisionTurn | null = buildDecisionTurn(
    0,
    priorState.homeScore,
    priorState.awayScore,
    priorState.squad,
    priorState.formation,
    priorState.mentality,
    priorState.hasRedCard
  );

  const decisions: Array<{ turnNumber: number; decisionId: string | null }> = [];
  const events: unknown[] = [];

  for (let turnNumber = 0; turnNumber < DECISION_TURNS.length; turnNumber++) {
    expect(offered).not.toBeNull();
    const decision = pick(offered!, turnNumber);
    decisions.push({ turnNumber, decisionId: decision?.id ?? null });

    const response = await decidePOST(
      post(DECIDE_URL, {
        userId: USER_ID,
        turnNumber,
        decision,
        priorState,
        seed: deriveTurnSeed(matchSeed, turnNumber),
      })
    );
    expect(response.status).toBe(200);
    const data = await response.json();

    priorState = data.endState;
    offered = data.nextTurn;
    events.push(...data.events);
  }

  return {
    decisions,
    homeScore: priorState.homeScore,
    awayScore: priorState.awayScore,
    eventCount: events.length,
  };
}

/** Answers every prompt with the first option offered. */
const pickFirst = (turn: DecisionTurn) => turn.options[0];
/** Lets every timer run out. */
const pickNothing = () => null;

/** Six turns of timeouts — the shortest well-formed decision list. */
const ALL_DEFAULTS = DECISION_TURNS.map((_, turnNumber) => ({ turnNumber, decisionId: null }));

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
  saved = freshState();
  resetFakeKickoffs();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/match/finalize reproduces the match that was played', () => {
  it('lands on the score the decide turns showed, option by option', async () => {
    const watched = await playWatchedMatch('watched-1', pickFirst);

    const { status, json } = await finalize({ seed: 'watched-1', decisions: watched.decisions });

    expect(status).toBe(200);
    expect(json.result.homeScore).toBe(watched.homeScore);
    expect(json.result.awayScore).toBe(watched.awayScore);
    expect(json.result.events).toHaveLength(watched.eventCount);
  });

  it('lands on the same score when every timer ran out', async () => {
    const watched = await playWatchedMatch(99, pickNothing);

    const { status, json } = await finalize({ seed: 99, decisions: watched.decisions });

    expect(status).toBe(200);
    expect(json.result.homeScore).toBe(watched.homeScore);
    expect(json.result.awayScore).toBe(watched.awayScore);
  });

  it('accepts the claimed score when the replay agrees with it', async () => {
    const watched = await playWatchedMatch('claim-ok', pickFirst);

    const { status, json } = await finalize({
      seed: 'claim-ok',
      decisions: watched.decisions,
      claimedScore: { homeScore: watched.homeScore, awayScore: watched.awayScore },
    });

    expect(status).toBe(200);
    expect(json.result.homeScore).toBe(watched.homeScore);
  });

  it('reports the per-turn seeds it replayed under', async () => {
    const { status, json } = await finalize({ seed: 'seeds-out', decisions: ALL_DEFAULTS });

    expect(status).toBe(200);
    expect(json.seed).toBe('seeds-out');
    expect(json.turnSeeds).toEqual(
      DECISION_TURNS.map((_, turnNumber) => deriveTurnSeed('seeds-out', turnNumber))
    );
  });

  it('replays under the fixture’s kickoff seed, not the seed sent', async () => {
    seedFixtureFor(USER_ID, 'the-fixtures-seed');
    // Straight to the route: the helper above would choose the seed.
    const response = await finalizePOST(
      post(FINALIZE_URL, { ...fixtureFields(), seed: 'the-clients-seed', decisions: ALL_DEFAULTS })
    );
    const { status } = response;
    const json = await response.json();

    expect(status).toBe(200);
    expect(json.seed).toBe('the-fixtures-seed');
    expect(json.turnSeeds[0]).toBe(deriveTurnSeed('the-fixtures-seed', 0));
  });

  it('settles the same way twice for the same seed and decisions', async () => {
    const first = await finalize({ seed: 'twice', decisions: ALL_DEFAULTS });
    saved = freshState(); // rewind the save; the fixture guard would reject otherwise
    const second = await finalize({ seed: 'twice', decisions: ALL_DEFAULTS });

    expect(first.json.result.homeScore).toBe(second.json.result.homeScore);
    expect(first.json.result.awayScore).toBe(second.json.result.awayScore);
    expect(first.json.pointsEarned).toBe(second.json.pointsEarned);
    expect(first.json.nextMatch.opponent).toBe(second.json.nextMatch.opponent);
    expect(first.json.position).toBe(second.json.position);
  });

  it('plays a different match under a different seed', async () => {
    // Six seeds is plenty to show the replay is not pinned to one outcome.
    const scores = new Set<string>();
    for (const seed of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) {
      saved = freshState();
      resetFakeKickoffs();
      const { json } = await finalize({ seed, decisions: ALL_DEFAULTS });
      scores.add(`${json.result.homeScore}-${json.result.awayScore}`);
    }
    expect(scores.size).toBeGreaterThan(1);
  });
});

describe('POST /api/match/finalize bookkeeping', () => {
  it('advances the week and banks the result, so a reload moves on', async () => {
    const before = structuredClone(saved);

    const { status, json } = await finalize({ seed: 'bank-me', decisions: ALL_DEFAULTS });

    expect(status).toBe(200);
    // The saved game, not just the response, carries the match.
    expect(saved.season.week).toBe(before.season.week + 1);
    expect(saved.season.wins + saved.season.draws + saved.season.losses).toBe(
      before.season.wins + before.season.draws + before.season.losses + 1
    );
    expect(saved.teamStats.matchesPlayed).toBe(before.teamStats.matchesPlayed + 1);
    expect(saved.context.lastAction).toBe('match_completed');
    // The fixture moved on: the same match cannot be played again.
    expect(saved.season.nextMatch.opponent).not.toBe(OPPONENT);
    expect(json.nextMatch).toEqual(saved.season.nextMatch);
    expect(json.updatedGameState.season.week).toBe(saved.season.week);
  });

  it('awards points that match the score it replayed', async () => {
    const before = structuredClone(saved);
    const { json } = await finalize({ seed: 'points-real', decisions: ALL_DEFAULTS });

    const { homeScore, awayScore } = json.result;
    // The user is at home in this fixture.
    const expected = homeScore > awayScore ? 3 : homeScore === awayScore ? 1 : 0;

    expect(json.pointsEarned).toBe(expected);
    expect(json.matchResult).toBe(homeScore > awayScore ? 'win' : homeScore === awayScore ? 'draw' : 'loss');
    expect(saved.season.points).toBe(before.season.points + expected);
    expect(json.result.winner).toBe(
      homeScore > awayScore ? USER_TEAM : awayScore > homeScore ? OPPONENT : 'Empate'
    );
  });

  it('pays the match out and takes the week of staff wages', async () => {
    const before = structuredClone(saved);
    const { json } = await finalize({ seed: 'money', decisions: ALL_DEFAULTS });

    expect(json.earnings.amount).toBeGreaterThan(0);
    expect(json.earnings.isHome).toBe(true);
    expect(saved.user.money).toBe(before.user.money + json.earnings.amount - json.wages);
    expect(saved.teamStats.totalEarnings).toBe(before.teamStats.totalEarnings + json.earnings.amount);
  });

  it('moves morale and the league position', async () => {
    const { json } = await finalize({ seed: 'morale', decisions: ALL_DEFAULTS });

    expect(saved.squad.morale).toBeGreaterThanOrEqual(30);
    expect(saved.squad.morale).toBeLessThanOrEqual(100);
    expect(json.position).toBe(saved.season.position);
    expect(json.position).toBeGreaterThanOrEqual(1);
    expect(json.position).toBeLessThanOrEqual(BRAZILIAN_TEAMS.length);
  });

  it('closes the season instead of drawing a fixture on the last week', async () => {
    saved.season.week = 38;

    const { status, json } = await finalize({ seed: 'season-end', decisions: ALL_DEFAULTS, week: 38 });

    expect(status).toBe(200);
    expect(json.isSeasonEnd).toBe(true);
    expect(saved.season.nextMatch.opponent).toBe('Temporada Completa');
    expect(saved.context.availableActions).toContain('new_season');
  });
});

describe('POST /api/match/finalize rejections', () => {
  it('refuses a second finalize of the same match', async () => {
    const first = await finalize({ seed: 'once-only', decisions: ALL_DEFAULTS });
    expect(first.status).toBe(200);
    const bankedWeek = saved.season.week;
    const bankedPoints = saved.season.points;

    const second = await finalize({ seed: 'once-only', decisions: ALL_DEFAULTS });

    expect(second.status).toBe(409);
    expect(second.json.error).toBe('Fixture mismatch');
    expect(second.json.expected.week).toBe(bankedWeek);
    // Nothing was banked twice.
    expect(saved.season.week).toBe(bankedWeek);
    expect(saved.season.points).toBe(bankedPoints);
  });

  it.each([
    { label: 'a stale week', body: { week: KICKOFF_WEEK - 1 } },
    { label: 'a week in the future', body: { week: KICKOFF_WEEK + 1 } },
    { label: 'the wrong opponent', body: { opponent: BRAZILIAN_TEAMS[5].name } },
    { label: 'the wrong venue', body: { isHome: false } },
  ])('refuses $label with 409 and leaves the save alone', async ({ body }) => {
    const before = structuredClone(saved);

    const { status, json } = await finalize({ seed: 'wrong-fixture', decisions: ALL_DEFAULTS, ...body });

    expect(status).toBe(409);
    expect(json.error).toBe('Fixture mismatch');
    expect(json.expected).toEqual({ week: KICKOFF_WEEK, opponent: OPPONENT, isHome: true });
    expect(saved).toEqual(before);
  });

  it('refuses a score the replay disagrees with, without banking anything', async () => {
    const before = structuredClone(saved);

    const { status, json } = await finalize({
      seed: 'liar',
      decisions: ALL_DEFAULTS,
      claimedScore: { homeScore: 9, awayScore: 0 },
    });

    expect(status).toBe(409);
    expect(json.error).toBe('Score mismatch');
    expect(json.claimed).toEqual({ homeScore: 9, awayScore: 0 });
    expect(json.replayed.homeScore).not.toBe(9);
    expect(saved).toEqual(before);
  });

  it.each([
    {
      label: 'a short decision list',
      decisions: ALL_DEFAULTS.slice(0, 3),
    },
    {
      label: 'turns out of order',
      decisions: [ALL_DEFAULTS[1], ALL_DEFAULTS[0], ...ALL_DEFAULTS.slice(2)],
    },
    {
      label: 'a repeated turn',
      decisions: [...ALL_DEFAULTS.slice(0, 5), { turnNumber: 4, decisionId: null }],
    },
    {
      label: 'a list that skips the opening turn',
      decisions: [...ALL_DEFAULTS.slice(1), { turnNumber: 5, decisionId: null }],
    },
  ])('refuses $label with 400 and no bookkeeping', async ({ decisions }) => {
    const before = structuredClone(saved);

    const { status, json } = await finalize({ seed: 'coverage', decisions });

    expect(status).toBe(400);
    expect(json.code).toBe('turn_coverage');
    expect(saved).toEqual(before);
  });

  it('refuses a decision that was never offered', async () => {
    const before = structuredClone(saved);
    const decisions = [
      { turnNumber: 0, decisionId: 'turn_0_instr_park_the_bus_but_also_win' },
      ...ALL_DEFAULTS.slice(1),
    ];

    const { status, json } = await finalize({ seed: 'invented', decisions });

    expect(status).toBe(400);
    expect(json.code).toBe('unknown_decision');
    expect(json.message).toContain('turn 0');
    expect(saved).toEqual(before);
  });

  it('refuses an option the engine generates, but not for the replayed state', async () => {
    // `default_red_card` is a real option id, offered only once someone has
    // been sent off. Nobody has at kickoff, so claiming it at turn 0 is a
    // decision the server never put on the menu.
    const before = structuredClone(saved);
    const decisions = [
      { turnNumber: 0, decisionId: 'default_red_card' },
      ...ALL_DEFAULTS.slice(1),
    ];

    const { status, json } = await finalize({ seed: 'wrong-turn', decisions });

    expect(status).toBe(400);
    expect(json.code).toBe('unknown_decision');
    expect(saved).toEqual(before);
  });

  it('accepts the default option by id, since a timeout is a real decision', async () => {
    const turn = buildDecisionTurn(0, 0, 0, saved.squad.players, saved.squad.formation || '4-3-3', 'balanced', false);

    const { status } = await finalize({
      seed: 'default-by-id',
      decisions: [{ turnNumber: 0, decisionId: turn.defaultOption.id }, ...ALL_DEFAULTS.slice(1)],
    });

    expect(status).toBe(200);
  });

  it('requires a seed: there is nothing to replay without one', async () => {
    const { status, json } = await finalize({ decisions: ALL_DEFAULTS });

    expect(status).toBe(400);
    expect(json.error).toBe('Validation failed');
    expect(json.field).toBe('seed');
  });

  it.each(BAD_SEEDS)('rejects $label as a seed with 400', async ({ seed }) => {
    const { status, json } = await finalize({ seed, decisions: ALL_DEFAULTS });

    expect(status).toBe(400);
    expect(json.error).toBe('Validation failed');
    expect(json.field).toBe('seed');
  });

  it.each([
    { label: 'no decisions at all', decisions: undefined, field: 'decisions' },
    { label: 'an empty decision list', decisions: [], field: 'decisions' },
    { label: 'more turns than a match has', decisions: [...ALL_DEFAULTS, { turnNumber: 5, decisionId: null }], field: 'decisions' },
    { label: 'a turn number out of range', decisions: [{ turnNumber: 9, decisionId: null }], field: 'decisions.0.turnNumber' },
    { label: 'a fractional turn number', decisions: [{ turnNumber: 0.5, decisionId: null }], field: 'decisions.0.turnNumber' },
    { label: 'a decision id that is not a string', decisions: [{ turnNumber: 0, decisionId: 7 }], field: 'decisions.0.decisionId' },
    { label: 'a decision id with spaces', decisions: [{ turnNumber: 0, decisionId: 'drop table' }], field: 'decisions.0.decisionId' },
  ])('rejects $label with 400 naming the field', async ({ decisions, field }) => {
    const { status, json } = await finalize({ seed: 'shape', decisions });

    expect(status).toBe(400);
    expect(json.error).toBe('Validation failed');
    expect(json.field).toBe(field);
  });

  it("refuses to finalize someone else's save", async () => {
    const before = structuredClone(saved);
    vi.mocked(getAuthenticatedUser).mockResolvedValue('user_someone_else');

    const { status, json } = await finalize({ seed: 'not-mine', decisions: ALL_DEFAULTS });

    expect(status).toBe(403);
    expect(json.error).toContain('Forbidden');
    expect(saved).toEqual(before);
  });

  it('rejects a missing fixture description rather than guessing it', async () => {
    const response = await finalizePOST(
      post(FINALIZE_URL, { userId: USER_ID, seed: 'no-fixture', decisions: ALL_DEFAULTS })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Validation failed');
    expect(['week', 'opponent', 'isHome']).toContain(json.field);
  });
});
