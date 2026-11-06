import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { investmentYields } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';
import { investmentClaimRequestSchema } from '@/lib/validations';
import { adjustMoney } from '@/lib/save-store';

/** A yield row, as this route reads it. */
type YieldRow = {
  id: string;
  amount: number;
  expiryDate: Date | string;
};

export const POST = withApiRoute('investment-claim', async (
  request: NextRequest,
  { log, readBody, refuse }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }

    const bodyResult = await readBody(investmentClaimRequestSchema);
    if (!bodyResult.ok) {
      return bodyResult.response;
    }

    const { yieldId, claimAll, userId } = bodyResult.body;

    // The same resolution as buying an investment: the session wins, the
    // body's userId is for dev with auth off. This route used to demand a
    // session unconditionally, so with AUTH_DISABLED a player could buy an
    // investment but never collect what it paid.
    const sessionUserId = await getAuthenticatedUser();
    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const targetUserId = sessionUserId || userId;
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Everything still on the books: not claimed, not swept by the expiry
    // cron. Rows past their expiryDate that the sweep has not reached yet are
    // split out below — they are told apart, never consumed.
    const yields: YieldRow[] = await db.query.investmentYields.findMany({
      where: and(
        eq(investmentYields.userId, targetUserId),
        eq(investmentYields.claimed, false),
        eq(investmentYields.expired, false)
      ),
    });

    const now = new Date();
    const claimable = yields.filter((y) => new Date(y.expiryDate) >= now);
    const expiredCount = yields.length - claimable.length;

    if (yields.length === 0) {
      refuse('claim_nothing_pending');
      return NextResponse.json({ error: 'No yields to claim' }, { status: 400 });
    }

    let yieldsToClaim = claimable;

    if (yieldId) {
      yieldsToClaim = claimable.filter((y) => y.id === yieldId);
      if (yieldsToClaim.length === 0) {
        // Expired between the screen loading and the press. The old loop
        // marked it claimed and paid nothing — the one silent way to lose
        // money on this route. It is refused in words instead, and the row
        // is left for the sweep.
        if (yields.some((y) => y.id === yieldId)) {
          refuse('claim_yield_expired');
          return NextResponse.json(
            { error: 'This yield expired before it could be claimed.' },
            { status: 400 }
          );
        }
        refuse('claim_yield_not_found');
        return NextResponse.json({ error: 'Yield not found' }, { status: 404 });
      }
    } else if (!claimAll) {
      yieldsToClaim = claimable.slice(0, 1);
    }

    if (yieldsToClaim.length === 0) {
      // Only expired yields were pending. Say so; pay nothing; consume
      // nothing.
      refuse('claim_only_expired_pending', { expiredCount });
      return NextResponse.json(
        {
          error: `No claimable yields. ${expiredCount} expired before being claimed.`,
        },
        { status: 400 }
      );
    }

    // Marked claimed one conditional UPDATE at a time, and only the rows the
    // UPDATE actually flipped are credited: two claims racing each other both
    // used to read the same unclaimed rows and both credit them. Whoever's
    // UPDATE finds claimed=false first is paid; the other's returns no row
    // and pays nothing.
    let totalClaimed = 0;
    let rowsClaimed = 0;
    for (const yieldRecord of yieldsToClaim) {
      const flipped = await db.update(investmentYields)
        .set({ claimed: true, claimedAt: now })
        .where(and(
          eq(investmentYields.id, yieldRecord.id),
          eq(investmentYields.claimed, false),
          eq(investmentYields.expired, false)
        ))
        .returning({ amount: investmentYields.amount });

      if (flipped.length > 0) {
        totalClaimed += flipped[0].amount;
        rowsClaimed++;
      }
    }

    if (totalClaimed > 0) {
      // Credited as an increment inside the UPDATE rather than the save
      // written back whole: the yields are already marked claimed above, so
      // a refusal here would lose the money, and an increment cannot lose a
      // race or erase what the player did meanwhile.
      const credited = await adjustMoney(targetUserId, totalClaimed);
      if (!credited.ok) {
        log.warn('Yield claim credited nothing: no save for this user', { totalClaimed });
      }
    }

    return NextResponse.json({
      success: true,
      claimed: totalClaimed,
      yieldsClaimed: rowsClaimed,
      // How many pending yields were past their window and left for the
      // sweep. Informational: nothing of the player's was consumed for them.
      expired: expiredCount,
      message: expiredCount > 0
        ? `Yields claimed. ${expiredCount} other(s) expired before being claimed.`
        : 'Yields claimed successfully',
    });

  } catch (error) {
    log.error('Error claiming yield', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
