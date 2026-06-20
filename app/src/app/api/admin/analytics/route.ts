import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { userProfiles, audienceSyncLog } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { getAllSegmentSizes } from '@/lib/audiences/segment-definitions';

export async function GET(request: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const segmentSizes = await getAllSegmentSizes();

    const clusterDist = await db.select({
      cluster: userProfiles.primaryCluster,
      count: sql<number>`count(*)::int`,
    }).from(userProfiles)
      .where(sql`${userProfiles.primaryCluster} IS NOT NULL`)
      .groupBy(userProfiles.primaryCluster);

    const tierDist = await db.select({
      tier: userProfiles.hotLeadTier,
      count: sql<number>`count(*)::int`,
    }).from(userProfiles)
      .where(sql`${userProfiles.hotLeadTier} IS NOT NULL`)
      .groupBy(userProfiles.hotLeadTier);

    const recentSyncs = await db.select()
      .from(audienceSyncLog)
      .orderBy(desc(audienceSyncLog.syncedAt))
      .limit(50);

    const totalUsers = await db.select({ count: sql<number>`count(*)::int` }).from(userProfiles);

    return NextResponse.json({
      totalUsers: totalUsers[0]?.count ?? 0,
      segmentSizes: segmentSizes.map(s => ({
        id: s.segment.id,
        name: s.segment.name,
        currentSize: s.currentSize,
        meetsMinimum: s.meetsMinimum,
        minSize: s.segment.minSize,
        platforms: s.segment.platforms,
        objective: s.segment.objective,
      })),
      clusterDistribution: clusterDist,
      tierDistribution: tierDist,
      recentSyncs: recentSyncs.map((s: { segmentId: string | null; platform: string | null; syncedAt: Date | null; userCount: number | null; success: boolean | null; errorMessage: string | null }) => ({
        segmentId: s.segmentId,
        platform: s.platform,
        syncedAt: s.syncedAt,
        userCount: s.userCount,
        success: s.success,
        errorMessage: s.errorMessage,
      })),
    });
  } catch (error) {
    console.error('[admin/analytics] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
