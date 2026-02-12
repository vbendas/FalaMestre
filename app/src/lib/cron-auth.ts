import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'Server misconfiguration: CRON_SECRET missing' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const presentedSecret = authHeader.slice('Bearer '.length);

  if (!safeEqual(presentedSecret, configuredSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
