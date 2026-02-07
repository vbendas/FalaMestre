/**
 * Braze Audience Connector
 * 
 * Syncs rich user profiles to Braze for personalized messaging campaigns.
 * Unlike ad platforms, Braze accepts full profile data (not just hashed identifiers).
 * 
 * API: https://www.braze.com/docs/api/endpoints/user_data/post_user_track/
 * Rate limits: 50,000 requests/hour, 75 user objects per request
 */

import { SegmentId } from '../segment-definitions';

interface BrazeUserProfile {
  external_id: string; // Our game_id (userId)
  email?: string; // Unhashed email (Braze handles hashing internally)
  
  // Custom attributes (all prefixed with fm_ for "Fala Mestre")
  fm_segment?: SegmentId;
  fm_primary_cluster?: string;
  fm_purchase_intent?: number;
  fm_churn_risk?: number;
  fm_extraversion?: number;
  fm_openness?: number;
  fm_wallet_archetype?: string;
  fm_fan_token_balance?: number;
  fm_total_points?: number;
  fm_sessions_count?: number;
  fm_last_sync?: string; // ISO timestamp
}

interface BrazeTrackRequest {
  attributes: BrazeUserProfile[];
}

interface BrazeApiResponse {
  message: string;
  errors?: Array<{
    type: string;
    input_array: string;
    index: number;
  }>;
  attributes_processed?: number;
}

/**
 * Sync user profiles to Braze.
 * Sends rich profile data for personalization and segmentation.
 * 
 * @param users - Array of user profiles with behavioral and personality data
 * @param segmentId - The segment these users belong to
 * @returns Success status and sync stats
 */
export async function syncToBraze(
  users: Array<{
    userId: string;
    emailHash: string | null;
    primaryCluster: string | null;
    purchaseIntentScore: number | null;
    churnRiskScore: number | null;
    extraversion?: number | null;
    openness?: number | null;
    walletArchetype?: string | null;
    fanTokenBalance?: number | null;
    totalPoints?: number | null;
    sessionsCount?: number | null;
  }>,
  segmentId: SegmentId
): Promise<{
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
}> {
  const apiKey = process.env.BRAZE_API_KEY;
  const restEndpoint = process.env.BRAZE_REST_ENDPOINT || 'https://rest.iad-06.braze.com';
  
  if (!apiKey) {
    console.warn('BRAZE_API_KEY not set, skipping Braze sync');
    return { success: false, processed: 0, failed: users.length, errors: ['API key not configured'] };
  }
  
  if (users.length === 0) {
    return { success: true, processed: 0, failed: 0, errors: [] };
  }
  
  // Convert to Braze user profiles
  const brazeProfiles: BrazeUserProfile[] = users.map((user) => ({
    external_id: user.userId,
    // Note: email is hashed in our DB, but Braze needs unhashed email
    // For now, we'll skip email sync to Braze. Alternative: store unhashed email separately.
    fm_segment: segmentId,
    fm_primary_cluster: user.primaryCluster || undefined,
    fm_purchase_intent: user.purchaseIntentScore || undefined,
    fm_churn_risk: user.churnRiskScore || undefined,
    fm_extraversion: user.extraversion || undefined,
    fm_openness: user.openness || undefined,
    fm_wallet_archetype: user.walletArchetype || undefined,
    fm_fan_token_balance: user.fanTokenBalance || undefined,
    fm_total_points: user.totalPoints || undefined,
    fm_sessions_count: user.sessionsCount || undefined,
    fm_last_sync: new Date().toISOString(),
  }));
  
  // Batch into groups of 75 (Braze limit)
  const BATCH_SIZE = 75;
  const batches: BrazeUserProfile[][] = [];
  for (let i = 0; i < brazeProfiles.length; i += BATCH_SIZE) {
    batches.push(brazeProfiles.slice(i, i + BATCH_SIZE));
  }
  
  let totalProcessed = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];
  
  // Send batches sequentially to respect rate limits
  for (const batch of batches) {
    try {
      const response = await fetch(`${restEndpoint}/users/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          attributes: batch,
        } as BrazeTrackRequest),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Braze API error:', response.status, errorText);
        allErrors.push(`HTTP ${response.status}: ${errorText}`);
        totalFailed += batch.length;
        continue;
      }
      
      const result: BrazeApiResponse = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        console.error('Braze batch errors:', result.errors);
        allErrors.push(...result.errors.map(e => `${e.type} at index ${e.index}`));
        totalFailed += result.errors.length;
        totalProcessed += (result.attributes_processed || 0);
      } else {
        totalProcessed += batch.length;
      }
      
      // Rate limiting: wait 100ms between batches
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('Braze sync error:', error);
      allErrors.push(error instanceof Error ? error.message : 'Unknown error');
      totalFailed += batch.length;
    }
  }
  
  return {
    success: totalFailed === 0,
    processed: totalProcessed,
    failed: totalFailed,
    errors: allErrors,
  };
}

/**
 * Remove users from a Braze segment.
 * Updates their fm_segment attribute to null.
 * 
 * @param userIds - Array of user IDs to remove from segment
 * @returns Success status
 */
export async function removeFromBrazeSegment(userIds: string[]): Promise<{
  success: boolean;
  processed: number;
}> {
  const apiKey = process.env.BRAZE_API_KEY;
  const restEndpoint = process.env.BRAZE_REST_ENDPOINT || 'https://rest.iad-06.braze.com';
  
  if (!apiKey || userIds.length === 0) {
    return { success: true, processed: 0 };
  }
  
  const profiles: BrazeUserProfile[] = userIds.map(userId => ({
    external_id: userId,
    fm_segment: undefined, // Clear segment
    fm_last_sync: new Date().toISOString(),
  }));
  
  // Batch and send
  const BATCH_SIZE = 75;
  let processed = 0;
  
  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE);
    
    try {
      const response = await fetch(`${restEndpoint}/users/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ attributes: batch }),
      });
      
      if (response.ok) {
        processed += batch.length;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Braze removal error:', error);
    }
  }
  
  return { success: true, processed };
}

/**
 * Test Braze connection and credentials.
 * Sends a test profile to verify API access.
 * 
 * @returns True if connection successful
 */
export async function testBrazeConnection(): Promise<boolean> {
  const apiKey = process.env.BRAZE_API_KEY;
  const restEndpoint = process.env.BRAZE_REST_ENDPOINT || 'https://rest.iad-06.braze.com';
  
  if (!apiKey) {
    return false;
  }
  
  try {
    const response = await fetch(`${restEndpoint}/users/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        attributes: [{
          external_id: 'test_connection',
          fm_segment: 'lookalike_seed',
          fm_last_sync: new Date().toISOString(),
        }],
      }),
    });
    
    return response.ok;
  } catch {
    return false;
  }
}
