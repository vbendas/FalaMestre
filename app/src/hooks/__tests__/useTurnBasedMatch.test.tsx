import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { DECISION_TURNS } from '@/lib/constants';
import { useTurnBasedMatch } from '../useTurnBasedMatch';
import type { GameState } from '@/lib/types';

const USER_ID = 'user_abc123def';
const USER_TEAM = BRAZILIAN_TEAMS[0].name;
const OPPONENT = BRAZILIAN_TEAMS[1].name;
const KICKOFF_WEEK = 4;

function gameState(isHome = true): GameState {
  const state = withSeed('fixture', () => createInitialGameState(USER_ID, USER_TEAM));
  state.season.week = KICKOFF_WEEK;
  state.season.nextMatch = {
    opponent: OPPONENT,
    isHome,
    date: '2026-01-01T00:00:00.000Z',
    competition: 'Liga Mestre',
  };
  return state;
}

/** The decide reply, with whatever the test wants to vary. */
function decideReply(turnNumber: number, overrides: Record<string, unknown> = {}) {
  const isLast = turnNumber >= DECISION_TURNS.length - 1;
  return {
    events: [{ id: `e${turnNumber}`, minute: DECISION_TURNS[turnNumber].minute + 1, type: 'goal', team: 'home' }],
    segmentSummary: `resumo ${turnNumber}`,
    turnPrompt: `prompt ${turnNumber}`,
    nextTurn: isLast
      ? null
      : { turnNumber: turnNumber + 1, minute: DECISION_TURNS[turnNumber + 1].minute, label: 'x', options: [{ id: `opt_${turnNumber + 1}` }], defaultOption: { id: 'def' }, timerSeconds: 30 },
    endState: {
      homeScore: turnNumber + 1,
      awayScore: 0,
      homeMomentum: 5,
      awayMomentum: 0,
      tension: 40,
      formation: '4-3-3',
      mentality: 'balanced',
      hasRedCard: false,
      squad: [],
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Records every request so the tests can read what the screen sent. */
interface SentRequest {
  url: string;
  body: Record<string, any>;
}

function mockServer(options: { finalize?: () => Response } = {}) {
  const sent: SentRequest[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const body = JSON.parse(String((init as RequestInit).body));
    sent.push({ url: String(url), body });

    if (String(url).endsWith('/api/match/decide')) {
      return jsonResponse(decideReply(body.turnNumber));
    }
    if (String(url).endsWith('/api/match/finalize')) {
      return (
        options.finalize?.() ??
        jsonResponse({
          result: { homeScore: 6, awayScore: 0, winner: USER_TEAM, events: [] },
          pointsEarned: 3,
          matchResult: 'win',
          earnings: { amount: 1234, breakdown: 'Vitória' },
          updatedGameState: { ...gameState(), season: { ...gameState().season, week: KICKOFF_WEEK + 1 } },
        })
      );
    }
    throw new Error(`unexpected request to ${url}`);
  });
  return { sent, spy };
}

/** Plays all six turns, taking the first option each time. */
async function playAll(hook: ReturnType<typeof renderHook<ReturnType<typeof useTurnBasedMatch>, unknown>>) {
  for (let turnNumber = 0; turnNumber < DECISION_TURNS.length; turnNumber++) {
    await hook.result.current.submitTurn(turnNumber, { id: `pick_${turnNumber}` } as never);
  }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useTurnBasedMatch', () => {
  it('plays every turn from kickoff under seeds derived from one match seed', async () => {
    const { sent } = mockServer();
    const hook = renderHook(() => useTurnBasedMatch(gameState()));
    const matchSeed = hook.result.current.matchSeed;

    await playAll(hook);

    const decides = sent.filter((r) => r.url.endsWith('/api/match/decide'));
    expect(decides).toHaveLength(DECISION_TURNS.length);
    // Turn 0 included: the opening fifteen minutes are played, not skipped.
    expect(decides.map((r) => r.body.turnNumber)).toEqual([0, 1, 2, 3, 4, 5]);
    // Written out rather than built with `deriveTurnSeed`: an expectation
    // computed by the function under test cannot notice it changing.
    expect(decides.map((r) => r.body.seed)).toEqual([
      `${matchSeed}:turn:0`,
      `${matchSeed}:turn:1`,
      `${matchSeed}:turn:2`,
      `${matchSeed}:turn:3`,
      `${matchSeed}:turn:4`,
      `${matchSeed}:turn:5`,
    ]);
  });

  it('draws a seed that the match routes will accept', () => {
    mockServer();
    const { result } = renderHook(() => useTurnBasedMatch(gameState()));

    expect(result.current.matchSeed).toMatch(/^[A-Za-z0-9_.:-]{1,64}$/);
    expect(`${result.current.matchSeed}:turn:5`).toMatch(/^[A-Za-z0-9_.:-]{1,64}$/);
  });

  it('gives each match its own seed', () => {
    mockServer();
    const first = renderHook(() => useTurnBasedMatch(gameState()));
    const second = renderHook(() => useTurnBasedMatch(gameState()));

    expect(first.result.current.matchSeed).not.toBe(second.result.current.matchSeed);
  });

  it('keeps the same seed across re-renders of one match', () => {
    mockServer();
    const hook = renderHook(() => useTurnBasedMatch(gameState()));
    const seed = hook.result.current.matchSeed;

    hook.rerender();

    expect(hook.result.current.matchSeed).toBe(seed);
  });

  it('chains each turn onto the end state of the last', async () => {
    const { sent } = mockServer();
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    await playAll(hook);

    const decides = sent.filter((r) => r.url.endsWith('/api/match/decide'));
    // Kickoff is 0-0; every later turn starts from the previous end state.
    expect(decides[0].body.priorState.homeScore).toBe(0);
    expect(decides[0].body.priorState.mentality).toBe('balanced');
    expect(decides[3].body.priorState.homeScore).toBe(3);
    expect(decides[5].body.priorState.homeScore).toBe(5);
  });

  it('builds the kickoff prompt without a round trip', () => {
    const { sent } = mockServer();
    const { result } = renderHook(() => useTurnBasedMatch(gameState()));

    expect(result.current.firstTurn.turnNumber).toBe(0);
    expect(result.current.firstTurn.minute).toBe(0);
    expect(result.current.firstTurn.options.length).toBeGreaterThan(0);
    expect(sent).toHaveLength(0);
  });

  it('finalizes with the decisions the player made and the kickoff fixture', async () => {
    const { sent } = mockServer();
    const hook = renderHook(() => useTurnBasedMatch(gameState()));
    const matchSeed = hook.result.current.matchSeed;

    await playAll(hook);
    const settlement = await hook.result.current.finalizeMatch();

    const finalize = sent.find((r) => r.url.endsWith('/api/match/finalize'))!;
    expect(finalize.body).toMatchObject({
      userId: USER_ID,
      seed: matchSeed,
      week: KICKOFF_WEEK,
      opponent: OPPONENT,
      isHome: true,
      // The watched score, sent as a cross-check the server may reject.
      claimedScore: { homeScore: 6, awayScore: 0 },
    });
    expect(finalize.body.decisions).toEqual([
      { turnNumber: 0, decisionId: 'pick_0' },
      { turnNumber: 1, decisionId: 'pick_1' },
      { turnNumber: 2, decisionId: 'pick_2' },
      { turnNumber: 3, decisionId: 'pick_3' },
      { turnNumber: 4, decisionId: 'pick_4' },
      { turnNumber: 5, decisionId: 'pick_5' },
    ]);
    expect(settlement.status).toBe('saved');
  });

  it('records a timeout as a null decision', async () => {
    const { sent } = mockServer();
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    await hook.result.current.submitTurn(0, null);
    await hook.result.current.submitTurn(1, { id: 'pick_1' } as never);
    await hook.result.current.submitTurn(2, null);
    await hook.result.current.finalizeMatch();

    const decides = sent.filter((r) => r.url.endsWith('/api/match/decide'));
    expect(decides[0].body.decision).toBeNull();
    const finalize = sent.find((r) => r.url.endsWith('/api/match/finalize'))!;
    expect(finalize.body.decisions).toEqual([
      { turnNumber: 0, decisionId: null },
      { turnNumber: 1, decisionId: 'pick_1' },
      { turnNumber: 2, decisionId: null },
    ]);
  });

  it('reports the points and state finalize returned, not the ones it watched', async () => {
    mockServer({
      finalize: () =>
        jsonResponse({
          result: { homeScore: 2, awayScore: 2, winner: 'Empate', events: [] },
          pointsEarned: 1,
          matchResult: 'draw',
          earnings: { amount: 500, breakdown: 'Empate' },
          updatedGameState: gameState(),
        }),
    });
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    await playAll(hook);
    const settlement = await hook.result.current.finalizeMatch();

    expect(settlement.status).toBe('saved');
    if (settlement.status !== 'saved') return;
    expect(settlement.pointsEarned).toBe(1);
    expect(settlement.matchResult).toBe('draw');
    // The server's score, even though the turns added up to 6-0 locally.
    expect(settlement.result).toEqual({ homeScore: 2, awayScore: 2, winner: 'Empate', events: [] });
  });

  it('reports a rejected match as rejected, with a reason for the player', async () => {
    mockServer({
      finalize: () =>
        jsonResponse(
          { error: 'Fixture mismatch', message: 'This match is not the fixture the saved game is waiting on.' },
          409
        ),
    });
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    await playAll(hook);
    const settlement = await hook.result.current.finalizeMatch();

    expect(settlement.status).toBe('rejected');
    if (settlement.status !== 'rejected') return;
    expect(settlement.error).toMatch(/já seguiu em frente/);
    // The score it watched is still reported, for the screen to talk about.
    expect(settlement.result.homeScore).toBe(6);
  });

  it('tells a player whose watched match the server does not replay to play it again, not that it moved on', async () => {
    mockServer({
      finalize: () =>
        jsonResponse(
          { error: 'Score mismatch', claimed: { homeScore: 6, awayScore: 0 }, replayed: { homeScore: 1, awayScore: 1 } },
          409
        ),
    });
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    await playAll(hook);
    const settlement = await hook.result.current.finalizeMatch();

    expect(settlement.status).toBe('rejected');
    if (settlement.status !== 'rejected') return;
    expect(settlement.retryable).toBe(false);
    expect(settlement.error).toMatch(/jogue a partida de novo/);
    expect(settlement.error).not.toMatch(/já seguiu em frente/);
  });

  it.each([
    { label: 'the fixture having moved on', status: 409, retryable: false, says: /já seguiu em frente/ },
    { label: 'a match the server refused', status: 400, retryable: false, says: /não aceitou/ },
    { label: 'a save that could not be written', status: 503, retryable: true, says: /tentar salvar novamente/ },
    { label: 'a rate limit', status: 429, retryable: true, says: /tentar salvar novamente/ },
    { label: 'a server error', status: 500, retryable: true, says: /tentar salvar novamente/ },
  ])('marks $label as retryable=$retryable and says so in Portuguese', async ({ status, retryable, says }) => {
    mockServer({ finalize: () => jsonResponse({ error: 'x', message: 'server side english' }, status) });
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    await playAll(hook);
    const settlement = await hook.result.current.finalizeMatch();

    expect(settlement.status).toBe('rejected');
    if (settlement.status !== 'rejected') return;
    expect(settlement.retryable).toBe(retryable);
    expect(settlement.error).toMatch(says);
    // The server's own wording never reaches the player.
    expect(settlement.error).not.toContain('server side english');
  });

  it('treats a lost connection as worth retrying', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    const settlement = await hook.result.current.finalizeMatch();

    expect(settlement.status).toBe('rejected');
    if (settlement.status !== 'rejected') return;
    expect(settlement.retryable).toBe(true);
  });

  it('sends the same match again on a second finalize call', async () => {
    const { sent } = mockServer({ finalize: () => jsonResponse({ error: 'boom' }, 503) });
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    await playAll(hook);
    await hook.result.current.finalizeMatch();
    await hook.result.current.finalizeMatch();

    const finalizes = sent.filter((r) => r.url.endsWith('/api/match/finalize'));
    expect(finalizes).toHaveLength(2);
    // A retry is the same match, not a new one: the server decides once.
    expect(finalizes[1].body).toEqual(finalizes[0].body);
  });

  it('reports a network failure as rejected rather than throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    const settlement = await hook.result.current.finalizeMatch();

    expect(settlement.status).toBe('rejected');
    if (settlement.status !== 'rejected') return;
    expect(settlement.error).toContain('não contou');
  });

  it('throws when a decision turn is refused, so the screen can say so', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'Validation failed' }, 400));
    const hook = renderHook(() => useTurnBasedMatch(gameState()));

    await expect(hook.result.current.submitTurn(0, null)).rejects.toThrow('400');
  });

  it('puts the player on the away side of the score when they played away', async () => {
    mockServer({ finalize: () => jsonResponse({ error: 'nope' }, 500) });
    const hook = renderHook(() => useTurnBasedMatch(gameState(false)));

    await playAll(hook);
    const settlement = await hook.result.current.finalizeMatch();

    expect(settlement.status).toBe('rejected');
    expect(settlement.fixture.isHome).toBe(false);
    // 6-0 to the home side, which away from home is the opponent.
    expect(settlement.result.winner).toBe(OPPONENT);
  });

  it('pins the fixture at kickoff, even if the save moves underneath it', async () => {
    const { sent } = mockServer();
    const state = gameState();
    const hook = renderHook(() => useTurnBasedMatch(state));

    await playAll(hook);
    // The save advances mid-match (another tab, a stale refresh).
    state.season.week = 99;
    state.season.nextMatch.opponent = 'Outro FC';
    hook.rerender();
    await hook.result.current.finalizeMatch();

    const finalize = sent.find((r) => r.url.endsWith('/api/match/finalize'))!;
    expect(finalize.body.week).toBe(KICKOFF_WEEK);
    expect(finalize.body.opponent).toBe(OPPONENT);
  });
});
