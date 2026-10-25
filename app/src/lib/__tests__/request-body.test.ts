// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readJsonBody, DEFAULT_MAX_BODY_BYTES } from '../request-body';

const URL = 'http://localhost/api/test';
const encoder = new TextEncoder();

function requestWithBody(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST',
    body,
    headers,
    duplex: 'half',
  };
  return new Request(URL, init);
}

function requestFromChunks(chunks: Uint8Array[], headers: Record<string, string> = {}): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return requestWithBody(stream, headers);
}

/** JSON string whose UTF-8 encoding is exactly `bytes` long. */
function jsonOfSize(bytes: number): string {
  const wrapper = '{"p":""}';
  if (bytes < wrapper.length) throw new Error('too small');
  return `{"p":"${'x'.repeat(bytes - wrapper.length)}"}`;
}

async function expectTooLarge(result: Awaited<ReturnType<typeof readJsonBody>>, maxBytes: number) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.reason).toBe('too_large');
  expect(result.response.status).toBe(413);
  await expect(result.response.json()).resolves.toEqual({
    error: 'Request body too large',
    maxBytes,
  });
}

describe('readJsonBody', () => {
  describe('happy path', () => {
    it('parses a small JSON body and reports the byte count', async () => {
      const payload = { userId: 'user_abc123def', message: 'olá' };
      const text = JSON.stringify(payload);

      const result = await readJsonBody(requestWithBody(text));

      expect(result).toEqual({ ok: true, body: payload, bytesRead: encoder.encode(text).byteLength });
    });

    it('uses the default limit when none is given', async () => {
      const atLimit = jsonOfSize(DEFAULT_MAX_BODY_BYTES);
      const overLimit = jsonOfSize(DEFAULT_MAX_BODY_BYTES + 1);

      const okResult = await readJsonBody(requestWithBody(atLimit));
      const bigResult = await readJsonBody(requestWithBody(overLimit));

      expect(okResult.ok).toBe(true);
      await expectTooLarge(bigResult, DEFAULT_MAX_BODY_BYTES);
    });

    it('treats the limit as inclusive', async () => {
      const result = await readJsonBody(requestWithBody(jsonOfSize(100)), { maxBytes: 100 });

      expect(result.ok).toBe(true);
    });

    it('lets a route override the default limit upwards', async () => {
      const body = jsonOfSize(DEFAULT_MAX_BODY_BYTES * 2);

      const result = await readJsonBody(requestWithBody(body), {
        maxBytes: DEFAULT_MAX_BODY_BYTES * 2,
      });

      expect(result.ok).toBe(true);
    });

    it('reassembles a multi-byte character split across chunks', async () => {
      const bytes = encoder.encode('{"m":"café"}');
      // 'é' is 0xC3 0xA9; split between those two bytes.
      const splitAt = bytes.indexOf(0xc3) + 1;
      const request = requestFromChunks([bytes.slice(0, splitAt), bytes.slice(splitAt)]);

      const result = await readJsonBody(request);

      expect(result).toEqual({ ok: true, body: { m: 'café' }, bytesRead: bytes.byteLength });
    });
  });

  describe('Content-Length header', () => {
    it('rejects an oversized declared length without reading the body', async () => {
      const request = requestWithBody(jsonOfSize(50), { 'content-length': '101' });

      const result = await readJsonBody(request, { maxBytes: 100 });

      await expectTooLarge(result, 100);
      // The stream was never locked or consumed, so the body is still intact.
      expect(request.bodyUsed).toBe(false);
      expect(request.body?.locked).toBe(false);
      await expect(request.text()).resolves.toBe(jsonOfSize(50));
    });

    it('accepts a declared length equal to the limit', async () => {
      const text = jsonOfSize(100);
      const request = requestWithBody(text, { 'content-length': '100' });

      const result = await readJsonBody(request, { maxBytes: 100 });

      expect(result.ok).toBe(true);
    });

    it('does not trust a Content-Length smaller than the real body', async () => {
      const text = jsonOfSize(200);
      const request = requestWithBody(text, { 'content-length': '10' });

      const result = await readJsonBody(request, { maxBytes: 100 });

      await expectTooLarge(result, 100);
    });

    it('ignores a malformed Content-Length and falls back to counting bytes', async () => {
      for (const bogus of ['abc', '-5', '1e3', '12.5', '']) {
        const text = jsonOfSize(200);
        const request = requestWithBody(text, { 'content-length': bogus });

        const result = await readJsonBody(request, { maxBytes: 100 });

        await expectTooLarge(result, 100);
      }
    });
  });

  describe('streamed bodies without Content-Length', () => {
    it('rejects a chunked body that grows past the limit', async () => {
      const chunks = Array.from({ length: 5 }, () => encoder.encode('a'.repeat(30)));
      const request = requestFromChunks(chunks);
      expect(request.headers.get('content-length')).toBeNull();

      const result = await readJsonBody(request, { maxBytes: 100 });

      await expectTooLarge(result, 100);
    });

    it('stops pulling and cancels the stream as soon as the limit is crossed', async () => {
      const cancel = vi.fn();
      let pulls = 0;
      const endless = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;
          controller.enqueue(new Uint8Array(1024));
        },
        cancel,
      });

      const result = await readJsonBody(requestWithBody(endless), { maxBytes: 4096 });

      await expectTooLarge(result, 4096);
      expect(cancel).toHaveBeenCalledTimes(1);
      // 4 KiB fits, the 5th chunk crosses the limit; allow a little read-ahead.
      expect(pulls).toBeGreaterThanOrEqual(5);
      expect(pulls).toBeLessThanOrEqual(8);
    });

    it('accepts a chunked body that stays within the limit', async () => {
      const text = JSON.stringify({ turnNumber: 3, decision: null });
      const bytes = encoder.encode(text);
      const request = requestFromChunks([bytes.slice(0, 7), bytes.slice(7, 20), bytes.slice(20)]);

      const result = await readJsonBody(request, { maxBytes: 100 });

      expect(result).toEqual({ ok: true, body: { turnNumber: 3, decision: null }, bytesRead: bytes.byteLength });
    });
  });

  describe('invalid bodies', () => {
    it('returns 400 for malformed JSON that is within the limit', async () => {
      const result = await readJsonBody(requestWithBody('{"userId": '));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('invalid_json');
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
    });

    it('returns 400 for an empty body', async () => {
      const result = await readJsonBody(requestWithBody(''));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('invalid_json');
      expect(result.response.status).toBe(400);
    });

    it('returns 400 when there is no body at all', async () => {
      const result = await readJsonBody(new Request(URL, { method: 'POST' }));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe('invalid_json');
      expect(result.response.status).toBe(400);
    });

    it('reports oversize before it reports malformed JSON', async () => {
      const garbage = 'not json at all '.repeat(20);

      const result = await readJsonBody(requestWithBody(garbage), { maxBytes: 50 });

      await expectTooLarge(result, 50);
    });
  });

  describe('configuration', () => {
    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'throws a RangeError for maxBytes = %s',
      async (maxBytes) => {
        await expect(readJsonBody(requestWithBody('{}'), { maxBytes })).rejects.toBeInstanceOf(RangeError);
      }
    );
  });
});
