/**
 * Versioned reads and writes of a player's save.
 *
 * Every save-changing route follows the same shape: load the whole save,
 * change it in memory, write the whole thing back. Two of them overlapping
 * on one save (a training session landing while a match is being banked,
 * say) both read the same row and both write it, and whichever lands second
 * silently erases the first. /api/match/finalize closes that window for
 * itself by making the season week part of its UPDATE's WHERE; nothing else
 * has a week to check against.
 *
 * `game_states.version` is the general answer. `loadSave` reads the save and
 * its version together; `commitSave` writes it back only if the row is still
 * at that version, bumping it as it goes. A write that matches no row lost a
 * race, and the route answers with `saveConflictResponse()`: a 409 telling
 * the caller the save moved on and to reload, exactly as finalize does when
 * it loses. The row's version is also bumped by a trigger on every write
 * that changes `current_state` (see drizzle/0001_game_state_version.sql), so
 * a guarded write is refused even when the write that beat it bypassed this
 * module: a hand-run SQL fix, or a route added later without it. Every route
 * that writes `current_state` goes through here; the one UPDATE on the table
 * that does not is the chat-history append in /api/conversation, which never
 * touches `current_state`.
 *
 * The database only runs this check in a single UPDATE, so it holds on the
 * embedded store and on Neon alike, with no locks and no transaction.
 *
 * Two more shapes live here for the writers that are not a player pressing a
 * button:
 *
 *  - `adjustMoney` changes `user.money` by a delta inside the UPDATE itself
 *    (`jsonb_set` on the stored JSON), so it never reads the save and has
 *    nothing to conflict with. Bets, bet settlement and yield claims only
 *    ever touch money, and settlement runs for every bettor at once, where a
 *    refusal has nobody to bounce back to.
 *  - `reviseSave` (src/lib/save-revise.ts, built on the two above) is load,
 *    revise, commit in a loop: a lost race reloads and tries again, a few
 *    times. For the schema migration of a save, which is idempotent and has
 *    nothing a player chose in it, retrying is right and a 409 would only
 *    make the client retry anyway.
 */

import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import type { GameState } from '@/lib/types';
import { getLogger } from '@/lib/request-context';

export type LoadedSave = {
  state: GameState;
  /** The row's version at the moment of the read. Hand it back to `commitSave`. */
  version: number;
};

export type CommitResult =
  | { ok: true; version: number }
  | { ok: false; reason: 'conflict' };

import { SAVE_CONFLICT_ERROR } from '@/lib/save-conflict';

/** The error string on a 409 from `saveConflictResponse`; shared with the client. */
export { SAVE_CONFLICT_ERROR };

/** The player's save and its current version, or null if there is none. */
export async function loadSave(userId: string): Promise<LoadedSave | null> {
  const record = await db.query.gameStates.findFirst({
    where: eq(gameStates.userId, userId),
  });
  if (!record) return null;
  return { state: record.currentState, version: record.version };
}

/**
 * Writes `state` back as long as the row is still at `expectedVersion`.
 *
 * The version check lives in the UPDATE's own WHERE, so it and the write are
 * one statement: whoever writes second matches no row. On success the row is
 * at `expectedVersion + 1` and that is what comes back; on a conflict nothing
 * was written and the caller should answer with `saveConflictResponse()`.
 */
export async function commitSave(
  userId: string,
  state: GameState,
  expectedVersion: number
): Promise<CommitResult> {
  const written = (await db
    .update(gameStates)
    .set({
      currentState: state,
      version: sql`${gameStates.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(gameStates.userId, userId), eq(gameStates.version, expectedVersion)))
    .returning({ version: gameStates.version })) as Array<{ version: number }>;

  if (written.length === 0) {
    getLogger('save-store').warn('Save write refused: the save moved on since it was read', {
      expectedVersion,
    });
    return { ok: false, reason: 'conflict' };
  }
  return { ok: true, version: written[0].version };
}

/**
 * The reply for a lost race, in the shape finalize uses: a 409 that says the
 * save moved on. No detail of what beat it, because this request never saw
 * it; the caller reloads the save to find out where it stands.
 */
export function saveConflictResponse(): NextResponse {
  return NextResponse.json(
    {
      error: SAVE_CONFLICT_ERROR,
      message:
        'The saved game changed while this action was being processed. Reload and try again.',
    },
    { status: 409 }
  );
}

export type AdjustMoneyResult =
  | { ok: true; money: number; version: number }
  | { ok: false; reason: 'not_found' | 'insufficient' };

/**
 * Adds `delta` (negative to debit) to `user.money` in one UPDATE, with no
 * read of the save and so no version to check: Postgres computes the new
 * value from the row as it is at the moment of the write, and the trigger
 * bumps the version for everyone else.
 *
 * With `floor` set, the write only goes through if the resulting balance is
 * at least that much, so a debit can never overdraw even against another
 * debit landing at the same instant. The returned `money` is the stored
 * balance after the write.
 */
export async function adjustMoney(
  userId: string,
  delta: number,
  options: { floor?: number } = {}
): Promise<AdjustMoneyResult> {
  if (!Number.isFinite(delta)) {
    throw new Error(`adjustMoney: delta must be a finite number, got ${String(delta)}`);
  }
  const money = sql`(${gameStates.currentState}->'user'->>'money')::numeric`;
  const newMoney = sql`${money} + ${delta}`;
  const conditions = [eq(gameStates.userId, userId)];
  if (options.floor !== undefined) {
    conditions.push(sql`${newMoney} >= ${options.floor}`);
  }

  const written = (await db
    .update(gameStates)
    .set({
      currentState: sql`jsonb_set(${gameStates.currentState}, '{user,money}', to_jsonb(${newMoney}))`,
      version: sql`${gameStates.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({
      money: sql<string | number>`(${gameStates.currentState}->'user'->>'money')::numeric`,
      version: gameStates.version,
    })) as Array<{ money: string | number; version: number }>;

  if (written.length > 0) {
    return { ok: true, money: Number(written[0].money), version: written[0].version };
  }
  // No row matched: either there is no save, or the floor refused the debit.
  // One more read tells them apart; it is only reached on the failure path.
  const exists = await db.query.gameStates.findFirst({
    where: eq(gameStates.userId, userId),
    columns: { userId: true },
  });
  return { ok: false, reason: exists ? 'insufficient' : 'not_found' };
}
