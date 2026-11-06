import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fanClubInvestments, investmentYields } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { calculateYieldExpiryDate } from '@/lib/economy';
import { requireCronAuth } from '@/lib/cron-auth';
import { withApiRoute, ApiContext } from '@/lib/api-route';

/** The UTC day `now` falls on, as the yield ledger stores it. */
function utcDayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The daily run over every investment: close the ones whose lock is over,
 * pay the ones still running.
 *
 * Three things this used to get wrong, each now pinned by the shape of the
 * writes rather than by the schedule being trusted:
 *
 *  - Nothing ever closed an investment, so every purchase paid and boosted
 *    for ever. Closing happens here, first, and a row closed on this run is
 *    not paid on it — an investment found already past its lock ends without
 *    one more yield.
 *  - A second run on the same day paid everyone again. Each yield now carries
 *    the UTC day it pays for, under a unique index on (investment, day), and
 *    is inserted with ON CONFLICT DO NOTHING — the second run's inserts hit
 *    the index and count as skipped.
 *  - The six products with no daily yield got a 0-amount row every day.
 *    Nothing to pay means no row.
 */
export const GET = withApiRoute('cron-daily-yield', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    const now = new Date();

    // Lock over, investment over: it stops paying and (because every reader
    // of bonuses and of the active list also checks unlockDate) has already
    // stopped boosting. One statement, so a backlog of long-dead rows —
    // nothing closed one before this existed — ends on a single run.
    const closed = await db.update(fanClubInvestments)
      .set({ active: false })
      .where(and(
        eq(fanClubInvestments.active, true),
        lte(fanClubInvestments.unlockDate, now)
      ))
      .returning({ id: fanClubInvestments.id });

    const activeInvestments = await db.query.fanClubInvestments.findMany({
      where: eq(fanClubInvestments.active, true),
    });

    let yieldsCreated = 0;
    let yieldsAlreadyPaid = 0;
    const yieldDate = utcDayOf(now);

    for (const investment of activeInvestments) {
      if (investment.yieldPerDay <= 0) continue;

      const inserted = await db.insert(investmentYields).values({
        investmentId: investment.id,
        userId: investment.userId,
        amount: investment.yieldPerDay,
        createdAt: now,
        claimed: false,
        expiryDate: calculateYieldExpiryDate(now),
        yieldDate,
      })
        .onConflictDoNothing({
          target: [investmentYields.investmentId, investmentYields.yieldDate],
        })
        .returning({ id: investmentYields.id });

      if (inserted.length > 0) {
        yieldsCreated++;
      } else {
        yieldsAlreadyPaid++;
      }
    }

    return NextResponse.json({
      success: true,
      investmentsProcessed: activeInvestments.length,
      investmentsClosed: closed.length,
      yieldsCreated,
      yieldsAlreadyPaid,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    log.error('Error generating daily yields', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
