import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Driving the match screen's clocks in tests the way a browser runs them.
 *
 * The screen is full of timers — a 30s decision clock ticking once a second,
 * a 600ms pause before a timeout is reported, 200ms before a decision is, a
 * 4s summary countdown, 800ms a minute of playback. Jumping the fake clock by
 * seconds at a time fires whole runs of them inside one `act`, with no render
 * in between, which is not a state a browser can be in: a test can then see a
 * double submit that cannot happen, or miss one that can, because the effects
 * that would have cancelled the second never ran.
 *
 * So these helpers advance to the *next* timer only, and let React render and
 * promises settle before the one after it. Every step is a state the browser
 * really passes through.
 */

/** Fires the next pending timer, then lets React render and promises settle. */
export async function tick(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersToNextTimerAsync();
  });
}

/** Lets pending promises settle without touching the clock. */
export async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * Fires timers one at a time until `done` holds, rendering between each.
 *
 * `limit` is a safety net, not a tuning knob: a match played entirely on its
 * clocks is a few hundred timers, and running out of them means the screen
 * stopped making progress, which is the failure the caller wants reported.
 */
export async function tickUntil(
  done: () => boolean,
  description: string,
  limit = 1500
): Promise<void> {
  await settle();
  for (let fired = 0; fired < limit; fired++) {
    if (done()) return;
    await tick();
  }
  if (!done()) {
    throw new Error(`gave up after ${limit} timers waiting for ${description}`);
  }
}
