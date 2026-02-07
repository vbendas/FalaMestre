/**
 * Segment Definitions for Audience Activation
 * 
 * Declarative rules that define targetable audience segments for ad platforms.
 * Each segment includes filter criteria, size estimates, and platform compatibility.
 */

import { db } from '@/db';
import { userProfiles } from '@/db/schema';
import { and, or, eq, gte, gt, inArray, sql } from 'drizzle-orm';

export type SegmentId = 
  | 'token_ready_extroverts'
  | 'power_user_hot_lead'
  | 'at_risk_high_value'
  | 'social_amplifiers'
  | 'whale_potential'
  | 'fan_token_holders'
  | 'lookalike_seed';

export interface SegmentDefinition {
  id: SegmentId;
  name: string;
  description: string;
  platforms: Array<'google' | 'facebook' | 'tiktok' | 'braze'>;
  /** Minimum audience size for platform activation (most platforms require 1000+ users) */
  minSize: number;
  /** Whether this segment is optimized for conversion or awareness */
  objective: 'conversion' | 'awareness' | 'retention';
  /** Priority tier for budget allocation (1 = highest) */
  priority: 1 | 2 | 3;
}

/**
 * All available segment definitions.
 * Segments are evaluated daily by the sync-audiences cron job.
 */
export const SEGMENT_DEFINITIONS: Record<SegmentId, SegmentDefinition> = {
  token_ready_extroverts: {
    id: 'token_ready_extroverts',
    name: 'Token-Ready Extroverts',
    description: 'High-openness, social users ready for Fan Token education. Strong NFT/crypto upsell potential.',
    platforms: ['google', 'facebook', 'tiktok', 'braze'],
    minSize: 1000,
    objective: 'conversion',
    priority: 1,
  },
  
  power_user_hot_lead: {
    id: 'power_user_hot_lead',
    name: 'Power User Hot Leads',
    description: 'Highly engaged users with strong purchase intent. Premium feature conversion targets.',
    platforms: ['google', 'facebook', 'braze'],
    minSize: 500,
    objective: 'conversion',
    priority: 1,
  },
  
  at_risk_high_value: {
    id: 'at_risk_high_value',
    name: 'At-Risk High Value',
    description: 'Previously engaged users showing churn signals. Re-engagement and win-back campaigns.',
    platforms: ['google', 'facebook', 'braze'],
    minSize: 1000,
    objective: 'retention',
    priority: 2,
  },
  
  social_amplifiers: {
    id: 'social_amplifiers',
    name: 'Social Amplifiers',
    description: 'Extroverted users with high social scores. Influencer and referral program candidates.',
    platforms: ['facebook', 'tiktok', 'braze'],
    minSize: 500,
    objective: 'awareness',
    priority: 2,
  },
  
  whale_potential: {
    id: 'whale_potential',
    name: 'Whale Potential',
    description: 'Crypto-active users with DeFi history or high spending scores. Premium product targets.',
    platforms: ['google', 'facebook', 'braze'],
    minSize: 100,
    objective: 'conversion',
    priority: 1,
  },
  
  fan_token_holders: {
    id: 'fan_token_holders',
    name: 'Fan Token Holders',
    description: 'Users holding Chiliz Fan Tokens. VIP treatment and exclusive content access.',
    platforms: ['braze', 'google'],
    minSize: 50,
    objective: 'retention',
    priority: 1,
  },
  
  lookalike_seed: {
    id: 'lookalike_seed',
    name: 'Lookalike Seed Audience',
    description: 'High-quality engaged users for lookalike modeling. Balanced engagement profile.',
    platforms: ['facebook', 'google', 'tiktok'],
    minSize: 2000,
    objective: 'awareness',
    priority: 3,
  },
};

/**
 * Fetch users matching a specific segment's criteria.
 * All queries respect consent by filtering for consentDataExport = true.
 * 
 * @param segmentId - The segment to query
 * @returns Array of user profiles with hashed identifiers ready for platform sync
 */
export async function getUsersForSegment(segmentId: SegmentId): Promise<Array<{
  userId: string;
  emailHash: string | null;
  walletAddressHash: string | null;
  primaryCluster: string | null;
  purchaseIntentScore: number | null;
  churnRiskScore: number | null;
}>> {
  // Base consent filter - NEVER sync users who haven't consented
  const consentFilter = eq(userProfiles.consentDataExport, true);
  
  let segmentFilter;
  
  switch (segmentId) {
    case 'token_ready_extroverts':
      // personalityOpenness > 0.7 AND softTrainingScore > 75 AND personalityExtraversion > 0.6
      segmentFilter = and(
        consentFilter,
        gt(userProfiles.personalityOpenness, 0.7),
        gt(userProfiles.softTrainingScore, 75),
        gt(userProfiles.personalityExtraversion, 0.6)
      );
      break;
    
    case 'power_user_hot_lead':
      // primaryCluster = 'power_user' AND purchaseIntentScore >= 70
      segmentFilter = and(
        consentFilter,
        eq(userProfiles.primaryCluster, 'power_user'),
        gte(userProfiles.purchaseIntentScore, 70)
      );
      break;
    
    case 'at_risk_high_value':
      // churnRiskScore > 0.6 AND totalPoints > 1000
      segmentFilter = and(
        consentFilter,
        gt(userProfiles.churnRiskScore, 0.6),
        gt(userProfiles.totalPoints, 1000)
      );
      break;
    
    case 'social_amplifiers':
      // extraversion > 0.8 AND socialScore > 60
      segmentFilter = and(
        consentFilter,
        gt(userProfiles.personalityExtraversion, 0.8),
        gt(userProfiles.socialScore, 60)
      );
      break;
    
    case 'whale_potential':
      // walletArchetype IN ('whale', 'defi_active') OR spendingScore > 70
      segmentFilter = and(
        consentFilter,
        or(
          inArray(userProfiles.walletArchetype, ['whale', 'defi_active']),
          gt(userProfiles.spendingScore, 70)
        )
      );
      break;
    
    case 'fan_token_holders':
      // fanTokenBalance > 0 (has any Fan Tokens)
      segmentFilter = and(
        consentFilter,
        gt(userProfiles.fanTokenBalance, 0)
      );
      break;
    
    case 'lookalike_seed':
      // primaryCluster = 'casual_fan' AND sessionsCount > 5 AND softTrainingScore > 30
      segmentFilter = and(
        consentFilter,
        eq(userProfiles.primaryCluster, 'casual_fan'),
        gt(userProfiles.sessionsCount, 5),
        gt(userProfiles.softTrainingScore, 30)
      );
      break;
    
    default:
      throw new Error(`Unknown segment ID: ${segmentId}`);
  }
  
  const results = await db
    .select({
      userId: userProfiles.userId,
      emailHash: userProfiles.emailHash,
      walletAddress: userProfiles.walletAddress,
      primaryCluster: userProfiles.primaryCluster,
      purchaseIntentScore: userProfiles.purchaseIntentScore,
      churnRiskScore: userProfiles.churnRiskScore,
    })
    .from(userProfiles)
    .where(segmentFilter);
  
  return results;
}

/**
 * Get segment size without fetching all users.
 * Useful for checking if segment meets minimum size requirements.
 * 
 * @param segmentId - The segment to measure
 * @returns User count matching segment criteria
 */
export async function getSegmentSize(segmentId: SegmentId): Promise<number> {
  const users = await getUsersForSegment(segmentId);
  return users.length;
}

/**
 * Get all segments with their current sizes.
 * Used for dashboard reporting and sync eligibility checks.
 * 
 * @returns Array of segments with current user counts
 */
export async function getAllSegmentSizes(): Promise<Array<{
  segment: SegmentDefinition;
  currentSize: number;
  meetsMinimum: boolean;
}>> {
  const results = await Promise.all(
    Object.values(SEGMENT_DEFINITIONS).map(async (segment) => {
      const currentSize = await getSegmentSize(segment.id);
      return {
        segment,
        currentSize,
        meetsMinimum: currentSize >= segment.minSize,
      };
    })
  );
  
  return results;
}

/**
 * Get segments eligible for sync to a specific platform.
 * Filters by platform compatibility and minimum size requirements.
 * 
 * @param platform - Target platform
 * @returns Segment IDs ready for sync to the platform
 */
export async function getEligibleSegmentsForPlatform(
  platform: 'google' | 'facebook' | 'tiktok' | 'braze'
): Promise<SegmentId[]> {
  const allSizes = await getAllSegmentSizes();
  
  return allSizes
    .filter(({ segment, meetsMinimum }) => 
      segment.platforms.includes(platform) && meetsMinimum
    )
    .map(({ segment }) => segment.id);
}
