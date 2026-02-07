/**
 * Facebook Custom Audiences Connector
 * 
 * Syncs audience segments to Facebook Marketing API for ad targeting.
 * Uses Custom Audiences with hashed emails (SHA-256).
 * 
 * API: https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences
 * Requirements:
 * - SHA-256 hashed emails (lowercase, trimmed before hashing)
 * - Marketing API access token with ads_management permission
 * - Minimum 100 users (recommended 1,000+ for stable delivery)
 * - Max 10,000 users per batch
 */

import { SegmentId, SEGMENT_DEFINITIONS } from '../segment-definitions';

const FACEBOOK_API_VERSION = 'v22.0';
const FACEBOOK_GRAPH_API = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

interface FacebookCustomAudienceResponse {
  id: string;
  name?: string;
  description?: string;
}

interface FacebookBatchResponse {
  num_received: number;
  num_invalid_entries: number;
  invalid_entry_samples?: Record<string, unknown>;
}

/**
 * Create or update a Facebook Custom Audience.
 * 
 * @param segmentId - The segment to sync
 * @param hashedEmails - Array of SHA-256 hashed emails
 * @returns Audience ID and operation stats
 */
export async function syncToFacebookAudience(
  segmentId: SegmentId,
  hashedEmails: string[]
): Promise<{
  success: boolean;
  audienceId: string | null;
  added: number;
  invalid: number;
  errors: string[];
}> {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID;
  
  if (!accessToken || !adAccountId) {
    console.warn('Facebook credentials not configured, skipping sync');
    return {
      success: false,
      audienceId: null,
      added: 0,
      invalid: 0,
      errors: ['Facebook credentials not configured'],
    };
  }
  
  if (hashedEmails.length === 0) {
    return {
      success: true,
      audienceId: null,
      added: 0,
      invalid: 0,
      errors: [],
    };
  }
  
  const segmentDef = SEGMENT_DEFINITIONS[segmentId];
  const audienceName = `FM_${segmentId}`;
  const audienceDescription = segmentDef.description;
  
  try {
    // Step 1: Find existing audience or create new one
    let audienceId: string;
    
    try {
      // Search for existing audience with this name
      const searchUrl = `${FACEBOOK_GRAPH_API}/act_${adAccountId}/customaudiences?fields=id,name&access_token=${accessToken}`;
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) {
        throw new Error(`Failed to search audiences: ${searchResponse.statusText}`);
      }
      
      const searchData = await searchResponse.json();
      const existingAudience = searchData.data?.find(
        (aud: FacebookCustomAudienceResponse) => aud.name === audienceName
      );
      
      if (existingAudience) {
        audienceId = existingAudience.id;
        console.log(`Using existing Facebook audience: ${audienceId}`);
      } else {
        // Create new audience
        const createUrl = `${FACEBOOK_GRAPH_API}/act_${adAccountId}/customaudiences`;
        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: audienceName,
            description: audienceDescription,
            subtype: 'CUSTOM',
            customer_file_source: 'USER_PROVIDED_ONLY',
            access_token: accessToken,
          }),
        });
        
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Failed to create audience: ${errorText}`);
        }
        
        const createData: FacebookCustomAudienceResponse = await createResponse.json();
        audienceId = createData.id;
        console.log(`Created new Facebook audience: ${audienceId}`);
      }
    } catch (error) {
      console.error('Error creating/finding Facebook audience:', error);
      return {
        success: false,
        audienceId: null,
        added: 0,
        invalid: 0,
        errors: [error instanceof Error ? error.message : 'Failed to create audience'],
      };
    }
    
    // Step 2: Upload users in batches (max 10,000 per batch)
    const BATCH_SIZE = 10000;
    let totalAdded = 0;
    let totalInvalid = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < hashedEmails.length; i += BATCH_SIZE) {
      const batch = hashedEmails.slice(i, i + BATCH_SIZE);
      
      try {
        const uploadUrl = `${FACEBOOK_GRAPH_API}/${audienceId}/users`;
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: {
              schema: ['EMAIL_SHA256'],
              data: batch.map(hash => [hash]),
            },
            access_token: accessToken,
          }),
        });
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('Facebook upload error:', errorText);
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${errorText}`);
          continue;
        }
        
        const uploadData: FacebookBatchResponse = await uploadResponse.json();
        totalAdded += uploadData.num_received || 0;
        totalInvalid += uploadData.num_invalid_entries || 0;
        
        if (uploadData.invalid_entry_samples) {
          console.warn('Facebook invalid entries:', uploadData.invalid_entry_samples);
        }
        
        console.log(`Uploaded ${batch.length} users to Facebook (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
        
        // Rate limiting: wait 200ms between batches
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error('Error uploading batch:', error);
        errors.push(error instanceof Error ? error.message : 'Failed to upload batch');
      }
    }
    
    return {
      success: errors.length === 0,
      audienceId,
      added: totalAdded,
      invalid: totalInvalid,
      errors,
    };
    
  } catch (error) {
    console.error('Facebook audience sync error:', error);
    return {
      success: false,
      audienceId: null,
      added: 0,
      invalid: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Remove users from a Facebook Custom Audience.
 * 
 * @param audienceId - The Facebook audience ID
 * @param hashedEmails - Array of SHA-256 hashed emails to remove
 * @returns Success status and removal count
 */
export async function removeFromFacebookAudience(
  audienceId: string,
  hashedEmails: string[]
): Promise<{
  success: boolean;
  removed: number;
}> {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  
  if (!accessToken || hashedEmails.length === 0) {
    return { success: true, removed: 0 };
  }
  
  try {
    const BATCH_SIZE = 10000;
    let totalRemoved = 0;
    
    for (let i = 0; i < hashedEmails.length; i += BATCH_SIZE) {
      const batch = hashedEmails.slice(i, i + BATCH_SIZE);
      
      const removeUrl = `${FACEBOOK_GRAPH_API}/${audienceId}/users`;
      const removeResponse = await fetch(removeUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            schema: ['EMAIL_SHA256'],
            data: batch.map(hash => [hash]),
          },
          access_token: accessToken,
        }),
      });
      
      if (removeResponse.ok) {
        const removeData: FacebookBatchResponse = await removeResponse.json();
        totalRemoved += removeData.num_received || 0;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return { success: true, removed: totalRemoved };
  } catch (error) {
    console.error('Facebook removal error:', error);
    return { success: false, removed: 0 };
  }
}

/**
 * Get statistics for a Facebook Custom Audience.
 * 
 * @param audienceId - The Facebook audience ID
 * @returns Audience size and approximate match count
 */
export async function getFacebookAudienceStats(
  audienceId: string
): Promise<{
  size: number;
  approximateCount: number | null;
} | null> {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    return null;
  }
  
  try {
    const statsUrl = `${FACEBOOK_GRAPH_API}/${audienceId}?fields=approximate_count_lower_bound,approximate_count_upper_bound&access_token=${accessToken}`;
    const response = await fetch(statsUrl);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const lowerBound = data.approximate_count_lower_bound || 0;
    const upperBound = data.approximate_count_upper_bound || 0;
    
    return {
      size: lowerBound,
      approximateCount: Math.floor((lowerBound + upperBound) / 2),
    };
  } catch (error) {
    console.error('Error fetching Facebook audience stats:', error);
    return null;
  }
}

/**
 * Delete a Facebook Custom Audience.
 * Use with caution - this permanently removes the audience.
 * 
 * @param audienceId - The Facebook audience ID
 * @returns Success status
 */
export async function deleteFacebookAudience(audienceId: string): Promise<boolean> {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  
  if (!accessToken) {
    return false;
  }
  
  try {
    const deleteUrl = `${FACEBOOK_GRAPH_API}/${audienceId}?access_token=${accessToken}`;
    const response = await fetch(deleteUrl, { method: 'DELETE' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Test Facebook Marketing API connection and credentials.
 * 
 * @returns True if connection successful
 */
export async function testFacebookConnection(): Promise<boolean> {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID;
  
  if (!accessToken || !adAccountId) {
    return false;
  }
  
  try {
    const testUrl = `${FACEBOOK_GRAPH_API}/act_${adAccountId}?fields=id,name&access_token=${accessToken}`;
    const response = await fetch(testUrl);
    return response.ok;
  } catch {
    return false;
  }
}
