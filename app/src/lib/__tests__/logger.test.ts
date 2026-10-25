// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createRequestLogger,
  sanitizeRequestId,
  resolveRequestId,
  serializeLogValue,
  MAX_REQUEST_ID_LENGTH,
  type LogLevel,
} from '../logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Collects emitted lines so tests can assert on exact output. */
function collector() {
  const lines: Array<{ level: LogLevel; line: string }> = [];
  return {
    lines,
    write: (level: LogLevel, line: string) => lines.push({ level, line }),
    parsed: () => lines.map((entry) => JSON.parse(entry.line)),
    only: () => {
      expect(lines).toHaveLength(1);
      return JSON.parse(lines[0].line);
    },
  };
}

function headers(init: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(init) };
}

describe('logger', () => {
  describe('sanitizeRequestId', () => {
    it('accepts a UUID and other tracing-style IDs', () => {
      for (const id of [
        '550e8400-e29b-41d4-a716-446655440000',
        '4bf92f3577b34da6a3ce929d0e0e4736',
        'req_abc123',
        'A-B_c-9',
      ]) {
        expect(sanitizeRequestId(id)).toBe(id);
      }
    });

    it('rejects a value carrying a newline', () => {
      expect(sanitizeRequestId('abc\ndef')).toBeNull();
      expect(sanitizeRequestId('abc\r\ndef')).toBeNull();
      expect(sanitizeRequestId('abc\n{"level":"info"}')).toBeNull();
    });

    it('rejects other control and whitespace characters', () => {
      for (const id of ['abc def', 'abc\tdef', 'abc\u0000def', 'abc def', ' abc']) {
        expect(sanitizeRequestId(id)).toBeNull();
      }
    });

    it('rejects characters outside the allowlist', () => {
      for (const id of ['abc.def', 'abc/def', 'abc:def', '{"a":1}', 'abc"def', 'café']) {
        expect(sanitizeRequestId(id)).toBeNull();
      }
    });

    it('accepts a value exactly at the length cap', () => {
      const id = 'a'.repeat(MAX_REQUEST_ID_LENGTH);

      expect(sanitizeRequestId(id)).toBe(id);
    });

    it('rejects an over-long value instead of truncating it', () => {
      expect(sanitizeRequestId('a'.repeat(MAX_REQUEST_ID_LENGTH + 1))).toBeNull();
      expect(sanitizeRequestId('a'.repeat(100_000))).toBeNull();
    });

    it('rejects empty and non-string values', () => {
      expect(sanitizeRequestId('')).toBeNull();
      expect(sanitizeRequestId(null)).toBeNull();
      expect(sanitizeRequestId(undefined)).toBeNull();
      expect(sanitizeRequestId(123 as unknown as string)).toBeNull();
    });
  });

  describe('resolveRequestId', () => {
    it('reuses a well-formed inbound header so an upstream trace stays joined', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';

      expect(resolveRequestId(headers({ 'x-request-id': id }))).toBe(id);
    });

    it('generates a UUID when the header is absent', () => {
      expect(resolveRequestId(headers({}))).toMatch(UUID_RE);
    });

    it('generates a UUID when no request is supplied', () => {
      expect(resolveRequestId()).toMatch(UUID_RE);
      expect(resolveRequestId(null)).toMatch(UUID_RE);
    });

    it('generates a fresh UUID when the header is hostile', () => {
      const hostile = resolveRequestId(headers({ 'x-request-id': 'a'.repeat(5000) }));

      expect(hostile).toMatch(UUID_RE);
    });

    it('produces a different ID per call when generating', () => {
      const ids = new Set(Array.from({ length: 50 }, () => resolveRequestId()));

      expect(ids.size).toBe(50);
    });
  });

  describe('line format', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-23T12:34:56.789Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('writes one JSON object with time, level, route, requestId and message', () => {
      const sink = collector();
      const logger = createRequestLogger('conversation', null, {
        requestId: 'req_fixed1',
        write: sink.write,
      });

      logger.info('Request processed');

      expect(sink.only()).toEqual({
        time: '2026-10-23T12:34:56.789Z',
        level: 'info',
        route: 'conversation',
        requestId: 'req_fixed1',
        message: 'Request processed',
      });
    });

    it('emits exactly one line with no embedded newline', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, {
        requestId: 'req_fixed2',
        write: sink.write,
      });

      logger.info('multi\nline\nmessage', { note: 'a\nb' });

      expect(sink.lines).toHaveLength(1);
      expect(sink.lines[0].line).not.toContain('\n');
      const parsed = JSON.parse(sink.lines[0].line);
      expect(parsed.message).toBe('multi\nline\nmessage');
      expect(parsed.note).toBe('a\nb');
    });

    it('merges extra fields alongside the envelope', () => {
      const sink = collector();
      const logger = createRequestLogger('match-decide', null, {
        requestId: 'req_fixed3',
        write: sink.write,
      });

      logger.info('Turn processed', { turnNumber: 4, durationMs: 128, userId: 'user_abc123def' });

      expect(sink.only()).toMatchObject({
        route: 'match-decide',
        requestId: 'req_fixed3',
        turnNumber: 4,
        durationMs: 128,
        userId: 'user_abc123def',
      });
    });

    it('does not let an extra field overwrite the envelope', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, {
        requestId: 'req_real',
        write: sink.write,
      });

      logger.error('boom', {
        level: 'debug',
        requestId: 'req_forged',
        route: 'other',
        time: 'yesterday',
        message: 'forged',
      });

      expect(sink.only()).toEqual({
        time: '2026-10-23T12:34:56.789Z',
        level: 'error',
        route: 'match',
        requestId: 'req_real',
        message: 'boom',
      });
    });

    it('stamps the same requestId on every line of a request', () => {
      const sink = collector();
      const logger = createRequestLogger('match-stream', headers({}), { write: sink.write });

      logger.info('started');
      logger.warn('AI call failed, falling back to mock');
      logger.error('failed');

      const ids = sink.parsed().map((entry) => entry.requestId);
      expect(new Set(ids).size).toBe(1);
      expect(ids[0]).toBe(logger.requestId);
      expect(sink.lines.map((l) => l.level)).toEqual(['info', 'warn', 'error']);
    });
  });

  describe('error fields', () => {
    it('expands an Error into name, message and stack', () => {
      const sink = collector();
      const logger = createRequestLogger('conversation', null, { write: sink.write });
      const error = new TypeError('database unreachable');

      logger.error('Failed to fetch game state', { error });

      const parsed = sink.only();
      expect(parsed.error.name).toBe('TypeError');
      expect(parsed.error.message).toBe('database unreachable');
      expect(typeof parsed.error.stack).toBe('string');
      expect(parsed.error.stack).toContain('database unreachable');
    });

    it('shows what plain JSON.stringify would have lost', () => {
      expect(JSON.stringify({ error: new Error('gone') })).toBe('{"error":{}}');

      const serialized = serializeLogValue(new Error('gone')) as Record<string, unknown>;
      expect(serialized.message).toBe('gone');
      expect(serialized.name).toBe('Error');
    });

    it('keeps custom properties such as code or status', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });
      const error = Object.assign(new Error('rate limited'), { code: 'ERR_429', status: 429 });

      logger.error('AI call failed', { error });

      const parsed = sink.only();
      expect(parsed.error).toMatchObject({
        name: 'Error',
        message: 'rate limited',
        code: 'ERR_429',
        status: 429,
      });
    });

    it('expands a nested error cause', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });
      const error = new Error('outer', { cause: new RangeError('inner') });

      logger.error('Fallback AI call also failed', { error });

      const parsed = sink.only();
      expect(parsed.error.cause).toMatchObject({ name: 'RangeError', message: 'inner' });
    });

    it('expands an Error nested inside an object or array', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });

      logger.error('batch failed', {
        context: { attempt: 2, failure: new Error('deep') },
        failures: [new Error('first')],
      });

      const parsed = sink.only();
      expect(parsed.context.failure).toMatchObject({ name: 'Error', message: 'deep' });
      expect(parsed.failures[0]).toMatchObject({ name: 'Error', message: 'first' });
    });

    it('handles a subclassed error', () => {
      class AppError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'AppError';
        }
      }
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });

      logger.error('failed', { error: new AppError('custom') });

      expect(sink.only().error).toMatchObject({ name: 'AppError', message: 'custom' });
    });

    it('still logs a non-Error thrown value', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });

      logger.error('failed', { error: 'just a string' });

      expect(sink.only().error).toBe('just a string');
    });
  });

  describe('awkward field values', () => {
    it('does not throw on a circular structure', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });
      const cyclic: Record<string, unknown> = { name: 'state' };
      cyclic.self = cyclic;

      expect(() => logger.info('state', { cyclic })).not.toThrow();
      expect(sink.only().cyclic).toEqual({ name: 'state', self: '[Circular]' });
    });

    it('serialises values JSON.stringify would drop or reject', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });

      logger.info('values', {
        big: BigInt(42),
        when: new Date('2020-01-02T03:04:05.000Z'),
        nan: Number.NaN,
        infinite: Number.POSITIVE_INFINITY,
        fn: function namedFn() {},
        set: new Set([1, 2]),
        map: new Map([['k', 'v']]),
        nothing: null,
      });

      expect(sink.only()).toMatchObject({
        big: '42',
        when: '2020-01-02T03:04:05.000Z',
        nan: 'NaN',
        infinite: 'Infinity',
        fn: '[Function namedFn]',
        set: [1, 2],
        map: { k: 'v' },
        nothing: null,
      });
    });

    it('truncates very deep nesting instead of recursing forever', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });
      let deep: Record<string, unknown> = { end: true };
      for (let i = 0; i < 50; i += 1) deep = { nested: deep };

      expect(() => logger.info('deep', { deep })).not.toThrow();
      expect(sink.lines[0].line).toContain('[Truncated]');
    });

    it('never throws out of a log call when a getter explodes', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });
      const hostile = {
        get boom() {
          throw new Error('getter exploded');
        },
      };

      expect(() => logger.info('hostile', { hostile, keep: 'me' })).not.toThrow();

      const parsed = sink.only();
      expect(parsed.hostile).toBe('[Unserializable: getter exploded]');
      // A bad field does not take the rest of the line down with it.
      expect(parsed.keep).toBe('me');
      expect(parsed.message).toBe('hostile');
    });
  });

  describe('levels', () => {
    const originalLevel = process.env.LOG_LEVEL;

    afterEach(() => {
      if (originalLevel === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = originalLevel;
      }
    });

    it('drops debug lines at the default level', () => {
      delete process.env.LOG_LEVEL;
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });

      logger.debug('verbose detail');
      logger.info('kept');

      expect(sink.parsed().map((e) => e.message)).toEqual(['kept']);
    });

    it('emits debug lines when the level is lowered', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { level: 'debug', write: sink.write });

      logger.debug('verbose detail');

      expect(sink.only().level).toBe('debug');
    });

    it('reads the level from LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'error';
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });

      logger.info('dropped');
      logger.warn('dropped');
      logger.error('kept');

      expect(sink.parsed().map((e) => e.message)).toEqual(['kept']);
    });

    it('falls back to info when LOG_LEVEL is nonsense', () => {
      process.env.LOG_LEVEL = 'chatty';
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write });

      logger.debug('dropped');
      logger.info('kept');

      expect(sink.parsed().map((e) => e.message)).toEqual(['kept']);
    });
  });

  describe('child loggers', () => {
    it('inherits the requestId and merges bound fields', () => {
      const sink = collector();
      const parent = createRequestLogger('conversation', null, {
        requestId: 'req_parent',
        write: sink.write,
      });
      const child = parent.child({ userId: 'user_abc123def' });

      child.info('scoped line', { step: 'persist' });

      expect(child.requestId).toBe('req_parent');
      expect(sink.only()).toMatchObject({
        requestId: 'req_parent',
        userId: 'user_abc123def',
        step: 'persist',
      });
    });

    it('does not leak child fields back to the parent', () => {
      const sink = collector();
      const parent = createRequestLogger('conversation', null, { write: sink.write });

      parent.child({ userId: 'user_abc123def' }).info('child');
      parent.info('parent');

      const [childLine, parentLine] = sink.parsed();
      expect(childLine.userId).toBe('user_abc123def');
      expect(parentLine.userId).toBeUndefined();
    });

    it('lets a per-call field override a bound field', () => {
      const sink = collector();
      const logger = createRequestLogger('match', null, { write: sink.write }).child({ phase: 'setup' });

      logger.info('later', { phase: 'simulation' });

      expect(sink.only().phase).toBe('simulation');
    });
  });

  describe('default console sink', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('routes each level to the matching console method', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = createRequestLogger('match', null, { level: 'debug' });

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(log).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledTimes(1);
      expect(() => JSON.parse(error.mock.calls[0][0] as string)).not.toThrow();
    });
  });
});
