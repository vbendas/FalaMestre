import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { recordRefusal, REFUSAL_REASONS } from './request-context';

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Enforces CRON_SECRET Bearer auth with constant-time comparison.
 * Returns a NextResponse on failure, or null when auth is valid.
 *
 * A refusal records itself as the request's refusal reason, so the summary
 * line distinguishes a caller presenting the wrong secret from a deployment
 * that never configured one. The presented secret is never recorded.
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    recordRefusal(REFUSAL_REASONS.cronSecretNotConfigured);
    return NextResponse.json(
      { error: 'Server misconfiguration: CRON_SECRET missing' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    recordRefusal(REFUSAL_REASONS.cronSecretMissing);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const presentedSecret = authHeader.slice('Bearer '.length);

  if (!safeEqual(presentedSecret, configuredSecret)) {
    recordRefusal(REFUSAL_REASONS.cronSecretInvalid);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
