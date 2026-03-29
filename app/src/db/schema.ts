import { pgTable, uuid, text, integer, jsonb, timestamp, boolean, real, customType } from 'drizzle-orm/pg-core';
import type { GameState, Message } from '@/lib/types';

// Custom vector type for pgvector (256 dimensions for embeddings)
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() { return 'vector(256)'; },
  toDriver(value: number[]) { return `[${value.join(',')}]`; },
  fromDriver(value: string) {
    return value.replace(/[\[\]]/g, '').split(',').map(Number);
  },
});

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  username: text('username'),
  createdAt: timestamp('created_at').defaultNow(),
  sociosId: text('socios_id'),
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

// Analytics events - for behavioral tracking
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'),
  eventType: text('event_type'),
  properties: jsonb('properties'),
  sessionId: text('session_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// User clusters - for behavioral segmentation
export const userClusters = pgTable('user_clusters', {
  userId: text('user_id').primaryKey(),
  primaryCluster: text('primary_cluster'),
  clusterScores: jsonb('cluster_scores'),
  behaviorProfile: jsonb('behavior_profile'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Enhanced user profiles - comprehensive behavioral and identity data
export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  emailHash: text('email_hash'),
  phoneHash: text('phone_hash'),
  walletAddress: text('wallet_address'),
  totalMatches: integer('total_matches').default(0),
  totalPoints: integer('total_points').default(0),
  sessionsCount: integer('sessions_count').default(0),
  avgSessionDurationSec: integer('avg_session_duration_sec').default(0),
  daysActive: integer('days_active').default(0),
  lastActiveAt: timestamp('last_active_at'),
  matchWinRate: real('match_win_rate').default(0),
  transfersMade: integer('transfers_made').default(0),
  aggressivenessScore: integer('aggressiveness_score').default(50),
  spendingScore: integer('spending_score').default(50),
  socialScore: integer('social_score').default(50),
  competitivenessScore: integer('competitiveness_score').default(50),
  softTrainingScore: integer('soft_training_score').default(0),
  softTrainingPhase: integer('soft_training_phase').default(0),
  personalityOpenness: real('personality_openness'),
  personalityConscientiousness: real('personality_conscientiousness'),
  personalityExtraversion: real('personality_extraversion'),
  personalityAgreeableness: real('personality_agreeableness'),
  personalityNeuroticism: real('personality_neuroticism'),
  personalityConfidence: real('personality_confidence').default(0),
  personalityLastAssessedAt: timestamp('personality_last_assessed_at'),
  walletArchetype: text('wallet_archetype'),
  fanTokenBalance: jsonb('fan_token_balance'),
  walletConnectedAt: timestamp('wallet_connected_at'),
  primaryCluster: text('primary_cluster'),
  secondaryCluster: text('secondary_cluster'),
  clusterScores: jsonb('cluster_scores'),
  purchaseIntentScore: integer('purchase_intent_score').default(0),
  churnRiskScore: real('churn_risk_score').default(0.5),
  ltvEstimate: real('ltv_estimate').default(0),
  hotLeadTier: integer('hot_lead_tier'),
  activeSegments: jsonb('active_segments'),
  consentMarketing: boolean('consent_marketing').default(false),
  consentAnalytics: boolean('consent_analytics').default(true),
  consentDataExport: boolean('consent_data_export').default(false),
  consentUpdatedAt: timestamp('consent_updated_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Audience sync log - tracks what was sent to ad platforms
export const audienceSyncLog = pgTable('audience_sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  segmentId: text('segment_id').notNull(), // token_ready_extroverts, power_user_hot_lead, etc.
  platform: text('platform').notNull(), // google, facebook, tiktok, braze
  syncedAt: timestamp('synced_at').defaultNow(),
  userCount: integer('user_count').notNull(),
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  platformAudienceId: text('platform_audience_id'), // External ID from ad platform
});

// User profile snapshots - for historical analysis and cluster stability
export const userProfileSnapshots = pgTable('user_profile_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  snapshotDate: timestamp('snapshot_date').notNull(),
  primaryCluster: text('primary_cluster'),
  hotLeadTier: integer('hot_lead_tier'),
  purchaseIntentScore: integer('purchase_intent_score'),
  churnRiskScore: real('churn_risk_score'),
  personalityOpenness: real('personality_openness'),
  personalityExtraversion: real('personality_extraversion'),
  activeSegments: jsonb('active_segments'),
});

// Message embeddings - stores vector embeddings for intent clustering
export const messageEmbeddings = pgTable('message_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  intentCluster: text('intent_cluster'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Intent clusters - discovered intent groups from embeddings
export const intentClusters = pgTable('intent_clusters', {
  id: text('id').primaryKey(), // e.g. "transfer_frustration"
  label: text('label').notNull(),
  description: text('description'),
  descriptionPt: text('description_pt'),
  centroid: vector('centroid'),
  messageCount: integer('message_count'),
  discoveredAt: timestamp('discovered_at').defaultNow(),
  isActive: boolean('is_active').default(true),
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

// Track user progress through soft-training phases
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
