import { describe, it, expect, vi, afterEach } from 'vitest';
import { withSeed, isSeeded } from '@/lib/rng';
import {
  pickNextFixture,
  pickTeam,
  rollOpponentMorale,
  simulateRivalStandings,
} from '@/lib/match-setup';

const TEAMS = [
  { name: 'Alfa' },
  { name: 'Bravo' },
  { name: 'Charlie' },
  { name: 'Delta' },
  { name: 'Echo' },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('rollOpponentMorale', () => {
  it('stays within 55-84', () => {
    for (let i = 0; i < 500; i++) {
      const morale = rollOpponentMorale();
      expect(morale).toBeGreaterThanOrEqual(55);
      expect(morale).toBeLessThanOrEqual(84);
    }
  });

  it('is reproducible under the same seed', () => {
    const a = withSeed('morale-1', () => [rollOpponentMorale(), rollOpponentMorale()]);
    const b = withSeed('morale-1', () => [rollOpponentMorale(), rollOpponentMorale()]);
    expect(a).toEqual(b);
  });

  it('uses Math.random when unseeded, so normal play is unchanged', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(isSeeded()).toBe(false);
    expect(rollOpponentMorale()).toBe(70);
    expect(spy).toHaveBeenCalled();
  });

  it('does not touch Math.random inside a seeded scope', () => {
    const spy = vi.spyOn(Math, 'random');
    withSeed('morale-2', () => rollOpponentMorale());
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('pickTeam', () => {
  it('always returns a team from the list', () => {
    for (let i = 0; i < 200; i++) {
      expect(TEAMS).toContain(pickTeam(TEAMS));
    }
  });

  it('is reproducible under the same seed', () => {
    const a = withSeed(7, () => [pickTeam(TEAMS).name, pickTeam(TEAMS).name]);
    const b = withSeed(7, () => [pickTeam(TEAMS).name, pickTeam(TEAMS).name]);
    expect(a).toEqual(b);
  });

  it('rejects an empty list rather than returning undefined', () => {
    expect(() => pickTeam([])).toThrow(/at least one team/);
  });
});

describe('pickNextFixture', () => {
  it('never picks the user team or the side just played', () => {
    for (let i = 0; i < 300; i++) {
      const fixture = pickNextFixture(TEAMS, 'Alfa', 'Bravo');
      expect(fixture.opponent).not.toBe('Alfa');
      expect(fixture.opponent).not.toBe('Bravo');
      expect(typeof fixture.isHome).toBe('boolean');
    }
  });

  it('falls back to any non-user team when exclusions empty the pool', () => {
    const fixture = pickNextFixture([{ name: 'Alfa' }, { name: 'Bravo' }], 'Alfa', 'Bravo');
    expect(fixture.opponent).toBe('Bravo');
  });

  it('is reproducible under the same seed', () => {
    const a = withSeed('fixture-1', () => pickNextFixture(TEAMS, 'Alfa', 'Bravo'));
    const b = withSeed('fixture-1', () => pickNextFixture(TEAMS, 'Alfa', 'Bravo'));
    expect(a).toEqual(b);
  });

  it('gives different draws for different seeds', () => {
    const draws = new Set(
      ['s1', 's2', 's3', 's4', 's5', 's6'].map((seed) =>
        withSeed(seed, () => JSON.stringify(pickNextFixture(TEAMS, 'Alfa', 'Bravo')))
      )
    );
    expect(draws.size).toBeGreaterThan(1);
  });
});

describe('simulateRivalStandings', () => {
  it('returns one entry per rival with non-negative points', () => {
    const standings = simulateRivalStandings(TEAMS, 10);
    expect(standings.map((s) => s.name)).toEqual(TEAMS.map((t) => t.name));
    for (const s of standings) {
      expect(s.points).toBeGreaterThanOrEqual(0);
    }
  });

  it('plays at least one match even in week 1', () => {
    for (let i = 0; i < 100; i++) {
      for (const s of simulateRivalStandings(TEAMS, 1)) {
        expect(s.points).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('is reproducible under the same seed', () => {
    const a = withSeed('table-1', () => simulateRivalStandings(TEAMS, 12));
    const b = withSeed('table-1', () => simulateRivalStandings(TEAMS, 12));
    expect(a).toEqual(b);
  });
});

describe('seeded scope and the async route constraint', () => {
  it('restores the unseeded source after the callback returns', () => {
    withSeed('scope', () => rollOpponentMorale());
    expect(isSeeded()).toBe(false);
  });

  it('refuses an async callback, which is why routes call the helpers directly', () => {
    expect(() => withSeed('async', async () => rollOpponentMorale())).toThrow(
      /synchronous only/
    );
    expect(isSeeded()).toBe(false);
  });

  it('reproduces a whole route-style sequence of draws from one seed', () => {
    const sequence = () => {
      const morale = rollOpponentMorale();
      const standings = simulateRivalStandings(TEAMS, 9);
      const fixture = pickNextFixture(TEAMS, 'Alfa', 'Bravo');
      return { morale, standings, fixture };
    };
    expect(withSeed('route-run', sequence)).toEqual(withSeed('route-run', sequence));
  });
});
