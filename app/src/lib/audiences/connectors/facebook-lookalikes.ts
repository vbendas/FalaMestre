import { SegmentId } from '../segment-definitions';

const GRAPH_API = 'https://graph.facebook.com/v22.0';

export async function createFacebookLookalike(params: {
  seedAudienceId: string;
  segmentId: SegmentId;
  adAccountId: string;
  country: string;
  ratio?: number;
}): Promise<{ success: boolean; lookalikeId: string | null; error: string | null }> {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, lookalikeId: null, error: 'Facebook access token not configured' };
  }

  const { seedAudienceId, adAccountId, country, ratio = 0.01 } = params;

  try {
    const response = await fetch(
      `${GRAPH_API}/${adAccountId}/customaudiences?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `FM_LAL_${params.segmentId}_${country}_${Math.round(ratio * 100)}%`,
          subtype: 'LOOKALIKE',
          origin_audience_id: seedAudienceId,
          lookalike_spec: {
            country,
            ratio,
            starting_ratio: 0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, lookalikeId: null, error: `Facebook API error: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, lookalikeId: data.id, error: null };
  } catch (error) {
    return {
      success: false,
      lookalikeId: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
