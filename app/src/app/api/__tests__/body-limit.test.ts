// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_MAX_BODY_BYTES } from '@/lib/request-body';

// Auth is checked before the body is read; stub it so these tests exercise
// the body-size path rather than the 401 branch.
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(async () => null),
  getAuthenticatedUser: vi.fn(async () => null),
  getRequestUserId: vi.fn(async () => null),
}));

import { POST as conversationPOST } from '../conversation/route';
import { POST as matchPOST } from '../match/route';
import { POST as matchDecidePOST } from '../match/decide/route';
import { POST as matchStreamPOST } from '../match/stream/route';

/** A syntactically valid JSON body larger than the default limit. */
function oversizedBody(): string {
  const padding = 'x'.repeat(DEFAULT_MAX_BODY_BYTES);
  return JSON.stringify({ userId: 'user_abc123def', message: padding, padding });
}

function postRequest(url: string, body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const ROUTES = [
  { name: 'conversation', url: 'http://localhost/api/conversation', handler: conversationPOST },
  { name: 'match', url: 'http://localhost/api/match', handler: matchPOST },
  { name: 'match-decide', url: 'http://localhost/api/match/decide', handler: matchDecidePOST },
  { name: 'match-stream', url: 'http://localhost/api/match/stream', handler: matchStreamPOST },
] as const;

describe('oversized request bodies', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The routes log a warn line for a rejected body; capture it and keep
    // test output clean.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(ROUTES)('$name answers an oversized body with 413', async ({ url, handler }) => {
    const body = oversizedBody();
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(DEFAULT_MAX_BODY_BYTES);

    const response = await handler(postRequest(url, body));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: 'Request body too large',
      maxBytes: DEFAULT_MAX_BODY_BYTES,
    });
  });

  it.each(ROUTES)(
    '$name rejects an oversized body declared only via Content-Length',
    async ({ url, handler }) => {
      // A body that fits, but with a header claiming it is far larger: the
      // declared-length check short-circuits before any bytes are read.
      const request = postRequest(url, JSON.stringify({ userId: 'user_abc123def' }), {
        'content-length': String(DEFAULT_MAX_BODY_BYTES + 1),
      });

      const response = await handler(request);

      expect(response.status).toBe(413);
    }
  );

  it('match-stream answers a malformed body with 400', async () => {
    const request = postRequest('http://localhost/api/match/stream', '{"userId": ');

    const response = await matchStreamPOST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
  });

  it('match-stream logs a malformed body at warn, like the oversized rejection', async () => {
    await matchStreamPOST(postRequest('http://localhost/api/match/stream', 'not json'));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: 'warn',
      route: 'match-stream',
      message: 'Request body rejected: invalid JSON',
    });
  });

  it.each(ROUTES)('$name logs the rejection as one JSON line naming the route', async ({ name, url, handler }) => {
    await handler(postRequest(url, oversizedBody()));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const line = warnSpy.mock.calls[0][0] as string;
    expect(line).not.toContain('\n');
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: 'warn',
      route: name,
      message: 'Request body rejected: too large',
    });
    expect(typeof parsed.requestId).toBe('string');
    expect(parsed.requestId.length).toBeGreaterThan(0);
  });
});
