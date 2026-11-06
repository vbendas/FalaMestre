import { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { createRequestLogger, Logger, type LogFields } from './logger';
import {
  runWithLogger,
  recordRefusal,
  REFUSAL_REASONS,
  type Refusal,
} from './request-context';
import { readJsonBody, DEFAULT_MAX_BODY_BYTES } from './request-body';
import { validateBody } from './request-schema';
import { checkRateLimit } from './rate-limit';
import { requireAuth } from './auth-helpers';
import { requireCronAuth } from './cron-auth';

/**
 * Shared wrapper for API route handlers.
 *
 * It hands the handler a context carrying the things every route needs and
 * nobody should wire up by hand: a request logger already bound to the route
 * name and the incoming request ID, a `readJson` that enforces the body size
 * cap before parsing, and the auth and rate-limit gates. It then writes the
 * one line that says how the request ended.
 *
 * `readJson` is a method on the context rather than something the wrapper does
 * up front on purpose. Routes differ in the order they run their auth, secret
 * and body checks, and reading the body eagerly would move the size rejection
 * ahead of the auth check on every route that authenticates first. Calling it
 * where `await request.json()` used to sit keeps each route's existing order.
 *
 * The handler runs inside `runWithLogger`, so library and database code it
 * calls reaches the same logger through `getLogger` and its lines carry this
 * request's ID too.
 */

/**
 * Every request ends with exactly one line carrying this message, so a whole
 * request's outcome is one grep away and counting them counts requests.
 */
export const REQUEST_COMPLETED_MESSAGE = 'Request completed';

/** Re-exported so a route reads the codes off the wrapper it already imports. */
export { REFUSAL_REASONS } from './request-context';

/**
 * Cap on a reason recovered from a response body. Route error strings are
 * short; the cap exists so a long one cannot bloat the summary line.
 */
const MAX_REASON_LENGTH = 200;

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
   * primitive. Each rejection records its reason, which the request's
   * summary line then reports at warn.
   */
  readJson<T = unknown>(options?: ReadJsonOptions): Promise<ReadJsonResult<T>>;
  /**
   * Reads the JSON body and checks it against `schema` — the way a route
   * should take a body.
   *
   * Everything `readJson` rejects, this rejects identically; what it adds is
   * the shape check, so a body that parses but is not what the route needs is
   * refused here with 400 `Validation failed` naming the field, instead of
   * being cast to an interface and read as `undefined` by code several checks
   * downstream. `body` is the schema's output and is typed from it, so the
   * route has no cast to make and nothing left to check by hand.
   *
   * `readJson` stays for the routes not yet moved over; new code should take
   * a schema.
   */
  readBody<T>(schema: ZodType<T>, options?: ReadJsonOptions): Promise<ReadJsonResult<T>>;
  /**
   * Records why this request is being refused.
   *
   * Call it next to a refusal the route builds itself, before returning the
   * response. The reason lands on the summary line instead of becoming a
   * second line of its own. Pass only what explains the refusal — never the
   * player's message or other body content.
   */
  refuse(reason: string, fields?: LogFields): void;
  /**
   * Applies the route's rate limit. Returns a 429 to return as-is when the
   * caller is over it, recording the reason and the retry delay, or null to
   * carry on.
   */
  rateLimit(scope: string, limit: number, windowMs: number): NextResponse | null;
  /**
   * The signed-in-user gate. Returns a 401 to return as-is when auth is on
   * and nobody is signed in, recording the reason, or null to carry on.
   */
  requireAuth(): Promise<NextResponse | null>;
  /**
   * The CRON_SECRET gate, for the scheduled routes. Returns the refusal to
   * return as-is (401 for a bad or missing secret, 500 when the secret is not
   * configured), recording the reason, or null to carry on.
   */
  requireCronAuth(): NextResponse | null;
};

export type ApiRouteOptions = {
  /** Byte cap for readJson. Defaults to DEFAULT_MAX_BODY_BYTES. */
  maxBodyBytes?: number;
  /**
   * Reply for a body that is not valid JSON, for routes whose existing
   * wording differs from the helper's `{ error: 'Invalid JSON body' }`.
   */
  invalidJsonResponse?: () => NextResponse;
  /**
   * Gives up on reading the body after this long.
   *
   * Only the match and chat routes set it. They are the ones a client holds
   * open — a stalled upload there ties up a request that was going to run a
   * simulation or call the model, so they would rather answer than wait. A
   * body that stalls and a body that will not parse are indistinguishable to
   * the caller and have always shared one reply; which it was goes on the
   * summary line as `cause`.
   */
  parseTimeoutMs?: number;
};

/** Reason recorded when a route with a parse timeout cannot read its body. */
const INVALID_JSON_OR_TIMEOUT = 'body_invalid_json_or_timeout';

/** `cause` on the summary line when the body stalled rather than misparsed. */
const PARSE_TIMEOUT_MESSAGE = (ms: number) => `Request body parsing timed out after ${ms}ms`;

/**
 * Rejects with `message` if `promise` has not settled within `timeoutMs`.
 *
 * The timer is always cleared, including on the happy path: four routes used
 * to carry their own copy of this and each left a 5s timer pending on every
 * successful request.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

type Handler<Args extends unknown[]> = (
  request: NextRequest,
  context: ApiContext,
  ...args: Args
) => Promise<Response> | Response;

/**
 * Recovers a reason from a refusal the route built without recording one.
 *
 * Every route answers a refusal with `{ error: '<why>' }`, so that field is
 * the reason already written down; reading it keeps a route that has not been
 * taught about `refuse` from logging a bare status. Only `error` is read, and
 * only from a JSON body: the sibling fields on a validation reply quote the
 * offending input, which has no place in a log line. The response is cloned,
 * so the body the caller receives is untouched.
 */
async function reasonFromResponse(response: Response): Promise<string | undefined> {
  try {
    if (!response.body) return undefined;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return undefined;

    const payload: unknown = await response.clone().json();
    if (payload === null || typeof payload !== 'object') return undefined;

    const error = (payload as { error?: unknown }).error;
    if (typeof error !== 'string' || error.length === 0) return undefined;

    return error.slice(0, MAX_REASON_LENGTH);
  } catch {
    // A body that will not clone or parse is not worth failing a log line for.
    return undefined;
  }
}

/**
 * Content type of a response whose outcome is not known when it is returned.
 *
 * A handler that returns a stream has only sent the headers; the match is
 * still being delivered. Reporting the request as finished at that point was
 * shown to log `status: 200` for a stream that then threw halfway, and for one
 * the player disconnected from, and to report a duration that measured only
 * the setup — 0ms for a stream that ran for three hundred.
 */
const STREAMING_CONTENT_TYPE = 'text/event-stream';

/** How a stream ended, once it has. */
type StreamOutcome = 'completed' | 'failed' | 'cancelled';

function isStreaming(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').includes(STREAMING_CONTENT_TYPE);
}

/**
 * Returns a copy of a streaming response that reports the request's outcome
 * once the stream settles, rather than when the headers went out.
 *
 * The body is passed through unchanged; what is added is a tap on its end.
 * `cancel` is the player's browser going away mid-match, which is ordinary
 * and so stays at the success level with the reason recorded; an error from
 * the source is a real failure and is reported as one.
 */
function instrumentStream(
  response: Response,
  report: (outcome: StreamOutcome, error?: unknown) => void | Promise<void>
): Response {
  const source = response.body;
  if (!source) return response;

  let settled = false;
  const settle = (outcome: StreamOutcome, error?: unknown): void => {
    if (settled) return;
    settled = true;
    void report(outcome, error);
  };

  // Taken here rather than inside start(): cancel() needs it too, and a
  // second reader on a locked stream is an error.
  const reader = source.getReader();

  const instrumented = new ReadableStream({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        settle('completed');
        controller.close();
      } catch (error) {
        // Either the handler's stream threw, or the consumer went away and
        // the enqueue failed. Both end the request here.
        settle('failed', error);
        try {
          controller.error(error);
        } catch {
          // Already closed or errored by the cancel path; nothing to add.
        }
      }
    },
    cancel(reason) {
      // The player's browser going away mid-match. Ordinary, but the request
      // did not deliver what it promised, so the line says so.
      settle('cancelled', reason);
      return reader.cancel(reason);
    },
  });

  return new Response(instrumented, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Writes the one line that says how a request ended.
 *
 * info for a request that succeeded, warn for one that was refused, error for
 * one the server could not answer, so a player reporting that they were
 * blocked is a warn-level lookup by route, status and time.
 */
async function logOutcome(
  log: Logger,
  method: string,
  status: number,
  durationMs: number,
  refusal: Refusal | null,
  response?: Response,
  stream?: { outcome: StreamOutcome; error?: unknown }
): Promise<void> {
  const fields: LogFields = { method, status, durationMs };

  if (stream) {
    fields.stream = stream.outcome;
    if (stream.outcome === 'failed') {
      fields.reason = 'stream_failed';
      fields.error = stream.error;
    } else if (stream.outcome === 'cancelled') {
      fields.reason = 'stream_cancelled';
    }
  }

  if (refusal) {
    fields.reason = refusal.reason;
    Object.assign(fields, refusal.fields);
  } else if (status >= 400 && response) {
    const recovered = await reasonFromResponse(response);
    if (recovered !== undefined) fields.reason = recovered;
  }

  // A stream that died after a 200 header is a failure however the status
  // reads, so it is reported as one.
  if (stream?.outcome === 'failed') {
    log.error(REQUEST_COMPLETED_MESSAGE, fields);
    return;
  }

  if (status >= 500) {
    log.error(REQUEST_COMPLETED_MESSAGE, fields);
  } else if (status >= 400) {
    log.warn(REQUEST_COMPLETED_MESSAGE, fields);
  } else {
    log.info(REQUEST_COMPLETED_MESSAGE, fields);
  }
}

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
  const parseTimeoutMs = options.parseTimeoutMs;

  return async (request: NextRequest, ...args: Args): Promise<Response> => {
    const log = createRequestLogger(route, request);
    const startedAt = Date.now();
    const method = request.method ?? 'UNKNOWN';

    /** The invalid-JSON reply, which a route may word its own way. */
    const invalidJson = (): NextResponse =>
      options.invalidJsonResponse?.() ??
      NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    // Named rather than written inline on the context so readBody can build
    // on it; the two must not drift into reading the body two different ways.
    const readJson = async <T>(readOptions: ReadJsonOptions = {}): Promise<ReadJsonResult<T>> => {
      const limit = readOptions.maxBytes ?? maxBytes;

      let result: Awaited<ReturnType<typeof readJsonBody<T>>>;
      try {
        const read = readJsonBody<T>(request, { maxBytes: limit });
        result = parseTimeoutMs === undefined
          ? await read
          : await withTimeout(read, parseTimeoutMs, PARSE_TIMEOUT_MESSAGE(parseTimeoutMs));
      } catch (error) {
        // Only reachable on a route that set a timeout: readJsonBody itself
        // answers rather than throwing. The reply cannot say whether the body
        // stalled or would not parse, so the line does.
        recordRefusal(INVALID_JSON_OR_TIMEOUT, {
          cause: error instanceof Error ? error.message : String(error),
        });
        return { ok: false, response: invalidJson() };
      }

      if (result.ok) {
        return { ok: true, body: result.body };
      }

      if (result.reason === 'too_large') {
        recordRefusal(REFUSAL_REASONS.bodyTooLarge, { maxBytes: limit });
        return { ok: false, response: result.response };
      }

      if (result.reason === 'not_object') {
        recordRefusal(REFUSAL_REASONS.bodyNotObject);
        return { ok: false, response: result.response };
      }

      // A route with a timeout reports both failures under one reason, so a
      // malformed body and a stalled one are counted together and told apart
      // by `cause` rather than by two codes that mean the same refusal.
      if (parseTimeoutMs !== undefined) {
        recordRefusal(INVALID_JSON_OR_TIMEOUT, { cause: result.reason });
      } else {
        recordRefusal(REFUSAL_REASONS.bodyInvalidJson);
      }
      return { ok: false, response: invalidJson() };
    };

    const context: ApiContext = {
      log,
      refuse: recordRefusal,

      rateLimit(scope: string, limit: number, windowMs: number): NextResponse | null {
        // checkRateLimit records the refusal itself.
        const result = checkRateLimit(request, scope, limit, windowMs);
        if (result.ok) return null;

        return NextResponse.json(
          { error: 'Too many requests', retryAfter: result.retryAfterSeconds },
          {
            status: 429,
            headers: { 'Retry-After': String(result.retryAfterSeconds) },
          }
        );
      },

      // Both gates record their own refusal; these are here so a route reads
      // its checks off one context rather than importing each helper.
      requireAuth: () => requireAuth(),
      requireCronAuth: () => requireCronAuth(request),

      readJson,

      async readBody<T>(
        schema: ZodType<T>,
        readOptions: ReadJsonOptions = {}
      ): Promise<ReadJsonResult<T>> {
        const raw = await readJson<unknown>(readOptions);
        if (!raw.ok) return raw;

        const validated = validateBody(schema, raw.body);
        if (!validated.ok) return { ok: false, response: validated.response };

        return { ok: true, body: validated.data };
      },
    };

    let scope!: { refusal: Refusal | null };
    let response: Response;
    try {
      response = await runWithLogger(log, (requestScope) => {
        scope = requestScope;
        return handler(request, context, ...args);
      });
    } catch (error) {
      // A handler that threw past its own catch still ends the request, so it
      // still gets its line — carrying the error, since no response will.
      const refusal: Refusal = scope?.refusal ?? {
        reason: REFUSAL_REASONS.unhandledError,
        fields: {},
      };
      refusal.fields = { ...refusal.fields, error };
      await logOutcome(log, method, 500, Date.now() - startedAt, refusal);
      throw error;
    }

    if (isStreaming(response)) {
      // The request is not over; the line comes when the stream settles.
      return instrumentStream(response, (outcome, error) =>
        logOutcome(
          log,
          method,
          response.status,
          Date.now() - startedAt,
          scope?.refusal ?? null,
          undefined,
          { outcome, error }
        )
      );
    }

    await logOutcome(
      log,
      method,
      response.status,
      Date.now() - startedAt,
      scope?.refusal ?? null,
      response
    );
    return response;
  };
}
