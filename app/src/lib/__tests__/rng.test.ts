import { describe, it, expect, vi, afterEach } from 'vitest';
import { random, withSeed, isSeeded, createSeededRandom, hashSeed } from '../rng';

const draw = (count: number, fn: () => number = random): number[] =>
  Array.from({ length: count }, () => fn());

describe('rng', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('unseeded (normal play)', () => {
    it('is not seeded by default', () => {
      expect(isSeeded()).toBe(false);
    });

    it('delegates to Math.random so behaviour is unchanged', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.4242);

      expect(random()).toBe(0.4242);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('withSeed', () => {
    it('gives the same stream for the same seed', () => {
      expect(withSeed('kickoff', () => draw(50))).toEqual(withSeed('kickoff', () => draw(50)));
    });

    it('gives different streams for different seeds', () => {
      const a = withSeed('seed-a', () => draw(50));
      const b = withSeed('seed-b', () => draw(50));

      expect(a).not.toEqual(b);
    });

    it('accepts numeric seeds', () => {
      expect(withSeed(7, () => draw(20))).toEqual(withSeed(7, () => draw(20)));
      expect(withSeed(7, () => draw(20))).not.toEqual(withSeed(8, () => draw(20)));
    });

    it('does not consult Math.random while seeded', () => {
      const spy = vi.spyOn(Math, 'random');

      withSeed('offline', () => draw(100));

      expect(spy).not.toHaveBeenCalled();
    });

    it('returns the value produced by fn', () => {
      expect(withSeed('x', () => 'result')).toBe('result');
    });

    it('restores the unseeded source afterwards', () => {
      withSeed('scoped', () => draw(5));

      expect(isSeeded()).toBe(false);
    });

    it('restores the unseeded source when fn throws', () => {
      expect(() => withSeed('scoped', () => {
        throw new Error('boom');
      })).toThrow('boom');

      expect(isSeeded()).toBe(false);
    });

    it('nests, restoring the outer stream when the inner scope ends', () => {
      const reference = withSeed('outer', () => draw(6));

      const nested = withSeed('outer', () => {
        const before = draw(3);
        withSeed('inner', () => draw(100));
        const after = draw(3);
        return [...before, ...after];
      });

      // The inner scope must not consume or disturb the outer stream.
      expect(nested).toEqual(reference);
    });

    it('rejects an async fn rather than silently leaking the seed', () => {
      expect(() => withSeed('async', async () => 1)).toThrow(/synchronous only/);
      expect(isSeeded()).toBe(false);
    });
  });

  describe('createSeededRandom', () => {
    it('stays within [0, 1)', () => {
      const values = draw(5000, createSeededRandom('range-check'));

      expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...values)).toBeLessThan(1);
    });

    it('is roughly uniform, so probability thresholds behave sensibly', () => {
      const values = draw(20000, createSeededRandom('uniformity'));
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const buckets = new Array(10).fill(0);
      values.forEach(v => { buckets[Math.floor(v * 10)]++; });

      expect(mean).toBeGreaterThan(0.48);
      expect(mean).toBeLessThan(0.52);
      // Every decile within 20% of the expected 2000 hits.
      buckets.forEach(count => {
        expect(count).toBeGreaterThan(1600);
        expect(count).toBeLessThan(2400);
      });
    });

    it('does not immediately repeat itself', () => {
      const values = draw(1000, createSeededRandom('cycle'));

      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('hashSeed', () => {
    it('is stable for a given seed', () => {
      expect(hashSeed('liga-mestre')).toBe(hashSeed('liga-mestre'));
    });

    it('separates similar seeds', () => {
      expect(hashSeed('match-1')).not.toBe(hashSeed('match-2'));
    });

    it('falls back to 0 for non-finite numbers', () => {
      expect(hashSeed(Number.NaN)).toBe(0);
      expect(hashSeed(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });
});
