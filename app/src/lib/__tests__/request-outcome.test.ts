// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withApiRoute, REQUEST_COMPLETED_MESSAGE, type ApiContext } from '../api-route';

/**
 * Every request ends with one line saying how it ended.
 *
 * The line carries the route, the method, the status and the duration, and a
 * refused request carries why, at warn — so a player reporting that they were
 * blocked can be looked up rather than guessed at. These assert the contract
 * the routes rely on: exactly one such line per request, never more, and
 * nothing from the request body on it beyond what explains the refusal.
 */

const ROUTE_URL = 'http://localhost/api/example';

function post(body = '{}', headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('request outcome line', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lines(spy: ReturnType<typeof vi.spyOn>) {
    return spy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
  }

  /** Every summary line written across all three levels, in order. */
  function summaries() {
    return [...lines(logSpy), ...lines(warnSpy), ...lines(errorSpy)].filter(
      (line) => line.message === REQUEST_COMPLETED_MESSAGE
    );
  }

  it('logs one info line with route, method, status and duration when a request succeeds', async () => {
    const route = withApiRoute('example', async () => NextResponse.json({ ok: true }));

    await route(post('{}', { 'x-request-id': 'ok-1' }));

    expect(summaries()).toEqual([
      expect.objectContaining({
        level: 'info',
        route: 'example',
        requestId: 'ok-1',
        message: REQUEST_COMPLETED_MESSAGE,
        method: 'POST',
        status: 200,
      }),
    ]);
    expect(typeof summaries()[0].durationMs).toBe('number');
    expect(summaries()[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs exactly one summary line even when the handler logs of its own accord', async () => {
    const route = withApiRoute('example', async (_request, ctx: ApiContext) => {
      ctx.log.info('halfway');
      return NextResponse.json({ ok: true });
    });

    await route(post());

    expect(summaries()).toHaveLength(1);
  });

  it('reports a rate-limited request at warn with the reason and the retry delay', async () => {
    const route = withApiRoute('example', async (_request, ctx: ApiContext) => {
      const limited = ctx.rateLimit('example-scope', 1, 60_000);
      if (limited) return limited;
      return NextResponse.json({ ok: true });
    });

    // The first call consumes the single permit, the second is refused.
    await route(post('{}', { 'x-forwarded-for': '203.0.113.9' }));
    logSpy.mockClear();
    warnSpy.mockClear();

    const response = await route(post('{}', { 'x-forwarded-for': '203.0.113.9' }));

    expect(response.status).toBe(429);
    expect(summaries()).toEqual([
      expect.objectContaining({
        level: 'warn',
        route: 'example',
        message: REQUEST_COMPLETED_MESSAGE,
        status: 429,
        reason: 'rate_limited',
        scope: 'example-scope',
        limit: 1,
      }),
    ]);
    expect(typeof summaries()[0].retryAfterSeconds).toBe('number');
  });

  it('reports an auth refusal at warn with the reason', async () => {
    const previous = process.env.AUTH_DISABLED;
    delete process.env.AUTH_DISABLED;
    vi.resetModules();
    vi.doMock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));
    vi.doMock('@/lib/auth', () => ({ authOptions: {} }));

    try {
      const { withApiRoute: wrap } = await import('../api-route');
      const route = wrap('example', async (_request, ctx: ApiContext) => {
        const refused = await ctx.requireAuth();
        if (refused) return refused;
        return NextResponse.json({ ok: true });
      });

      const response = await route(post());

      expect(response.status).toBe(401);
      expect(summaries()).toEqual([
        expect.objectContaining({
          level: 'warn',
          message: REQUEST_COMPLETED_MESSAGE,
          status: 401,
          reason: 'unauthorized',
        }),
      ]);
    } finally {
      if (previous === undefined) delete process.env.AUTH_DISABLED;
      else process.env.AUTH_DISABLED = previous;
      vi.doUnmock('next-auth');
      vi.doUnmock('@/lib/auth');
      vi.resetModules();
    }
  });

  it('carries a reason a route records for a refusal it builds itself', async () => {
    const route = withApiRoute('example', async (_request, ctx: ApiContext) => {
      ctx.refuse('season_over', { week: 39 });
      return NextResponse.json({ error: 'Season complete' }, { status: 409 });
    });

    await route(post());

    expect(summaries()).toEqual([
      expect.objectContaining({
        level: 'warn',
        status: 409,
        reason: 'season_over',
        week: 39,
      }),
    ]);
  });

  it('falls back to the reply\'s own error text when a route records nothing', async () => {
    const route = withApiRoute('example', async () =>
      NextResponse.json({ error: 'Forbidden. You can only access your own data.' }, { status: 403 })
    );

    await route(post());

    expect(summaries()).toEqual([
      expect.objectContaining({
        level: 'warn',
        status: 403,
        reason: 'Forbidden. You can only access your own data.',
      }),
    ]);
  });

  it('does not put the rest of a refusal body on the line', async () => {
    // A validation reply quotes the offending input alongside `error`; only
    // `error` may reach the log.
    const route = withApiRoute('example', async () =>
      NextResponse.json(
        { error: 'Validation failed', message: 'too long', field: 'message' },
        { status: 400 }
      )
    );

    await route(post(JSON.stringify({ message: 'a sentence the player typed' })));

    const [summary] = summaries();
    expect(summary.reason).toBe('Validation failed');
    expect(JSON.stringify(summary)).not.toContain('a sentence the player typed');
    expect(JSON.stringify(summary)).not.toContain('too long');
  });

  it('leaves the response body intact after reading a reason from it', async () => {
    const route = withApiRoute('example', async () =>
      NextResponse.json({ error: 'Not found', detail: 42 }, { status: 404 })
    );

    const response = await route(post());

    await expect(response.json()).resolves.toEqual({ error: 'Not found', detail: 42 });
  });

  it('reports a 500 at error', async () => {
    const route = withApiRoute('example', async () =>
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    );

    await route(post());

    expect(summaries()).toEqual([
      expect.objectContaining({
        level: 'error',
        status: 500,
        reason: 'Internal server error',
      }),
    ]);
  });

  it('still logs a line, with the error, when the handler throws', async () => {
    const boom = new Error('handler exploded');
    const route = withApiRoute('example', async () => {
      throw boom;
    });

    await expect(route(post())).rejects.toThrow('handler exploded');

    expect(summaries()).toEqual([
      expect.objectContaining({
        level: 'error',
        status: 500,
        reason: 'unhandled_error',
        error: expect.objectContaining({ message: 'handler exploded' }),
      }),
    ]);
  });

  it('keeps the first refusal when a later check also refuses', async () => {
    const route = withApiRoute('example', async (_request, ctx: ApiContext) => {
      ctx.refuse('first_reason');
      ctx.refuse('second_reason');
      return NextResponse.json({ error: 'nope' }, { status: 400 });
    });

    await route(post());

    expect(summaries()[0].reason).toBe('first_reason');
  });

  it('does not leak a refusal from one request into the next', async () => {
    const route = withApiRoute('example', async (_request, ctx: ApiContext) => {
      const url = new URL(_request.url);
      if (url.searchParams.get('bad') === '1') {
        ctx.refuse('deliberate');
        return NextResponse.json({ error: 'nope' }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    });

    await route(new NextRequest(`${ROUTE_URL}?bad=1`, { method: 'POST' }));
    logSpy.mockClear();
    warnSpy.mockClear();

    await route(new NextRequest(ROUTE_URL, { method: 'POST' }));

    expect(summaries()).toEqual([
      expect.objectContaining({ level: 'info', status: 200 }),
    ]);
    expect(summaries()[0].reason).toBeUndefined();
  });

  it('records the method it was called with', async () => {
    const route = withApiRoute('example', async () => NextResponse.json({ ok: true }));

    await route(new NextRequest(ROUTE_URL, { method: 'GET' }));

    expect(summaries()[0]).toMatchObject({ method: 'GET', status: 200 });
  });
});

describe('streaming requests', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function summaries() {
    return [logSpy, warnSpy, errorSpy]
      .flatMap((spy) => spy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string)))
      .filter((line) => line.message === REQUEST_COMPLETED_MESSAGE);
  }

  /** A route that streams `chunks`, optionally throwing partway through. */
  function streamRoute(chunks: number, throwAt?: number, delayMs = 0) {
    return withApiRoute('demo-stream', async () => {
      const stream = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < chunks; i++) {
            if (i === throwAt) throw new Error('simulation exploded at minute 45');
            controller.enqueue(new TextEncoder().encode(`data: ${i}\n\n`));
            if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
          controller.close();
        },
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
    });
  }

  async function drain(response: Response): Promise<string | null> {
    const reader = response.body!.getReader();
    try {
      for (;;) {
        const { done } = await reader.read();
        if (done) return null;
      }
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  it('writes no line until the stream settles', async () => {
    const response = await streamRoute(3)(post());

    expect(summaries()).toEqual([]);

    await drain(response);

    expect(summaries()).toHaveLength(1);
  });

  it('reports a stream that ran to the end as a success', async () => {
    const response = await streamRoute(3)(post('{}', { 'x-request-id': 'stream-ok' }));
    await drain(response);

    expect(summaries()).toEqual([
      expect.objectContaining({
        level: 'info',
        route: 'demo-stream',
        requestId: 'stream-ok',
        status: 200,
        stream: 'completed',
      }),
    ]);
  });

  it('reports a stream that failed halfway as a failure, not a 200 success', async () => {
    const response = await streamRoute(5, 2)(post('{}', { 'x-request-id': 'stream-boom' }));
    const readError = await drain(response);

    // The consumer saw the failure, and so does the log.
    expect(readError).toBe('simulation exploded at minute 45');
    expect(summaries()).toEqual([
      expect.objectContaining({
        level: 'error',
        requestId: 'stream-boom',
        stream: 'failed',
        reason: 'stream_failed',
        error: expect.objectContaining({ message: 'simulation exploded at minute 45' }),
      }),
    ]);
  });

  it('records a player who disconnects mid-stream as cancelled', async () => {
    const response = await streamRoute(20, undefined, 5)(
      post('{}', { 'x-request-id': 'stream-gone' })
    );
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(summaries()).toEqual([
      expect.objectContaining({
        level: 'info',
        requestId: 'stream-gone',
        stream: 'cancelled',
        reason: 'stream_cancelled',
      }),
    ]);
  });

  it('times the whole stream, not just the handler that set it up', async () => {
    const response = await streamRoute(4, undefined, 40)(post());
    await drain(response);

    // Four chunks, 40ms apart: a line timing only the setup would say ~0.
    expect(summaries()[0].durationMs).toBeGreaterThan(80);
  });

  it('passes the streamed bytes through untouched', async () => {
    const response = await streamRoute(3)(post());
    const text = await response.text();

    expect(text).toBe('data: 0\n\ndata: 1\n\ndata: 2\n\n');
  });

  it('still reports a refusal on a streaming route at warn', async () => {
    const route = withApiRoute('demo-stream', async (_request, ctx: ApiContext) => {
      ctx.refuse('not_your_save');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    });

    await route(post());

    // The refusal never became a stream, so it is reported immediately.
    expect(summaries()).toEqual([
      expect.objectContaining({ level: 'warn', status: 403, reason: 'not_your_save' }),
    ]);
  });
});
