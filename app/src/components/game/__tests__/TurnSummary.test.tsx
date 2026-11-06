import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { settle, tick } from '@/test/match-timers';
import { BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { TurnSummary } from '../TurnSummary';

/**
 * The summary advances on a countdown and on a button, and both call the same
 * handler. Advancing twice does not skip a turn today — the handler only
 * changes which phase the screen is in — but it is one call per summary, and
 * this keeps it that way.
 */

function renderSummary() {
  const onContinue = vi.fn();
  render(
    <TurnSummary
      segment={{
        fromMinute: 15,
        toMinute: 30,
        events: [],
        homeScoreAtStart: 0,
        awayScoreAtStart: 0,
        homeScoreAtEnd: 1,
        awayScoreAtEnd: 0,
      }}
      homeTeam={BRAZILIAN_TEAMS[0].name}
      awayTeam={BRAZILIAN_TEAMS[1].name}
      homeColor="#ffffff"
      awayColor="#000000"
      segmentSummary="resumo"
      turnNumber={1}
      totalTurns={6}
      onContinue={onContinue}
    />
  );
  return { onContinue };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TurnSummary', () => {
  it('advances once when its countdown runs out', async () => {
    vi.useFakeTimers();
    const { onContinue } = renderSummary();

    await settle();
    for (let second = 0; second < 10; second++) await tick();

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('does not advance again when the player clicks after the countdown', async () => {
    vi.useFakeTimers();
    const { onContinue } = renderSummary();

    await settle();
    for (let second = 0; second < 4; second++) await tick();

    await act(async () => {
      fireEvent.click(screen.getByText('Continuar'));
    });

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('advances once when the player clicks before the countdown', async () => {
    vi.useFakeTimers();
    const { onContinue } = renderSummary();

    await act(async () => {
      fireEvent.click(screen.getByText('Continuar'));
    });
    for (let second = 0; second < 10; second++) await tick();

    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
