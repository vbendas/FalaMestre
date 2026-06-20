import { db } from '@/db';
import { userProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { syncToFacebookAudience } from './connectors/facebook-audiences';
import { syncToTikTokAudience } from './connectors/tiktok-audiences';

export type ConversionEvent =
  | 'wallet_connected'
  | 'soft_training_completed'
  | 'first_purchase'
  | 'phase_3_reached'
  | 'phase_4_reached';

interface ConversionPayload {
  userId: string;
  event: ConversionEvent;
  value?: number;
  currency?: string;
  timestamp?: Date;
}

export async function emitConversion(payload: ConversionPayload): Promise<{
  success: boolean;
  platforms: Record<string, boolean>;
}> {
  const { userId, event, value, currency = 'BRL', timestamp = new Date() } = payload;

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile?.consentDataExport) {
    console.log(`[conversion-emitter] User ${userId} has not consented to ad personalization`);
    return { success: false, platforms: {} };
  }

  const emailHash = profile.emailHash;
  const walletHash = profile.walletAddressHash;

  const results: Record<string, boolean> = {};

  if (emailHash) {
    try {
      await emitToMeta({ emailHash, event, value, currency, timestamp });
      results.meta = true;
    } catch (e) {
      console.error('[conversion-emitter] Meta CAPI error:', e);
      results.meta = false;
    }

    try {
      await emitToTikTok({ emailHash, event, value, currency, timestamp });
      results.tiktok = true;
    } catch (e) {
      console.error('[conversion-emitter] TikTok Events API error:', e);
      results.tiktok = false;
    }

    try {
      await emitToGoogle({ emailHash, event, value, currency, timestamp });
      results.google = true;
    } catch (e) {
      console.error('[conversion-emitter] Google Conversion Upload error:', e);
      results.google = false;
    }
  }

  return { success: Object.values(results).some(Boolean), platforms: results };
}

async function emitToMeta(params: {
  emailHash: string;
  event: ConversionEvent;
  value?: number;
  currency: string;
  timestamp: Date;
}) {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  const pixelId = process.env.FACEBOOK_PIXEL_ID;
  if (!accessToken || !pixelId) return;

  const eventName = mapEventToMeta(params.event);
  if (!eventName) return;

  const response = await fetch(
    `https://graph.facebook.com/v22.0/${pixelId}/events?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(params.timestamp.getTime() / 1000),
            user_data: { em: params.emailHash },
            custom_data: {
              value: params.value,
              currency: params.currency,
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Meta CAPI error: ${response.status}`);
  }
}

async function emitToTikTok(params: {
  emailHash: string;
  event: ConversionEvent;
  value?: number;
  currency: string;
  timestamp: Date;
}) {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  if (!accessToken || !advertiserId) return;

  const eventName = mapEventToTikTok(params.event);
  if (!eventName) return;

  const response = await fetch(
    'https://business-api.tiktok.com/open_api/v1.3/event/track/',
    {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_source: 'user_id_only',
        event_source_id: advertiserId,
        data: [
          {
            event: eventName,
            timestamp: params.timestamp.toISOString(),
            properties: {
              value: params.value,
              currency: params.currency,
            },
            user: {
              email: params.emailHash,
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`TikTok Events API error: ${response.status}`);
  }
}

async function emitToGoogle(params: {
  emailHash: string;
  event: ConversionEvent;
  value?: number;
  currency: string;
  timestamp: Date;
}) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (!developerToken || !customerId) return;

  console.log(`[conversion-emitter] Google conversion upload: ${params.event} for ${customerId}`);
}

function mapEventToMeta(event: ConversionEvent): string | null {
  const map: Record<ConversionEvent, string> = {
    wallet_connected: 'CompleteRegistration',
    soft_training_completed: 'Lead',
    first_purchase: 'Purchase',
    phase_3_reached: 'LevelAchieved',
    phase_4_reached: 'LevelAchieved',
  };
  return map[event] ?? null;
}

function mapEventToTikTok(event: ConversionEvent): string | null {
  const map: Record<ConversionEvent, string> = {
    wallet_connected: 'CompleteRegistration',
    soft_training_completed: 'SubmitForm',
    first_purchase: 'Purchase',
    phase_3_reached: 'ViewContent',
    phase_4_reached: 'ViewContent',
  };
  return map[event] ?? null;
}
