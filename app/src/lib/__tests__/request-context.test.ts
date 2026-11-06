// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequestLogger, type LogLevel } from '../logger';
import {
  runWithLogger,
  getLogger,
  currentLogger,
  getProcessLogger,
  resetProcessLogger,
  NO_REQUEST_ID,
  NO_REQUEST_ROUTE,
} from '../request-context';

function collector() {
  const lines: Array<{ level: LogLevel; line: string }> = [];
  return {
    write: (level: LogLevel, line: string) => lines.push({ level, line }),
    parsed: () => lines.map((entry) => JSON.parse(entry.line)),
  };
}

function requestLogger(requestId: string, write: (level: LogLevel, line: string) => void) {
  return createRequestLogger('example', null, { requestId, write, level: 'debug' });
}

describe('request context', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetProcessLogger();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands library code the request logger, stamped with its ID and a scope', () => {
    const out = collector();
    const log = requestLogger('req-1', out.write);

    runWithLogger(log, () => {
      getLogger('db').info('opened');
    });

    expect(out.parsed()).toEqual([
      expect.objectContaining({ route: 'example', requestId: 'req-1', scope: 'db', message: 'opened' }),
    ]);
  });

  it('keeps the request logger across awaits and nested calls', async () => {
    const out = collector();
    const log = requestLogger('req-2', out.write);

    async function deep() {
      await new Promise((resolve) => setTimeout(resolve, 1));
      getLogger('ai-service').warn('slow');
    }
    async function middle() {
      await Promise.resolve();
      await deep();
    }

    await runWithLogger(log, () => middle());

    expect(out.parsed()).toEqual([expect.objectContaining({ requestId: 'req-2', scope: 'ai-service' })]);
  });

  it('does not mix up concurrent requests', async () => {
    const out = collector();
    const a = requestLogger('req-a', out.write);
    const b = requestLogger('req-b', out.write);

    async function work(name: string, delay: number) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      getLogger('db').info(name);
      await new Promise((resolve) => setTimeout(resolve, delay));
      getLogger('db').info(name);
    }

    await Promise.all([runWithLogger(a, () => work('a', 3)), runWithLogger(b, () => work('b', 1))]);

    const byName = Object.fromEntries(
      out.parsed().map((line) => [line.message, line.requestId])
    );
    expect(byName).toEqual({ a: 'req-a', b: 'req-b' });
    expect(out.parsed().filter((line) => line.message === 'a')).toHaveLength(2);
    expect(out.parsed().filter((line) => line.message === 'b')).toHaveLength(2);
  });

  it('is empty again once the request has finished', async () => {
    const out = collector();
    const log = requestLogger('req-3', out.write);

    await runWithLogger(log, async () => {
      expect(currentLogger()).not.toBeNull();
    });

    expect(currentLogger()).toBeNull();
  });

  it('falls back to the process logger outside any request', () => {
    getLogger('memory').info('monitoring started');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      route: NO_REQUEST_ROUTE,
      requestId: NO_REQUEST_ID,
      scope: 'memory',
      message: 'monitoring started',
    });
  });

  it('reuses one process logger', () => {
    expect(getProcessLogger()).toBe(getProcessLogger());
  });
});
