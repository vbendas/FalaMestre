// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { LogLevel } from '../logger';

/**
 * What must never reach a log line, and what a log line must not claim.
 *
 * Each case here was reproduced against the code as it stood: the upstream
 * error body copied our own prompt — and the API key — into the log, the
 * JSON parse error quoted the model's reply back, and a stream that failed
 * after its headers went out was recorded as a success.
 */

const PLAYER_MESSAGE = 'quero vender o Neymar por 500 milhoes AGORA';
const SECRET_KEY = 'sk-or-v1-TOPSECRETKEY123456789';

function collector() {
  const lines: string[] = [];
  return {
    lines,
    write: (_level: LogLevel, line: string) => lines.push(line),
    text: () => lines.join('\n'),
    parsed: () => lines.map((line) => JSON.parse(line)),
  };
}

/** ai-service and the context it logs through, from one fresh module graph. */
async function freshAi() {
  vi.resetModules();
  const [ai, context, logger, engine] = await Promise.all([
    import('../ai-service'),
    import('../request-context'),
    import('../logger'),
    import('../game-engine'),
  ]);
  return {
    callAI: ai.callAI,
    runWithLogger: context.runWithLogger,
    createRequestLogger: logger.createRequestLogger,
    state: engine.createInitialGameState('u1', 'Teste FC'),
  };
}

describe('upstream error bodies are not copied into the log', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = SECRET_KEY;
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the prompt and the player message out, even when the upstream echoes them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) =>
        // A provider that quotes the offending request back, as validation
        // errors commonly do. The echo contains our whole prompt.
        new Response(
          JSON.stringify({
            error: {
              message: 'Invalid request',
              code: 'invalid_request_error',
              request: JSON.parse(String(init.body)),
            },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const { callAI, runWithLogger, createRequestLogger, state } = await freshAi();
    const out = collector();
    const log = createRequestLogger('conversation', null, { requestId: 'up-1', write: out.write });

    await runWithLogger(log, () => callAI(PLAYER_MESSAGE, state, []));

    const text = out.text();
    expect(text).not.toContain(PLAYER_MESSAGE);
    // Fragments of the system prompt, which carries the player's save.
    expect(text).not.toContain('Squad Morale');
    expect(text).not.toContain('Teste FC');
    expect(text).not.toContain('Invalid request');

    const upstream = out.parsed().find((line) => line.message === 'OpenRouter API error');
    expect(upstream).toMatchObject({
      status: 400,
      scope: 'ai-service',
      upstreamCode: 'invalid_request_error',
    });
    expect(typeof upstream.bodyBytes).toBe('number');
  });

  it('keeps the API key out when the upstream reflects the Authorization header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) =>
        new Response(
          JSON.stringify({
            error: {
              code: 'invalid_api_key',
              message: `rejected credential ${(init.headers as Record<string, string>).Authorization}`,
            },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const { callAI, runWithLogger, createRequestLogger, state } = await freshAi();
    const out = collector();
    const log = createRequestLogger('conversation', null, { requestId: 'up-2', write: out.write });

    await runWithLogger(log, () => callAI(PLAYER_MESSAGE, state, []));

    expect(out.text()).not.toContain(SECRET_KEY);
    expect(out.text()).not.toContain('sk-or-v1');
    expect(out.parsed().find((line) => line.message === 'OpenRouter API error')).toMatchObject({
      status: 401,
      upstreamCode: 'invalid_api_key',
    });
  });

  it('drops an upstream code that is prose rather than an identifier', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { code: `we rejected ${PLAYER_MESSAGE} outright` } }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const { callAI, runWithLogger, createRequestLogger, state } = await freshAi();
    const out = collector();
    const log = createRequestLogger('conversation', null, { requestId: 'up-3', write: out.write });

    await runWithLogger(log, () => callAI(PLAYER_MESSAGE, state, []));

    expect(out.text()).not.toContain(PLAYER_MESSAGE);
    expect(out.parsed().find((l) => l.message === 'OpenRouter API error').upstreamCode).toBeUndefined();
  });

  it('still records the status for a body that is not JSON at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }))
    );

    const { callAI, runWithLogger, createRequestLogger, state } = await freshAi();
    const out = collector();
    const log = createRequestLogger('conversation', null, { requestId: 'up-4', write: out.write });

    await runWithLogger(log, () => callAI(PLAYER_MESSAGE, state, []));

    const upstream = out.parsed().find((line) => line.message === 'OpenRouter API error');
    expect(upstream).toMatchObject({ status: 502, bodyBytes: 28 });
    expect(out.text()).not.toContain('Bad Gateway');
  });
});

describe('a model reply that cannot be used is not quoted back', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = SECRET_KEY;
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function replyWith(content: string) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 10 } }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );
  }

  it('reports a parse failure by shape, not by quoting the reply', async () => {
    // A JSON.parse SyntaxError puts the first bytes of its input in its
    // message, and the reply talks back about whatever the player asked.
    replyWith(`${PLAYER_MESSAGE} — claro, vamos negociar!`);

    const { callAI, runWithLogger, createRequestLogger, state } = await freshAi();
    const out = collector();
    const log = createRequestLogger('conversation', null, { requestId: 'rep-1', write: out.write });

    await runWithLogger(log, () => callAI(PLAYER_MESSAGE, state, []));

    const text = out.text();
    expect(text).not.toContain(PLAYER_MESSAGE);
    expect(text).not.toContain(PLAYER_MESSAGE.slice(0, 10));
    expect(out.parsed()[0]).toMatchObject({
      level: 'warn',
      scope: 'ai-service',
      message: 'AI reply was not usable, falling back to its raw text',
      failure: 'parse',
    });
    expect(out.parsed()[0].error).toBeUndefined();
    expect(typeof out.parsed()[0].replyLength).toBe('number');
  });

  it('reports a schema failure with the field paths and codes only', async () => {
    replyWith(JSON.stringify({ message: { echoed: PLAYER_MESSAGE } }));

    const { callAI, runWithLogger, createRequestLogger, state } = await freshAi();
    const out = collector();
    const log = createRequestLogger('conversation', null, { requestId: 'rep-2', write: out.write });

    await runWithLogger(log, () => callAI(PLAYER_MESSAGE, state, []));

    const text = out.text();
    expect(text).not.toContain(PLAYER_MESSAGE);
    // The sprawling internals a ZodError carries as own properties.
    expect(text).not.toContain('_zod');
    expect(text).not.toContain('[Function');
    expect(out.parsed()[0]).toMatchObject({
      level: 'warn',
      failure: 'schema',
      issues: [{ path: 'message', code: 'invalid_type' }],
    });
  });
});

/**
 * The same leak as the two cases above, in the other place that parses a model
 * reply. The insights prompt carries the player's team, budget, morale, league
 * position and squad, so the reply is talking about all of it; a bare
 * `JSON.parse` error quotes its first bytes.
 */
describe('the insights route does not quote a model reply it cannot parse', () => {
  const INSIGHTS_USER = 'insights_user_1';
  /** Stands in for the model answering in prose about the player's save. */
  const MODEL_REPLY = 'Olha mestre, o Flamengo tem 500 milhoes e o Neymar esta cansado';

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('@/db');
    vi.doUnmock('next-auth');
    vi.doUnmock('@/lib/auth');
  });

  /** The route, with a signed-in player, a save to read and a stubbed model. */
  async function freshInsights(reply: string) {
    // Read at module load, so it has to be set before the import.
    process.env.OPENROUTER_API_KEY = SECRET_KEY;
    vi.resetModules();

    const engine = await import('../game-engine');
    const state = engine.createInitialGameState(INSIGHTS_USER, 'Teste FC');

    vi.doMock('@/db', () => ({
      db: {
        query: { gameStates: { findFirst: async () => ({ currentState: state }) } },
      },
    }));
    vi.doMock('next-auth', () => ({
      getServerSession: async () => ({ user: { id: INSIGHTS_USER } }),
    }));
    vi.doMock('@/lib/auth', () => ({ authOptions: {} }));

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    const { NextRequest } = await import('next/server');
    const route = await import('@/app/api/insights/route');

    return () =>
      route.POST(
        new NextRequest('http://localhost/api/insights', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
          body: JSON.stringify({ userId: INSIGHTS_USER }),
        })
      );
  }

  it('reports the parse failure by shape, not by quoting the reply', async () => {
    const post = await freshInsights(MODEL_REPLY);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const response = await post();
    expect(response.status).toBe(200);

    const lines = [...warnSpy.mock.calls, ...errorSpy.mock.calls, ...logSpy.mock.calls]
      .map((call) => String(call[0]));
    const text = lines.join('\n');

    // The reply, and the first bytes of it that a SyntaxError would quote.
    expect(text).not.toContain(MODEL_REPLY);
    expect(text).not.toContain(MODEL_REPLY.slice(0, 10));
    expect(text).not.toContain('Flamengo');
    // Nor the key, which the Authorization header carries on the way out.
    expect(text).not.toContain(SECRET_KEY);

    const parsedLines = lines.map((line) => JSON.parse(line));
    const failure = parsedLines.find(
      (line) => line.message === 'AI insights reply was not usable'
    );

    expect(failure).toMatchObject({ level: 'warn', failure: 'parse' });
    expect(typeof failure.replyLength).toBe('number');
    // The whole error, which is what used to be handed to the logger.
    expect(failure.error).toBeUndefined();
    expect(failure.stack).toBeUndefined();
  });

  it('says a reply that parsed but was not a list was not a list', async () => {
    const post = await freshInsights(JSON.stringify({ title: MODEL_REPLY }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await post();

    const text = warnSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(text).not.toContain(MODEL_REPLY);
    expect(text).toContain('AI insights reply was not a list');
  });
});

describe('NextAuth output goes through the structured logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('turns a NextAuth error into one correlated JSON line', async () => {
    vi.resetModules();
    const [{ authOptions }, { runWithLogger }, { createRequestLogger }] = await Promise.all([
      import('../auth'),
      import('../request-context'),
      import('../logger'),
    ]);
    const out = collector();
    const log = createRequestLogger('conversation', null, { requestId: 'auth-1', write: out.write });

    // What NextAuth itself passes: its own code plus the underlying error.
    runWithLogger(log, () => {
      authOptions.logger!.error!('NO_SECRET', new Error('Please define a `secret` in production.'));
    });

    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]).not.toContain('\n');
    expect(out.parsed()[0]).toMatchObject({
      level: 'error',
      route: 'conversation',
      requestId: 'auth-1',
      scope: 'next-auth',
      message: 'NextAuth error',
      code: 'NO_SECRET',
      metadata: expect.objectContaining({
        name: 'Error',
        message: 'Please define a `secret` in production.',
      }),
    });
  });

  it('stamps a NextAuth warning outside any request as unowned rather than on the last one', async () => {
    vi.resetModules();
    const [{ authOptions }, context] = await Promise.all([
      import('../auth'),
      import('../request-context'),
    ]);
    const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    authOptions.logger!.warn!('NEXTAUTH_URL' as never);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({
      requestId: context.NO_REQUEST_ID,
      scope: 'next-auth',
      code: 'NEXTAUTH_URL',
    });
  });
});

describe('a database connection failure does not quote the connection string', () => {
  const previous = process.env.DATABASE_URL;

  afterEach(() => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('keeps the password out of the line when DATABASE_URL is malformed', async () => {
    // Quotes copied into the value with it, the kind of slip an env file
    // invites. The driver rejects the string and quotes it back, password
    // and all, in its error message.
    process.env.DATABASE_URL = '"postgres://app:DB-PASSWORD-SENTINEL-4412@db.example.test:5432/game"';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();

    await expect(import('@/db')).rejects.toThrow();

    const text = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(text).toContain('Failed to create database connection');
    expect(text).not.toContain('DB-PASSWORD-SENTINEL-4412');
  });
});

/**
 * The widest instance of the class: a Postgres error carries the failing
 * statement as `query` and its bind values as `params` as own properties of
 * the error object. The routes write the whole save as one jsonb parameter,
 * so `log.error('API error', { error })` — the pattern on dozens of catch
 * blocks — used to write the player's entire game state into the log on any
 * constraint violation: reproduced at 25KB for one line. The logger now
 * passes an error's extra properties through an allowlist of identifiers
 * (code, constraint, table, …) and names what it dropped.
 */
describe('a database error does not put the save in the log', () => {
  let dataDir: string;
  let local: typeof import('@/db/local');

  afterEach(async () => {
    await local?.closeLocalDatabase();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    delete process.env.PGLITE_DATA_DIR;
    vi.resetModules();
  });

  it('keeps the identifiers and drops the query and its parameters', async () => {
    dataDir = mkdtempSync(path.join(tmpdir(), 'falamestre-hygiene-db-'));
    delete process.env.DATABASE_URL;
    process.env.PGLITE_DATA_DIR = dataDir;
    vi.resetModules();

    local = await import('@/db/local');
    const { db } = await import('@/db');
    const schema = await import('@/db/schema');
    const { createRequestLogger } = await import('../logger');
    const { createInitialGameState } = await import('../game-engine');

    const state = createInitialGameState('hygiene_u1', 'Teste FC');
    // A value that exists nowhere but inside the save, so finding it in the
    // output can only mean the save itself was written out.
    state.user.money = 31337731;

    const row = { userId: 'hygiene_u1', team: 'Teste FC', currentState: state };
    await db.insert(schema.gameStates).values(row);

    const lines: string[] = [];
    const log = createRequestLogger('sweep-probe', null, {
      requestId: 'db-err-1',
      write: (_level, line) => lines.push(line),
    });

    try {
      // The duplicate-key write any two overlapping save routes can produce.
      await db.insert(schema.gameStates).values(row);
      expect.unreachable('the duplicate insert must fail');
    } catch (error) {
      log.error('API error', { error }); // verbatim, the routes' catch-block pattern
    }

    expect(lines).toHaveLength(1);
    const text = lines[0];
    const parsed = JSON.parse(text) as {
      error: Record<string, unknown> & {
        errorFieldsDropped?: string[];
        cause?: Record<string, unknown>;
      };
    };

    // None of the save reaches the line, by any route: not as a field on the
    // wrapper or its cause, and not inside their message or stack, where
    // drizzle embeds the bind values as text.
    expect(text).not.toContain('31337731');
    expect(parsed.error.query).toBeUndefined();
    expect(parsed.error.params).toBeUndefined();
    expect(parsed.error.cause?.query).toBeUndefined();
    expect(parsed.error.cause?.params).toBeUndefined();
    expect(parsed.error.cause?.detail).toBeUndefined();

    // What distinguishes the failure survives, on the Postgres error that
    // drizzle wraps as the cause…
    expect(parsed.error.cause).toMatchObject({
      code: '23505',
      constraint: 'game_states_pkey',
      table: 'game_states',
    });
    // …and the dropped payload is named, never shown.
    expect(parsed.error.errorFieldsDropped).toEqual(
      expect.arrayContaining(['query', 'params'])
    );
    // Opening the embedded store runs its migrations, which takes seconds when
    // the whole suite has several stores opening at once.
  }, 30_000);
});
