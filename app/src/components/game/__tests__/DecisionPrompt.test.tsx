import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { settle, tick } from '@/test/match-timers';
import { withSeed } from '@/lib/rng';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { buildDecisionTurn } from '@/lib/decision-engine';
import { DecisionPrompt } from '../DecisionPrompt';

/**
 * One prompt is one decision. The 30s clock and the player's click are two
 * ways of answering the same turn, and a turn answered twice is a turn the
 * server is told about twice, so what these tests pin is the invariant:
 * exactly one of `onDecision` and `onTimeout`, however the two race.
 *
 * The clock is advanced one timer at a time (see src/test/match-timers.ts) so
 * the component renders between ticks as it would in a browser. The three
 * orderings below are the ones that matter: the clock committing first, the
 * click committing first, and the click landing before React has committed
 * the clock's render — which a browser reaches only when that render is
 * deferred, and which a fake clock can produce on demand.
 */

const state = withSeed('fixture', () =>
  createInitialGameState('user_abc123def', BRAZILIAN_TEAMS[0].name)
);
const turn = buildDecisionTurn(1, 0, 0, state.squad.players, '4-3-3', 'balanced', false);

function renderPrompt() {
  const onDecision = vi.fn();
  const onTimeout = vi.fn();
  render(
    <DecisionPrompt
      turn={turn}
      turnPrompt="e agora?"
      segmentSummary="resumo"
      onDecision={onDecision}
      onTimeout={onTimeout}
    />
  );
  return { onDecision, onTimeout };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DecisionPrompt', () => {
  it('reports the decision, not a timeout, when a click lands on the final tick', async () => {
    vi.useFakeTimers();
    const { onDecision, onTimeout } = renderPrompt();

    await settle();
    // A second at a time, rendering in between, the way the browser ticks.
    for (let second = 0; second < 29; second++) await tick();

    // The clock reaching zero and the click, in one batch: both the timeout
    // flag and the selection are set before any effect runs.
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync();
      fireEvent.click(screen.getByText('Manter como está'));
    });
    for (let step = 0; step < 4; step++) await tick();

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('reports a timeout and ignores a click that arrives after it', async () => {
    vi.useFakeTimers();
    const { onDecision, onTimeout } = renderPrompt();

    await settle();
    for (let second = 0; second < 30; second++) await tick();

    // The clock has already been reported by the time the click lands.
    fireEvent.click(screen.getByText('Manter como está'));
    for (let step = 0; step < 4; step++) await tick();

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onDecision).not.toHaveBeenCalled();
  });

  it('reports the decision and stops the clock when the click comes first', async () => {
    vi.useFakeTimers();
    const { onDecision, onTimeout } = renderPrompt();

    await settle();
    // One second left, and the player answers.
    for (let second = 0; second < 29; second++) await tick();
    fireEvent.click(screen.getByText('Manter como está'));
    await settle();

    // The clock is stopped by the decision, so no timeout follows it however
    // long the prompt stays mounted.
    for (let step = 0; step < 10; step++) await tick();

    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('reports one decision however many times the player clicks', async () => {
    const { onDecision } = renderPrompt();

    const keep = screen.getByText('Manter como está');
    fireEvent.click(keep);
    fireEvent.click(keep);
    fireEvent.click(keep);

    await waitFor(() => expect(onDecision).toHaveBeenCalled());
    expect(onDecision).toHaveBeenCalledTimes(1);
  });
});
