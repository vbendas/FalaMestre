import { pgTable, uuid, text, integer, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import type { GameState, Message } from '@/lib/types';

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  username: text('username'),
  createdAt: timestamp('created_at').defaultNow(),
  onboardingCompleted: boolean('onboarding_completed').default(false),
});

// Game states - stores complete game state as JSON
export const gameStates = pgTable('game_states', {
  userId: text('user_id').primaryKey(),
  team: text('team').notNull(),
  currentState: jsonb('current_state').$type<GameState>().notNull(),
  conversationHistory: jsonb('conversation_history').$type<Message[]>(),
  statistics: jsonb('statistics'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Conversations - stores individual messages for analytics
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'),
  messageType: text('message_type'), // 'user' or 'ai'
  content: text('content'),
  intent: text('intent'),
  gameStateSnapshot: jsonb('game_state_snapshot'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Analytics events - first-party gameplay telemetry (stays in this database)
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'),
  eventType: text('event_type'),
  properties: jsonb('properties'),
  sessionId: text('session_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// =====================================================
// PREDICTION MARKET TABLES
// =====================================================

// Predictions for upcoming matches
export const predictions = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: text('match_id').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  type: text('type').notNull(), // 'win_draw_loss', 'first_scorer', 'clean_sheet', 'score_range'
  options: jsonb('options').notNull(), // Array of {id, label, odds, totalBets}
  entryCost: integer('entry_cost').notNull(),
  deadline: timestamp('deadline').notNull(),
  status: text('status').notNull().default('open'), // 'open', 'closed', 'settled'
  settledAt: timestamp('settled_at'),
  matchDate: timestamp('match_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// User bets on predictions
export const userBets = pgTable('user_bets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  predictionId: uuid('prediction_id').notNull(),
  optionId: text('option_id').notNull(),
  amount: integer('amount').notNull(),
  potentialWin: integer('potential_win').notNull(),
  settled: boolean('settled').default(false),
  won: boolean('won'),
  settledAt: timestamp('settled_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// User prediction history and stats
export const predictionHistory = pgTable('prediction_history', {
  userId: text('user_id').primaryKey(),
  totalBets: integer('total_bets').default(0),
  correctBets: integer('correct_bets').default(0),
  currentStreak: integer('current_streak').default(0),
  bestStreak: integer('best_streak').default(0),
  expertLevel: integer('expert_level').default(0),
  totalWinnings: integer('total_winnings').default(0),
  lastBetAt: timestamp('last_bet_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// =====================================================
// FAN CLUB INVESTMENT TABLES
// =====================================================

// User fan club investments
export const fanClubInvestments = pgTable('fan_club_investments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  option: text('option').notNull(), // 'A', 'B', 'C'
  amount: integer('amount').notNull(),
  startDate: timestamp('start_date').notNull(),
  unlockDate: timestamp('unlock_date').notNull(),
  yieldPerDay: integer('yield_per_day').notNull(),
  moraleBoost: integer('morale_boost').notNull(),
  revenueBoostPerMatch: integer('revenue_boost_per_match').notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Generated yields from investments
export const investmentYields = pgTable('investment_yields', {
  id: uuid('id').primaryKey().defaultRandom(),
  investmentId: uuid('investment_id').notNull(),
  userId: text('user_id').notNull(),
  amount: integer('amount').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  claimed: boolean('claimed').default(false),
  claimedAt: timestamp('claimed_at'),
  expiryDate: timestamp('expiry_date').notNull(),
});

// =====================================================
// TOURNAMENT TICKET TABLES
// =====================================================

// User tournament tickets
export const tournamentTickets = pgTable('tournament_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  tournamentId: text('tournament_id').notNull(),
  earned: boolean('earned').default(false),
  earnedAt: timestamp('earned_at'),
  used: boolean('used').default(false),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// =====================================================
// ELITE CONTENT TABLES
// =====================================================

// User elite content unlocks
export const eliteContent = pgTable('elite_content', {
  userId: text('user_id').primaryKey(),
  eliteTrainingUnlocked: boolean('elite_training_unlocked').default(false),
  eliteTrainingUnlockedAt: timestamp('elite_training_unlocked_at'),
  eliteTrainingUsesRemaining: integer('elite_training_uses_remaining'),
  fastRecoveryUnlocked: boolean('fast_recovery_unlocked').default(false),
  fastRecoveryUnlockedAt: timestamp('fast_recovery_unlocked_at'),
  activeInjuriesFastTracked: jsonb('active_injuries_fast_tracked'), // Player IDs
  updatedAt: timestamp('updated_at').defaultNow(),
});

// =====================================================
// PHASE PROGRESS TABLE
// =====================================================

// Track user progress through gameplay unlock phases
export const phaseProgress = pgTable('phase_progress', {
  userId: text('user_id').primaryKey(),
  currentPhase: integer('current_phase').notNull().default(1),
  phase2Unlocked: boolean('phase2_unlocked').default(false),
  phase2UnlockedAt: timestamp('phase2_unlocked_at'),
  phase3Unlocked: boolean('phase3_unlocked').default(false),
  phase3UnlockedAt: timestamp('phase3_unlocked_at'),
  phase4Unlocked: boolean('phase4_unlocked').default(false),
  phase4UnlockedAt: timestamp('phase4_unlocked_at'),
  totalMatches: integer('total_matches').default(0),
  totalPredictions: integer('total_predictions').default(0),
  predictionsWon: integer('predictions_won').default(0),
  totalInvestmentMade: integer('total_investment_made').default(0),
  hoursPlayed: integer('hours_played').default(0),
  lastUpdated: timestamp('last_updated').defaultNow(),
});
