/**
 * TypeScript interfaces for behavioral clustering, personality profiling,
 * and lead scoring systems.
 */

export interface BehavioralFeatures {
  // Engagement metrics
  totalSessions: number;
  avgSessionDurationSec: number;
  sessionsLast7d: number;
  sessionsLast30d: number;
  daysActive: number;
  daysSinceLastActive: number;
  
  // Game performance
  matchesPlayed: number;
  matchWinRate: number;
  avgPointsPerSession: number;
  totalPoints: number;
  
  // Decision patterns
  aggressiveDecisions: number;
  defensiveDecisions: number;
  spendingDecisions: number;
  socialActions: number;
  
  // Conversation patterns
  totalMessages: number;
  avgMessageLength: number;
  questionRatio: number;
  uniqueIntents: number;
  
  // Temporal patterns
  preferredPlayHour: number;
  weekdayVsWeekend: number;
  consistencyScore: number;
}

export type ClusterName = 
  | 'casual_fan'
  | 'tactical_master'
  | 'social_competitor'
  | 'collector'
  | 'story_enthusiast'
  | 'power_user';

export interface ClusterResult {
  primary: ClusterName;
  secondary: ClusterName | null;
  scores: Record<ClusterName, number>;  // 0.0 - 1.0 each, sum = 1
}

export interface HotLeadResult {
  userId: string;
  classification: 'HOT_LEAD' | 'WARM_LEAD' | 'COLD_LEAD';
  tier: 1 | 2 | 3 | null;
  purchaseIntentScore: number;
  churnRiskScore: number;
  ltvEstimate: number;
  reasons: string[];
  recommendedAction: string;
}

export interface PersonalityProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  confidence: number;
  messageCount: number;
  assessedAt: Date;
}

export type WalletArchetype = 
  | 'new_wallet'
  | 'fan_token_holder'
  | 'defi_active'
  | 'nft_collector'
  | 'whale'
  | 'casual_holder';

export interface WalletProfile {
  address: string;
  chzBalance: string;
  fanTokenBalances: Record<string, number>;
  transactionCount: number;
  archetype: WalletArchetype;
}

export interface IntentCluster {
  id: string;
  label: string;
  description?: string;
  descriptionPt?: string;
  centroid: number[];
  messageCount: number;
  discoveredAt: Date;
  isActive: boolean;
}

export interface SegmentDefinition {
  id: string;
  name: string;
  description: string;
  criteria: (profile: unknown) => boolean;
  platforms: ('google' | 'facebook' | 'tiktok' | 'braze')[];
  refreshFrequency: 'daily' | 'weekly';
}

export interface ClusterStabilityResult {
  totalUsers: number;
  usersChangedCluster: number;
  stabilityScore: number;
  migrations: Array<{ from: string; to: string; count: number }>;
}
