// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withApiRoute, type ApiContext } from '../api-route';
import { DEFAULT_MAX_BODY_BYTES } from '../request-body';

const URL = 'http://localhost/api/example';

function post(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(URL, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function parsedLines(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
}

describe('withApiRoute', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handler invocation', () => {
    it('passes the request through and returns the handler response untouched', async () => {
      const handler = vi.fn<(request: NextRequest, ctx: ApiContext) => Promise<Response>>(
        async () => NextResponse.json({ hello: 'world' }, { status: 201 })
      );
      const wrapped = withApiRoute('example', handler);
      const request = post('{}');

      const response = await wrapped(request);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBe(request);
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual({ hello: 'world' });
    });

    it('forwards any further arguments after the context', async () => {
      type Params = { params: { id: string } };
      const handler = vi.fn<(request: NextRequest, ctx: ApiContext, params: Params) => Promise<Response>>(
        async () => new Response(null, { status: 204 })
      );
      const wrapped = withApiRoute<[Params]>('example', handler);
      const extra = { params: { id: '42' } };

      await wrapped(post('{}'), extra);

      expect(handler.mock.calls[0][2]).toBe(extra);
    });

    it('does not read the body before the handler runs', async () => {
      // Routes decide where the body check sits relative to their auth
      // checks; the wrapper must leave the stream untouched until asked.
      let bodyUsedOnEntry: boolean | undefined;
      const wrapped = withApiRoute('example', async (request) => {
        bodyUsedOnEntry = request.bodyUsed;
        return new Response(null, { status: 204 });
      });

      await wrapped(post(JSON.stringify({ a: 1 })));

      expect(bodyUsedOnEntry).toBe(false);
    });

    it('lets a handler exception propagate rather than converting it', async () => {
      const wrapped = withApiRoute('example', async () => {
        throw new Error('boom');
      });

      await expect(wrapped(post('{}'))).rejects.toThrow('boom');
    });
  });

  describe('log', () => {
    it('is bound to the route name and generates a request ID', async () => {
      let log: ApiContext['log'] | undefined;
      const wrapped = withApiRoute('example', async (_request, ctx) => {
        log = ctx.log;
        ctx.log.error('something failed', { code: 7 });
        return new Response(null, { status: 204 });
      });

      await wrapped(post('{}'));

      expect(log?.route).toBe('example');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [line] = parsedLines(errorSpy);
      expect(line).toMatchObject({ level: 'error', route: 'example', message: 'something failed', code: 7 });
      expect(line.requestId).toBe(log?.requestId);
      expect(typeof line.requestId).toBe('string');
      expect(line.requestId.length).toBeGreaterThan(0);
    });

    it('reuses a well-formed x-request-id header', async () => {
      const wrapped = withApiRoute('example', async (_request, { log }) => {
        log.info('hello');
        return new Response(null, { status: 204 });
      });

      await wrapped(post('{}', { 'x-request-id': 'trace-abc-123' }));

      expect(parsedLines(logSpy)[0]).toMatchObject({ route: 'example', requestId: 'trace-abc-123' });
    });

    it('discards a malformed x-request-id in favour of a generated one', async () => {
      const wrapped = withApiRoute('example', async (_request, { log }) => {
        log.info('hello');
        return new Response(null, { status: 204 });
      });

      await wrapped(post('{}', { 'x-request-id': 'has spaces and "quotes"' }));

      const [line] = parsedLines(logSpy);
      expect(line.requestId).not.toBe('has spaces and "quotes"');
      expect(line.requestId.length).toBeGreaterThan(0);
    });
  });

  describe('readJson', () => {
    /** A handler that returns the readJson outcome as the response. */
    function echoRoute(options?: Parameters<typeof withApiRoute>[2], perCall?: { maxBytes?: number }) {
      return withApiRoute(
        'example',
        async (_request, { readJson }) => {
          const result = await readJson<{ value?: unknown }>(perCall);
          if (!result.ok) return result.response;
          return NextResponse.json({ parsed: result.body });
        },
        options
      );
    }

    it('returns the parsed body for a well-formed request', async () => {
      const response = await echoRoute()(post(JSON.stringify({ value: [1, 2, 3] })));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ parsed: { value: [1, 2, 3] } });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('answers an oversized body with 413 and the default cap', async () => {
      const body = JSON.stringify({ value: 'x'.repeat(DEFAULT_MAX_BODY_BYTES) });

      const response = await echoRoute()(post(body));

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual({
        error: 'Request body too large',
        maxBytes: DEFAULT_MAX_BODY_BYTES,
      });
    });

    it('rejects a body that only claims to be oversized via Content-Length', async () => {
      const response = await echoRoute()(
        post(JSON.stringify({ value: 1 }), { 'content-length': String(DEFAULT_MAX_BODY_BYTES + 1) })
      );

      expect(response.status).toBe(413);
    });

    it('logs the oversized rejection as one warn line with route, request ID and cap', async () => {
      const body = JSON.stringify({ value: 'x'.repeat(DEFAULT_MAX_BODY_BYTES) });

      await echoRoute()(post(body, { 'x-request-id': 'req-size' }));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const raw = warnSpy.mock.calls[0][0] as string;
      expect(raw).not.toContain('\n');
      expect(JSON.parse(raw)).toMatchObject({
        level: 'warn',
        route: 'example',
        requestId: 'req-size',
        message: 'Request body rejected: too large',
        maxBytes: DEFAULT_MAX_BODY_BYTES,
      });
    });

    it('answers malformed JSON with the default 400 reply and logs it at warn', async () => {
      const response = await echoRoute()(post('{"value": ', { 'x-request-id': 'req-bad' }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(parsedLines(warnSpy)[0]).toMatchObject({
        level: 'warn',
        route: 'example',
        requestId: 'req-bad',
        message: 'Request body rejected: invalid JSON',
      });
    });

    it.each([
      ['null', 'null'],
      ['an array', '[1,2,3]'],
      ['a number', '42'],
    ])('answers %s with 400 and logs it at warn as not a JSON object', async (_label, text) => {
      const response = await echoRoute()(post(text, { 'x-request-id': 'req-shape' }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Request body must be a JSON object' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(parsedLines(warnSpy)[0]).toMatchObject({
        level: 'warn',
        route: 'example',
        requestId: 'req-shape',
        message: 'Request body rejected: not a JSON object',
      });
    });

    it('does not apply invalidJsonResponse to a non-object body', async () => {
      const route = echoRoute({
        invalidJsonResponse: () => NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
      });

      const response = await route(post('null'));

      await expect(response.json()).resolves.toEqual({ error: 'Request body must be a JSON object' });
    });

    it('treats a missing body as malformed JSON', async () => {
      const request = new NextRequest(URL, { method: 'POST' });

      const response = await echoRoute()(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
    });

    it('uses invalidJsonResponse for malformed JSON when a route supplies one', async () => {
      const route = echoRoute({
        invalidJsonResponse: () => NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
      });

      const response = await route(post('not json'));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON' });
      // The override only covers the malformed-JSON reply; the log line is unchanged.
      expect(parsedLines(warnSpy)[0]).toMatchObject({ message: 'Request body rejected: invalid JSON' });
    });

    it('does not apply invalidJsonResponse to an oversized body', async () => {
      const route = echoRoute({
        invalidJsonResponse: () => NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
      });

      const response = await route(post(JSON.stringify({ value: 'x'.repeat(DEFAULT_MAX_BODY_BYTES) })));

      expect(response.status).toBe(413);
    });

    it('honours a route-level maxBodyBytes', async () => {
      const route = echoRoute({ maxBodyBytes: 32 });

      const small = await route(post(JSON.stringify({ value: 'ok' })));
      const large = await route(post(JSON.stringify({ value: 'x'.repeat(64) })));

      expect(small.status).toBe(200);
      expect(large.status).toBe(413);
      await expect(large.json()).resolves.toEqual({ error: 'Request body too large', maxBytes: 32 });
      expect(parsedLines(warnSpy)[0]).toMatchObject({ maxBytes: 32 });
    });

    it('lets one readJson call override the route cap', async () => {
      const route = echoRoute({ maxBodyBytes: 32 }, { maxBytes: 1024 });

      const response = await route(post(JSON.stringify({ value: 'x'.repeat(64) })));

      expect(response.status).toBe(200);
    });
  });
});
