/**
 * Seedable random number source for the match engine.
 *
 * Normal play never seeds anything: `random()` falls straight through to
 * `Math.random()`, so matches play exactly as they did before this module
 * existed. Tests — and match replay — wrap a simulation in `withSeed()` to
 * draw from a deterministic stream instead, so the same inputs produce the
 * same match every time.
 *
 *   const a = withSeed('match-42', () => simulateMatch(...));
 *   const b = withSeed('match-42', () => simulateMatch(...));
 *   // a and b are identical, down to the commentary.
 *
 * Match event ids are deliberately *outside* this stream: they come from
 * crypto.randomUUID(), because an id is identity rather than match content.
 * Compare replays on everything but the ids.
 *
 * The engine is synchronous, and so is the seeded scope: `withSeed` restores
 * the previous source as soon as `fn` returns, and refuses a callback that
 * returns a promise. Seeding is therefore not safe around concurrent work.
 *
 * Async request handlers can still replay a match, but only by keeping every
 * random draw inside one synchronous block — pick the opponent's morale, run
 * the simulation, build the script — and calling `withSeed` around that block
 * *between* awaits, never around the handler itself. A scope that spans an
 * `await` would already be closed when the handler resumed, and two requests
 * in flight would read each other's seed. When the caller sends no seed, the
 * handler draws one with `generateSeed()` and reports it so the match can be
 * replayed later; the game itself still plays as it always has.
 */

/** Active deterministic source, or null when running unseeded (normal play). */
let source: (() => number) | null = null;

/**
 * Returns a float in [0, 1) — the single source of randomness for the engine.
 * Delegates to Math.random unless a seeded scope is active.
 */
export function random(): number {
  return source === null ? Math.random() : source();
}

/**
 * mulberry32: a small, fast PRNG with a 32-bit state. Good enough for match
 * simulation and, unlike Math.random, reproducible from a known seed.
 */
export function createSeededRandom(seed: string | number): () => number {
  let state = hashSeed(seed);
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Folds a seed of either type into a 32-bit integer (FNV-1a for strings). */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') {
    return Number.isFinite(seed) ? Math.trunc(seed) | 0 : 0;
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

/**
 * Runs `fn` with randomness drawn from `seed`, then restores whatever source
 * was active before (normally Math.random). Nests safely.
 */
export function withSeed<T>(seed: string | number, fn: () => T): T {
  const previous = source;
  source = createSeededRandom(seed);
  try {
    const result = fn();
    if (isThenable(result)) {
      throw new Error(
        'withSeed() is synchronous only: the seeded scope closes when fn returns, ' +
          'so a promise would resolve after the seed is gone.'
      );
    }
    return result;
  } finally {
    source = previous;
  }
}

/**
 * A fresh seed for a match the caller did not seed. Drawn from the ambient
 * source (Math.random outside a scope), so an unseeded request still gets a
 * seed it can send back to replay the match.
 */
export function generateSeed(): string {
  return random().toString(36).slice(2, 12).padEnd(10, '0');
}

/** True while a seeded scope is active. Exposed for tests and diagnostics. */
export function isSeeded(): boolean {
  return source !== null;
}

function isThenable(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}
