import { NextResponse } from 'next/server';

/**
 * Default cap for JSON request bodies on public API routes.
 * The largest legitimate payload (match/decide with a full squad) is a
 * few tens of KiB, so 64 KiB leaves headroom without inviting abuse.
 */
export const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

export type ReadJsonBodyOptions = {
  /** Maximum accepted body size in bytes. Defaults to DEFAULT_MAX_BODY_BYTES. */
  maxBytes?: number;
};

export type ReadJsonBodyResult<T> =
  | { ok: true; body: T; bytesRead: number }
  | { ok: false; reason: 'too_large'; response: NextResponse }
  | { ok: false; reason: 'invalid_json'; response: NextResponse }
  | { ok: false; reason: 'not_object'; response: NextResponse };

function tooLarge(maxBytes: number): ReadJsonBodyResult<never> {
  return {
    ok: false,
    reason: 'too_large',
    response: NextResponse.json(
      { error: 'Request body too large', maxBytes },
      { status: 413 }
    ),
  };
}

function notObject(): ReadJsonBodyResult<never> {
  return {
    ok: false,
    reason: 'not_object',
    response: NextResponse.json(
      { error: 'Request body must be a JSON object' },
      { status: 400 }
    ),
  };
}

/** True for a plain JSON object: not null, not an array, not a primitive. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidJson(): ReadJsonBodyResult<never> {
  return {
    ok: false,
    reason: 'invalid_json',
    response: NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    ),
  };
}

/**
 * Parses a Content-Length header. Returns null when the header is absent or
 * malformed; malformed values fall through to the streaming check rather than
 * being trusted either way.
 */
function parseContentLength(request: Request): number | null {
  const raw = request.headers.get('content-length');
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Reads a JSON request body while enforcing a byte limit.
 *
 * Two checks are applied:
 *  1. If Content-Length is present and already exceeds the limit the body is
 *     rejected without reading a single byte.
 *  2. The body stream is then consumed chunk by chunk and the running byte
 *     count is compared to the limit. This is the check that actually
 *     protects the route: chunked transfer encoding has no Content-Length,
 *     and a client can declare a small Content-Length regardless. As soon as
 *     the limit is crossed the stream is cancelled and a 413 is returned.
 *
 * JSON.parse only runs once the whole body has been read and is within the
 * limit. The parsed value must then be a plain object: `null`, an array or a
 * bare primitive are valid JSON but every route reads named fields off the
 * body, so they are answered with 400 here instead of surfacing as a
 * TypeError in the route's 500 handler. Returns a discriminated result so
 * routes can `return result.response` on failure and keep their own
 * validation flow on success.
 */
export async function readJsonBody<T = unknown>(
  request: Request,
  options: ReadJsonBodyOptions = {}
): Promise<ReadJsonBodyResult<T>> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError(`maxBytes must be a positive integer, received ${String(maxBytes)}`);
  }

  const declaredLength = parseContentLength(request);
  if (declaredLength !== null && declaredLength > maxBytes) {
    return tooLarge(maxBytes);
  }

  const stream = request.body;
  if (!stream) {
    return invalidJson();
  }

  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  const reader = stream.getReader();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel();
        return tooLarge(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Decode once after merging so multi-byte characters split across chunks
  // are reassembled correctly.
  const text = new TextDecoder('utf-8').decode(merged);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalidJson();
  }

  if (!isPlainObject(parsed)) {
    return notObject();
  }

  return { ok: true, body: parsed as T, bytesRead };
}
