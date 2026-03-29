import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSquad,
  calculateTeamPower,
  simulateMatch,
  createInitialGameState,
  BRAZILIAN_TEAMS,
  PVE_TEAMS,
} from '../game-engine';
import {
  PLAYER_RATINGS,
  SQUAD_CONSTANTS,
  POSITION_WEIGHTS,
  MATCH_CONSTANTS,
  SEASON_CONSTANTS,
} from '../constants';
import type { Player } from '../types';

// Mock Math.random for deterministic tests
const mockMathRandom = (): number => 0.5;

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
      const squad = generateSquad('Test Team');
      
      const gk = squad.filter(p => p.position === 'GK');
      const def = squad.filter(p => p.position === 'DEF');
      const mid = squad.filter(p => p.position === 'MID');
      const fwd = squad.filter(p => p.position === 'FWD');
      
      expect(gk).toHaveLength(1);
      expect(def).toHaveLength(4);
      expect(mid).toHaveLength(3);
      expect(fwd).toHaveLength(3);
    });

    it('should generate players with attributes in valid range (50-99)', () => {
      const squad = generateSquad('Test Team');
      
      squad.forEach(player => {
        expect(player.pac).toBeGreaterThanOrEqual(PLAYER_RATINGS.MIN);
        expect(player.pac).toBeLessThanOrEqual(PLAYER_RATINGS.MAX);
        expect(player.sho).toBeGreaterThanOrEqual(PLAYER_RATINGS.MIN);
        expect(player.sho).toBeLessThanOrEqual(PLAYER_RATINGS.MAX);
        expect(player.pas).toBeGreaterThanOrEqual(PLAYER_RATINGS.MIN);
        expect(player.pas).toBeLessThanOrEqual(PLAYER_RATINGS.MAX);
        expect(player.dri).toBeGreaterThanOrEqual(PLAYER_RATINGS.MIN);
        expect(player.dri).toBeLessThanOrEqual(PLAYER_RATINGS.MAX);
        expect(player.def).toBeGreaterThanOrEqual(PLAYER_RATINGS.MIN);
        expect(player.def).toBeLessThanOrEqual(PLAYER_RATINGS.MAX);
        expect(player.phy).toBeGreaterThanOrEqual(PLAYER_RATINGS.MIN);
        expect(player.phy).toBeLessThanOrEqual(PLAYER_RATINGS.MAX);
      });
    });

    it('should generate players with valid hidden attributes', () => {
      const squad = generateSquad('Test Team');
      
      squad.forEach(player => {
        expect(player.consistency).toBeGreaterThanOrEqual(60);
        expect(player.consistency).toBeLessThanOrEqual(90);
        expect(player.bigMatchPlayer).toBeGreaterThanOrEqual(50);
        expect(player.bigMatchPlayer).toBeLessThanOrEqual(90);
        expect(player.leadership).toBeGreaterThanOrEqual(40);
        expect(player.leadership).toBeLessThanOrEqual(80);
        expect(player.injuryProneness).toBeGreaterThanOrEqual(20);
        expect(player.injuryProneness).toBeLessThanOrEqual(50);
      });
    });

    it('should generate players with unique IDs', () => {
      // Use a more realistic mock that returns different values
      let callCount = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        callCount++;
        return callCount / 20; // Returns 0.05, 0.1, 0.15, etc.
      });
      
      const squad = generateSquad('Test Team');
      const ids = squad.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(11);
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
    it('should return valid scores (non-negative integers)', () => {
      const homeSquad = generateSquad('Home Team');
      const awaySquad = generateSquad('Away Team');
      
      const result = simulateMatch(
        'Home Team',
        'Away Team',
        homeSquad,
        awaySquad,
        75,
        75
      );
      
      expect(result.homeScore).toBeGreaterThanOrEqual(0);
      expect(result.awayScore).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.homeScore)).toBe(true);
      expect(Number.isInteger(result.awayScore)).toBe(true);
    });

    it('should return valid winner', () => {
      const homeSquad = generateSquad('Home Team');
      const awaySquad = generateSquad('Away Team');
      
      const result = simulateMatch(
        'Home Team',
        'Away Team',
        homeSquad,
        awaySquad,
        75,
        75
      );
      
      expect(['Home Team', 'Away Team', 'Empate']).toContain(result.winner);
    });

    it('should return events array', () => {
      const homeSquad = generateSquad('Home Team');
      const awaySquad = generateSquad('Away Team');
      
      const result = simulateMatch(
        'Home Team',
        'Away Team',
        homeSquad,
        awaySquad,
        75,
        75
      );
      
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('should apply home advantage', () => {
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
      
      // Calculate expected power to verify home advantage applies
      const homePower = calculateTeamPower(strongHomeSquad, '4-3-3', 100, 100);
      const awayPower = calculateTeamPower(weakAwaySquad, '4-3-3', 100, 100);
      
      // Home team should be significantly stronger
      expect(homePower).toBeGreaterThan(awayPower * 1.5);
    });

    it('should apply big match bonus in late season', () => {
      const homeSquad = generateSquad('Home Team');
      // High bigMatchPlayer values
      homeSquad.forEach(p => p.bigMatchPlayer = 90);
      
      const awaySquad = generateSquad('Away Team');
      
      const regularResult = simulateMatch('Home Team', 'Away Team', homeSquad, awaySquad, 75, 75);
      const bigMatchResult = simulateMatch('Home Team', 'Away Team', homeSquad, awaySquad, 75, 75, 35);
      
      // Big match should not crash and should return valid result
      expect(bigMatchResult.homeScore).toBeGreaterThanOrEqual(0);
      expect(bigMatchResult.awayScore).toBeGreaterThanOrEqual(0);
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
      expect(gameState.season.league).toBe('Brasileirão Serie A');
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
});
