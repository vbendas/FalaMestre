// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateBody, SCHEMA_REFUSAL_REASON } from '../request-schema';
import { runWithLogger, currentRefusal } from '../request-context';
import { createRequestLogger } from '../logger';

/**
 * The one body check, held to the promise the routes rely on: a body that
 * does not match is refused in one shape, with one status, naming the field.
 */

/** Runs `fn` inside a request scope and returns what it recorded as refused. */
function refusalFrom(fn: () => void) {
  const log = createRequestLogger('test', null);
  let recorded: ReturnType<typeof currentRefusal> = null;
  runWithLogger(log, () => {
    fn();
    recorded = currentRefusal();
  });
  return recorded as ReturnType<typeof currentRefusal>;
}

async function refusal(result: ReturnType<typeof validateBody>) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a refusal');
  expect(result.response.status).toBe(400);
  return result.response.json() as Promise<{ error: string; message: string; field: string }>;
}

describe('validateBody', () => {
  it('returns the schema output, not the raw body, when the body matches', () => {
    const schema = z.object({ name: z.string().transform((v) => v.trim()) });
    const result = validateBody(schema, { name: '  Botafogo  ' });

    expect(result).toEqual({ ok: true, data: { name: 'Botafogo' } });
  });

  it('names the field that failed, as a dotted path', async () => {
    const schema = z.object({ player: z.object({ pac: z.number() }) });
    const body = await refusal(validateBody(schema, { player: { pac: 'fast' } }));

    expect(body.error).toBe('Validation failed');
    expect(body.field).toBe('player.pac');
  });

  it('names the position in a list, not just the list', async () => {
    const schema = z.object({ decisions: z.array(z.object({ turn: z.number() })) });
    const body = await refusal(
      validateBody(schema, { decisions: [{ turn: 1 }, { turn: 2 }, { turn: 'three' }] })
    );

    expect(body.field).toBe('decisions.2.turn');
  });

  it('keeps a message that already names its field', async () => {
    const schema = z.object({ sellValue: z.number('sellValue must be a number') });
    const body = await refusal(validateBody(schema, { sellValue: 'free' }));

    expect(body.message).toBe('sellValue must be a number');
  });

  it("prefixes the field onto a message that does not mention it", async () => {
    // Zod's built-in text says what was expected but not of what, so a schema
    // written without hand-written messages still has to produce a reply the
    // caller can act on.
    const schema = z.object({ userId: z.string() });
    const body = await refusal(validateBody(schema, {}));

    expect(body.field).toBe('userId');
    expect(body.message.startsWith('userId: ')).toBe(true);
  });

  it('reports the first issue and no others, so no input is quoted back', async () => {
    const schema = z.object({ a: z.string(), b: z.string() });
    const body = await refusal(validateBody(schema, { a: 1, b: 2 }));

    expect(Object.keys(body).sort()).toEqual(['error', 'field', 'message']);
    expect(body.field).toBe('a');
  });

  it('calls an issue against the whole body `body`', async () => {
    const schema = z.object({ a: z.string() }).refine(() => false, 'the body is not usable');
    const payload = await refusal(validateBody(schema, { a: 'ok' }));

    expect(payload.field).toBe('body');
    expect(payload.message).toBe('the body is not usable');
  });

  it('records the refusal with the field, so the summary line carries it', () => {
    const schema = z.object({ userId: z.string() });
    const recorded = refusalFrom(() => {
      validateBody(schema, {});
    });

    expect(recorded).toEqual({ reason: SCHEMA_REFUSAL_REASON, fields: { field: 'userId' } });
  });

  it('records nothing when the body matches', () => {
    const schema = z.object({ userId: z.string() });
    const recorded = refusalFrom(() => {
      validateBody(schema, { userId: 'user_1' });
    });

    expect(recorded).toBeNull();
  });
});
