import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userProfiles, userProfileSnapshots } from '@/db/schema';
import { requireCronAuth } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    const profiles = await db.select().from(userProfiles);
    const now = new Date();

    let inserted = 0;
    for (const profile of profiles) {
      await db.insert(userProfileSnapshots).values({
        userId: profile.userId,
        snapshotDate: now,
        primaryCluster: profile.primaryCluster,
        hotLeadTier: profile.hotLeadTier,
        purchaseIntentScore: profile.purchaseIntentScore,
        churnRiskScore: profile.churnRiskScore,
        personalityOpenness: profile.personalityOpenness,
        personalityExtraversion: profile.personalityExtraversion,
        activeSegments: null,
      });
      inserted++;
    }

    return NextResponse.json({ success: true, snapshotsCreated: inserted });
  } catch (error) {
    console.error('[snapshot-profiles] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
