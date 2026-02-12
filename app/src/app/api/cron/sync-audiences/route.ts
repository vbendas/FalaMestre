/**
 * Audience Sync Cron Job
 * 
 * Daily sync of audience segments to ad platforms.
 * Runs at 6:00 AM UTC to ensure fresh data for daily campaigns.
 * 
 * Schedule: 0 6 * * * (Daily at 6 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllEligibleSegments } from '@/lib/audiences/sync-router';
import { requireCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

export async function GET(request: NextRequest) {
  const authError = requireCronAuth(request);
  if (authError) {
    return authError;
  }
  
  const startTime = Date.now();
  console.log('[Cron] Starting audience sync job');
  
  try {
    // Sync all eligible segments to their compatible platforms
    const results = await syncAllEligibleSegments();
    
    // Calculate summary statistics
    const totalSegments = results.length;
    const successfulSegments = results.filter(r => r.overallSuccess).length;
    const totalUsers = results.reduce((sum, r) => sum + r.totalUsers, 0);
    const totalPlatformSyncs = results.reduce((sum, r) => sum + r.results.length, 0);
    const successfulSyncs = results.reduce(
      (sum, r) => sum + r.results.filter(pr => pr.success).length,
      0
    );
    
    // Collect all errors
    const allErrors = results.flatMap(r => 
      r.results.flatMap(pr => 
        pr.errors.map(err => `${r.segmentId}/${pr.platform}: ${err}`)
      )
    );
    
    const duration = Date.now() - startTime;
    
    console.log('[Cron] Audience sync completed', {
      duration: `${duration}ms`,
      totalSegments,
      successfulSegments,
      totalUsers,
      totalPlatformSyncs,
      successfulSyncs,
      errorCount: allErrors.length,
    });
    
    return NextResponse.json({
      success: true,
      summary: {
        duration: `${duration}ms`,
        totalSegments,
        successfulSegments,
        totalUsers,
        totalPlatformSyncs,
        successfulSyncs,
        failedSyncs: totalPlatformSyncs - successfulSyncs,
      },
      segments: results.map(r => ({
        segmentId: r.segmentId,
        totalUsers: r.totalUsers,
        overallSuccess: r.overallSuccess,
        platforms: r.results.map(pr => ({
          platform: pr.platform,
          success: pr.success,
          usersProcessed: pr.usersProcessed,
          audienceId: pr.platformAudienceId,
          errors: pr.errors,
        })),
      })),
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Cron] Audience sync failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      },
      { status: 500 }
    );
  }
}
