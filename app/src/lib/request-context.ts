import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequestLogger, type Logger, type LogFields } from './logger';

/**
 * Carries the current request's logger, and the reason it was refused, down
 * to library and database code.
 *
 * Routes bind a logger to the incoming request ID, but the modules they call
 * (the AI client, the storage layer, formation mapping) have no request in
 * hand. Rather than threading a `log` parameter through every signature on
 * the way down, the route enters an async context with `runWithLogger` and
 * anything it calls, however deep and across any number of awaits, reaches
 * the same logger through `getLogger`. Concurrent requests each see their
 * own: AsyncLocalStorage follows the promise chain, not module state.
 *
 * The same scope carries the refusal slot. A gate that turns a request away
 * — the auth check, the rate limiter — is called from the route but has no
 * way to reach the line that reports the outcome, so instead of each route
 * remembering to log its own refusal, the gate records the reason here and
 * the wrapper puts it on the request's one summary line.
 *
 * Server only. This module imports `node:async_hooks`, so it must not be
 * reached from anything a client component imports. The match engine, which
 * the transfer market screen bundles, stays logger-free for that reason.
 */

/** Why a request was turned away, and the detail that explains it. */
export type Refusal = { reason: string; fields: LogFields };

/**
 * The refusal codes the shared gates record.
 *
 * They live here rather than with the route wrapper because the gates write
 * them and the wrapper reads them, and a route importing the wrapper must not
 * drag the wrapper back into the rate limiter. A route recording its own
 * refusal is free to pass a code that is not in this list.
 */
export const REFUSAL_REASONS = {
  unauthorized: 'unauthorized',
  rateLimited: 'rate_limited',
  bodyTooLarge: 'body_too_large',
  bodyInvalidJson: 'body_invalid_json',
  bodyNotObject: 'body_not_object',
  cronSecretMissing: 'cron_secret_missing',
  cronSecretInvalid: 'cron_secret_invalid',
  cronSecretNotConfigured: 'cron_secret_not_configured',
  unhandledError: 'unhandled_error',
} as const;

type RequestScope = {
  log: Logger;
  /** Set by the first gate to refuse; later refusals do not overwrite it. */
  refusal: Refusal | null;
};

const storage = new AsyncLocalStorage<RequestScope>();

/** Route name and request ID stamped on lines written outside any request. */
export const NO_REQUEST_ROUTE = 'process';
export const NO_REQUEST_ID = 'no-request';

let processLogger: Logger | null = null;

/**
 * Logger for work that no request owns: module initialisation, shutdown
 * hooks, background monitors. Its lines are still structured JSON, just
 * stamped with a fixed ID so they are recognisably unowned rather than
 * silently attributed to whichever request happened to run last.
 */
export function getProcessLogger(): Logger {
  if (!processLogger) {
    processLogger = createRequestLogger(NO_REQUEST_ROUTE, null, { requestId: NO_REQUEST_ID });
  }
  return processLogger;
}

/**
 * Runs `fn` with `log` as the current request logger for everything it
 * awaits, and returns the scope so the caller can read back any refusal
 * recorded while it ran.
 */
export function runWithLogger<T>(log: Logger, fn: (scope: RequestScope) => T): T {
  const scope: RequestScope = { log, refusal: null };
  return storage.run(scope, () => fn(scope));
}

/** The request logger in scope, or null when called outside any request. */
export function currentLogger(): Logger | null {
  return storage.getStore()?.log ?? null;
}

/**
 * Records why the current request is being refused.
 *
 * Called by the shared gates and by routes that build a refusal themselves.
 * Only the first call counts: the gate that actually ended the request is the
 * one worth reporting, and a later check running on the way out must not
 * rewrite it. Outside a request it is a no-op, so a gate stays callable from
 * a script or a test with no scope entered.
 *
 * Pass only what explains the refusal. The player's message and the rest of
 * the request body have no place on a log line.
 */
export function recordRefusal(reason: string, fields: LogFields = {}): void {
  const scope = storage.getStore();
  if (scope && scope.refusal === null) {
    scope.refusal = { reason, fields };
  }
}

/** The refusal recorded for the current request, if any. */
export function currentRefusal(): Refusal | null {
  return storage.getStore()?.refusal ?? null;
}

/**
 * The logger for library code to write through.
 *
 * Inside a request this is that request's logger, so the line carries its
 * route and ID; outside one it is the process logger. `scope` names the
 * module writing the line, which is what the route name used to tell you
 * when every module wrote through its own console prefix.
 */
export function getLogger(scope: string): Logger {
  const base = currentLogger() ?? getProcessLogger();
  return base.child({ scope });
}

/** Test hook: drops the cached process logger so a changed LOG_LEVEL is picked up. */
export function resetProcessLogger(): void {
  processLogger = null;
}
