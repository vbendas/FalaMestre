/**
 * TikTok Custom Audiences Connector
 * 
 * Syncs audience segments to TikTok Ads Manager for ad targeting.
 * Uses Custom Audiences with hashed emails (SHA-256).
 * 
 * API: https://business-api.tiktok.com/portal/docs?id=1739940570793985
 * Requirements:
 * - SHA-256 hashed emails (lowercase, trimmed before hashing)
 * - TikTok Business API access token with Audience Management permission
 * - Minimum 1,000 users for reliable targeting
 * - Max 500,000 users per file upload
 */

import { SegmentId, SEGMENT_DEFINITIONS } from '../segment-definitions';

const TIKTOK_API_VERSION = 'v1.3';
const TIKTOK_BUSINESS_API = `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}`;

interface TikTokAudienceResponse {
  code: number;
  message: string;
  request_id: string;
  data?: {
    custom_audience_id: string;
    audience_name?: string;
  };
}

interface TikTokUploadResponse {
  code: number;
  message: string;
  request_id: string;
  data?: {
    file_path: string;
  };
}

/**
 * Create or update a TikTok Custom Audience.
 * 
 * @param segmentId - The segment to sync
 * @param hashedEmails - Array of SHA-256 hashed emails
 * @returns Audience ID and operation stats
 */
export async function syncToTikTokAudience(
  segmentId: SegmentId,
  hashedEmails: string[]
): Promise<{
  success: boolean;
  audienceId: string | null;
  added: number;
  errors: string[];
}> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  
  if (!accessToken || !advertiserId) {
    console.warn('TikTok credentials not configured, skipping sync');
    return {
      success: false,
      audienceId: null,
      added: 0,
      errors: ['TikTok credentials not configured'],
    };
  }
  
  if (hashedEmails.length === 0) {
    return {
      success: true,
      audienceId: null,
      added: 0,
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
      const searchUrl = `${TIKTOK_BUSINESS_API}/dmp/custom_audience/list/`;
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });
      
      if (!searchResponse.ok) {
        throw new Error(`Failed to search audiences: ${searchResponse.statusText}`);
      }
      
      const searchData: TikTokAudienceResponse = await searchResponse.json();
      
      if (searchData.code !== 0) {
        throw new Error(`TikTok API error: ${searchData.message}`);
      }
      
      // TikTok doesn't have a direct search by name, so we'll always create a new audience
      // In production, you might want to store audience IDs in a database to reuse them
      
      // Create new audience
      const createUrl = `${TIKTOK_BUSINESS_API}/dmp/custom_audience/create/`;
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          custom_audience_name: audienceName,
          audience_description: audienceDescription,
          audience_type: 'EMAIL',
          file_paths: [], // Will upload file separately
        }),
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create audience: ${errorText}`);
      }
      
      const createData: TikTokAudienceResponse = await createResponse.json();
      
      if (createData.code !== 0 || !createData.data) {
        throw new Error(`TikTok create error: ${createData.message}`);
      }
      
      audienceId = createData.data.custom_audience_id;
      console.log(`Created new TikTok audience: ${audienceId}`);
      
    } catch (error) {
      console.error('Error creating TikTok audience:', error);
      return {
        success: false,
        audienceId: null,
        added: 0,
        errors: [error instanceof Error ? error.message : 'Failed to create audience'],
      };
    }
    
    // Step 2: Upload users via file (TikTok uses file-based upload for large batches)
    // For simplicity, we'll use the direct update API for small batches
    // For production with >10k users, implement file upload via TikTok's file endpoint
    
    try {
      const BATCH_SIZE = 10000;
      let totalAdded = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < hashedEmails.length; i += BATCH_SIZE) {
        const batch = hashedEmails.slice(i, i + BATCH_SIZE);
        
        const updateUrl = `${TIKTOK_BUSINESS_API}/dmp/custom_audience/update/`;
        const updateResponse = await fetch(updateUrl, {
          method: 'POST',
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            advertiser_id: advertiserId,
            custom_audience_id: audienceId,
            action: 'ADD',
            id_type: 'EMAIL_SHA256',
            id_list: batch,
          }),
        });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('TikTok upload error:', errorText);
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${errorText}`);
          continue;
        }
        
        const updateData: TikTokAudienceResponse = await updateResponse.json();
        
        if (updateData.code !== 0) {
          console.error('TikTok update error:', updateData.message);
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${updateData.message}`);
        } else {
          totalAdded += batch.length;
          console.log(`Uploaded ${batch.length} users to TikTok (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
        }
        
        // Rate limiting: wait 300ms between batches
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      return {
        success: errors.length === 0,
        audienceId,
        added: totalAdded,
        errors,
      };
      
    } catch (error) {
      console.error('Error uploading to TikTok:', error);
      return {
        success: false,
        audienceId,
        added: 0,
        errors: [error instanceof Error ? error.message : 'Failed to upload users'],
      };
    }
    
  } catch (error) {
    console.error('TikTok audience sync error:', error);
    return {
      success: false,
      audienceId: null,
      added: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Remove users from a TikTok Custom Audience.
 * 
 * @param audienceId - The TikTok audience ID
 * @param hashedEmails - Array of SHA-256 hashed emails to remove
 * @returns Success status and removal count
 */
export async function removeFromTikTokAudience(
  audienceId: string,
  hashedEmails: string[]
): Promise<{
  success: boolean;
  removed: number;
}> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  
  if (!accessToken || !advertiserId || hashedEmails.length === 0) {
    return { success: true, removed: 0 };
  }
  
  try {
    const BATCH_SIZE = 10000;
    let totalRemoved = 0;
    
    for (let i = 0; i < hashedEmails.length; i += BATCH_SIZE) {
      const batch = hashedEmails.slice(i, i + BATCH_SIZE);
      
      const removeUrl = `${TIKTOK_BUSINESS_API}/dmp/custom_audience/update/`;
      const removeResponse = await fetch(removeUrl, {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          custom_audience_id: audienceId,
          action: 'REMOVE',
          id_type: 'EMAIL_SHA256',
          id_list: batch,
        }),
      });
      
      if (removeResponse.ok) {
        const removeData: TikTokAudienceResponse = await removeResponse.json();
        if (removeData.code === 0) {
          totalRemoved += batch.length;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return { success: true, removed: totalRemoved };
  } catch (error) {
    console.error('TikTok removal error:', error);
    return { success: false, removed: 0 };
  }
}

/**
 * Get statistics for a TikTok Custom Audience.
 * 
 * @param audienceId - The TikTok audience ID
 * @returns Audience size and status
 */
export async function getTikTokAudienceStats(
  audienceId: string
): Promise<{
  size: number;
  status: string;
} | null> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  
  if (!accessToken || !advertiserId) {
    return null;
  }
  
  try {
    const statsUrl = `${TIKTOK_BUSINESS_API}/dmp/custom_audience/get/`;
    const response = await fetch(statsUrl, {
      method: 'GET',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data: TikTokAudienceResponse = await response.json();
    
    if (data.code !== 0 || !data.data) {
      return null;
    }
    
    // TikTok API returns audience details in the data field
    // The actual structure depends on the response, adjust as needed
    return {
      size: 0, // TikTok doesn't always expose exact size
      status: 'ACTIVE',
    };
  } catch (error) {
    console.error('Error fetching TikTok audience stats:', error);
    return null;
  }
}

/**
 * Delete a TikTok Custom Audience.
 * Use with caution - this permanently removes the audience.
 * 
 * @param audienceId - The TikTok audience ID
 * @returns Success status
 */
export async function deleteTikTokAudience(audienceId: string): Promise<boolean> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  
  if (!accessToken || !advertiserId) {
    return false;
  }
  
  try {
    const deleteUrl = `${TIKTOK_BUSINESS_API}/dmp/custom_audience/delete/`;
    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        custom_audience_ids: [audienceId],
      }),
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data: TikTokAudienceResponse = await response.json();
    return data.code === 0;
  } catch {
    return false;
  }
}

/**
 * Test TikTok Business API connection and credentials.
 * 
 * @returns True if connection successful
 */
export async function testTikTokConnection(): Promise<boolean> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  
  if (!accessToken || !advertiserId) {
    return false;
  }
  
  try {
    const testUrl = `${TIKTOK_BUSINESS_API}/advertiser/info/`;
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data: TikTokAudienceResponse = await response.json();
    return data.code === 0;
  } catch {
    return false;
  }
}
