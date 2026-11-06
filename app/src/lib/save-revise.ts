/**
 * Load, revise, commit, retrying on a lost race. Built on `loadSave` and
 * `commitSave` from save-store, and kept in its own module so that it reaches
 * them through the same import every route uses: a test that stands in for
 * that module to interpose a competing write between a load and its commit
 * then catches this path too.
 */

import type { GameState } from '@/lib/types';
import { loadSave, commitSave } from '@/lib/save-store';

export type ReviseSaveResult =
  | { ok: true; changed: boolean; version: number; attempts: number }
  | { ok: false; reason: 'not_found' | 'conflict'; attempts: number };

/**
 * Loads the save, applies `revise` to it and commits, reloading and trying
 * again if the commit loses a race, up to `attempts` times. `revise` returns
 * whether it changed anything; when it did not, nothing is written and the
 * version is left alone. `revise` must be safe to run more than once on
 * fresh copies of the save, which is what makes retrying correct.
 */
export async function reviseSave(
  userId: string,
  revise: (state: GameState) => boolean,
  options: { attempts?: number } = {}
): Promise<ReviseSaveResult> {
  const attempts = Math.max(1, options.attempts ?? 3);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const save = await loadSave(userId);
    if (!save) return { ok: false, reason: 'not_found', attempts: attempt };
    if (!revise(save.state)) {
      return { ok: true, changed: false, version: save.version, attempts: attempt };
    }
    const committed = await commitSave(userId, save.state, save.version);
    if (committed.ok) {
      return { ok: true, changed: true, version: committed.version, attempts: attempt };
    }
  }
  return { ok: false, reason: 'conflict', attempts };
}
