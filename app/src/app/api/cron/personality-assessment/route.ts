/**
 * Weekly cron job for personality assessment.
 * Runs every Sunday at 4 AM UTC.
 * 
 * This job:
 * 1. Finds users with 15+ new messages since last assessment
 * 2. Limits to 50 users per run (stay within Vercel execution limits)
 * 3. Assesses personality using GPT-4o-mini
 * 4. Updates user_profiles with OCEAN scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { 
  assessPersonality, 
  getUsersNeedingAssessment, 
  getUserMessages 
} from '@/lib/clustering/personality-profiler';

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check (CRON_SECRET)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get users needing assessment
    const userIds = await getUsersNeedingAssessment();

    // 3. Limit to 50 users per run
    const usersToProcess = userIds.slice(0, 50);

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    // 4. For each user
    for (const userId of usersToProcess) {
      try {
        // a. Get last 100 messages
        const messages = await getUserMessages(userId, 100);

        if (messages.length < 15) {
          skipped++;
          continue;
        }

        // b. Assess personality
        const profile = await assessPersonality(messages);

        if (!profile) {
          skipped++;
          continue;
        }

        // c. Update user_profiles
        await db.insert(userProfiles)
          .values({
            userId,
            personalityOpenness: profile.openness,
            personalityConscientiousness: profile.conscientiousness,
            personalityExtraversion: profile.extraversion,
            personalityAgreeableness: profile.agreeableness,
            personalityNeuroticism: profile.neuroticism,
            personalityConfidence: profile.confidence,
            personalityLastAssessedAt: profile.assessedAt,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: userProfiles.userId,
            set: {
              personalityOpenness: profile.openness,
              personalityConscientiousness: profile.conscientiousness,
              personalityExtraversion: profile.extraversion,
              personalityAgreeableness: profile.agreeableness,
              personalityNeuroticism: profile.neuroticism,
              personalityConfidence: profile.confidence,
              personalityLastAssessedAt: profile.assessedAt,
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
      skipped,
      totalQueued: userIds.length,
      processedUsers: usersToProcess.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Personality assessment cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}