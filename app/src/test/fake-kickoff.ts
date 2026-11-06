/**
 * An in-memory stand-in for src/lib/fixture-kickoff.ts, for the route tests
 * that run on a mocked database rather than the embedded one.
 *
 * Same contract as the real module: one kickoff per player and round, whose
 * seed, mode and setup the first call fixes and every later call gets back;
 * a decision recorded for a turn keeps the first one; a fixture kicked off in
 * one mode is refused in the other. The real module's own behaviour, and
 * the market close it does at the same time, is tested against the real
 * database (fixture-seed-integrity.test.ts).
 *
 * What the fake adds is a way to say what seed a fixture will be drawn,
 * which those tests use to replay a match: `seedFixtureFor(userId, seed)`.
 *
 * Wire it up with
 *   vi.mock('@/lib/fixture-kickoff', async () => (await import('@/test/fake-kickoff')).fakeKickoffModule);
 */

import type { Kickoff, KickoffMode, KickoffResult, KickoffSetup } from '@/lib/fixture-kickoff';

const rows = new Map<string, Kickoff>();
const seeds = new Map<string, string>();
let drawn = 0;

const key = (userId: string, season: { week: number; number?: number }) =>
  `${userId}#${season.number ?? 1}#${season.week}`;

/**
 * The seed `userId`'s next kickoff draws, for any round. Forgets any kickoff
 * the player already has, so the next call kicks off afresh under it.
 */
export function seedFixtureFor(userId: string, seed: string | number): void {
  seeds.set(userId, String(seed));
  for (const k of [...rows.keys()]) if (k.startsWith(`${userId}#`)) rows.delete(k);
}

/** Forgets every kickoff and seed. */
export function resetFakeKickoffs(): void {
  rows.clear();
  seeds.clear();
}

/** The kickoff a player has on a round, if any. */
export function fakeKickoffOf(userId: string, round: number, season = 1): Kickoff | undefined {
  return rows.get(key(userId, { week: round, number: season }));
}

export const fakeKickoffModule = {
  async kickOffFixture(
    userId: string,
    season: { week: number; number?: number },
    mode: KickoffMode,
    setup: KickoffSetup
  ): Promise<KickoffResult> {
    const k = key(userId, season);
    if (!rows.has(k)) {
      drawn += 1;
      rows.set(k, {
        seed: seeds.get(userId) ?? `fake-seed-${drawn}`,
        mode,
        setup: structuredClone(setup),
        decisions: {},
      });
    }
    const kickoff = structuredClone(rows.get(k)!);
    if (kickoff.mode !== mode) return { ok: false, reason: 'other_mode', mode: kickoff.mode };
    return { ok: true, kickoff };
  },

  hasDecision(kickoff: Pick<Kickoff, 'decisions'>, turnNumber: number): boolean {
    return Object.prototype.hasOwnProperty.call(kickoff.decisions, String(turnNumber));
  },

  async recordDecisions(
    userId: string,
    season: { week: number; number?: number },
    decisions: Record<number, string | null>
  ): Promise<Record<string, string | null>> {
    const row = rows.get(key(userId, season));
    if (!row) throw new Error('Recording a decision for a fixture that has not kicked off');
    row.decisions = { ...Object.fromEntries(Object.entries(decisions)), ...row.decisions };
    return { ...row.decisions };
  },
};
