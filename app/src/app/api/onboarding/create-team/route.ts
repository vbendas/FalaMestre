import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { gameStates, users } from '@/db/schema';
import { createInitialGameState } from '@/lib/game-engine';
import { GameState } from '@/lib/types';
import { generateUserId } from '@/lib/utils';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { getAuthenticatedSessionUser, requireAuth } from '@/lib/auth-helpers';
import { eq } from 'drizzle-orm';
import { teamCreationRequestSchema } from '@/lib/validations';
import { openFixtureMarketAfterCommit } from '@/lib/fixture-markets';

export const POST = withApiRoute('onboarding-create-team', async (
  request: NextRequest,
  { log, readBody }: ApiContext
) => {
  try {
    // With auth on, a team created by an unsigned visitor could never be
    // played — every other route wants a session — so onboarding wants one
    // too. With AUTH_DISABLED=true (dev) this is a no-op and the local-id
    // path below still runs.
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const bodyResult = await readBody(teamCreationRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { teamName, primaryColor, secondaryColor, badgeStyle } = bodyResult.body;

    // A signed-in player's save belongs to their account, so it is keyed on the
    // session user id. Only an anonymous player gets a generated local id, which
    // is also the path taken when auth is disabled in dev.
    const sessionUser = await getAuthenticatedSessionUser();
    const userId = sessionUser?.id ?? generateUserId();

    // The session user may already have a save (a second trip through
    // onboarding, or two tabs). Keyed on userId, a second insert would be
    // swallowed below and the player would be sent back to a team they did not
    // just create, so answer with the save they already own instead.
    if (sessionUser) {
      let existing;
      try {
        existing = await db.query.gameStates.findFirst({
          where: eq(gameStates.userId, userId),
        });
      } catch (lookupError) {
        log.warn('Failed to check for an existing save, continuing', { error: lookupError });
      }

      if (existing) {
        return NextResponse.json(
          {
            success: true,
            userId,
            team: (existing as { team: string }).team,
            alreadyExisted: true,
            message: 'Você já tem um time.',
          },
          { status: 200 }
        );
      }
    }

    // Create initial game state with custom team name
    const gameState: GameState = createInitialGameState(userId, teamName);

    // Add team customization to game state
    const enhancedGameState: GameState & {
      teamCustomization?: {
        primaryColor: string;
        secondaryColor: string;
        badgeStyle: string;
      };
    } = {
      ...gameState,
      teamCustomization: {
        primaryColor,
        secondaryColor,
        badgeStyle,
      },
    };

    // Create user record
    try {
      await db.insert(users).values({
        id: userId,
        username: teamName,
        // A signed-in player keeps their real account email; an anonymous one
        // gets the placeholder the local id implies.
        email: sessionUser?.email ?? `${userId}@falamestre.local`,
        onboardingCompleted: true,
        createdAt: new Date(),
      });
    } catch (userError) {
      log.warn('Failed to create user record, continuing anyway', { error: userError });
      // Continue even if user creation fails - it's not critical
    }

    // Create game state record
    try {
      await db.insert(gameStates).values({
        userId,
        team: teamName,
        currentState: enhancedGameState,
        conversationHistory: [],
        statistics: {
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          pointsEarned: 0,
        },
      });

      // Round 1's market, once there is a save for it to belong to.
      await openFixtureMarketAfterCommit(userId, enhancedGameState);
    } catch (gameStateError) {
      log.warn('Failed to persist game state to DB, continuing with client-only mode', {
        error: gameStateError,
      });
    }

    // Return success with userId (client will store in localStorage)
    return NextResponse.json(
      {
        success: true,
        userId,
        team: teamName,
        message: 'Time criado com sucesso!',
      },
      { status: 201 }
    );
  } catch (error) {
    log.error('Onboarding error', { error });
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
