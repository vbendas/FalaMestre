/**
 * Google Ads Customer Match Connector
 * 
 * Syncs audience segments to Google Ads using Customer Match.
 * Requires OAuth 2.0 credentials and explicit user consent (GDPR/LGPD).
 * 
 * API: https://developers.google.com/google-ads/api/docs/remarketing/audience-types/customer-match
 * Requirements:
 * - Hashed emails (SHA-256)
 * - Consent fields: ad_user_data: GRANTED, ad_personalization: GRANTED
 * - Minimum 1,000 users for list activation
 * - Max 500,000 operations per request
 */

// Temporarily disabled due to module compatibility issues
// import { GoogleAdsApi, CustomerMatchUserListParams } from 'google-ads-api';
import { SegmentId, SEGMENT_DEFINITIONS } from '../segment-definitions';

// Google Ads API client (lazy initialization)
// let googleAdsClient: GoogleAdsApi | null = null;
let googleAdsClient: any = null;

function getGoogleAdsClient(): any {
   if (!googleAdsClient) {
     const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
     const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
     const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
     const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
     
     if (!clientId || !clientSecret || !developerToken || !refreshToken) {
       console.warn('Google Ads credentials not configured');
       return null;
    }
    
     // GoogleAdsApi temporarily disabled
     googleAdsClient = {
       client_id: clientId,
       client_secret: clientSecret,
       developer_token: developerToken,
     } as any;
  }
  
  return googleAdsClient;
}

interface GoogleAdsCustomerMatchMember {
  hashed_email?: string;
  // Google also supports phone and address, but we only use email
}

interface OfflineUserDataJobOperation {
  create: {
    user_identifiers: GoogleAdsCustomerMatchMember[];
  };
}

/**
 * Create or update a Customer Match user list in Google Ads.
 * 
 * @param segmentId - The segment to sync
 * @param hashedEmails - Array of SHA-256 hashed emails (lowercase, trimmed)
 * @returns User list resource name and operation status
 */
export async function syncToGoogleCustomerMatch(
  segmentId: SegmentId,
  hashedEmails: string[]
): Promise<{
  success: boolean;
  listResourceName: string | null;
  added: number;
  errors: string[];
}> {
  const client = getGoogleAdsClient();
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  
  if (!client || !customerId) {
    console.warn('Google Ads not configured, skipping sync');
    return {
      success: false,
      listResourceName: null,
      added: 0,
      errors: ['Google Ads credentials not configured'],
    };
  }
  
  if (hashedEmails.length === 0) {
    return {
      success: true,
      listResourceName: null,
      added: 0,
      errors: [],
    };
  }
  
  const segmentDef = SEGMENT_DEFINITIONS[segmentId];
  const listName = `FM_${segmentId}_${new Date().toISOString().split('T')[0]}`;
  const listDescription = segmentDef.description;
  
  try {
    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    });
    
    // Step 1: Create or find existing user list
    let userListResourceName: string;
    
    try {
      // Search for existing list with this segment ID
      const existingLists = await customer.query(`
        SELECT user_list.resource_name, user_list.name, user_list.size_for_display
        FROM user_list
        WHERE user_list.name LIKE 'FM_${segmentId}%'
        ORDER BY user_list.name DESC
        LIMIT 1
      `);
      
      if (existingLists.length > 0) {
        userListResourceName = existingLists[0].user_list.resource_name;
        console.log(`Using existing Google Ads list: ${userListResourceName}`);
      } else {
        // Create new user list
        const createResult = await customer.userLists.create({
          name: listName,
          description: listDescription,
          membership_life_span: 540, // 540 days (max allowed)
          crm_based_user_list: {
            upload_key_type: 'CONTACT_INFO',
            data_source_type: 'FIRST_PARTY',
          },
        });
        
        userListResourceName = createResult.resource_name;
        console.log(`Created new Google Ads list: ${userListResourceName}`);
      }
    } catch (error) {
      console.error('Error creating/finding user list:', error);
      return {
        success: false,
        listResourceName: null,
        added: 0,
        errors: [error instanceof Error ? error.message : 'Failed to create user list'],
      };
    }
    
    // Step 2: Create OfflineUserDataJob to upload members
    const jobResourceName = await customer.offlineUserDataJobs.create({
      type: 'CUSTOMER_MATCH_USER_LIST',
      customer_match_user_list_metadata: {
        user_list: userListResourceName,
        consent: {
          ad_user_data: 'GRANTED', // Required for GDPR/LGPD
          ad_personalization: 'GRANTED',
        },
      },
    });
    
    console.log(`Created OfflineUserDataJob: ${jobResourceName}`);
    
    // Step 3: Add operations in batches (max 10,000 per batch)
    const BATCH_SIZE = 10000;
    let totalAdded = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < hashedEmails.length; i += BATCH_SIZE) {
      const batch = hashedEmails.slice(i, i + BATCH_SIZE);
      
      const operations: OfflineUserDataJobOperation[] = batch.map(hashedEmail => ({
        create: {
          user_identifiers: [{ hashed_email: hashedEmail }],
        },
      }));
      
      try {
        await customer.offlineUserDataJobs.addOperations({
          resource_name: jobResourceName,
          operations,
        });
        
        totalAdded += batch.length;
        console.log(`Added ${batch.length} users to Google Ads (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
      } catch (error) {
        console.error('Error adding operations:', error);
        errors.push(error instanceof Error ? error.message : 'Failed to add batch');
      }
    }
    
    // Step 4: Run the job
    try {
      await customer.offlineUserDataJobs.run({ resource_name: jobResourceName });
      console.log(`Started OfflineUserDataJob processing`);
    } catch (error) {
      console.error('Error running job:', error);
      errors.push('Failed to run job: ' + (error instanceof Error ? error.message : 'Unknown'));
    }
    
    return {
      success: errors.length === 0,
      listResourceName: userListResourceName,
      added: totalAdded,
      errors,
    };
    
  } catch (error) {
    console.error('Google Customer Match sync error:', error);
    return {
      success: false,
      listResourceName: null,
      added: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Remove users from a Customer Match list.
 * Creates a removal job with DELETE operations.
 * 
 * @param listResourceName - The user list resource name
 * @param hashedEmails - Array of SHA-256 hashed emails to remove
 * @returns Success status and removal count
 */
export async function removeFromGoogleCustomerMatch(
  listResourceName: string,
  hashedEmails: string[]
): Promise<{
  success: boolean;
  removed: number;
}> {
  const client = getGoogleAdsClient();
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  
  if (!client || !customerId || hashedEmails.length === 0) {
    return { success: true, removed: 0 };
  }
  
  try {
    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    });
    
    // Create removal job
    const jobResourceName = await customer.offlineUserDataJobs.create({
      type: 'CUSTOMER_MATCH_USER_LIST',
      customer_match_user_list_metadata: {
        user_list: listResourceName,
      },
    });
    
    // Add remove operations
    const operations = hashedEmails.map(hashedEmail => ({
      remove: {
        user_identifiers: [{ hashed_email: hashedEmail }],
      },
    }));
    
    await customer.offlineUserDataJobs.addOperations({
      resource_name: jobResourceName,
      operations,
    });
    
    await customer.offlineUserDataJobs.run({ resource_name: jobResourceName });
    
    return { success: true, removed: hashedEmails.length };
  } catch (error) {
    console.error('Google Customer Match removal error:', error);
    return { success: false, removed: 0 };
  }
}

/**
 * Get statistics for a Customer Match list.
 * 
 * @param listResourceName - The user list resource name
 * @returns List size and match rate
 */
export async function getGoogleCustomerMatchStats(
  listResourceName: string
): Promise<{
  size: number;
  matchRate: number | null;
} | null> {
  const client = getGoogleAdsClient();
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  
  if (!client || !customerId) {
    return null;
  }
  
  try {
    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    });
    
    const results = await customer.query(`
      SELECT 
        user_list.size_for_display,
        user_list.size_for_search,
        user_list.match_rate_percentage
      FROM user_list
      WHERE user_list.resource_name = '${listResourceName}'
    `);
    
    if (results.length === 0) {
      return null;
    }
    
    const list = results[0].user_list;
    return {
      size: list.size_for_display || 0,
      matchRate: list.match_rate_percentage || null,
    };
  } catch (error) {
    console.error('Error fetching Google Ads stats:', error);
    return null;
  }
}

/**
 * Test Google Ads API connection and credentials.
 * 
 * @returns True if connection successful
 */
export async function testGoogleAdsConnection(): Promise<boolean> {
  const client = getGoogleAdsClient();
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  
  if (!client || !customerId) {
    return false;
  }
  
  try {
    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    });
    
    // Simple query to test connection
    await customer.query('SELECT campaign.id FROM campaign LIMIT 1');
    return true;
  } catch {
    return false;
  }
}
