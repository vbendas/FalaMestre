/**
 * Kickoff: the moment a fixture starts being played, and everything about
 * the match that is fixed from then on.
 *
 * A match follows entirely from its seed, its setup (the squad, formation
 * and morale it is played with) and, turn by turn, the decisions taken. The
 * client used to choose the seed, and the server read the setup from the
 * save whenever it played a turn or replayed the match to bank it. So a
 * player could:
 *
 *  - find a winning seed before kickoff (the stream route played the
 *    fixture to full time under any seed, without closing the market) and
 *    bet on it, then bank that seed;
 *  - abandon a match going badly and play the same fixture again under a
 *    new seed, or the same seed with a different decision at some turn, and
 *    bank whichever run went their way;
 *  - ask finalize for the score under different decisions: a claimed score
 *    the replay disagrees with is answered with the replayed one, unbanked;
 *  - change morale mid-match (a fan-club investment counts at once) so the
 *    replay that banks the match played different football from the turns
 *    that were watched;
 *  - watch the whole match in one go, then play it turn by turn instead:
 *    the two modes play different football from one seed.
 *
 * Now the first time the server plays any of a fixture (a decision turn, a
 * one-shot match, its stream, or a finalize sent without turns) it writes a
 * kickoff row in the same statement that closes the fixture's market: a
 * seed the server draws, the mode, and the setup as it stands. Every later
 * turn, replay, stream and bank of that fixture reads them from the row.
 * Each decision is recorded the first time its turn is played, and a turn
 * played again is played as it was. The client's seed is ignored.
 *
 * What the player can still do is play the fixture again from the top:
 * they get the same match, turn for turn, and finalize banks it.
 */

import { randomBytes } from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { fixtureKickoffs, predictions } from '@/db/schema';
import { fixtureMatchId } from './fixture-markets';
import { seasonNumber } from './constants';
import type { MatchSettings, Player } from './types';

/** Played turn by turn (decide, finalize) or in one go (/api/match, stream). */
export type KickoffMode = 'turns' | 'quick';

/** What the match is played from, taken from the save at kickoff. */
export interface KickoffSetup {
  formation: string;
  players: Player[];
  /** The squad's morale with the investment bonus already applied. */
  userMorale: number;
  matchSettings?: MatchSettings;
}

export interface Kickoff {
  seed: string;
  mode: KickoffMode;
  setup: KickoffSetup;
  /** Turn number (as a string key) to the decision id played, null for the timer. */
  decisions: Record<string, string | null>;
}

export type KickoffResult =
  | { ok: true; kickoff: Kickoff }
  | { ok: false; reason: 'other_mode'; mode: KickoffMode };

type KickoffRow = typeof fixtureKickoffs.$inferSelect;

/** The kickoff row of the fixture `season` is on: its season and round. */
function ofFixture(userId: string, season: { week: number; number?: number }) {
  return and(
    eq(fixtureKickoffs.userId, userId),
    eq(fixtureKickoffs.season, seasonNumber(season)),
    eq(fixtureKickoffs.round, season.week)
  );
}

/**
 * A fixture's seed: from the operating system's generator, not the game's
 * seedable one, since the point is that nobody can know it in advance. 12
 * characters of [A-Za-z0-9_-], inside `seedSchema`.
 */
function drawFixtureSeed(): string {
  return randomBytes(9).toString('base64url');
}

function fromRow(row: KickoffRow): Kickoff {
  return {
    seed: row.seed,
    mode: row.mode as KickoffMode,
    setup: row.setup as KickoffSetup,
    decisions: (row.decisions ?? {}) as Record<string, string | null>,
  };
}

/**
 * Kicks off the fixture the save is waiting on, or returns the kickoff it
 * already had. The first call writes the row and closes the fixture's
 * market in one statement, so no bet is taken once any of the match can be
 * shown; later calls change nothing and get the first call's seed, mode and
 * setup back. Refuses a fixture kicked off in the other mode.
 *
 * Callers kick off before playing or showing anything, and refuse the
 * request if this throws.
 */
export async function kickOffFixture(
  userId: string,
  season: { week: number; number?: number },
  mode: KickoffMode,
  setup: KickoffSetup
): Promise<KickoffResult> {
  await db.execute(sql`
    with started as (
      insert into ${fixtureKickoffs} (user_id, season, round, seed, mode, setup)
      values (${userId}, ${seasonNumber(season)}, ${season.week}, ${drawFixtureSeed()}, ${mode}, ${JSON.stringify(setup)}::jsonb)
      on conflict (user_id, season, round) do nothing
      returning 1
    ),
    closed as (
      update ${predictions}
      set status = 'closed', kicked_off_at = coalesce(${predictions.kickedOffAt}, now())
      where ${predictions.userId} = ${userId}
        and ${predictions.matchId} = ${fixtureMatchId(season)}
        and ${predictions.status} = 'open'
      returning 1
    )
    select 1
  `);

  const row = await db.query.fixtureKickoffs.findFirst({ where: ofFixture(userId, season) });
  if (!row) throw new Error('Kickoff row missing after it was written');

  const kickoff = fromRow(row);
  if (kickoff.mode !== mode) return { ok: false, reason: 'other_mode', mode: kickoff.mode };
  return { ok: true, kickoff };
}

/** Whether a decision has been recorded for `turnNumber`. */
export function hasDecision(kickoff: Pick<Kickoff, 'decisions'>, turnNumber: number): boolean {
  return Object.prototype.hasOwnProperty.call(kickoff.decisions, String(turnNumber));
}

/**
 * Records decisions for turns that have none yet, and returns every
 * decision the fixture now has. A turn that already has one keeps it: the
 * first decision played for a turn is the one that counts. One statement,
 * so two requests recording the same turn at once cannot both win.
 */
export async function recordDecisions(
  userId: string,
  season: { week: number; number?: number },
  decisions: Record<number, string | null>
): Promise<Record<string, string | null>> {
  const rows = (await db
    .update(fixtureKickoffs)
    // Right operand wins in jsonb `||`, so the existing decisions override.
    .set({ decisions: sql`${JSON.stringify(decisions)}::jsonb || ${fixtureKickoffs.decisions}` })
    .where(ofFixture(userId, season))
    .returning({ decisions: fixtureKickoffs.decisions })) as Array<{ decisions: unknown }>;
  if (rows.length === 0) throw new Error('Recording a decision for a fixture that has not kicked off');
  return rows[0].decisions as Record<string, string | null>;
}
