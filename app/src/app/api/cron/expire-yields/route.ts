import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { investmentYields } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { requireCronAuth } from '@/lib/cron-auth';
import { withApiRoute, ApiContext } from '@/lib/api-route';

/**
 * Sweeps up the yields whose claim window closed.
 *
 * Two corrections to how it used to work:
 *
 *  - It judged expiry by recomputing `createdAt` + a hardcoded seven days,
 *    its own private definition, while every other reader of a yield judges
 *    by the row's `expiryDate`. The row's own date is the definition now, so
 *    the sweep and the claim route can never disagree about one yield.
 *  - It marked a lost yield `claimed`, with a `claimedAt`, which booked money
 *    the player never saw exactly like money paid out. A lost yield is now
 *    marked `expired` and stays unclaimed: the ledger says what happened.
 *
 * One statement instead of a row-by-row loop: the filter used to happen in
 * JS over every unclaimed row in the table, then write them back one UPDATE
 * at a time.
 */
export const GET = withApiRoute('cron-expire-yields', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    const now = new Date();

    const swept = await db.update(investmentYields)
      .set({ expired: true })
      .where(and(
        eq(investmentYields.claimed, false),
        eq(investmentYields.expired, false),
        lt(investmentYields.expiryDate, now)
      ))
      .returning({ amount: investmentYields.amount });

    const totalLost = swept.reduce((sum: number, y: { amount: number }) => sum + y.amount, 0);

    if (swept.length > 0) {
      log.warn('Yields expired unclaimed', { expiredCount: swept.length, totalLost });
    }

    return NextResponse.json({
      success: true,
      expiredCount: swept.length,
      totalLost,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    log.error('Error processing expired yields', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
