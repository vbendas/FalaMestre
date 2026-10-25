import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSquad,
  calculateTeamPower,
  simulateMatch,
  calculateExpectedGoals,
  narrativeGoalChance,
  simulateMatchSegment,
  simulateMatchWithNarrative,
  createInitialGameState,
  BRAZILIAN_TEAMS,
  PVE_TEAMS,
} from '../game-engine';
import {
  PLAYER_RATINGS,
  ATTRIBUTE_RANGES,
  SQUAD_CONSTANTS,
  POSITION_WEIGHTS,
  MATCH_CONSTANTS,
  SEASON_CONSTANTS,
} from '../constants';
import { MATCH_SETTINGS_DEFAULTS, type MatchSettings, type Player, type TurnResult } from '../types';
import { withSeed, isSeeded } from '../rng';

// Mock Math.random for deterministic tests
const mockMathRandom = (): number => 0.5;

// Seeds give us many *different* but fully reproducible squads and matches,
// so these tests exercise real variety instead of a single frozen 0.5 draw.
const SEEDS = Array.from({ length: 25 }, (_, i) => `seed-${i}`);

describe('Game Engine', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockImplementation(mockMathRandom);
  });

  describe('generateSquad', () => {
    it('should generate exactly 11 players', () => {
      const squad = generateSquad('Test Team');
      expect(squad).toHaveLength(11);
    });

    it('should have correct position distribution (1 GK, 4 DEF, 3 MID, 3 FWD)', () => {
      for (const seed of SEEDS) {
        const squad = withSeed(seed, () => generateSquad('Test Team'));
        const count = (position: Player['position']) =>
          squad.filter(p => p.position === position).length;

        expect({ GK: count('GK'), DEF: count('DEF'), MID: count('MID'), FWD: count('FWD') })
          .toEqual({ GK: 1, DEF: 4, MID: 3, FWD: 3 });
      }
    });

    it('should generate players with attributes in valid range (50-99)', () => {
      const visible = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;

      for (const seed of SEEDS) {
        const squad = withSeed(seed, () => generateSquad('Test Team'));

        squad.forEach(player => {
          visible.forEach(attr => {
            expect(player[attr]).toBeGreaterThanOrEqual(PLAYER_RATINGS.MIN);
            expect(player[attr]).toBeLessThanOrEqual(PLAYER_RATINGS.MAX);
          });
        });
      }
    });

    it('should spread visible attributes across the variance band, not just the midpoint', () => {
      // Guards the variance maths: a frozen RNG would make every player identical.
      const ratings = SEEDS.flatMap(seed =>
        withSeed(seed, () => generateSquad('Test Team')).map(p => p.pac)
      );

      expect(new Set(ratings).size).toBeGreaterThan(1);
      expect(Math.min(...ratings)).toBeGreaterThanOrEqual(
        PLAYER_RATINGS.BASE_DEF - PLAYER_RATINGS.VARIANCE
      );
      expect(Math.max(...ratings)).toBeLessThanOrEqual(
        PLAYER_RATINGS.BASE_FWD + PLAYER_RATINGS.VARIANCE
      );
    });

    it('should generate players with valid hidden attributes', () => {
      const hidden = [
        ['potential', ATTRIBUTE_RANGES.POTENTIAL],
        ['consistency', ATTRIBUTE_RANGES.CONSISTENCY],
        ['bigMatchPlayer', ATTRIBUTE_RANGES.BIG_MATCH_PLAYER],
        ['leadership', ATTRIBUTE_RANGES.LEADERSHIP],
        ['injuryProneness', ATTRIBUTE_RANGES.INJURY_PRONENESS],
      ] as const;

      for (const seed of SEEDS) {
        const squad = withSeed(seed, () => generateSquad('Test Team'));

        squad.forEach(player => {
          hidden.forEach(([attr, range]) => {
            expect(player[attr]).toBeGreaterThanOrEqual(range.MIN);
            expect(player[attr]).toBeLessThanOrEqual(range.MAX);
          });
        });
      }
    });

    it('should generate players with unique IDs', () => {
      for (const seed of SEEDS) {
        const squad = withSeed(seed, () => generateSquad('Test Team'));
        const ids = squad.map(p => p.id);

        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  });

  describe('calculateTeamPower', () => {
    it('should return a positive number', () => {
      const squad = generateSquad('Test Team');
      const power = calculateTeamPower(squad, '4-3-3', 75, 100);
      expect(power).toBeGreaterThan(0);
    });

    it('should be affected by morale', () => {
      const squad = generateSquad('Test Team');
      const highMoralePower = calculateTeamPower(squad, '4-3-3', 100, 100);
      const lowMoralePower = calculateTeamPower(squad, '4-3-3', 30, 100);
      expect(highMoralePower).toBeGreaterThan(lowMoralePower);
    });

    it('should be affected by fitness', () => {
      const squad = generateSquad('Test Team');
      const highFitnessPower = calculateTeamPower(squad, '4-3-3', 75, 100);
      const lowFitnessPower = calculateTeamPower(squad, '4-3-3', 75, 50);
      expect(highFitnessPower).toBeGreaterThan(lowFitnessPower);
    });

    it('should apply position weights correctly', () => {
      // Create squad with known attributes
      const gkOnlySquad: Player[] = [{
        id: '1',
        name: 'GK Player',
        position: 'GK',
        pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70,
        potential: 80, consistency: 70, bigMatchPlayer: 70, leadership: 70, injuryProneness: 30,
        fatigue: 100, currentForm: 'average', weeklyTrainingCount: 0, isInjured: false, injuryWeeksRemaining: 0, injuryType: null,
      }];
      
      const fwdOnlySquad: Player[] = [{
        id: '2',
        name: 'FWD Player',
        position: 'FWD',
        pac: 85, sho: 85, pas: 85, dri: 85, def: 85, phy: 85,
        potential: 90, consistency: 80, bigMatchPlayer: 80, leadership: 60, injuryProneness: 25,
        fatigue: 100, currentForm: 'average', weeklyTrainingCount: 0, isInjured: false, injuryWeeksRemaining: 0, injuryType: null,
      }];
      
      const gkPower = calculateTeamPower(gkOnlySquad, '4-3-3', 100, 100);
      const fwdPower = calculateTeamPower(fwdOnlySquad, '4-3-3', 100, 100);
      
      // FWD has higher position weight (1.2 vs 0.8), so should have higher power
      // even though it's only 1 player
      expect(fwdPower).toBeGreaterThan(gkPower);
    });

    it('should apply leadership bonus', () => {
      const highLeadershipSquad: Player[] = [{
        id: '1',
        name: 'Leader',
        position: 'MID',
        pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75,
        potential: 85, consistency: 75, bigMatchPlayer: 75, leadership: 80, injuryProneness: 30,
        fatigue: 100, currentForm: 'average', weeklyTrainingCount: 0, isInjured: false, injuryWeeksRemaining: 0, injuryType: null,
      }];
      
      const lowLeadershipSquad: Player[] = [{
        id: '2',
        name: 'Follower',
        position: 'MID',
        pac: 75, sho: 75, pas: 75, dri: 75, def: 75, phy: 75,
        potential: 85, consistency: 75, bigMatchPlayer: 75, leadership: 40, injuryProneness: 30,
        fatigue: 100, currentForm: 'average', weeklyTrainingCount: 0, isInjured: false, injuryWeeksRemaining: 0, injuryType: null,
      }];
      
      const highLeaderPower = calculateTeamPower(highLeadershipSquad, '4-3-3', 100, 100);
      const lowLeaderPower = calculateTeamPower(lowLeadershipSquad, '4-3-3', 100, 100);
      
      expect(highLeaderPower).toBeGreaterThan(lowLeaderPower);
    });
  });

  describe('simulateMatch', () => {
    // A squad of eleven clones at one rating, so a fixture's only variable is
    // how good each side is.
    const squadOf = (rating: number, tag: string): Player[] =>
      Array.from({ length: 11 }, (_, i) => ({
        id: `${tag}-${i}`,
        name: `${tag} Player ${i}`,
        position: i === 0 ? 'GK' : i <= 4 ? 'DEF' : i <= 7 ? 'MID' : 'FWD',
        pac: rating, sho: rating, pas: rating, dri: rating, def: rating, phy: rating,
        potential: 90, consistency: 75, bigMatchPlayer: 75, leadership: 60, injuryProneness: 30,
        fatigue: 100, currentForm: 'average', weeklyTrainingCount: 0,
        isInjured: false, injuryWeeksRemaining: 0, injuryType: null,
      })) as Player[];

    // One seeded match, reused by the shape assertions below.
    const playSeeded = (seed: string, week?: number) =>
      withSeed(seed, () => {
        const homeSquad = generateSquad('Home Team');
        const awaySquad = generateSquad('Away Team');
        return simulateMatch('Home Team', 'Away Team', homeSquad, awaySquad, 75, 75, week);
      });

    it('should return valid scores (non-negative integers)', () => {
      for (const seed of SEEDS) {
        const result = playSeeded(seed);

        expect(result.homeScore).toBeGreaterThanOrEqual(0);
        expect(result.awayScore).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(result.homeScore)).toBe(true);
        expect(Number.isInteger(result.awayScore)).toBe(true);
      }
    });

    it('should report the winner that the score line implies', () => {
      for (const seed of SEEDS) {
        const result = playSeeded(seed);
        const expected =
          result.homeScore > result.awayScore
            ? 'Home Team'
            : result.awayScore > result.homeScore
              ? 'Away Team'
              : 'Empate';

        expect(result.winner).toBe(expected);
      }
    });

    it('should return events array', () => {
      const result = playSeeded('seed-events');

      expect(Array.isArray(result.events)).toBe(true);
    });

    it('should keep scores inside a plausible football range', () => {
      // The power-share clamp exists to stop 15-0 blowouts.
      for (const seed of SEEDS) {
        const result = playSeeded(seed);

        expect(result.homeScore).toBeLessThanOrEqual(10);
        expect(result.awayScore).toBeLessThanOrEqual(10);
      }
    });

    it('should replay a match exactly from the same seed', () => {
      expect(playSeeded('final-2026')).toEqual(playSeeded('final-2026'));
    });

    it('should produce different matches from different seeds', () => {
      const results = SEEDS.map(seed => JSON.stringify(playSeeded(seed)));

      expect(new Set(results).size).toBeGreaterThan(1);
    });

    it('should rate a stronger squad above a weaker one', () => {
      // Create squads with very different power levels
      const strongHomeSquad: Player[] = Array(11).fill(null).map((_, i) => ({
        id: `home-${i}`,
        name: `Home Player ${i}`,
        position: i === 0 ? 'GK' : i <= 5 ? 'DEF' : i <= 8 ? 'MID' : 'FWD',
        pac: 90, sho: 90, pas: 90, dri: 90, def: 90, phy: 90,
        potential: 90, consistency: 80, bigMatchPlayer: 80, leadership: 70, injuryProneness: 20,
        fatigue: 100, currentForm: 'average', weeklyTrainingCount: 0, isInjured: false, injuryWeeksRemaining: 0, injuryType: null,
      }));
      
      const weakAwaySquad: Player[] = Array(11).fill(null).map((_, i) => ({
        id: `away-${i}`,
        name: `Away Player ${i}`,
        position: i === 0 ? 'GK' : i <= 5 ? 'DEF' : i <= 8 ? 'MID' : 'FWD',
        pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50,
        potential: 60, consistency: 60, bigMatchPlayer: 50, leadership: 40, injuryProneness: 40,
        fatigue: 100, currentForm: 'average', weeklyTrainingCount: 0, isInjured: false, injuryWeeksRemaining: 0, injuryType: null,
      }));
      
      // This only exercises calculateTeamPower — see the goal-probability
      // characterisation test below for what reaches the scoreline.
      const homePower = calculateTeamPower(strongHomeSquad, '4-3-3', 100, 100);
      const awayPower = calculateTeamPower(weakAwaySquad, '4-3-3', 100, 100);

      expect(homePower).toBeGreaterThan(awayPower * 1.5);
    });

    it('should accept a late-season week without changing the result shape', () => {
      const regular = playSeeded('big-match', 10);
      const bigMatch = playSeeded('big-match', 35);

      for (const result of [regular, bigMatch]) {
        expect(result.homeScore).toBeGreaterThanOrEqual(0);
        expect(result.awayScore).toBeGreaterThanOrEqual(0);
        expect(['Home Team', 'Away Team', 'Empate']).toContain(result.winner);
      }
    });

    it('gives the stronger squad the better of the chances', () => {
      const strong = squadOf(92, 'strong');
      const weak = squadOf(55, 'weak');

      const play = (home: Player[], away: Player[]) =>
        SEEDS.map(seed =>
          withSeed(seed, () => simulateMatch('Home Team', 'Away Team', home, away, 75, 75))
        );

      const favourite = play(strong, weak);
      const underdog = play(weak, strong);

      // The same fixture with the sides swapped must mirror, not repeat.
      expect(favourite.map(r => `${r.homeScore}-${r.awayScore}`))
        .not.toEqual(underdog.map(r => `${r.homeScore}-${r.awayScore}`));

      const goalsFor = (results: typeof favourite, side: 'home' | 'away') =>
        results.reduce((sum, r) => sum + (side === 'home' ? r.homeScore : r.awayScore), 0);

      expect(goalsFor(favourite, 'home')).toBeGreaterThan(goalsFor(favourite, 'away'));
      expect(goalsFor(underdog, 'away')).toBeGreaterThan(goalsFor(underdog, 'home'));
    });
  });

  describe('createInitialGameState', () => {
    it('should create game state with correct team', () => {
      const gameState = createInitialGameState('user_123456789', 'Leões do Norte');
      expect(gameState.user.team).toBe('Leões do Norte');
    });

    it('should start at week 1', () => {
      const gameState = createInitialGameState('user_123456789', 'Leões do Norte');
      expect(gameState.season.week).toBe(1);
    });

    it('should have default morale of 75', () => {
      const gameState = createInitialGameState('user_123456789', 'Leões do Norte');
      expect(gameState.squad.morale).toBe(SQUAD_CONSTANTS.DEFAULT_MORALE);
    });

    it('should have 11 players in squad', () => {
      const gameState = createInitialGameState('user_123456789', 'Leões do Norte');
      expect(gameState.squad.players).toHaveLength(11);
    });

    it('should have correct initial points', () => {
      const gameState = createInitialGameState('user_123456789', 'Leões do Norte');
      expect(gameState.season.points).toBe(SEASON_CONSTANTS.INITIAL_POINTS);
    });

    it('should have default formation 4-3-3', () => {
      const gameState = createInitialGameState('user_123456789', 'Leões do Norte');
      expect(gameState.squad.formation).toBe('4-3-3');
    });

    it('should have correct user ID', () => {
      const userId = 'user_123456789';
      const gameState = createInitialGameState(userId, 'Leões do Norte');
      expect(gameState.user.id).toBe(userId);
    });

    it('should start with initial money', () => {
      const gameState = createInitialGameState('user_123456789', 'Leões do Norte');
      expect(gameState.user.money).toBe(100000);
    });

    it('should have correct initial position', () => {
      const gameState = createInitialGameState('user_123456789', 'Leões do Norte');
      expect(gameState.season.position).toBe(SEASON_CONSTANTS.INITIAL_POSITION);
    });

    it('should have correct league', () => {
      const gameState = createInitialGameState('user_123456789', 'Leões do Norte');
      expect(gameState.season.league).toBe('Liga Mestre');
    });
  });

  describe('BRAZILIAN_TEAMS', () => {
    it('should have at least 6 teams defined', () => {
      expect(BRAZILIAN_TEAMS.length).toBeGreaterThanOrEqual(6);
    });

    it('should have teams with required properties', () => {
      BRAZILIAN_TEAMS.forEach(team => {
        expect(team).toHaveProperty('name');
        expect(team).toHaveProperty('city');
        expect(team).toHaveProperty('stadium');
        expect(team).toHaveProperty('primaryColor');
        expect(team).toHaveProperty('secondaryColor');
      });
    });
  });

  describe('PVE_TEAMS', () => {
    it('should be equal to BRAZILIAN_TEAMS', () => {
      expect(PVE_TEAMS).toEqual(BRAZILIAN_TEAMS);
    });
  });

  // ─── Goal probability ─────────────────────────────────────────────────────

  describe('calculateExpectedGoals', () => {
    it('splits expected goals evenly between evenly matched sides', () => {
      const { homeExpectedGoals, awayExpectedGoals, homePowerShare } = calculateExpectedGoals(1000, 1000);

      expect(homePowerShare).toBe(0.5);
      expect(homeExpectedGoals).toBeCloseTo(awayExpectedGoals, 10);
    });

    it('keeps the combined expected goals constant whatever the mismatch', () => {
      const fixtures: [number, number][] = [
        [1000, 1000], [1400, 600], [600, 1400], [2000, 100], [100, 2000], [1050, 950],
      ];

      fixtures.forEach(([home, away]) => {
        const { homeExpectedGoals, awayExpectedGoals } = calculateExpectedGoals(home, away);

        expect(homeExpectedGoals + awayExpectedGoals).toBeCloseTo(
          MATCH_CONSTANTS.EXPECTED_GOALS_PER_MATCH, 10
        );
      });
    });

    it('gives the stronger side the larger share', () => {
      const { homeExpectedGoals, awayExpectedGoals } = calculateExpectedGoals(1400, 600);

      expect(homeExpectedGoals).toBeGreaterThan(awayExpectedGoals);
    });

    it('turns home advantage into a real edge between equal squads', () => {
      // This is how HOME_ADVANTAGE_MULTIPLIER reaches the scoreline.
      const power = 1000;
      const { homeExpectedGoals, awayExpectedGoals } = calculateExpectedGoals(
        power * MATCH_CONSTANTS.HOME_ADVANTAGE_MULTIPLIER,
        power
      );

      expect(homeExpectedGoals).toBeGreaterThan(awayExpectedGoals);
    });

    it('clamps the share so no fixture becomes a certainty', () => {
      const lopsided = calculateExpectedGoals(100000, 1);
      const reversed = calculateExpectedGoals(1, 100000);

      expect(lopsided.homePowerShare).toBe(MATCH_CONSTANTS.MAX_POWER_SHARE);
      expect(reversed.homePowerShare).toBe(MATCH_CONSTANTS.MIN_POWER_SHARE);
      expect(lopsided.awayExpectedGoals).toBeGreaterThan(0);
      expect(reversed.homeExpectedGoals).toBeGreaterThan(0);
    });

    it('spreads a side\'s expected goals over its narrative ticks exactly', () => {
      // Summing the per-tick chance over the ticks a side attacks on must give
      // back that side's expected goals, for either side, whatever the weighting.
      const { DURATION_MINUTES, NARRATIVE_TICK_MINUTES } = MATCH_CONSTANTS;
      const sideExpectedGoals = 1.35;

      for (const isHomeTurn of [true, false]) {
        let total = 0;
        for (let tick = NARRATIVE_TICK_MINUTES; tick <= DURATION_MINUTES; tick += NARRATIVE_TICK_MINUTES) {
          if ((tick % 2 === 1) !== isHomeTurn) continue;
          total += narrativeGoalChance(tick, isHomeTurn, sideExpectedGoals);
        }
        expect(total).toBeCloseTo(sideExpectedGoals, 10);
      }
    });

    it('weights narrative goals towards the closing half-hour', () => {
      expect(narrativeGoalChance(85, true, 1.35)).toBeGreaterThan(narrativeGoalChance(25, true, 1.35));
    });

    it('falls back to an even split on degenerate power values', () => {
      [[0, 0], [Number.NaN, 1000], [1000, Number.NaN]].forEach(([home, away]) => {
        const { homeExpectedGoals, awayExpectedGoals, homePowerShare } = calculateExpectedGoals(home, away);

        expect(homePowerShare).toBe(0.5);
        expect(Number.isFinite(homeExpectedGoals)).toBe(true);
        expect(Number.isFinite(awayExpectedGoals)).toBe(true);
      });
    });
  });

  // ─── Strength on the live match path ──────────────────────────────────────
  //
  // simulateMatchWithNarrative is what /api/match runs. These are statistical
  // but not flaky: every match is drawn from a fixed seed, so the totals below
  // are the same on every run.

  describe('squad strength decides matches', () => {
    const MANY_SEEDS = Array.from({ length: 150 }, (_, i) => `match-${i}`);

    const squadOf = (rating: number, tag: string): Player[] =>
      Array.from({ length: 11 }, (_, i) => ({
        id: `${tag}-${i}`,
        name: `${tag} Player ${i}`,
        position: i === 0 ? 'GK' : i <= 4 ? 'DEF' : i <= 7 ? 'MID' : 'FWD',
        pac: rating, sho: rating, pas: rating, dri: rating, def: rating, phy: rating,
        potential: 90, consistency: 75, bigMatchPlayer: 75, leadership: 60, injuryProneness: 30,
        fatigue: 100, currentForm: 'average', weeklyTrainingCount: 0,
        isInjured: false, injuryWeeksRemaining: 0, injuryType: null,
      })) as Player[];

    const season = (home: Player[], away: Player[], week?: number) => {
      const results = MANY_SEEDS.map(seed =>
        withSeed(seed, () =>
          simulateMatchWithNarrative('Home Team', 'Away Team', home, away, 75, 75, week)
        )
      );

      return {
        homeWins: results.filter(r => r.homeScore > r.awayScore).length,
        awayWins: results.filter(r => r.awayScore > r.homeScore).length,
        homeGoals: results.reduce((sum, r) => sum + r.homeScore, 0),
        awayGoals: results.reduce((sum, r) => sum + r.awayScore, 0),
        goalsPerMatch: results.reduce((sum, r) => sum + r.homeScore + r.awayScore, 0) / results.length,
        lines: results.map(r => `${r.homeScore}-${r.awayScore}`),
      };
    };

    const strong = squadOf(92, 'strong');
    const weak = squadOf(55, 'weak');

    it('lets a strong home side beat a weak one more often than it loses', () => {
      const { homeWins, awayWins, homeGoals, awayGoals } = season(strong, weak);

      expect(homeWins).toBeGreaterThan(awayWins * 1.5);
      expect(homeGoals).toBeGreaterThan(awayGoals);
    });

    it('lets a strong away side beat a weak home one more often than it loses', () => {
      // Away form matters too: strength has to outweigh home advantage.
      const { homeWins, awayWins, homeGoals, awayGoals } = season(weak, strong);

      expect(awayWins).toBeGreaterThan(homeWins * 1.5);
      expect(awayGoals).toBeGreaterThan(homeGoals);
    });

    it('does not simply mirror the fixture when the sides are swapped', () => {
      expect(season(strong, weak).lines).not.toEqual(season(weak, strong).lines);
    });

    it('lets morale swing a fixture between identical squads', () => {
      const even = [squadOf(75, 'a'), squadOf(75, 'b')] as const;
      const level = MANY_SEEDS.map(seed =>
        withSeed(seed, () => simulateMatchWithNarrative('H', 'A', even[0], even[1], 75, 75))
      );
      const homeOnTop = MANY_SEEDS.map(seed =>
        withSeed(seed, () => simulateMatchWithNarrative('H', 'A', even[0], even[1], 100, 40))
      );

      const goals = (rs: typeof level, side: 'homeScore' | 'awayScore') =>
        rs.reduce((sum, r) => sum + r[side], 0);

      expect(goals(homeOnTop, 'homeScore')).toBeGreaterThan(goals(level, 'homeScore'));
    });

    it('feeds the big-match bonus into late-season fixtures', () => {
      // Same seeds and squads; only the week differs, so any change to the
      // results can only have come through the big-match bonus.
      const bigMatchSquad = squadOf(75, 'clutch').map(p => ({ ...p, bigMatchPlayer: 95 }));
      const flatSquad = squadOf(75, 'flat').map(p => ({ ...p, bigMatchPlayer: 50 }));

      const earlySeason = season(bigMatchSquad, flatSquad, 10);
      const lateSeason = season(bigMatchSquad, flatSquad, 35);

      expect(lateSeason.lines).not.toEqual(earlySeason.lines);
    });

    it('produces a realistic scoreline: about EXPECTED_GOALS_PER_MATCH goals a match', () => {
      const even = season(squadOf(75, 'a'), squadOf(75, 'b'));
      const target = MATCH_CONSTANTS.EXPECTED_GOALS_PER_MATCH;

      expect(even.goalsPerMatch).toBeGreaterThan(target * 0.85);
      expect(even.goalsPerMatch).toBeLessThan(target * 1.15);
    });

    it('moves goals to the stronger side without adding to the total', () => {
      const even = season(squadOf(75, 'a'), squadOf(75, 'b'));
      const lopsided = season(strong, weak);

      expect(Math.abs(lopsided.goalsPerMatch - even.goalsPerMatch)).toBeLessThan(0.4);
    });

    it('does not let the commentary density setting change how many goals are scored', () => {
      const home = squadOf(75, 'a');
      const away = squadOf(75, 'b');
      const goalsAt = (eventDensity: MatchSettings['eventDensity']) =>
        MANY_SEEDS.reduce((sum, seed) => {
          const r = withSeed(seed, () =>
            simulateMatchWithNarrative('H', 'A', home, away, 75, 75, undefined, {
              ...MATCH_SETTINGS_DEFAULTS,
              eventDensity,
            })
          );
          return sum + r.homeScore + r.awayScore;
        }, 0) / MANY_SEEDS.length;

      const minimal = goalsAt('minimal');
      const maximum = goalsAt('maximum');

      // Different density means a different event stream, so the samples are
      // not identical — but both must sit on the same expected rate.
      expect(Math.abs(minimal - maximum)).toBeLessThan(0.4);
    });
  });

  // ─── Seeded replay ────────────────────────────────────────────────────────
  //
  // These cover the two simulators the app actually runs:
  // simulateMatchWithNarrative (the /api/match path) and simulateMatchSegment
  // (the turn-based flow). Before the engine drew from a seedable source,
  // nothing here could be asserted exactly.

  describe('seeded replay', () => {
    const PRIOR_STATE = {
      homeScore: 0,
      awayScore: 0,
      homeMomentum: 50,
      awayMomentum: 50,
      tension: 50,
    };

    // Event ids come from crypto.randomUUID(), which is deliberately outside
    // the seeded stream — ids are identity, not match content. Compare the
    // rest, which is what "the same match" actually means.
    const withoutIds = <T extends { events: { id: string }[] }>(result: T) => ({
      ...result,
      events: result.events.map(({ id: _id, ...event }) => event),
    });

    const playNarrative = (seed: string) =>
      withSeed(seed, () => {
        const homeSquad = generateSquad('Home Team');
        const awaySquad = generateSquad('Away Team');
        return simulateMatchWithNarrative('Home Team', 'Away Team', homeSquad, awaySquad, 75, 75);
      });

    const playSegment = (seed: string, turnResult?: TurnResult) =>
      withSeed(seed, () => {
        const homeSquad = generateSquad('Home Team');
        const awaySquad = generateSquad('Away Team');
        return simulateMatchSegment(
          'Home Team', 'Away Team', homeSquad, awaySquad, 75, 75,
          15, 45, PRIOR_STATE, turnResult
        );
      });

    it('replays a narrative match exactly, commentary included', () => {
      const first = playNarrative('classico-2026');
      const second = playNarrative('classico-2026');

      expect(withoutIds(first)).toEqual(withoutIds(second));
      expect(first.events.length).toBeGreaterThan(0);
    });

    it('replays a squad exactly, down to player ids and names', () => {
      const first = withSeed('squad-7', () => generateSquad('Leões do Norte'));
      const second = withSeed('squad-7', () => generateSquad('Leões do Norte'));

      expect(first).toEqual(second);
    });

    it('replays a whole initial game state exactly', () => {
      const first = withSeed('save-1', () => createInitialGameState('user_1', 'Leões do Norte'));
      const second = withSeed('save-1', () => createInitialGameState('user_1', 'Leões do Norte'));

      expect(first.squad).toEqual(second.squad);
      expect(first.season).toEqual(second.season);
    });

    it('produces different matches for different seeds', () => {
      const lines = SEEDS.map(seed => {
        const r = playNarrative(seed);
        return `${r.homeScore}-${r.awayScore}`;
      });

      expect(new Set(lines).size).toBeGreaterThan(1);
    });

    it('replays a match segment exactly', () => {
      expect(withoutIds(playSegment('segment-3'))).toEqual(withoutIds(playSegment('segment-3')));
    });

    it('keeps segment events inside (fromMinute, toMinute] and never un-scores a goal', () => {
      // The boundary minute belongs to the segment that ends on it, so the six
      // chained segments of a turn-based match play exactly 90 minutes.
      for (const seed of SEEDS) {
        const { events, endState } = playSegment(seed);

        events.forEach(event => {
          expect(event.minute).toBeGreaterThan(15);
          expect(event.minute).toBeLessThanOrEqual(45);
        });

        expect(endState.homeScore).toBeGreaterThanOrEqual(PRIOR_STATE.homeScore);
        expect(endState.awayScore).toBeGreaterThanOrEqual(PRIOR_STATE.awayScore);
      }
    });

    it('lets a defensive turn decision change the segment it is applied to', () => {
      const goDefensive: TurnResult = {
        turnNumber: 1,
        minute: 15,
        decision: {
          id: 'turn_1_defensive',
          label: 'Proteger resultado',
          description: 'Mudar para mentalidade defensiva.',
          icon: '🛡️',
          action: 'change_mentality',
          category: 'mentality',
          mentality: 'defensive',
        },
        wasDefault: false,
        mentalityShift: 'defensive',
      };

      // Same seeds, same squads — the only difference is the decision, which
      // multiplies the post-cap goal probabilities (MENTALITY_MODIFIERS).
      const plain = SEEDS.map(seed => JSON.stringify(withoutIds(playSegment(seed))));
      const defensive = SEEDS.map(seed => JSON.stringify(withoutIds(playSegment(seed, goDefensive))));

      expect(defensive).not.toEqual(plain);
    });

    it('leaves normal play unseeded so Math.random still drives it', () => {
      // Guards the promise that seeding is opt-in: outside withSeed the engine
      // must go through Math.random exactly as it did before.
      expect(isSeeded()).toBe(false);

      const spy = vi.spyOn(Math, 'random');
      spy.mockClear();
      generateSquad('Test Team');

      expect(spy).toHaveBeenCalled();
    });

    it('restores the previous source even when the simulation throws', () => {
      expect(() =>
        withSeed('boom', () => {
          throw new Error('match abandoned');
        })
      ).toThrow('match abandoned');

      expect(isSeeded()).toBe(false);
    });
  });
});
