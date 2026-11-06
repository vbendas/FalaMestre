import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { settle, tick, tickUntil } from '@/test/match-timers';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { buildDecisionTurn } from '@/lib/decision-engine';
import { DECISION_TURNS } from '@/lib/constants';
import { TurnBasedMatchFlow } from '../TurnBasedMatchFlow';
import type { GameState } from '@/lib/types';
import type { MatchSettlement } from '@/hooks/useTurnBasedMatch';

/**
 * The screen's half of the finalize work: that it plays every turn from
 * kickoff, under the derived seeds, and that the match only looks played once
 * the server says it was.
 *
 * The decide replies here carry no events, which skips the minute-by-minute
 * playback — the animation is the component's other job and not what these
 * tests are about.
 */

const USER_ID = 'user_abc123def';
const USER_TEAM = BRAZILIAN_TEAMS[0].name;
const OPPONENT = BRAZILIAN_TEAMS[1].name;
const KICKOFF_WEEK = 7;

function gameState(): GameState {
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

const state = gameState();

/** A real prompt for a turn, so the options on screen are the real ones. */
function promptFor(turnNumber: number) {
  return buildDecisionTurn(turnNumber, 0, 0, state.squad.players, '4-3-3', 'balanced', false);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface Sent {
  url: string;
  body: Record<string, any>;
}

const SAVED_REPLY = {
  result: { homeScore: 2, awayScore: 1, winner: USER_TEAM, events: [] },
  pointsEarned: 3,
  matchResult: 'win',
  earnings: { amount: 4321, breakdown: 'Vitória' },
  updatedGameState: gameState(),
};

function mockServer(
  finalizeReply: (attempt: number) => Response | Promise<Response> = () => jsonResponse(SAVED_REPLY)
) {
  const sent: Sent[] = [];
  let finalizeAttempts = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const body = JSON.parse(String((init as RequestInit).body));
    sent.push({ url: String(url), body });

    if (String(url).endsWith('/api/match/decide')) {
      const turnNumber = body.turnNumber as number;
      const isLast = turnNumber >= DECISION_TURNS.length - 1;
      return jsonResponse({
        events: [],
        segmentSummary: `resumo do turno ${turnNumber}`,
        turnPrompt: `e agora, turno ${turnNumber + 1}?`,
        nextTurn: isLast ? null : promptFor(turnNumber + 1),
        endState: {
          homeScore: 0,
          awayScore: 0,
          homeMomentum: 0,
          awayMomentum: 0,
          tension: 30,
          formation: '4-3-3',
          mentality: 'balanced',
          hasRedCard: false,
          squad: state.squad.players,
        },
      });
    }
    finalizeAttempts += 1;
    return finalizeReply(finalizeAttempts);
  });
  return sent;
}

/**
 * Plays a whole match without touching anything: every prompt is left to its
 * 30s clock and every summary to its countdown. One timer at a time, so the
 * screen renders between them as it would in a browser.
 */
async function playByTimeout(sent: Sent[]) {
  await tickUntil(
    () => sent.some((r) => r.url.endsWith('/api/match/finalize')),
    'the match to be sent for settling'
  );
  await settle();
}

/**
 * Answers the prompt on screen with "Manter como está" and clears the summary
 * that follows it. The last turn has no summary — the match ends there — so a
 * missing "Continuar" is not a failure.
 */
async function answerPrompt() {
  fireEvent.click(await screen.findByText('Manter como está'));

  await waitFor(() => {
    const movedOn =
      screen.queryByText('Continuar') ||
      screen.queryByText('Encerrando a partida...') ||
      screen.queryByText('A partida não contou') ||
      !screen.queryByText('Manter como está');
    expect(movedOn).toBeTruthy();
  });

  const summaryContinue = screen.queryByText('Continuar');
  if (summaryContinue) {
    fireEvent.click(summaryContinue);
  }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('TurnBasedMatchFlow', () => {
  it('opens on the kickoff prompt', () => {
    mockServer();
    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={vi.fn()} onAbandon={vi.fn()} />);

    // Turn 0, minute 0 — the prompt the old screen answered into turn 1.
    expect(screen.getByText(/Pré-jogo/)).toBeInTheDocument();
    expect(screen.getByText(/Min 0/)).toBeInTheDocument();
  });

  it('plays all six turns from kickoff and banks the match', async () => {
    const sent = mockServer();
    const onMatchEnd = vi.fn();

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={onMatchEnd} onAbandon={vi.fn()} />);

    for (let turn = 0; turn < DECISION_TURNS.length; turn++) {
      await answerPrompt();
    }

    await waitFor(() => expect(onMatchEnd).toHaveBeenCalled());

    const decides = sent.filter((r) => r.url.endsWith('/api/match/decide'));
    expect(decides.map((r) => r.body.turnNumber)).toEqual([0, 1, 2, 3, 4, 5]);

    const finalize = sent.find((r) => r.url.endsWith('/api/match/finalize'))!;
    expect(finalize).toBeTruthy();
    expect(finalize.body.week).toBe(KICKOFF_WEEK);
    expect(finalize.body.opponent).toBe(OPPONENT);
    expect(finalize.body.decisions).toHaveLength(DECISION_TURNS.length);
    expect(finalize.body.decisions.map((d: { turnNumber: number }) => d.turnNumber)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    // Each turn went out under the seed derived from this match's seed. The
    // expectation is spelled out rather than taken from `deriveTurnSeed`, so
    // that a change to the derivation shows up here.
    for (const decide of decides) {
      expect(decide.body.seed).toBe(`${finalize.body.seed}:turn:${decide.body.turnNumber}`);
    }

    const settlement = onMatchEnd.mock.calls[0][0] as MatchSettlement;
    expect(settlement.status).toBe('saved');
    if (settlement.status !== 'saved') return;
    expect(settlement.pointsEarned).toBe(3);
    expect(settlement.result).toEqual(SAVED_REPLY.result);
  }, 20_000);

  it('shows the opening fifteen minutes as a segment of their own', async () => {
    mockServer();

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={vi.fn()} onAbandon={vi.fn()} />);
    fireEvent.click(await screen.findByText('Manter como está'));

    // The first summary covers 0' to 15'; the old flow started at 15'.
    expect(await screen.findByText(/Minutos 0'- 15'/)).toBeInTheDocument();
  });

  it('tells the player the match did not count when finalize refuses it', async () => {
    mockServer(() =>
      jsonResponse(
        {
          error: 'Fixture mismatch',
          message: 'This match is not the fixture the saved game is waiting on.',
        },
        409
      )
    );
    const onMatchEnd = vi.fn();
    const onAbandon = vi.fn();

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={onMatchEnd} onAbandon={onAbandon} />);

    for (let turn = 0; turn < DECISION_TURNS.length; turn++) {
      await answerPrompt();
    }

    expect(await screen.findByText('A partida não contou')).toBeInTheDocument();
    // The screen says it in Portuguese; the server's own English wording goes
    // to the console, not to the player.
    expect(screen.getByText(/já seguiu em frente/)).toBeInTheDocument();
    // No score is presented as a result.
    expect(screen.queryByText('Fim de Jogo')).not.toBeInTheDocument();

    const settlement = onMatchEnd.mock.calls[0][0] as MatchSettlement;
    expect(settlement.status).toBe('rejected');

    fireEvent.click(screen.getByText('Voltar'));
    expect(onAbandon).toHaveBeenCalled();
  }, 20_000);

  it('plays one turn per prompt and banks once when nobody touches anything', async () => {
    vi.useFakeTimers();
    const sent = mockServer();
    const onMatchEnd = vi.fn();

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={onMatchEnd} onAbandon={vi.fn()} />);
    await playByTimeout(sent);

    const decides = sent.filter((r) => r.url.endsWith('/api/match/decide'));
    expect(decides.map((r) => r.body.turnNumber)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(decides.every((r) => r.body.decision === null)).toBe(true);
    expect(sent.filter((r) => r.url.endsWith('/api/match/finalize'))).toHaveLength(1);
    expect(onMatchEnd).toHaveBeenCalledTimes(1);
  });

  it('sends one decision per turn when a click lands on the final tick', async () => {
    vi.useFakeTimers();
    const sent = mockServer();

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={vi.fn()} onAbandon={vi.fn()} />);
    await settle();

    // 29 of the 30 seconds, a second at a time.
    for (let second = 0; second < 29; second++) await tick();

    // The last tick and the click in one batch: the prompt ends up with both a
    // selection and a timeout to report, and the turn must still go out once.
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync();
      fireEvent.click(screen.getByText('Manter como está'));
    });

    // Let the 200ms decision and the 600ms timeout both come due, one at a
    // time: the first unmounts the prompt, which is what cancels the second.
    for (let step = 0; step < 6; step++) await tick();

    const decides = sent.filter((r) => r.url.endsWith('/api/match/decide'));
    expect(decides).toHaveLength(1);
    expect(decides[0].body.turnNumber).toBe(0);
  });

  it('sends one decision per turn when the click arrives just after the clock', async () => {
    vi.useFakeTimers();
    const sent = mockServer();

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={vi.fn()} onAbandon={vi.fn()} />);
    await settle();

    // The browser's own ordering: the clock reaches zero, the screen renders,
    // and only then does the click land.
    for (let second = 0; second < 30; second++) await tick();
    fireEvent.click(screen.getByText('Manter como está'));
    for (let step = 0; step < 6; step++) await tick();

    const decides = sent.filter((r) => r.url.endsWith('/api/match/decide'));
    expect(decides).toHaveLength(1);
    expect(decides[0].body.turnNumber).toBe(0);
    // The clock got there first, so it is reported as a timeout.
    expect(decides[0].body.decision).toBeNull();
  });

  it('finalizes once when the last prompt is clicked as it expires', async () => {
    vi.useFakeTimers();
    const sent = mockServer();
    const onMatchEnd = vi.fn();

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={onMatchEnd} onAbandon={vi.fn()} />);
    await settle();

    // Five turns on the clock, then race the last one.
    await tickUntil(
      () => sent.filter((r) => r.url.endsWith('/api/match/decide')).length === 5,
      'five turns to be played'
    );
    await tickUntil(() => !!screen.queryByText('Manter como está'), 'the last prompt');
    for (let second = 0; second < 29; second++) await tick();
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync();
      fireEvent.click(screen.getByText('Manter como está'));
    });
    await tickUntil(
      () => sent.some((r) => r.url.endsWith('/api/match/finalize')),
      'the match to be sent for settling'
    );
    for (let step = 0; step < 4; step++) await tick();

    const decides = sent.filter((r) => r.url.endsWith('/api/match/decide'));
    expect(decides.map((r) => r.body.turnNumber)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(sent.filter((r) => r.url.endsWith('/api/match/finalize'))).toHaveLength(1);
    expect(onMatchEnd).toHaveBeenCalledTimes(1);
  });

  it('stops talking to the server when the player leaves mid-match', async () => {
    const sent = mockServer();
    const onMatchEnd = vi.fn();
    const view = render(
      <TurnBasedMatchFlow gameState={state} onMatchEnd={onMatchEnd} onAbandon={vi.fn()} />
    );

    fireEvent.click(await screen.findByText('Manter como está'));
    await waitFor(() => expect(sent.length).toBeGreaterThan(0));

    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // One decide, which saves nothing, and no finalize: an abandoned match
    // leaves the save exactly as it was.
    expect(sent.filter((r) => r.url.endsWith('/api/match/finalize'))).toHaveLength(0);
    expect(onMatchEnd).not.toHaveBeenCalled();
  });

  it('offers a retry when the save fails, and banks the same match on the retry', async () => {
    vi.useFakeTimers();
    // The first attempt never comes back; the second works.
    const sent = mockServer((attempt) =>
      attempt === 1 ? Promise.reject(new Error('network down')) : jsonResponse(SAVED_REPLY)
    );
    const onMatchEnd = vi.fn();

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={onMatchEnd} onAbandon={vi.fn()} />);
    await playByTimeout(sent);

    expect(screen.getByText('A partida não contou')).toBeInTheDocument();
    const retry = screen.getByText('Tentar novamente');

    await act(async () => {
      fireEvent.click(retry);
    });
    await settle();

    const finalizes = sent.filter((r) => r.url.endsWith('/api/match/finalize'));
    expect(finalizes).toHaveLength(2);
    // The retry is the same match: same seed, same decisions, not a replay.
    expect(finalizes[1].body.seed).toBe(finalizes[0].body.seed);
    expect(finalizes[1].body.decisions).toEqual(finalizes[0].body.decisions);

    const settlements = onMatchEnd.mock.calls.map((c) => (c[0] as MatchSettlement).status);
    expect(settlements).toEqual(['rejected', 'saved']);
  }, 20_000);

  it('offers no retry when the server has made up its mind about the match', async () => {
    vi.useFakeTimers();
    const sent = mockServer(() =>
      jsonResponse({ error: 'Fixture mismatch', message: 'already finalized' }, 409)
    );

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={vi.fn()} onAbandon={vi.fn()} />);
    await playByTimeout(sent);

    expect(screen.getByText('A partida não contou')).toBeInTheDocument();
    // Sending the same match again would be refused the same way.
    expect(screen.queryByText('Tentar novamente')).not.toBeInTheDocument();
    expect(screen.getByText(/já seguiu em frente/)).toBeInTheDocument();
  }, 20_000);

  it('says so and stops when a decision turn itself fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'boom' }, 500));
    const onMatchEnd = vi.fn();

    render(<TurnBasedMatchFlow gameState={state} onMatchEnd={onMatchEnd} onAbandon={vi.fn()} />);
    fireEvent.click(await screen.findByText('Manter como está'));

    expect(await screen.findByText('A partida não contou')).toBeInTheDocument();
    expect(onMatchEnd).not.toHaveBeenCalled();
  });
});
