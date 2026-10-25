import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger, Logger } from './logger';
import { readJsonBody, DEFAULT_MAX_BODY_BYTES } from './request-body';

/**
 * Shared wrapper for API route handlers.
 *
 * It hands the handler a context carrying the two things every route needs
 * and nobody should wire up by hand: a request logger already bound to the
 * route name and the incoming request ID, and a `readJson` that enforces the
 * body size cap before parsing.
 *
 * `readJson` is a method on the context rather than something the wrapper does
 * up front on purpose. Routes differ in the order they run their auth, secret
 * and body checks, and reading the body eagerly would move the size rejection
 * ahead of the auth check on every route that authenticates first. Calling it
 * where `await request.json()` used to sit keeps each route's existing order.
 */

export type ReadJsonResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse };

export type ReadJsonOptions = {
  /** Overrides the route's byte cap for this one call. */
  maxBytes?: number;
};

export type ApiContext = {
  /** Logger bound to the route name and this request's ID. */
  readonly log: Logger;
  /**
   * Reads the JSON body under the route's size cap.
   *
   * Returns the parsed body, or a response to return as-is: 413 for a body
   * over the cap, the invalid-JSON reply (400 `Invalid JSON body` unless the
   * route overrides it) for one that will not parse, and 400 `Request body
   * must be a JSON object` for valid JSON that is null, an array or a
   * primitive. Every rejection is logged at warn before the result comes
   * back.
   */
  readJson<T = unknown>(options?: ReadJsonOptions): Promise<ReadJsonResult<T>>;
};

export type ApiRouteOptions = {
  /** Byte cap for readJson. Defaults to DEFAULT_MAX_BODY_BYTES. */
  maxBodyBytes?: number;
  /**
   * Reply for a body that is not valid JSON, for routes whose existing
   * wording differs from the helper's `{ error: 'Invalid JSON body' }`.
   */
  invalidJsonResponse?: () => NextResponse;
};

type Handler<Args extends unknown[]> = (
  request: NextRequest,
  context: ApiContext,
  ...args: Args
) => Promise<Response> | Response;

/**
 * Wraps a route handler, giving it an ApiContext as its second argument.
 *
 * Any further arguments Next.js passes (such as a dynamic segment's params)
 * are forwarded on after the context.
 */
export function withApiRoute<Args extends unknown[]>(
  route: string,
  handler: Handler<Args>,
  options: ApiRouteOptions = {}
): (request: NextRequest, ...args: Args) => Promise<Response> {
  const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async (request: NextRequest, ...args: Args): Promise<Response> => {
    const log = createRequestLogger(route, request);

    const context: ApiContext = {
      log,
      async readJson<T>(readOptions: ReadJsonOptions = {}): Promise<ReadJsonResult<T>> {
        const result = await readJsonBody<T>(request, {
          maxBytes: readOptions.maxBytes ?? maxBytes,
        });

        if (result.ok) {
          return { ok: true, body: result.body };
        }

        if (result.reason === 'too_large') {
          log.warn('Request body rejected: too large', {
            maxBytes: readOptions.maxBytes ?? maxBytes,
          });
          return { ok: false, response: result.response };
        }

        if (result.reason === 'not_object') {
          log.warn('Request body rejected: not a JSON object');
          return { ok: false, response: result.response };
        }

        log.warn('Request body rejected: invalid JSON');
        return {
          ok: false,
          response: options.invalidJsonResponse?.() ?? result.response,
        };
      },
    };

    return handler(request, context, ...args);
  };
}
