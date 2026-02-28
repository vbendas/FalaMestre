/**
 * Game constants for Fala Mestre!
 * Centralized configuration values to avoid magic numbers
 */

import { MatchSettings } from './types';

// Match simulation constants
export const MATCH_CONSTANTS = {
  DURATION_MINUTES: 90,
  HOME_ADVANTAGE_MULTIPLIER: 1.1,
  BASE_HOME_GOAL_PROBABILITY: 0.1,
  BASE_AWAY_GOAL_PROBABILITY: 0.05,
  MAX_GOAL_PROBABILITY: 0.4,
  YELLOW_CARD_PROBABILITY: 0.0015,
  RED_CARD_PROBABILITY: 0.0003,
} as const;

// Player rating constraints
export const PLAYER_RATINGS = {
  MIN: 50,
  MAX: 99,
  BASE_GK: 70,
  BASE_DEF: 68,
  BASE_MID: 72,
  BASE_FWD: 75,
  VARIANCE: 7,
} as const;

// Squad constraints
export const SQUAD_CONSTANTS = {
  SIZE: 11,
  MIN_MORALE: 30,
  MAX_MORALE: 100,
  MIN_FITNESS: 0,
  MAX_FITNESS: 100,
  DEFAULT_MORALE: 75,
  DEFAULT_FITNESS: 100,
  FORMATION: '4-3-3',
  POSITIONS: {
    GK: 1,
    DEF: 4,
    MID: 3,
    FWD: 3,
  },
} as const;

// Season constants
export const SEASON_CONSTANTS = {
  TOTAL_ROUNDS: 38,
  INITIAL_POSITION: 10,
  INITIAL_POINTS: 0,
  WIN_POINTS: 3,
  DRAW_POINTS: 1,
  LOSS_POINTS: 0,
  WIN_SOCIOS_POINTS: 100,
  DRAW_SOCIOS_POINTS: 50,
  LOSS_SOCIOS_POINTS: 20,
} as const;

// Points and rewards
export const REWARD_CONSTANTS = {
  MATCH_WIN_POINTS: 100,
  MATCH_DRAW_POINTS: 50,
  MATCH_LOSS_POINTS: 20,
  MORALE_CHANGE_WIN: 10,
  MORALE_CHANGE_DRAW: 0,
  MORALE_CHANGE_LOSS: -10,
  MORALE_MIN: 30,
  MORALE_MAX: 100,
} as const;

// Position weights for team power calculation
export const POSITION_WEIGHTS = {
  GK: 0.8,
  DEF: 1.0,
  MID: 1.1,
  FWD: 1.2,
} as const;

// Hidden attribute ranges
export const ATTRIBUTE_RANGES = {
  POTENTIAL: { MIN: 80, MAX: 95 },
  CONSISTENCY: { MIN: 60, MAX: 90 },
  BIG_MATCH_PLAYER: { MIN: 50, MAX: 90 },
  LEADERSHIP: { MIN: 40, MAX: 80 },
  INJURY_PRONENESS: { MIN: 20, MAX: 50 },
} as const;

// Opponent settings
export const OPPONENT_CONSTANTS = {
  MIN_MORALE: 55,
  MAX_MORALE: 85,
} as const;

// API and timing constants
export const API_CONSTANTS = {
  AI_TIMEOUT_MS: 8000,
  MOCK_LATENCY_MIN: 300,
  MOCK_LATENCY_MAX: 800,
} as const;

// User ID format
export const USER_ID_FORMAT = {
  PREFIX: 'user',
  LENGTH: 9,
  PATTERN: /^user_[a-z0-9]{9}$/,
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  MESSAGE_MAX_LENGTH: 2000,
  USER_ID_MAX_LENGTH: 100,
} as const;

// Event density configuration
export const EVENT_DENSITY_CONFIG = {
  minimal: { 
    eventMultiplier: 0.3, 
    throttleLimit: 1, 
    throttleWindow: 5,
    description: '30% events - Relaxed pace',
  },
  standard: { 
    eventMultiplier: 0.5, 
    throttleLimit: 2, 
    throttleWindow: 5,
    description: '50% events - Balanced',
  },
  enhanced: { 
    eventMultiplier: 0.8, 
    throttleLimit: 3, 
    throttleWindow: 5,
    description: '80% events - Intense',
  },
  maximum: { 
    eventMultiplier: 1.0, 
    throttleLimit: 5, 
    throttleWindow: 5,
    description: '100% events - Full action',
  },
} as const;

// Animation quality configuration
export const ANIMATION_CONFIG = {
  low: {
    duration: 0.2,
    springPhysics: false,
    complexAnimations: false,
    enableLottie: false,
    maxSimultaneousAnimations: 2,
    description: 'Performance optimized',
  },
  medium: {
    duration: 0.3,
    springPhysics: true,
    complexAnimations: true,
    enableLottie: true,
    maxSimultaneousAnimations: 5,
    description: 'Balanced quality',
  },
  high: {
    duration: 0.5,
    springPhysics: true,
    complexAnimations: true,
    enableLottie: true,
    maxSimultaneousAnimations: 10,
    description: 'Best visual experience',
  },
} as const;

// Narration speed configuration (milliseconds per match minute)
export const NARRATION_SPEED_CONFIG = {
  slow: { msPerMinute: 400, description: 'Slow - Easy to follow' },
  normal: { msPerMinute: 200, description: 'Normal - Balanced' },
  fast: { msPerMinute: 100, description: 'Fast - Quick games' },
} as const;
