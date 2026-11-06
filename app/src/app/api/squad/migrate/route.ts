import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { requireAuth, getAuthenticatedUser } from '@/lib/auth-helpers';
import { GameState } from '@/lib/types';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { saveConflictResponse } from '@/lib/save-store';
import { reviseSave } from '@/lib/save-revise';
import { squadMigrateRequestSchema } from '@/lib/validations';

/**
 * How many times a save's migration is retried after losing a write race.
 * The migration only fills in missing fields, so re-running it on a fresh
 * copy of the save is always correct; three tries outlasts any realistic
 * burst of a player's own actions landing at the same moment.
 */
const MIGRATION_ATTEMPTS = 3;

function migrateGameState(gameState: GameState): boolean {
  let modified = false;

  if (!gameState.squad) return modified;

  // Ensure squad fields
  if (gameState.squad.weeklyTrainingBudget === undefined) {
    gameState.squad.weeklyTrainingBudget = 15;
    modified = true;
  }
  if (gameState.squad.currentWeek === undefined) {
    gameState.squad.currentWeek = 1;
    modified = true;
  }

  // Ensure player fields
  for (const player of gameState.squad.players) {
    if (player.fatigue === undefined) {
      player.fatigue = 100;
      modified = true;
    }
    if (player.currentForm === undefined) {
      player.currentForm = 'average';
      modified = true;
    }
    if (player.weeklyTrainingCount === undefined) {
      player.weeklyTrainingCount = 0;
      modified = true;
    }
    if (player.isInjured === undefined) {
      player.isInjured = false;
      modified = true;
    }
    if (player.injuryWeeksRemaining === undefined) {
      player.injuryWeeksRemaining = 0;
      modified = true;
    }
    if (player.injuryType === undefined) {
      player.injuryType = null;
      modified = true;
    }
  }

  return modified;
}

export const POST = withApiRoute('squad-migrate', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    // Check authentication
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    const bodyResult = await readBody(squadMigrateRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const body = bodyResult.body;

    // A body naming someone other than the session user is refused, not
    // silently redirected to the session user's own save. The client sends the
    // id it resolved from the session, so a signed-in player's load-time call
    // always matches.
    if (sessionUserId && body.userId && body.userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetUserId = sessionUserId || body.userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User not identified' }, { status: 401 });
    }

    // Load, migrate, write back guarded on the version, retrying on a lost
    // race: this runs on every page load, right when the player's other
    // actions are most likely to be in flight.
    const revised = await reviseSave(targetUserId, migrateGameState, { attempts: MIGRATION_ATTEMPTS });

    if (!revised.ok) {
      if (revised.reason === 'not_found') {
        return NextResponse.json({ error: 'Game state not found' }, { status: 404 });
      }
      log.warn('Migration rejected: the save kept moving on across every attempt', {
        attempts: revised.attempts,
      });
      return saveConflictResponse();
    }

    if (revised.changed) {
      return NextResponse.json({
        success: true,
        message: 'Migration completed'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No migration needed - already up to date'
    });
  } catch (error) {
    log.error('Error', { error });
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
});

// GET endpoint for admin batch migration. It rewrites every saved game state,
// so it is gated on the cron or admin secret rather than a user session; the
// app itself only ever calls the POST above.
export const GET = withApiRoute('squad-migrate', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const adminSecret = process.env.ADMIN_SECRET;
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAdmin = adminSecret && authHeader === `Bearer ${adminSecret}`;

    if (!isCron && !isAdmin) {
      return NextResponse.json(
        { error: 'Admin or cron auth required to run the batch migration' },
        { status: 403 }
      );
    }

    // Only the ids are listed here; each save is loaded again, inside
    // reviseSave, at the moment it is written, so a batch over many players
    // never writes a save it read minutes earlier.
    const allIds: Array<{ userId: string }> = await db
      .select({ userId: gameStates.userId })
      .from(gameStates);

    let migrated = 0;
    let alreadyUpToDate = 0;
    let conflicts = 0;
    let errors = 0;

    for (const { userId } of allIds) {
      try {
        const revised = await reviseSave(userId, migrateGameState, { attempts: MIGRATION_ATTEMPTS });
        if (!revised.ok) {
          // A save that kept changing through every attempt. The player's
          // own load-time call will migrate it; the batch moves on and
          // reports how many it left.
          if (revised.reason === 'conflict') {
            log.warn('Batch migration skipped a save that kept moving on', { userId });
            conflicts++;
          }
          continue;
        }
        if (revised.changed) {
          migrated++;
        } else {
          alreadyUpToDate++;
        }
      } catch (e) {
        log.error('Migration failed for user', { userId, error: e });
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      total: allIds.length,
      migrated,
      alreadyUpToDate,
      conflicts,
      errors
    });
  } catch (error) {
    log.error('Batch migration error', { error });
    return NextResponse.json({ error: 'Batch migration failed' }, { status: 500 });
  }
});
