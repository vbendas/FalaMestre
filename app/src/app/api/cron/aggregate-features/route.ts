/**
 * Daily cron job for aggregating behavioral features and computing clusters.
 * Runs at 3 AM UTC every day.
 * 
 * This job:
 * 1. Identifies active users (activity in last 25 hours)
 * 2. Computes behavioral features for each user
 * 3. Assigns cluster labels
 * 4. Scores hot leads
 * 5. Upserts everything to user_profiles table
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getActiveUserIds, computeBehavioralFeatures } from '@/lib/clustering/behavioral-features';
import { assignClusterV2 } from '@/lib/clustering/cluster-engine';
import { scoreHotLead } from '@/lib/clustering/lead-scoring';
import { messageEmbeddings } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { requireCronAuth } from '@/lib/cron-auth';

// Configuration for batch processing
const BATCH_SIZE = 50; // Process 50 users at a time
const BATCH_DELAY_MS = 1000; // 1 second delay between batches
const MAX_PROCESSING_TIME_MS = 4 * 60 * 60 * 1000; // 4 hour max runtime
const MEMORY_THRESHOLD_PERCENT = 85; // Stop if memory exceeds 85%

/**
 * Check if memory usage is critical
 */
function isMemoryCritical(): boolean {
  if (typeof process === 'undefined' || !process.memoryUsage) {
    return false;
  }
  
  const usage = process.memoryUsage();
  const percentage = (usage.heapUsed / usage.heapTotal) * 100;
  return percentage > MEMORY_THRESHOLD_PERCENT;
}

/**
 * Process a single user
 */
async function processUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // a. Compute behavioral features
    const features = await computeBehavioralFeatures(userId);
    
    // b. Load existing profile for personality and wallet data
    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });
    
    // c. Get intent signals from recent message embeddings
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const intentSignalsResult = await db.execute(sql`
      SELECT DISTINCT intent_cluster
      FROM message_embeddings
      WHERE user_id = ${userId}
        AND intent_cluster IS NOT NULL
        AND created_at >= ${sevenDaysAgo}
    `);
    const intentSignals = (intentSignalsResult as { intent_cluster: string }[])
      .map(r => r.intent_cluster)
      .filter(Boolean);
    
    // d. Assign cluster with personality and intent signals
    const personality = existingProfile?.personalityConfidence && existingProfile.personalityConfidence > 0.5
      ? {
          openness: existingProfile.personalityOpenness ?? 0.5,
          conscientiousness: existingProfile.personalityConscientiousness ?? 0.5,
          extraversion: existingProfile.personalityExtraversion ?? 0.5,
          agreeableness: existingProfile.personalityAgreeableness ?? 0.5,
          neuroticism: existingProfile.personalityNeuroticism ?? 0.5,
          confidence: existingProfile.personalityConfidence,
          messageCount: 0,
          assessedAt: existingProfile.personalityLastAssessedAt ?? new Date(),
        }
      : null;
    
    const cluster = assignClusterV2(
      features,
      personality,
      intentSignals,
      existingProfile?.walletArchetype ?? null
    );
    
    // e. Score hot lead
    const softTrainingScore = existingProfile?.softTrainingScore ?? 0;
    const leadScore = scoreHotLead(userId, features, softTrainingScore);
    
    // d. Upsert user_profiles
    await db.insert(userProfiles)
      .values({
        userId,
        totalMatches: features.matchesPlayed,
        totalPoints: features.totalPoints,
        sessionsCount: features.totalSessions,
        avgSessionDurationSec: Math.round(features.avgSessionDurationSec),
        daysActive: features.daysActive,
        lastActiveAt: new Date(),
        matchWinRate: features.matchWinRate,
        aggressivenessScore: Math.round(
          (features.aggressiveDecisions / Math.max(features.aggressiveDecisions + features.defensiveDecisions, 1)) * 100
        ),
        spendingScore: Math.min(100, features.spendingDecisions * 10),
        socialScore: Math.min(100, features.socialActions * 15),
        competitivenessScore: Math.round(features.matchWinRate * 100),
        primaryCluster: cluster.primary,
        secondaryCluster: cluster.secondary,
        clusterScores: cluster.scores,
        purchaseIntentScore: leadScore.purchaseIntentScore,
        churnRiskScore: leadScore.churnRiskScore,
        ltvEstimate: leadScore.ltvEstimate,
        hotLeadTier: leadScore.tier,
        updatedAt: new Date(),
        // Preserve existing values if they exist
        emailHash: existingProfile?.emailHash ?? null,
        phoneHash: existingProfile?.phoneHash ?? null,
        walletAddress: existingProfile?.walletAddress ?? null,
        softTrainingScore: softTrainingScore,
        softTrainingPhase: existingProfile?.softTrainingPhase ?? 0,
        consentMarketing: existingProfile?.consentMarketing ?? false,
        consentAnalytics: existingProfile?.consentAnalytics ?? true,
        consentDataExport: existingProfile?.consentDataExport ?? false,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          totalMatches: features.matchesPlayed,
          totalPoints: features.totalPoints,
          sessionsCount: features.totalSessions,
          avgSessionDurationSec: Math.round(features.avgSessionDurationSec),
          daysActive: features.daysActive,
          lastActiveAt: new Date(),
          matchWinRate: features.matchWinRate,
          aggressivenessScore: Math.round(
            (features.aggressiveDecisions / Math.max(features.aggressiveDecisions + features.defensiveDecisions, 1)) * 100
          ),
          spendingScore: Math.min(100, features.spendingDecisions * 10),
          socialScore: Math.min(100, features.socialActions * 15),
          competitivenessScore: Math.round(features.matchWinRate * 100),
          primaryCluster: cluster.primary,
          secondaryCluster: cluster.secondary,
          clusterScores: cluster.scores,
          purchaseIntentScore: leadScore.purchaseIntentScore,
          churnRiskScore: leadScore.churnRiskScore,
          ltvEstimate: leadScore.ltvEstimate,
          hotLeadTier: leadScore.tier,
          updatedAt: new Date(),
        },
      });
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const authError = requireCronAuth(request);
    if (authError) {
      return authError;
    }
    
    // 2. Get all users with activity in last 25 hours (overlap for safety)
    const activeUserIds = await getActiveUserIds(25);
    
    console.log(`[AggregateFeatures] Starting processing of ${activeUserIds.length} users`);
    
    let processed = 0;
    let errors = 0;
    let batchesCompleted = 0;
    
    // Process users in batches to prevent memory issues
    for (let i = 0; i < activeUserIds.length; i += BATCH_SIZE) {
      // Check for timeout
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > MAX_PROCESSING_TIME_MS) {
        console.warn(`[AggregateFeatures] Timeout reached after ${elapsedTime}ms. Processed ${processed}/${activeUserIds.length} users.`);
        return NextResponse.json({
          status: 'timeout',
          processed,
          errors,
          totalActive: activeUserIds.length,
          batchesCompleted,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Check for memory pressure
      if (isMemoryCritical()) {
        console.warn(`[AggregateFeatures] Memory critical after processing ${processed} users. Stopping.`);
        return NextResponse.json({
          status: 'memory_critical',
          processed,
          errors,
          totalActive: activeUserIds.length,
          batchesCompleted,
          timestamp: new Date().toISOString(),
        });
      }
      
      // Get batch of users
      const batch = activeUserIds.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(userId => processUser(userId))
      );
      
      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          processed++;
        } else {
          errors++;
          console.error(`[AggregateFeatures] User processing failed:`, result.error);
        }
      });
      
      batchesCompleted++;
      
      // Log progress every 10 batches
      if (batchesCompleted % 10 === 0) {
        console.log(`[AggregateFeatures] Progress: ${processed}/${activeUserIds.length} users processed (${batchesCompleted} batches)`);
      }
      
      // Delay between batches to prevent memory buildup
      if (i + BATCH_SIZE < activeUserIds.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[AggregateFeatures] Completed in ${duration}ms. Processed ${processed} users with ${errors} errors.`);
    
    return NextResponse.json({
      status: 'ok',
      processed,
      errors,
      totalActive: activeUserIds.length,
      batchesCompleted,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[AggregateFeatures] Cron job error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}
