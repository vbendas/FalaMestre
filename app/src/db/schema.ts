import { pgTable, uuid, text, integer, jsonb, timestamp, boolean, date, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
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
  // Bumped on every write that changes `current_state`: by `commitSave` and
  // `adjustMoney` (src/lib/save-store.ts), which every route goes through,
  // and as a backstop by a trigger (drizzle/0001_game_state_version.sql) for
  // any write that sets the column without them. A route that read the save
  // at version N writes it back only if the row is still at N, so two
  // actions overlapping on one save cannot silently lose one of them.
  version: integer('version').notNull().default(1),
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
  // The player whose fixture this market is on. Every player's season is
  // their own, so a fixture belongs to one save. Nullable only so a database
  // that already holds rows from before the column takes the migration.
  userId: text('user_id'),
  // Which fixture of the player's career: `round-<week>` in the first
  // season, `s<n>-round-<week>` after it (fixtureMatchId in
  // src/lib/fixture-markets.ts).
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
  // When the fixture kicked off: the first time the server played any of it
  // (a decision turn, a one-shot match or a finalize). The market stops
  // taking bets at that moment, before a single score has been shown.
  kickedOffAt: timestamp('kicked_off_at'),
  // The real result, home side first, written once when the match is banked
  // (src/lib/market-settlement.ts). Settlement reads it from here, never
  // from a caller. Null until the match has been banked.
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
}, (table) => [
  // One market per fixture. Markets are opened from more than one place (a
  // new save, a banked match, the bets screen catching up) and any of them
  // can run twice; the second insert hits this index and adds nothing.
  uniqueIndex('predictions_one_per_fixture').on(table.userId, table.matchId),
]);

// A fixture once it has kicked off: the one seed it is played under, how it
// is being played, the squad as it stood at kickoff, and each decision once
// it has been played. Written at the first moment the server plays any of
// the match, and never changed after, so an abandoned match replays as it
// went the first time (see src/lib/fixture-kickoff.ts).
export const fixtureKickoffs = pgTable('fixture_kickoffs', {
  userId: text('user_id').notNull(),
  // Which season of the save, and which round of it (`season.number`,
  // `season.week`): every season reuses the round numbers.
  season: integer('season').notNull().default(1),
  round: integer('round').notNull(),
  // Drawn by the server. The client's seed is never used for a fixture.
  seed: text('seed').notNull(),
  // 'turns' (decide/finalize) or 'quick' (/api/match and its stream). The
  // two play different football from one seed, so a fixture is one or the
  // other.
  mode: text('mode').notNull(),
  // What the match is played from: formation, players, morale with the
  // investment bonus, match settings. Taken at kickoff, so nothing done to
  // the save mid-match changes the football.
  setup: jsonb('setup').notNull(),
  // Turn number -> decision id (null for the timer), first one played wins.
  decisions: jsonb('decisions').notNull().default({}),
  kickedOffAt: timestamp('kicked_off_at').defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.season, table.round] }),
]);

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
  // What settlement actually credited: potential_win for a winner that was
  // paid, 0 for a loser. Null until the bet is settled.
  payout: integer('payout'),
  settledAt: timestamp('settled_at'),
  createdAt: timestamp('created_at').defaultNow(),
  // No longer written. Settlement used to claim a bet here, then pay it,
  // then mark it, and a run that died in between left the claim for ever
  // with no telling whether the money had gone out. Paying and marking are
  // now one statement (src/lib/market-settlement.ts); a bet that still
  // carries a claim is one of those, left for someone to look at.
  settlingAt: timestamp('settling_at'),
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
  // The day (UTC) this yield pays for. The unique index below is what makes
  // the daily cron idempotent: a second run on the same day hits the index
  // and inserts nothing, where it used to pay every investment again. Null on
  // rows from before the column existed, which the index then ignores.
  yieldDate: date('yield_date'),
  // Money the player lost to the 7-day window. Its own flag, not `claimed`:
  // the expiry sweep used to book a lost yield as claimed with a timestamp,
  // indistinguishable from money actually paid out.
  expired: boolean('expired').default(false).notNull(),
}, (table) => [
  uniqueIndex('investment_yields_one_per_day').on(table.investmentId, table.yieldDate),
]);

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
