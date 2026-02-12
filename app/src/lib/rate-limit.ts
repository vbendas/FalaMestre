import type { NextRequest } from 'next/server';

type Entry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Entry>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

/**
 * Simple in-memory rate limiter for serverless route handlers.
 * Best-effort only; enough to protect obvious abuse in MVP/demo environments.
 */
export function checkRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const key = `${scope}:${getClientIp(request)}`;
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  entry.count += 1;
  buckets.set(key, entry);
  return { ok: true };
}
