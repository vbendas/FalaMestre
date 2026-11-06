// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequestLogger, type LogLevel } from '../logger';
import { runWithLogger, NO_REQUEST_ID } from '../request-context';
import { normalizeFormation, mapPlayersToFormation } from '../match-formations';
import { createInitialGameState } from '../game-engine';

/**
 * The library modules that used to write plain console lines now write
 * through the request logger: inside a request their lines carry its ID and
 * name the module in `scope`; outside one they are stamped as unowned.
 */

function collector() {
  const lines: Array<{ level: LogLevel; line: string }> = [];
  return {
    write: (level: LogLevel, line: string) => lines.push({ level, line }),
    parsed: () => lines.map((entry) => ({ level: entry.level, ...JSON.parse(entry.line) })),
  };
}

describe('match-formations logging', () => {
  it('warns under the request ID when a formation is unknown', () => {
    const out = collector();
    const log = createRequestLogger('match', null, { requestId: 'form-1', write: out.write });

    const result = runWithLogger(log, () => normalizeFormation('9-9-9'));

    expect(result).toBe('4-3-3');
    expect(out.parsed()).toEqual([
      expect.objectContaining({
        level: 'warn',
        route: 'match',
        requestId: 'form-1',
        scope: 'match-formations',
        message: 'Unknown formation, defaulting to 4-3-3',
        formation: '9-9-9',
      }),
    ]);
  });

  it('keeps the per-match mapping line at debug so it is silent by default', () => {
    const out = collector();
    const log = createRequestLogger('match', null, { requestId: 'form-2', write: out.write, level: 'info' });

    runWithLogger(log, () => mapPlayersToFormation('4-4-2', []));

    expect(out.parsed()).toEqual([]);
  });

  it('writes the mapping line at debug when asked for it', () => {
    const out = collector();
    const log = createRequestLogger('match', null, { requestId: 'form-3', write: out.write, level: 'debug' });

    runWithLogger(log, () => mapPlayersToFormation('4-4-2', []));

    expect(out.parsed()).toEqual([
      expect.objectContaining({
        level: 'debug',
        requestId: 'form-3',
        scope: 'match-formations',
        message: 'Mapped players to formation',
        formation: '4-4-2',
      }),
    ]);
  });
});

describe('ai-service logging', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = 'test-key';
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function parsed(spy: ReturnType<typeof vi.spyOn>) {
    return spy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
  }

  const gameState = createInitialGameState('user-1', 'Teste FC');

  it('logs a rejected upstream call at error under the request ID, with the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('upstream broke', { status: 502 }))
    );
    const { callAI } = await import('../ai-service');
    const { runWithLogger: run } = await import('../request-context');
    const { createRequestLogger: create } = await import('../logger');
    const log = create('conversation', null, { requestId: 'ai-1' });

    const reply = await run(log, () => callAI('quero ver o elenco', gameState, []));

    expect(reply.source).toBe('fallback');
    const errors = parsed(errorSpy);
    expect(errors).toEqual([
      expect.objectContaining({
        route: 'conversation',
        requestId: 'ai-1',
        scope: 'ai-service',
        message: 'OpenRouter API error',
        status: 502,
        // The body itself is deliberately not here; see log-hygiene.test.ts.
        bodyBytes: 14,
      }),
      expect.objectContaining({
        requestId: 'ai-1',
        scope: 'ai-service',
        message: 'AI call failed',
        error: expect.objectContaining({ message: 'AI API error: 502' }),
      }),
    ]);
  });

  it('is stamped as unowned when called outside any request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    const { callAI } = await import('../ai-service');

    await callAI('quero ver o elenco', gameState, []);

    expect(parsed(errorSpy)).toEqual([
      expect.objectContaining({ requestId: NO_REQUEST_ID, scope: 'ai-service', message: 'AI call failed' }),
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
