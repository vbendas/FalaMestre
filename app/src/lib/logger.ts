/**
 * Structured request logging for API route handlers.
 *
 * Every line is a single JSON object terminated by a newline, carrying the
 * same requestId for the whole request so lines can be correlated. Replaces
 * the free-form `console.error('[Conversation] ...')` style calls, where a
 * line gives no way to tell which request produced it.
 *
 * No runtime dependency: output goes through console, which is what the
 * serverless log drain already collects.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Keys owned by the log envelope; extra fields may not overwrite them. */
const RESERVED_KEYS = ['time', 'level', 'route', 'requestId', 'message'] as const;

/** Request IDs are capped so a hostile header cannot bloat every line. */
export const MAX_REQUEST_ID_LENGTH = 64;

/** Conservative allowlist: what real tracing systems emit (UUIDs, hex spans). */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]+$/;

const REQUEST_ID_HEADER = 'x-request-id';

/** Guards against unbounded recursion and cycles when serialising fields. */
const MAX_FIELD_DEPTH = 6;

export type LogFields = Record<string, unknown>;

export type Logger = {
  /** The ID stamped on every line this logger writes. */
  readonly requestId: string;
  readonly route: string;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Returns a logger that merges `fields` into every subsequent line. */
  child(fields: LogFields): Logger;
};

export type CreateLoggerOptions = {
  /** Overrides the incoming/generated request ID. */
  requestId?: string;
  /** Minimum level to emit. Defaults to LOG_LEVEL, else 'info'. */
  level?: LogLevel;
  /** Fields merged into every line. */
  fields?: LogFields;
  /** Sink override, for tests. Defaults to console. */
  write?: (level: LogLevel, line: string) => void;
};

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && value in LEVEL_ORDER;
}

function generateRequestId(): string {
  // randomUUID is available on the Web Crypto global in Node 19+ and on the
  // edge runtime. The fallback keeps the logger usable if it is ever absent.
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Normalises a client-supplied request ID.
 *
 * An inbound x-request-id is attacker-controlled, so it is accepted only when
 * it already looks like a tracing ID: non-empty, within MAX_REQUEST_ID_LENGTH,
 * and made purely of unreserved URL characters. Anything else (control
 * characters, newlines, spaces, quotes, an over-long value) is discarded in
 * favour of a freshly generated ID rather than being trimmed down, so a
 * caller can never steer the stored value by padding it.
 */
export function sanitizeRequestId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!SAFE_REQUEST_ID.test(value)) return null;
  return value;
}

/** Extracts a usable request ID from headers, generating one when absent. */
export function resolveRequestId(request?: { headers: Headers } | null): string {
  const header = request?.headers?.get(REQUEST_ID_HEADER);
  return sanitizeRequestId(header) ?? generateRequestId();
}

/**
 * Converts an Error into a plain object. JSON.stringify yields `{}` for an
 * Error because name/message/stack are not enumerable own properties, which
 * would silently drop the only useful part of an error log line.
 */
function serializeError(error: Error, depth: number): LogFields {
  const result: LogFields = {
    name: error.name,
    message: error.message,
  };
  if (typeof error.stack === 'string') {
    result.stack = error.stack;
  }
  if (error.cause !== undefined && depth < MAX_FIELD_DEPTH) {
    result.cause = serializeValue(error.cause, depth + 1, new WeakSet());
  }
  // Preserve custom own properties such as `code` or `status`.
  for (const key of Object.getOwnPropertyNames(error)) {
    if (key === 'name' || key === 'message' || key === 'stack' || key === 'cause') continue;
    result[key] = serializeValue((error as unknown as LogFields)[key], depth + 1, new WeakSet());
  }
  return result;
}

function serializeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') return Number.isFinite(value as number) ? value : String(value);
  if (type === 'bigint') return (value as bigint).toString();
  if (type === 'function') return `[Function ${(value as () => void).name || 'anonymous'}]`;
  if (type === 'symbol') return (value as symbol).toString();

  if (value instanceof Error) {
    if (depth > MAX_FIELD_DEPTH) return '[Truncated]';
    return serializeError(value, depth);
  }
  if (value instanceof Date) return value.toISOString();

  if (depth > MAX_FIELD_DEPTH) return '[Truncated]';

  const asObject = value as object;
  if (seen.has(asObject)) return '[Circular]';
  seen.add(asObject);

  try {
    if (Array.isArray(value)) {
      return value.map((item) => serializeValue(item, depth + 1, seen));
    }
    if (value instanceof Map) {
      return Object.fromEntries(
        Array.from(value.entries()).map(([k, v]) => [String(k), serializeValue(v, depth + 1, seen)])
      );
    }
    if (value instanceof Set) {
      return Array.from(value).map((item) => serializeValue(item, depth + 1, seen));
    }

    const output: LogFields = {};
    for (const [key, item] of Object.entries(value as LogFields)) {
      output[key] = serializeValue(item, depth + 1, seen);
    }
    return output;
  } finally {
    seen.delete(asObject);
  }
}

/** Public helper so routes can attach an error without a full log call. */
export function serializeLogValue(value: unknown): unknown {
  return serializeValue(value, 0, new WeakSet());
}

function defaultWrite(level: LogLevel, line: string): void {
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function resolveLevel(explicit?: LogLevel): LogLevel {
  if (explicit) return explicit;
  const fromEnv = process.env.LOG_LEVEL?.toLowerCase();
  return isLogLevel(fromEnv) ? fromEnv : 'info';
}

function build(
  route: string,
  requestId: string,
  minLevel: LogLevel,
  boundFields: LogFields,
  write: (level: LogLevel, line: string) => void
): Logger {
  const emit = (level: LogLevel, message: string, fields?: LogFields): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

    const entry: LogFields = {
      time: new Date().toISOString(),
      level,
      route,
      requestId,
      message: typeof message === 'string' ? message : String(message),
    };

    const merged = { ...boundFields, ...fields };
    for (const [key, value] of Object.entries(merged)) {
      // The envelope wins; a stray `level` field must not rewrite the line.
      if ((RESERVED_KEYS as readonly string[]).includes(key)) continue;
      try {
        entry[key] = serializeValue(value, 0, new WeakSet());
      } catch (serializeError) {
        // A throwing getter must not escape a log call made from a catch
        // block, or it would mask the error being reported.
        entry[key] = `[Unserializable: ${
          serializeError instanceof Error ? serializeError.message : 'unknown'
        }]`;
      }
    }

    let line: string;
    try {
      line = JSON.stringify(entry);
    } catch {
      // Last resort: never let logging throw inside a request handler.
      line = JSON.stringify({
        time: entry.time,
        level,
        route,
        requestId,
        message: entry.message,
        logError: 'Failed to serialise log fields',
      });
    }

    write(level, line);
  };

  return {
    requestId,
    route,
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
    child: (fields) => build(route, requestId, minLevel, { ...boundFields, ...fields }, write),
  };
}

/**
 * Creates a logger bound to one request.
 *
 * The request ID comes from a trusted x-request-id header when one is present
 * and well formed, so a trace started upstream stays joined up; otherwise a
 * fresh UUID is generated.
 */
export function createRequestLogger(
  route: string,
  request?: { headers: Headers } | null,
  options: CreateLoggerOptions = {}
): Logger {
  const requestId = sanitizeRequestId(options.requestId) ?? resolveRequestId(request);
  return build(
    route,
    requestId,
    resolveLevel(options.level),
    options.fields ?? {},
    options.write ?? defaultWrite
  );
}
