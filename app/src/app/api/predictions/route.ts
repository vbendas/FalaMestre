import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { predictions, predictionHistory, userBets } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { loadSave } from '@/lib/save-store';
import { openFixtureMarket } from '@/lib/fixture-markets';
import type { PredictionOption } from '@/lib/types';

/**
 * Where a bet stands, as the bets screen shows it: on a market still taking
 * bets (`open`), on a match that has kicked off and is waiting to be banked
 * and settled (`in_play`), held because the old settlement code left it
 * half done and an operator has to say whether it was paid
 * (`under_review`), or settled.
 */
export type BetStatus = 'open' | 'in_play' | 'under_review' | 'won' | 'lost';

export const GET = withApiRoute('predictions', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const sessionUserId = await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const status = searchParams.get('status'); // 'open', 'closed', 'settled'

    if (sessionUserId && requestedUserId && requestedUserId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // The session owns the read. A named id only ever selects the signed-in
    // player's own rows, so it can never reach someone else's bets.
    const userId = sessionUserId || requestedUserId;

    if (userId) {
      // The market on the player's next fixture is opened when the save is
      // created and every time a match is banked. This is the backstop for
      // the times it was not: a save from before markets existed, or an open
      // that failed after its match had already been committed. Idempotent
      // (see fixture-markets.ts), so a board read that finds the market
      // there writes nothing. A failure costs the player the market, not the
      // board.
      try {
        const save = await loadSave(userId);
        if (save) {
          await openFixtureMarket(userId, save.state);
        }
      } catch (error) {
        log.warn('Could not open the market for the next fixture', { error });
      }
    }

    // A market is on one player's fixture, so a player is shown their own.
    // Without a player there is nobody's board to show.
    const predictionList = userId
      ? await db.query.predictions.findMany({
          where: status
            ? and(eq(predictions.userId, userId), eq(predictions.status, status))
            : eq(predictions.userId, userId),
          orderBy: [desc(predictions.createdAt)],
          limit: 50,
        })
      : [];
    
    if (userId) {
      const userBetHistory = await db.query.userBets.findMany({
        where: eq(userBets.userId, userId),
        orderBy: [desc(userBets.createdAt)],
        limit: 50,
      });

      // Each bet with the market it is on, whatever that market's status:
      // the list above is filtered to the open ones, and a bet the player
      // wants to see is as often on a match already played.
      const marketIds: string[] = [...new Set<string>(userBetHistory.map((b: { predictionId: string }) => b.predictionId))];
      const betMarkets = marketIds.length
        ? await db.query.predictions.findMany({ where: inArray(predictions.id, marketIds) })
        : [];
      const marketById = new Map(betMarkets.map((m: { id: string }) => [m.id, m]));

      const bets = userBetHistory.map((bet: typeof userBets.$inferSelect) => {
        const market = marketById.get(bet.predictionId) as typeof predictions.$inferSelect | undefined;
        const option = ((market?.options ?? []) as PredictionOption[]).find(o => o.id === bet.optionId);
        const status: BetStatus = bet.settled
          ? bet.won ? 'won' : 'lost'
          : bet.settlingAt ? 'under_review'
          : market?.status === 'open' ? 'open' : 'in_play';
        return {
          id: bet.id,
          predictionId: bet.predictionId,
          matchId: market?.matchId ?? null,
          homeTeam: market?.homeTeam ?? null,
          awayTeam: market?.awayTeam ?? null,
          optionId: bet.optionId,
          optionLabel: option?.label ?? bet.optionId,
          odds: option?.odds ?? null,
          amount: bet.amount,
          potentialWin: bet.potentialWin,
          status,
          // What it actually paid once settled; null while it is not.
          payout: bet.settled ? (bet.payout ?? (bet.won ? bet.potentialWin : 0)) : null,
          score:
            market && market.homeScore !== null && market.awayScore !== null
              ? { homeScore: market.homeScore, awayScore: market.awayScore }
              : null,
          placedAt: bet.createdAt,
          settledAt: bet.settledAt,
        };
      });
      
      const history = await db.query.predictionHistory.findFirst({
        where: eq(predictionHistory.userId, userId),
      });
      
      return NextResponse.json({
        predictions: predictionList,
        userBets: userBetHistory,
        bets,
        history: history || {
          userId,
          totalBets: 0,
          correctBets: 0,
          currentStreak: 0,
          bestStreak: 0,
          expertLevel: 0,
          totalWinnings: 0
        }
      });
    }
    
    return NextResponse.json({ predictions: predictionList });
    
  } catch (error) {
    log.error('Error fetching predictions', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withApiRoute('predictions', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }
    
    const sessionUserId = await getAuthenticatedUser();
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // This endpoint would be called by admin/cron to create new predictions
    // For now, we'll just return a placeholder
    
    return NextResponse.json({ 
      message: 'Prediction creation handled by cron job',
      note: 'Use internal function createPrediction for now'
    });
    
  } catch (error) {
    log.error('Error creating prediction', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});