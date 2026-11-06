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

/**
 * The own properties an Error may carry into the log besides name, message,
 * stack and cause.
 *
 * A foreign error attaches whatever its library finds convenient, and that
 * was shown to be a leak: a Postgres error carries the failing statement as
 * `query` and its bind values as `params` — for a save write, the player's
 * entire game state, measured at 25KB on one line — plus row values in
 * `detail`. So unknown properties are dropped, and these survive because they
 * distinguish one failure from another without quoting anyone's data: they
 * are identifiers from the schema and the standard error taxonomies, not
 * payload.
 *
 * A dropped property is still *named* in `errorFieldsDropped` (names only,
 * never values), so a field we attach to our own errors cannot vanish without
 * a trace — the line says what it is not showing.
 */
const ERROR_FIELD_ALLOWLIST = [
  'code',
  'status',
  'statusCode',
  'severity',
  'constraint',
  'table',
  'schema',
  'routine',
] as const;

/** An allowlisted field is an identifier, so a long value is not one. */
const MAX_ERROR_FIELD_LENGTH = 200;

/** How many dropped-field names are worth listing. */
const MAX_DROPPED_FIELDS = 20;

/**
 * The environment variables whose values are secrets, and only those: the
 * scrub matches these values wherever they appear in a line, not every
 * setting (`LOG_LEVEL=info` must not redact the word "info").
 */
const SECRET_ENV_VARS = [
  'OPENROUTER_API_KEY',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CRON_SECRET',
  'ADMIN_SECRET',
  'DATABASE_URL',
] as const;

/**
 * A secret shorter than this is not scrubbed: redacting a short common string
 * would mangle unrelated text, and no real credential is this short.
 */
const MIN_SECRET_LENGTH = 8;

type SecretToken = { value: string; label: string };

let secretCacheKey = '';
let secretCache: SecretToken[] = [];

/**
 * The secret values to scrub from every string the logger writes.
 *
 * Read from the environment on use and memoised on the joined values, so a
 * test that sets a variable after the module loaded is still covered. For
 * DATABASE_URL the password component is scrubbed on its own as well as the
 * whole string, so a line quoting only part of the URL — the driver's
 * "Connection string: …" message, a stack frame — still comes out clean.
 */
function secretTokens(): SecretToken[] {
  const values = SECRET_ENV_VARS.map((name) => process.env[name] ?? '');
  const key = values.join('\u0000');
  if (key === secretCacheKey) return secretCache;

  const tokens: SecretToken[] = [];
  for (let i = 0; i < SECRET_ENV_VARS.length; i += 1) {
    const name = SECRET_ENV_VARS[i];
    const value = values[i];
    if (value.length < MIN_SECRET_LENGTH) continue;
    tokens.push({ value, label: name });
    if (name === 'DATABASE_URL') {
      // The password alone. `new URL` rejects some malformed strings, so fall
      // back to the `scheme://user:password@` shape when it does.
      let password = '';
      try {
        password = decodeURIComponent(new URL(value).password);
      } catch {
        const match = value.match(/\/\/[^:/@\s]+:([^@\s]+)@/);
        password = match ? match[1] : '';
      }
      if (password.length >= MIN_SECRET_LENGTH) {
        tokens.push({ value: password, label: 'DATABASE_URL_PASSWORD' });
      }
    }
  }

  secretCacheKey = key;
  secretCache = tokens;
  return tokens;
}

/** Replaces every occurrence of a known secret value in `text`. */
function scrubSecrets(text: string): string {
  let result = text;
  for (const token of secretTokens()) {
    if (result.includes(token.value)) {
      result = result.split(token.value).join(`[redacted:${token.label}]`);
    }
  }
  return result;
}

/**
 * A payload string shorter than this is not scrubbed from an error's message
 * or stack; removing short fragments would mangle the text for no gain.
 */
const MIN_PAYLOAD_SCRUB_LENGTH = 16;

/** How many payload strings one error is worth collecting. */
const MAX_PAYLOAD_STRINGS = 50;

/**
 * Collects the string atoms of a dropped error property, so the same payload
 * can be removed from the error's message and stack.
 *
 * Dropping a property from the serialised fields is not enough on its own:
 * drizzle's query error embeds the failing SQL and its bind values *as text*
 * in its message — and therefore in its stack — so the save a dropped
 * `params` refused to show was still right there in `stack`. Whatever the
 * allowlist refuses as a field is scrubbed from the prose too.
 */
function collectPayloadStrings(value: unknown, out: string[], depth: number): void {
  if (out.length >= MAX_PAYLOAD_STRINGS || value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (value.length >= MIN_PAYLOAD_SCRUB_LENGTH) out.push(value);
    return;
  }
  if (depth > 4 || typeof value !== 'object') return;
  const items = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const item of items) {
    collectPayloadStrings(item, out, depth + 1);
  }
}

/** Removes every collected payload string from `text`. */
function scrubPayload(text: string, payload: string[], label: string): string {
  let result = text;
  for (const value of payload) {
    if (result.includes(value)) {
      result = result.split(value).join(`[redacted:${label}]`);
    }
  }
  return result;
}

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
  // Own properties beyond the standard four pass only through the allowlist;
  // everything else is dropped by name, and its string content is collected
  // so the same payload cannot survive inside the message or the stack.
  const result: LogFields = {};
  const dropped: string[] = [];
  const payloadByKey: Array<{ key: string; payload: string[] }> = [];

  for (const key of Object.getOwnPropertyNames(error)) {
    if (key === 'name' || key === 'message' || key === 'stack' || key === 'cause') continue;

    const value = (error as unknown as LogFields)[key];
    const allowed =
      (ERROR_FIELD_ALLOWLIST as readonly string[]).includes(key) &&
      ((typeof value === 'string' && value.length <= MAX_ERROR_FIELD_LENGTH) ||
        typeof value === 'number' ||
        typeof value === 'boolean');

    if (allowed) {
      result[key] = typeof value === 'string' ? scrubSecrets(value) : value;
    } else if (value !== undefined) {
      dropped.push(key);
      const payload: string[] = [];
      collectPayloadStrings(value, payload, 0);
      if (payload.length > 0) payloadByKey.push({ key, payload });
    }
  }

  let message = error.message;
  let stack = typeof error.stack === 'string' ? error.stack : undefined;
  for (const { key, payload } of payloadByKey) {
    message = scrubPayload(message, payload, key);
    if (stack !== undefined) stack = scrubPayload(stack, payload, key);
  }

  result.name = scrubSecrets(error.name);
  result.message = scrubSecrets(message);
  if (stack !== undefined) {
    result.stack = scrubSecrets(stack);
  }
  if (error.cause !== undefined && depth < MAX_FIELD_DEPTH) {
    result.cause = serializeValue(error.cause, depth + 1, new WeakSet());
  }
  if (dropped.length > 0) {
    result.errorFieldsDropped = dropped.slice(0, MAX_DROPPED_FIELDS);
  }
  return result;
}

function serializeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  const type = typeof value;
  if (type === 'string') return scrubSecrets(value as string);
  if (type === 'boolean') return value;
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
      message: scrubSecrets(typeof message === 'string' ? message : String(message)),
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
