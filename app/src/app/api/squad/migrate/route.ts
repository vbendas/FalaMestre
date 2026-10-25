import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, getAuthenticatedUser } from '@/lib/auth-helpers';
import { GameState, Player } from '@/lib/types';
import { withApiRoute, ApiContext } from '@/lib/api-route';

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
  { log, readJson }: ApiContext
) => {
  try {
    // Check authentication
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();

    // Parse request
    const bodyResult = await readJson<{ userId?: string }>();
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const body = bodyResult.body;

    const targetUserId = sessionUserId || body.userId;
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'User not identified' }, { status: 401 });
    }

    // Get game state
    const gameStateRecord = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, targetUserId),
    });

    if (!gameStateRecord) {
      return NextResponse.json({ error: 'Game state not found' }, { status: 404 });
    }

    const gameState = gameStateRecord.currentState;
    
    // Run migration
    const modified = migrateGameState(gameState);
    
    if (modified) {
      await db.update(gameStates)
        .set({ currentState: gameState })
        .where(eq(gameStates.userId, targetUserId));
        
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

// GET endpoint for admin batch migration
export const GET = withApiRoute('squad-migrate', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  try {
    // Note: In production, add admin authentication check here
    
    const allStates = await db.query.gameStates.findMany();
    
    let migrated = 0;
    let alreadyUpToDate = 0;
    let errors = 0;
    
    for (const state of allStates) {
      try {
        const modified = migrateGameState(state.currentState);
        
        if (modified) {
          await db.update(gameStates)
            .set({ currentState: state.currentState })
            .where(eq(gameStates.userId, state.userId));
          migrated++;
        } else {
          alreadyUpToDate++;
        }
      } catch (e) {
        log.error('Migration failed for user', { userId: state.userId, error: e });
        errors++;
      }
    }
    
    return NextResponse.json({ 
      success: true,
      total: allStates.length,
      migrated,
      alreadyUpToDate,
      errors 
    });
  } catch (error) {
    log.error('Batch migration error', { error });
    return NextResponse.json({ error: 'Batch migration failed' }, { status: 500 });
  }
});
