// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { applyMatchOutcome, resolveMatchResult } from '@/lib/match-bookkeeping';
import { deriveTurnSeed } from '@/lib/match-replay';
import { createInitialGameState, BRAZILIAN_TEAMS } from '@/lib/game-engine';
import { DECISION_TURNS } from '@/lib/constants';
import { seedSchema } from '@/lib/validations';
import { withSeed } from '@/lib/rng';
import type { GameState } from '@/lib/types';

const USER_ID = 'user_abc123def';
const USER_TEAM = BRAZILIAN_TEAMS[0].name;
const OPPONENT = BRAZILIAN_TEAMS[1].name;

function state(week = 5): GameState {
  const s = withSeed('fixture', () => createInitialGameState(USER_ID, USER_TEAM));
  s.season.week = week;
  s.season.nextMatch = {
    opponent: OPPONENT,
    isHome: true,
    date: '2026-01-01T00:00:00.000Z',
    competition: 'Liga Mestre',
  };
  return s;
}

/** A home win, a draw and a home defeat, as either route would report them. */
const WIN = { homeScore: 2, awayScore: 1, winner: USER_TEAM };
const DRAW = { homeScore: 1, awayScore: 1, winner: 'Empate' };
const LOSS = { homeScore: 0, awayScore: 2, winner: OPPONENT };

function apply(gameState: GameState, outcome: typeof WIN, seed = 'book', isHome = true) {
  return withSeed(seed, () =>
    applyMatchOutcome(gameState, { opponentTeam: OPPONENT, isHome, outcome })
  );
}

describe('applyMatchOutcome', () => {
  it('reads the result from the user team, home or away', () => {
    expect(resolveMatchResult(USER_TEAM, USER_TEAM)).toBe('win');
    expect(resolveMatchResult(USER_TEAM, 'Empate')).toBe('draw');
    expect(resolveMatchResult(USER_TEAM, OPPONENT)).toBe('loss');
  });

  it.each([
    { label: 'a win', outcome: WIN, points: 3, record: 'wins' as const },
    { label: 'a draw', outcome: DRAW, points: 1, record: 'draws' as const },
    { label: 'a defeat', outcome: LOSS, points: 0, record: 'losses' as const },
  ])('banks $label: points, record, week and stats', ({ outcome, points, record }) => {
    const s = state();
    const before = structuredClone(s);

    const result = apply(s, outcome);

    expect(result.pointsEarned).toBe(points);
    expect(s.season.points).toBe(before.season.points + points);
    expect(s.season[record]).toBe(before.season[record] + 1);
    expect(s.season.week).toBe(before.season.week + 1);
    expect(s.teamStats.matchesPlayed).toBe(before.teamStats.matchesPlayed + 1);
    expect(s.context.lastAction).toBe('match_completed');
    expect(s.context.narrative.lastEvent).toContain(OPPONENT);
  });

  it('pays the match and takes the staff wages out of the same balance', () => {
    const s = state();
    const before = structuredClone(s);

    const result = apply(s, WIN);

    expect(result.matchEarnings).toBeGreaterThan(0);
    expect(s.user.money).toBe(before.user.money + result.matchEarnings - result.weeklyWages);
    expect(s.teamStats.totalEarnings).toBe(before.teamStats.totalEarnings + result.matchEarnings);
  });

  it('keeps morale inside 30-100 however one-sided the week is', () => {
    const losing = state();
    losing.squad.morale = 32;
    apply(losing, LOSS);
    expect(losing.squad.morale).toBe(30);

    const winning = state();
    winning.squad.morale = 99;
    apply(winning, WIN);
    expect(winning.squad.morale).toBe(100);
  });

  it('draws the next fixture, never the side just played nor the user', () => {
    const s = state();

    apply(s, DRAW);

    expect(s.season.nextMatch.opponent).not.toBe(OPPONENT);
    expect(s.season.nextMatch.opponent).not.toBe(USER_TEAM);
    expect(s.season.nextMatch.competition).toBe('Liga Mestre');
  });

  it('closes the season on week 38 instead of drawing a fixture', () => {
    const s = state(38);

    const result = apply(s, WIN);

    expect(result.isSeasonEnd).toBe(true);
    expect(s.season.nextMatch.opponent).toBe('Temporada Completa');
    expect(s.season.nextMatch.competition).toBe('Fim da Temporada');
    expect(s.context.availableActions).toEqual(['view_final_standings', 'new_season']);
  });

  it('settles identically for the same seed, so both routes can replay it', () => {
    const a = state();
    const b = state();

    const first = apply(a, WIN, 'same-seed');
    const second = apply(b, WIN, 'same-seed');

    expect(first).toEqual(second);
    // The fixture and the table are drawn from the seed too, not just the money.
    expect(a.season.nextMatch.opponent).toBe(b.season.nextMatch.opponent);
    expect(a.season.nextMatch.isHome).toBe(b.season.nextMatch.isHome);
    expect(a.season.position).toBe(b.season.position);
  });

  it('backfills a save written before stadiums, staff and stats existed', () => {
    const s = state() as GameState & Record<string, unknown>;
    // A genuinely old save: these keys were added after launch.
    delete (s as Record<string, unknown>).stadium;
    delete (s as Record<string, unknown>).staff;
    delete (s as Record<string, unknown>).teamStats;
    delete (s.season as Record<string, unknown>).division;

    const result = apply(s as GameState, DRAW);

    expect(s.stadium).toEqual({ level: 0, capacity: 0, amenities: 0, ticketPrice: 0, maintenanceLevel: 1 });
    expect(s.staff).toEqual({ headCoach: null, scout: null, medicalStaff: null });
    expect(s.season.division).toBe('Serie D');
    expect(s.teamStats.matchesPlayed).toBe(1);
    expect(result.weeklyWages).toBe(0);
  });

  it('places the user in the table it simulated', () => {
    const s = state();

    const result = apply(s, WIN);

    expect(result.position).toBe(s.season.position);
    expect(result.position).toBeGreaterThanOrEqual(1);
    expect(result.position).toBeLessThanOrEqual(BRAZILIAN_TEAMS.length);
  });
});

describe('deriveTurnSeed', () => {
  it('gives each turn of a match its own seed', () => {
    const seeds = DECISION_TURNS.map((_, turn) => deriveTurnSeed('match-1', turn));

    expect(new Set(seeds).size).toBe(DECISION_TURNS.length);
    expect(seeds[0]).toBe('match-1:turn:0');
  });

  it('separates matches that share a turn number', () => {
    expect(deriveTurnSeed('match-1', 2)).not.toBe(deriveTurnSeed('match-2', 2));
  });

  it('takes an integer match seed as readily as a token', () => {
    expect(deriveTurnSeed(42, 3)).toBe('42:turn:3');
  });

  it('produces seeds /api/match/decide will accept, so the live turns can use them', () => {
    // The match screen sends these to decide as the per-turn seed; if they
    // did not pass seedSchema the live turns could not be pinned at all.
    for (const matchSeed of ['abcdefghij', 'x'.repeat(52), -7, Number.MAX_SAFE_INTEGER]) {
      for (let turn = 0; turn < DECISION_TURNS.length; turn++) {
        expect(seedSchema.safeParse(deriveTurnSeed(matchSeed, turn)).success).toBe(true);
      }
    }
  });
});
