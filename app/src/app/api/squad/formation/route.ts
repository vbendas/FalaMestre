import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getAuthenticatedUser } from '@/lib/auth-helpers';
import { FORMATIONS } from '@/lib/formations';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { squadFormationRequestSchema } from '@/lib/validations';
import { loadSave, commitSave, saveConflictResponse } from '@/lib/save-store';

export const POST = withApiRoute('squad-formation', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    // Check authentication - returns 401 only if REQUIRE_AUTH=true and no session
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }
    
    // Get authenticated user ID (or null if not using auth)
    const sessionUserId = await getAuthenticatedUser();
    
    // Parse and validate request
    const bodyResult = await readBody(squadFormationRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { userId, formation } = bodyResult.body;

    // A body naming someone other than the session user is refused, not
    // silently redirected to the session user's own save.
    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Session user when signed in, body id as the auth-disabled dev fallback
    const targetUserId = sessionUserId || userId;
    
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'User not identified. Please provide userId or sign in.' },
        { status: 401 }
      );
    }

    // Get user's game state, remembering the version it was read at
    const save = await loadSave(targetUserId);

    if (!save) {
      return NextResponse.json(
        { error: 'Game state not found' },
        { status: 404 }
      );
    }

    const gameState = save.state;
    
    // Update formation
    gameState.squad.formation = formation;

    const committed = await commitSave(targetUserId, gameState, save.version);
    if (!committed.ok) {
      log.warn('Formation change rejected: the save moved on while it was being processed', { formation });
      return saveConflictResponse();
    }

    return NextResponse.json({
      success: true,
      formation,
      message: `Formação alterada para ${FORMATIONS[formation].name}!`,
    });
  } catch (error) {
    log.error('Error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
