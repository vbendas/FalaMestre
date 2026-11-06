/**
 * What may be said in a log line about text that is not ours.
 *
 * A failure to parse untrusted text must never be reported by handing the
 * error to the logger. `JSON.parse` puts the first bytes of its input in the
 * error's `message` — verified, not assumed: parsing `"PLAYER-SECRET..."`
 * raises `Unexpected token 'P', "PLAYER-SEC"... is not valid JSON`. When the
 * input is a model's reply, those bytes are the model talking back about
 * whatever the player asked, and our system prompt hands it the player's
 * team, budget, morale and league position. A `ZodError` is worse: it carries
 * the offending values on `issues` and a pile of `_zod` internals as own
 * properties, all of which the logger expands.
 *
 * So the failure is described by its shape instead: which of the two checks
 * failed, how long the text was, and — for a schema failure — the field paths
 * and codes, which are names from *our* schema rather than anything the far
 * end chose.
 *
 * This lives apart from `logger.ts` on purpose: the logger serialises whatever
 * it is given, and this decides what is worth giving it. Both the assistant
 * (`ai-service.ts`) and the dashboard insights route parse a model reply, and
 * they described the failure differently until they shared this.
 */

import { z } from 'zod';
import type { LogFields } from './logger';

/** How much of a field path is worth keeping. */
const MAX_ISSUE_PATH_LENGTH = 64;

/** Issues are capped so a reply that fails every field cannot bloat the line. */
const MAX_ISSUES = 10;

/**
 * Describes a failure to parse or validate foreign text, quoting none of it.
 *
 * `text` is read only for its length. Pass the error from a `JSON.parse` or a
 * schema `parse`; anything that is not a `ZodError` is reported as a parse
 * failure.
 */
export function parseFailureFields(error: unknown, text: string): LogFields {
  const fields: LogFields = {
    failure: error instanceof z.ZodError ? 'schema' : 'parse',
    replyLength: text.length,
  };

  if (error instanceof z.ZodError) {
    fields.issues = error.issues.slice(0, MAX_ISSUES).map((issue) => ({
      path: issue.path.join('.').slice(0, MAX_ISSUE_PATH_LENGTH),
      code: issue.code,
    }));
  }

  return fields;
}

/**
 * What may be said about a connection string.
 *
 * The Neon driver quotes the whole string back when it will not parse as a
 * URL — verified: the message reads `Connection string: "postgres://app:…"`,
 * password included, and the same text is in the stack. So neither the
 * driver's `message` nor its `stack` can be logged for this failure, and what
 * is actually useful for telling one misconfiguration from another is the
 * part that is not secret.
 *
 * Returns the scheme, host and database name and never the userinfo. A string
 * that will not parse yields only its length, since any substring of it could
 * be the credential.
 */
export function describeDatabaseUrl(value: string | undefined): LogFields {
  if (!value) return { configured: false };

  try {
    // A string wrapped in literal quotes — the slip an env file invites — is
    // what `new URL` rejects here, exactly as the driver does.
    const url = new URL(value);
    return {
      configured: true,
      scheme: url.protocol.replace(/:$/, ''),
      host: url.host,
      database: url.pathname.replace(/^\//, '') || null,
      // Said as a fact, never quoted: whether a credential was supplied is
      // worth knowing when a connection is refused.
      hasCredentials: Boolean(url.username || url.password),
    };
  } catch {
    return { configured: true, parsed: false, valueLength: value.length };
  }
}
