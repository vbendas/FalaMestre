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

export async function GET(request: NextRequest) {
  try {
    // 1. Verify cron secret (Vercel passes CRON_SECRET header)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // 2. Get all users with activity in last 25 hours (overlap for safety)
    const activeUserIds = await getActiveUserIds(25);
    
    let processed = 0;
    let errors = 0;
    
    // 3. For each active user:
    for (const userId of activeUserIds) {
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
        
        processed++;
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        errors++;
      }
    }
    
    return NextResponse.json({
      status: 'ok',
      processed,
      errors,
      totalActive: activeUserIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}