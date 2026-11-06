/**
 * The seed contract between the match screen and the match routes.
 *
 * This lives on its own, away from `match-replay.ts`, because the client needs
 * it: the match screen draws one seed per match and sends a derived seed with
 * every decision turn, and importing it from the replay module would pull the
 * whole match engine into the browser bundle. The `Seed` import is type-only,
 * so nothing else comes with it.
 */

import type { Seed } from './validations';

/**
 * The seed for one turn of a match, derived from the match seed.
 *
 * Both sides of a finalize depend on this being the only derivation: the live
 * turns are played under these seeds (the screen sends each one to
 * /api/match/decide) and /api/match/finalize re-derives them from the match
 * seed alone to replay the same football. The result stays inside `seedSchema`
 * (letters, digits, `_ . : -`) for match seeds up to 52 characters, so it is a
 * valid seed in its own right.
 */
export function deriveTurnSeed(matchSeed: Seed, turnNumber: number): string {
  return `${matchSeed}:turn:${turnNumber}`;
}
