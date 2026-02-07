/**
 * Hot lead scoring service.
 * Implements three-tier lead classification based on behavioral signals
 * and soft training progress.
 * 
 * Lead tiers:
 * - Tier 1 (Priority): Purchase intent >= 80 OR crypto awareness inferred >= 70
 * - Tier 2 (Warm): Engagement >= 80 AND purchase intent >= 50
 * - Tier 3 (Nurture): Soft training score >= 75 AND engagement top 20%
 * - Cold: Doesn't meet any tier criteria
 */

import { BehavioralFeatures, HotLeadResult } from './types';
import { calculateEngagementPercentile } from './cluster-engine';

/**
 * Score a user as a hot lead based on behavioral signals and soft training progress.
 * 
 * Purchase intent is DERIVED from:
 * - spendingDecisions count * 5
 * - totalPoints * 0.01
 * - softTrainingScore * 0.5
 * - Clamped to 0-100
 * 
 * Churn risk is DERIVED from:
 * - daysSinceLastActive > 14 → 0.9
 * - daysSinceLastActive > 7 → 0.7
 * - daysSinceLastActive > 3 → 0.4
 * - sessionsLast7d < 2 → 0.3
 * - else → 0.1
 * 
 * LTV estimate:
 * - Tier 1: $200-350
 * - Tier 2: $100-200
 * - Tier 3: $80-150
 * - No tier: $10-50
 * 
 * @param userId - The user ID
 * @param features - Behavioral features
 * @param softTrainingScore - Soft training progress (0-100)
 * @returns Hot lead classification result
 */
export function scoreHotLead(
  userId: string,
  features: BehavioralFeatures,
  softTrainingScore: number
): HotLeadResult {
  // Calculate purchase intent score
  let purchaseIntentScore = Math.min(100,
    features.spendingDecisions * 5 +
    features.totalPoints * 0.01 +
    softTrainingScore * 0.5
  );
  
  // Calculate churn risk
  let churnRiskScore: number;
  if (features.daysSinceLastActive > 14) {
    churnRiskScore = 0.9;
  } else if (features.daysSinceLastActive > 7) {
    churnRiskScore = 0.7;
  } else if (features.daysSinceLastActive > 3) {
    churnRiskScore = 0.4;
  } else if (features.sessionsLast7d < 2) {
    churnRiskScore = 0.3;
  } else {
    churnRiskScore = 0.1;
  }
  
  // Calculate engagement percentile
  const engagementPercentile = calculateEngagementPercentile(features.totalPoints);
  
  const reasons: string[] = [];
  
  // Tier 1: Purchase intent >= 80
  if (purchaseIntentScore >= 80) {
    reasons.push(`Alta intenção de compra (${Math.round(purchaseIntentScore)}%)`);
    return {
      userId,
      classification: 'HOT_LEAD',
      tier: 1,
      purchaseIntentScore: Math.round(purchaseIntentScore),
      churnRiskScore,
      ltvEstimate: 275, // Average of $200-350
      reasons,
      recommendedAction: 'Immediate outreach within 24-48h',
    };
  }
  
  // Tier 2: Engagement top 20% AND purchase intent >= 50
  if (engagementPercentile >= 80 && purchaseIntentScore >= 50) {
    reasons.push(`Engajamento excepcional (top ${engagementPercentile}%)`);
    reasons.push(`Intenção de compra moderada (${Math.round(purchaseIntentScore)}%)`);
    return {
      userId,
      classification: 'HOT_LEAD',
      tier: 2,
      purchaseIntentScore: Math.round(purchaseIntentScore),
      churnRiskScore,
      ltvEstimate: 150, // Average of $100-200
      reasons,
      recommendedAction: 'Send educational content + special offer',
    };
  }
  
  // Tier 3: Soft training complete AND moderate purchase intent
  if (softTrainingScore >= 75 && purchaseIntentScore >= 40) {
    reasons.push(`Soft training completo (${softTrainingScore}%)`);
    reasons.push(`Curiosidade natural por tokens`);
    return {
      userId,
      classification: 'HOT_LEAD',
      tier: 3,
      purchaseIntentScore: Math.round(purchaseIntentScore),
      churnRiskScore,
      ltvEstimate: 115, // Average of $80-150
      reasons,
      recommendedAction: 'Nurture with engagement-focused offers + social proof',
    };
  }
  
  // Warm lead: Shows interest but not ready
  if (softTrainingScore >= 50 || purchaseIntentScore >= 40) {
    return {
      userId,
      classification: 'WARM_LEAD',
      tier: null,
      purchaseIntentScore: Math.round(purchaseIntentScore),
      churnRiskScore,
      ltvEstimate: 60,
      reasons: ['Interesse inicial, continuar soft training'],
      recommendedAction: 'Continue soft training until Phase 3-4 complete',
    };
  }
  
  // Cold lead
  return {
    userId,
    classification: 'COLD_LEAD',
    tier: null,
    purchaseIntentScore: Math.round(purchaseIntentScore),
    churnRiskScore,
    ltvEstimate: 30,
    reasons: ['Baixo engajamento, precisa de ativação'],
    recommendedAction: 'Continue data collection until criteria met',
  };
}

/**
 * Generate a human-readable summary of why a user was classified.
 * 
 * @param result - Hot lead result
 * @returns Portuguese summary string
 */
export function generateLeadSummary(result: HotLeadResult): string {
  const tierName = result.tier 
    ? `Tier ${result.tier}` 
    : result.classification === 'WARM_LEAD' 
      ? 'Lead Morno'
      : 'Lead Frio';
  
  const reasons = result.reasons.join('. ');
  const ltv = result.ltvEstimate;
  
  return `${tierName} - ${reasons}. LTV estimado: $${ltv}. ${result.recommendedAction}`;
}

/**
 * Calculate conversion probability based on lead tier.
 * 
 * @param tier - Lead tier (1, 2, 3, or null)
 * @returns Conversion probability (0-1)
 */
export function getConversionProbability(tier: number | null): number {
  switch (tier) {
    case 1: return 0.22; // 20-25% range
    case 2: return 0.075; // 5-10% range
    case 3: return 0.055; // 3-8% range
    default: return 0.02; // Cold leads: 1-3%
  }
}