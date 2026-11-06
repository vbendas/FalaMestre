import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { recordRefusal } from './request-context';

/**
 * The one check a request body goes through once it has parsed.
 *
 * `readJsonBody` already answers the questions that are the same everywhere —
 * is it under the size cap, is it JSON, is it an object — and then hands the
 * route a `Record<string, unknown>` it knows nothing else about. What each
 * route did next was its own invention: a few called a Zod schema and built a
 * reply inline, match/decide hand-wrote seventy lines of `typeof` checks, and
 * the rest cast the body to an interface and read fields off it. So the same
 * malformed request got three different answers depending on where it landed,
 * and on the routes that only cast, a missing `userId` was not reported at all
 * — it travelled on as `undefined` and surfaced several checks later as
 * `Forbidden` or `User not found`, neither of which is true and neither of
 * which tells the caller what to fix.
 *
 * This module is the single answer. A route names a schema; a body that does
 * not match is refused here, with the same status, the same shape and the same
 * level of detail whichever route it was sent to, and with the offending field
 * named.
 */

/**
 * The reply shape, kept identical to the one /api/conversation, /api/match and
 * /api/match/stream already send, so adopting this helper on those routes is a
 * deletion rather than a change of contract for anything calling them.
 */
export type ValidationErrorBody = {
  error: 'Validation failed';
  /** What is wrong, in a sentence that names the field. */
  message: string;
  /** Dotted path to the field that failed: `userId`, `player.pac`. */
  field: string;
};

/** Recorded on the request's summary line when a body fails its schema. */
export const SCHEMA_REFUSAL_REASON = 'body_failed_schema';

/** Path reported for an issue the schema raised against the body as a whole. */
const WHOLE_BODY_FIELD = 'body';

export type ValidateBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * Dotted path to the field an issue is about. Array positions become indices,
 * so a bad entry in a list reads `decisions.2.turnNumber` rather than pointing
 * vaguely at `decisions`.
 */
function fieldOf(path: ReadonlyArray<PropertyKey>): string {
  return path.length > 0 ? path.map(String).join('.') : WHOLE_BODY_FIELD;
}

/**
 * The message to send, guaranteed to name the field.
 *
 * Schemas in validations.ts spell their own messages and those name the field
 * already (`turnNumber must be an integer`), which reads better than anything
 * assembled here. But Zod's built-in text does not — a missing field yields
 * `Invalid input: expected string, received undefined`, which leaves the
 * caller guessing which field. So a message that does not mention the field it
 * is about gets the path prefixed onto it. The guarantee is then structural:
 * a schema added later without hand-written messages still produces a reply
 * that says where to look.
 */
function messageFor(field: string, message: string): string {
  if (field === WHOLE_BODY_FIELD) return message;

  const leaf = field.slice(field.lastIndexOf('.') + 1);
  return message.includes(leaf) ? message : `${field}: ${message}`;
}

/** The 400 a body that failed its schema is answered with. */
export function validationFailedResponse(field: string, message: string): NextResponse {
  const body: ValidationErrorBody = { error: 'Validation failed', message, field };
  return NextResponse.json(body, { status: 400 });
}

/**
 * Checks an already-parsed body against `schema`.
 *
 * On success, returns the schema's output — the parsed value, not the raw one,
 * so defaults and coercions a schema declares are what the route goes on to
 * use. On failure, returns the 400 to send back as-is and records the refusal,
 * so the request's summary line carries `body_failed_schema` and the field
 * rather than a bare status.
 *
 * Only the first issue is reported. Zod raises them in field order, so the
 * first is the earliest thing wrong, and a caller fixing one field at a time
 * is walked through them. The rest are deliberately dropped: the issue list
 * quotes the input that failed, and request bodies carry save contents and
 * whatever the player typed, neither of which belongs in a reply or a log.
 */
export function validateBody<T>(schema: ZodType<T>, body: unknown): ValidateBodyResult<T> {
  const result = schema.safeParse(body);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const issue = result.error.issues[0];
  const field = issue ? fieldOf(issue.path) : WHOLE_BODY_FIELD;
  const message = messageFor(field, issue?.message ?? 'Invalid input');

  // The field name is the whole of what is recorded. It explains the refusal
  // without quoting the value that caused it.
  recordRefusal(SCHEMA_REFUSAL_REASON, { field });

  return { ok: false, response: validationFailedResponse(field, message) };
}
