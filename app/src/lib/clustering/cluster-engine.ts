/**
 * Cluster assignment engine.
 * Assigns users to behavioral clusters based on their features.
 * 
 * Cluster definitions:
 * - casual_fan: Low engagement, short sessions, few matches
 * - tactical_master: High intent diversity, long messages, analytical decisions
 * - social_competitor: High social actions, competitive, frequent sessions
 * - collector: Spending-focused, transfer market active
 * - story_enthusiast: Long sessions, high question ratio, narrative engagement
 * - power_user: Top 10% engagement across all dimensions
 */

import { BehavioralFeatures, ClusterResult, ClusterName, PersonalityProfile } from './types';

/**
 * Assign a user to a behavioral cluster based on their features.
 * Uses weighted scoring across multiple behavioral dimensions.
 * 
 * @param features - Computed behavioral features
 * @returns Cluster assignment with primary, secondary, and score breakdown
 */
export function assignCluster(features: BehavioralFeatures): ClusterResult {
  // Initialize scores for each cluster
  const scores: Record<ClusterName, number> = {
    casual_fan: 0,
    tactical_master: 0,
    social_competitor: 0,
    collector: 0,
    story_enthusiast: 0,
    power_user: 0,
  };
  
  // Engagement intensity signals
  if (features.sessionsLast7d < 2) {
    scores.casual_fan += 30;
  } else if (features.sessionsLast7d >= 5) {
    scores.power_user += 30;
    scores.social_competitor += 10;
  } else if (features.sessionsLast7d >= 3) {
    scores.social_competitor += 20;
    scores.tactical_master += 10;
    scores.collector += 10;
    scores.story_enthusiast += 10;
  }
  
  // Decision style signals
  const totalDecisions = features.aggressiveDecisions + features.defensiveDecisions + 1;
  const aggressiveRatio = features.aggressiveDecisions / totalDecisions;
  
  if (aggressiveRatio > 0.6) {
    scores.social_competitor += 15;
  }
  
  // Spending behavior signals
  const spendingRatio = features.spendingDecisions / Math.max(features.matchesPlayed, 1);
  if (spendingRatio > 0.3) {
    scores.collector += 20;
  }
  
  // Tactical engagement signals
  if (features.uniqueIntents > 8 && features.avgMessageLength > 30) {
    scores.tactical_master += 25;
    scores.power_user += 5;
  }
  
  // Social signals (would be enhanced in Phase 3)
  if (features.socialActions > 3) {
    scores.social_competitor += 20;
  }
  
  // Story engagement signals
  if (features.questionRatio > 0.3 && features.avgSessionDurationSec > 900) {
    scores.story_enthusiast += 20;
  }
  
  // High engagement markers
  if (features.totalPoints > 2000 && features.daysActive > 30) {
    scores.power_user += 25;
  }
  
  if (features.totalMessages > 100 && features.daysActive > 20) {
    scores.tactical_master += 10;
    scores.power_user += 10;
  }
  
  // Consistency bonus
  if (features.consistencyScore > 70 && features.daysActive > 14) {
    scores.power_user += 10;
    scores.social_competitor += 5;
  }
  
  // Days active signals
  if (features.daysActive < 3) {
    scores.casual_fan += 20;
  } else if (features.daysActive > 50) {
    scores.power_user += 10;
    scores.tactical_master += 5;
  }
  
  // Win rate signals
  if (features.matchWinRate > 0.6) {
    scores.social_competitor += 10;
  }
  
  // Normalize scores to sum to 1.0
  const total = Object.values(scores).reduce((a, b) => a + b, 1); // +1 to avoid division by zero
  const normalized: Record<ClusterName, number> = {
    casual_fan: scores.casual_fan / total,
    tactical_master: scores.tactical_master / total,
    social_competitor: scores.social_competitor / total,
    collector: scores.collector / total,
    story_enthusiast: scores.story_enthusiast / total,
    power_user: scores.power_user / total,
  };
  
  // Sort clusters by score
  const sorted = Object.entries(normalized)
    .sort((a, b) => b[1] - a[1]) as [ClusterName, number][];
  
  return {
    primary: sorted[0][0],
    secondary: sorted[1][1] > 0.15 ? sorted[1][0] : null, // Only if score > 15%
    scores: normalized,
  };
}

/**
 * Determine if a user should be considered highly engaged.
 * Used for filtering high-value users.
 * 
 * @param features - Behavioral features
 * @returns True if highly engaged
 */
export function isHighlyEngaged(features: BehavioralFeatures): boolean {
  return features.sessionsLast7d >= 4 &&
         features.daysActive >= 14 &&
         features.totalPoints >= 1000;
}

/**
 * Calculate engagement percentile based on total points.
 * Simplified calculation for initial use.
 * 
 * @param totalPoints - User's total points
 * @returns Percentile (0-100)
 */
export function calculateEngagementPercentile(totalPoints: number): number {
  // Simplified percentile calculation
  if (totalPoints >= 5000) return 95;
  if (totalPoints >= 3000) return 85;
  if (totalPoints >= 2000) return 70;
  if (totalPoints >= 1000) return 50;
  if (totalPoints >= 500) return 30;
  if (totalPoints >= 100) return 15;
  return 5;
}

/**
 * Enhanced cluster assignment using personality and intent signals.
 * Falls back to basic assignCluster if personality/intent data unavailable.
 * 
 * @param features - Computed behavioral features
 * @param personality - Personality profile (optional)
 * @param intentSignals - Array of discovered intent cluster labels (optional)
 * @param walletArchetype - Wallet archetype (optional, Phase 3)
 * @returns Cluster assignment with multi-signal scoring
 */
export function assignClusterV2(
  features: BehavioralFeatures,
  personality?: PersonalityProfile | null,
  intentSignals?: string[],
  walletArchetype?: string | null
): ClusterResult {
  // Start with basic cluster assignment
  const baseResult = assignCluster(features);
  
  // If no personality or intent data, return basic result
  if (!personality && (!intentSignals || intentSignals.length === 0) && !walletArchetype) {
    return baseResult;
  }
  
  // Start with base scores
  const scores: Record<ClusterName, number> = { ...baseResult.scores };
  
  // Apply personality signals (only if confidence > 0.5)
  if (personality && personality.confidence > 0.5) {
    // High openness → collector (curious about features/tokens)
    if (personality.openness > 0.7) {
      scores.collector += 0.10;
      scores.power_user += 0.05;
    }
    
    // High extraversion → social_competitor
    if (personality.extraversion > 0.7) {
      scores.social_competitor += 0.15;
    }
    
    // High conscientiousness → tactical_master
    if (personality.conscientiousness > 0.7) {
      scores.tactical_master += 0.10;
    }
    
    // High agreeableness → story_enthusiast
    if (personality.agreeableness > 0.7) {
      scores.story_enthusiast += 0.10;
    }
    
    // High neuroticism + low engagement → casual_fan (churn risk)
    if (personality.neuroticism > 0.7 && features.sessionsLast7d < 2) {
      scores.casual_fan += 0.10;
    }
  }
  
  // Apply intent signals
  if (intentSignals && intentSignals.length > 0) {
    for (const signal of intentSignals) {
      const lowerSignal = signal.toLowerCase();
      
      // Transfer/market intents
      if (lowerSignal.includes('transfer') || lowerSignal.includes('market') || lowerSignal.includes('buy') || lowerSignal.includes('sell')) {
        scores.collector += 0.10;
      }
      
      // Social intents
      if (lowerSignal.includes('social') || lowerSignal.includes('friend') || lowerSignal.includes('share') || lowerSignal.includes('compete')) {
        scores.social_competitor += 0.15;
      }
      
      // Strategy/tactical intents
      if (lowerSignal.includes('tactic') || lowerSignal.includes('strategy') || lowerSignal.includes('formation')) {
        scores.tactical_master += 0.10;
      }
      
      // Story/narrative intents
      if (lowerSignal.includes('story') || lowerSignal.includes('narrative') || lowerSignal.includes('lore')) {
        scores.story_enthusiast += 0.10;
      }
      
      // Excitement/engagement intents
      if (lowerSignal.includes('excited') || lowerSignal.includes('happy') || lowerSignal.includes('love')) {
        scores.power_user += 0.05;
      }
    }
  }
  
  // Apply wallet signals (Phase 3)
  if (walletArchetype) {
    switch (walletArchetype) {
      case 'whale':
        scores.collector += 0.20;
        scores.power_user += 0.15;
        break;
      case 'fan_token_holder':
        scores.collector += 0.15;
        break;
      case 'defi_active':
        scores.tactical_master += 0.10;
        scores.power_user += 0.05;
        break;
      case 'new_wallet':
        // No bonus, rely on game signals
        break;
    }
  }
  
  // Normalize scores to sum to 1.0
  const total = Object.values(scores).reduce((a, b) => a + b, 0.001); // Small epsilon to avoid division by zero
  const normalized: Record<ClusterName, number> = {
    casual_fan: scores.casual_fan / total,
    tactical_master: scores.tactical_master / total,
    social_competitor: scores.social_competitor / total,
    collector: scores.collector / total,
    story_enthusiast: scores.story_enthusiast / total,
    power_user: scores.power_user / total,
  };
  
  // Sort clusters by score
  const sorted = Object.entries(normalized)
    .sort((a, b) => b[1] - a[1]) as [ClusterName, number][];
  
  return {
    primary: sorted[0][0],
    secondary: sorted[1][1] > 0.15 ? sorted[1][0] : null,
    scores: normalized,
  };
}