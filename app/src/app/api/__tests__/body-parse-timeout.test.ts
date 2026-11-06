// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The routes that will not wait forever for a body.
 *
 * Four routes set `parseTimeoutMs` on the wrapper: the chat route and the
 * three match routes, the ones that go on to run a simulation or call the
 * model. A client that opens the request and then stops sending would
 * otherwise hold one of those open indefinitely — the body reader is
 * awaiting a chunk that is never coming, and nothing else in the stack has
 * an opinion about how long that may take.
 *
 * Each of those four used to carry its own copy of the timeout, and every
 * copy leaked its timer on the way out: the 5s `setTimeout` was only ever
 * cleared on the failure path, so a successful request left one pending.
 * The wrapper owns it now and clears it either way, and these tests are
 * what says the behaviour survived being moved.
 *
 * Two things are checked for each: that the request is answered rather than
 * left hanging, and that the answer is the 'or timeout' reply with the
 * summary line naming the stall rather than a parse failure. match-stream
 * is here as the contrast — it sets no timeout, so it is still waiting when
 * the others have given up.
 */

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(async () => null),
  getAuthenticatedUser: vi.fn(async () => null),
  getRequestUserId: vi.fn(async () => null),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/db', () => {
  const reach = async () => {
    throw new Error('a body-timeout test reached the database');
  };
  return {
    db: {
      query: new Proxy({}, { get: () => ({ findFirst: reach, findMany: reach }) }),
      insert: () => ({ values: reach }),
      update: () => ({ set: () => ({ where: reach }) }),
    },
  };
});

import { POST as conversationPOST } from '../conversation/route';
import { POST as matchPOST } from '../match/route';
import { POST as matchDecidePOST } from '../match/decide/route';
import { POST as matchFinalizePOST } from '../match/finalize/route';
import { POST as matchStreamPOST } from '../match/stream/route';

/** The timeout every one of these routes is configured with. */
const PARSE_TIMEOUT_MS = 5000;

type Handler = (request: NextRequest) => Promise<Response>;

const TIMEOUT_ROUTES: Array<{ name: string; handler: Handler; url: string }> = [
  { name: 'conversation', handler: conversationPOST, url: 'http://localhost/api/conversation' },
  { name: 'match', handler: matchPOST, url: 'http://localhost/api/match' },
  { name: 'match-decide', handler: matchDecidePOST, url: 'http://localhost/api/match/decide' },
  { name: 'match-finalize', handler: matchFinalizePOST, url: 'http://localhost/api/match/finalize' },
];

/**
 * A request whose body opens and then stops: one chunk of a JSON object
 * that is never completed and never closed.
 *
 * Deliberately not an empty stream — an empty one closes, and a body that
 * closed early is a parse failure, which is the other half of this reply.
 * This one stays open, which is the half under test. The returned `abandon`
 * closes it so the reader is not left attached once the test is done.
 */
function neverFinishingBody(url: string): { request: NextRequest; abandon: () => void } {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      c.enqueue(new TextEncoder().encode('{"userId":"user_abc123def"'));
    },
  });

  // `duplex: 'half'` is required by Node to send a stream as a body and is
  // in neither RequestInit the types offer, hence building the Request and
  // wrapping it rather than passing an init NextRequest will not accept.
  const underlying = new Request(url, {
    method: 'POST',
    body: stream,
    headers: { 'content-type': 'application/json' },
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  return {
    request: new NextRequest(underlying),
    abandon: () => {
      try {
        controller.close();
      } catch {
        // Already closed by the reader's cancel; nothing to do.
      }
    },
  };
}

describe('a body that never finishes arriving', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(TIMEOUT_ROUTES)('$name answers rather than hanging on it', async (route) => {
    const { request, abandon } = neverFinishingBody(route.url);

    const pending = route.handler(request);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    // Nothing has arrived and nothing will. Before the timeout, the route is
    // still waiting — if this were already answered, the test below would
    // pass for the wrong reason.
    await vi.advanceTimersByTimeAsync(PARSE_TIMEOUT_MS - 100);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    const response = await pending;

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body or timeout' });
    abandon();
  });

  it.each(TIMEOUT_ROUTES)('$name reports the stall, not a parse failure', async (route) => {
    const { request, abandon } = neverFinishingBody(route.url);

    const pending = route.handler(request);
    await vi.advanceTimersByTimeAsync(PARSE_TIMEOUT_MS + 100);
    await pending;

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      level: 'warn',
      route: route.name,
      message: 'Request completed',
      status: 400,
      reason: 'body_invalid_json_or_timeout',
      cause: `Request body parsing timed out after ${PARSE_TIMEOUT_MS}ms`,
    });
    abandon();
  });

  it.each(TIMEOUT_ROUTES)('$name still answers a body that closes early as a parse failure', async (route) => {
    // The other half of the shared reply: same wording to the caller, but
    // the line says `invalid_json`, so the two are told apart in the logs.
    const request = new NextRequest(route.url, {
      method: 'POST',
      body: '{"userId": ',
      headers: { 'content-type': 'application/json' },
    });

    const response = await route.handler(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body or timeout' });
    expect(JSON.parse(warnSpy.mock.calls[0][0] as string)).toMatchObject({
      reason: 'body_invalid_json_or_timeout',
      cause: 'invalid_json',
    });
  });

  it('match-stream sets no timeout, so it is still waiting when the others have given up', async () => {
    const { request, abandon } = neverFinishingBody('http://localhost/api/match/stream');

    const pending = matchStreamPOST(request);
    let settled = false;
    void pending.then(() => {
      settled = true;
    }).catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(PARSE_TIMEOUT_MS * 4);

    expect(settled).toBe(false);

    // Closing the body lets it finish, so the test does not leave a reader
    // attached to a stream nobody will ever feed.
    abandon();
    await vi.advanceTimersByTimeAsync(0);
    const response = await pending;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
  });
});
