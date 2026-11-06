import type { NextRequest } from 'next/server';
import { recordRefusal, REFUSAL_REASONS } from './request-context';

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
 *
 * A rejection records itself as the current request's refusal reason, so the
 * request's summary line says it was rate limited and for how long without
 * the route having to log anything. The client's address is deliberately not
 * recorded: the scope and the retry delay are what explain the refusal.
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
    recordRefusal(REFUSAL_REASONS.rateLimited, { scope, limit, windowMs, retryAfterSeconds });
    return { ok: false, retryAfterSeconds };
  }

  entry.count += 1;
  buckets.set(key, entry);
  return { ok: true };
}
