/**
 * Audience Sync Router
 * 
 * Orchestrates audience segment synchronization across all ad platforms.
 * Routes segments to appropriate connectors based on platform compatibility.
 */

import { SegmentId, getUsersForSegment, getSegmentSize, SEGMENT_DEFINITIONS } from './segment-definitions';
import { syncToBraze } from './connectors/braze';
import { syncToGoogleCustomerMatch } from './connectors/google-customer-match';
import { syncToFacebookAudience } from './connectors/facebook-audiences';
import { syncToTikTokAudience } from './connectors/tiktok-audiences';
import { db } from '@/db';
import { audienceSyncLog } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export type SyncPlatform = 'google' | 'facebook' | 'tiktok' | 'braze';

export interface SyncResult {
  platform: SyncPlatform;
  success: boolean;
  usersProcessed: number;
  errors: string[];
  platformAudienceId?: string | null;
}

export interface SegmentSyncResult {
  segmentId: SegmentId;
  totalUsers: number;
  results: SyncResult[];
  overallSuccess: boolean;
}

/**
 * Sync a single segment to all compatible platforms.
 * Respects platform compatibility defined in segment definitions.
 * 
 * @param segmentId - The segment to sync
 * @returns Sync results for each platform
 */
export async function syncSegmentToAllPlatforms(
  segmentId: SegmentId
): Promise<SegmentSyncResult> {
  const segmentDef = SEGMENT_DEFINITIONS[segmentId];
  const results: SyncResult[] = [];
  
  // Check if segment meets minimum size
  const segmentSize = await getSegmentSize(segmentId);
  
  if (segmentSize < segmentDef.minSize) {
    console.warn(
      `Segment ${segmentId} has ${segmentSize} users, below minimum ${segmentDef.minSize}. Skipping sync.`
    );
    return {
      segmentId,
      totalUsers: segmentSize,
      results: [],
      overallSuccess: false,
    };
  }
  
  // Fetch users with consent
  const users = await getUsersForSegment(segmentId);
  
  if (users.length === 0) {
    console.warn(`No consented users found for segment ${segmentId}`);
    return {
      segmentId,
      totalUsers: 0,
      results: [],
      overallSuccess: false,
    };
  }
  
  console.log(`Syncing segment ${segmentId} with ${users.length} consented users`);
  
  // Extract hashed emails (filter nulls)
  const hashedEmails = users
    .map((u: { emailHash: string | null }) => u.emailHash)
    .filter((email: string | null): email is string => email !== null);
  
  // Sync to each compatible platform
  const platformPromises: Promise<SyncResult>[] = [];
  
  if (segmentDef.platforms.includes('braze')) {
    platformPromises.push(
      syncToBraze(users, segmentId).then(result => ({
        platform: 'braze' as SyncPlatform,
        success: result.success,
        usersProcessed: result.processed,
        errors: result.errors,
      }))
    );
  }
  
  if (segmentDef.platforms.includes('google')) {
    platformPromises.push(
      syncToGoogleCustomerMatch(segmentId, hashedEmails).then(result => ({
        platform: 'google' as SyncPlatform,
        success: result.success,
        usersProcessed: result.added,
        errors: result.errors,
        platformAudienceId: result.listResourceName,
      }))
    );
  }
  
  if (segmentDef.platforms.includes('facebook')) {
    platformPromises.push(
      syncToFacebookAudience(segmentId, hashedEmails).then(result => ({
        platform: 'facebook' as SyncPlatform,
        success: result.success,
        usersProcessed: result.added,
        errors: result.errors,
        platformAudienceId: result.audienceId,
      }))
    );
  }
  
  if (segmentDef.platforms.includes('tiktok')) {
    platformPromises.push(
      syncToTikTokAudience(segmentId, hashedEmails).then(result => ({
        platform: 'tiktok' as SyncPlatform,
        success: result.success,
        usersProcessed: result.added,
        errors: result.errors,
        platformAudienceId: result.audienceId,
      }))
    );
  }
  
  // Execute all platform syncs in parallel
  const platformResults = await Promise.all(platformPromises);
  results.push(...platformResults);
  
  // Log each sync to database
  for (const result of results) {
    try {
      await db.insert(audienceSyncLog).values({
        segmentId,
        platform: result.platform,
        syncedAt: new Date(),
        userCount: result.usersProcessed,
        success: result.success,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        platformAudienceId: result.platformAudienceId || null,
      });
    } catch (error) {
      console.error('Error logging sync to database:', error);
    }
  }
  
  const overallSuccess = results.every((r: SyncResult) => r.success);
  
  return {
    segmentId,
    totalUsers: users.length,
    results,
    overallSuccess,
  };
}

/**
 * Sync multiple segments to their compatible platforms.
 * Processes segments sequentially to avoid rate limits.
 * 
 * @param segmentIds - Array of segment IDs to sync
 * @returns Sync results for each segment
 */
export async function syncMultipleSegments(
  segmentIds: SegmentId[]
): Promise<SegmentSyncResult[]> {
  const results: SegmentSyncResult[] = [];
  
  for (const segmentId of segmentIds) {
    try {
      console.log(`Starting sync for segment: ${segmentId}`);
      const result = await syncSegmentToAllPlatforms(segmentId);
      results.push(result);
      
      // Wait 2 seconds between segments to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error syncing segment ${segmentId}:`, error);
      results.push({
        segmentId,
        totalUsers: 0,
        results: [],
        overallSuccess: false,
      });
    }
  }
  
  return results;
}

/**
 * Sync all eligible segments (those meeting minimum size requirements).
 * This is the main function called by the cron job.
 * 
 * @returns Sync results for all eligible segments
 */
export async function syncAllEligibleSegments(): Promise<SegmentSyncResult[]> {
  const allSegmentIds = Object.keys(SEGMENT_DEFINITIONS) as SegmentId[];
  
  // Filter to only eligible segments
  const eligibleSegments: SegmentId[] = [];
  
  for (const segmentId of allSegmentIds) {
    const size = await getSegmentSize(segmentId);
    const minSize = SEGMENT_DEFINITIONS[segmentId].minSize;
    
    if (size >= minSize) {
      eligibleSegments.push(segmentId);
    } else {
      console.log(`Skipping ${segmentId}: ${size} users (min: ${minSize})`);
    }
  }
  
  console.log(`Syncing ${eligibleSegments.length} eligible segments`);
  
  return syncMultipleSegments(eligibleSegments);
}

/**
 * Get sync history for a specific segment.
 * Useful for debugging and monitoring.
 * 
 * @param segmentId - The segment ID
 * @param limit - Max number of records to return
 * @returns Recent sync logs
 */
export async function getSyncHistory(
  segmentId: SegmentId,
  limit: number = 10
): Promise<Array<{
  platform: string;
  syncedAt: Date;
  userCount: number;
  success: boolean;
  errorMessage: string | null;
}>> {
  const logs = await db
    .select()
    .from(audienceSyncLog)
    .where(eq(audienceSyncLog.segmentId, segmentId))
    .orderBy(desc(audienceSyncLog.syncedAt))
    .limit(limit);
  
  return logs.map((log: any) => ({
    platform: log.platform,
    syncedAt: log.syncedAt,
    userCount: log.userCount,
    success: log.success,
    errorMessage: log.errorMessage,
  }));
}
