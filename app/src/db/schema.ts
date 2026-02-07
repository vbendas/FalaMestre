import { pgTable, uuid, text, integer, jsonb, timestamp, boolean, real, customType } from 'drizzle-orm/pg-core';

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
  id: uuid('id').primaryKey().defaultRandom(),
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
  currentState: jsonb('current_state').$type<any>().notNull(),
  conversationHistory: jsonb('conversation_history').$type<any[]>(),
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
