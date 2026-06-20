import { SegmentId, SEGMENT_DEFINITIONS } from '../segment-definitions';

const LINKEDIN_API = 'https://api.linkedin.com/v2';

export async function syncToLinkedInAudience(params: {
  segmentId: SegmentId;
  hashedEmails: string[];
}): Promise<{
  success: boolean;
  audienceId: string | null;
  added: number;
  errors: string[];
}> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const adAccountId = process.env.LINKEDIN_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    return {
      success: false,
      audienceId: null,
      added: 0,
      errors: ['LinkedIn credentials not configured'],
    };
  }

  const { segmentId, hashedEmails } = params;

  if (hashedEmails.length === 0) {
    return { success: true, audienceId: null, added: 0, errors: [] };
  }

  const segmentDef = SEGMENT_DEFINITIONS[segmentId];
  const audienceName = `FM_${segmentId}`;

  try {
    const createResponse = await fetch(`${LINKEDIN_API}/audiences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
      },
      body: JSON.stringify({
        name: audienceName,
        description: segmentDef.description,
        account: `urn:li:sponsoredAccount:${adAccountId}`,
        type: 'CREATIVE',
        format: 'HASHED_EMAIL',
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      return {
        success: false,
        audienceId: null,
        added: 0,
        errors: [`LinkedIn create error: ${errorText}`],
      };
    }

    const createData = await createResponse.json();
    const audienceId = createData.id;

    const BATCH_SIZE = 10000;
    let totalAdded = 0;

    for (let i = 0; i < hashedEmails.length; i += BATCH_SIZE) {
      const batch = hashedEmails.slice(i, i + BATCH_SIZE);

      const updateResponse = await fetch(`${LINKEDIN_API}/audiences/${audienceId}/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202401',
        },
        body: JSON.stringify({
          elements: batch.map(email => ({ email })),
        }),
      });

      if (updateResponse.ok) {
        totalAdded += batch.length;
      }
    }

    return { success: true, audienceId, added: totalAdded, errors: [] };
  } catch (error) {
    return {
      success: false,
      audienceId: null,
      added: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

export async function removeFromLinkedInAudience(
  audienceId: string,
  hashedEmails: string[]
): Promise<{ success: boolean; removed: number }> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!accessToken) return { success: false, removed: 0 };

  try {
    const response = await fetch(`${LINKEDIN_API}/audiences/${audienceId}/users`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
      },
      body: JSON.stringify({
        elements: hashedEmails.map(email => ({ email })),
      }),
    });

    return { success: response.ok, removed: response.ok ? hashedEmails.length : 0 };
  } catch {
    return { success: false, removed: 0 };
  }
}

export async function testLinkedInConnection(): Promise<boolean> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!accessToken) return false;

  try {
    const response = await fetch(`${LINKEDIN_API}/adAccountsV2?q=search&start=0&count=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
