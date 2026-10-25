import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { investmentYields } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireCronAuth } from '@/lib/cron-auth';
import { withApiRoute, ApiContext } from '@/lib/api-route';

export const GET = withApiRoute('cron-expire-yields', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    const now = new Date();
    const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const allUnclaimed = await db.query.investmentYields.findMany({
      where: eq(investmentYields.claimed, false),
    });

    const actuallyExpired = allUnclaimed.filter((y: { createdAt: string }) => {
      return new Date(y.createdAt).getTime() < sevenDaysAgoMs;
    });

    if (actuallyExpired.length === 0) {
      return NextResponse.json({
        message: 'No expired yields to process',
        expiredCount: 0,
      });
    }

    let expiredCount = 0;
    let totalLost = 0;

    for (const yieldRecord of actuallyExpired) {
      await db.update(investmentYields).set({
        claimed: true,
        claimedAt: now.toISOString(),
      }).where(eq(investmentYields.id, yieldRecord.id));

      expiredCount++;
      totalLost += yieldRecord.amount;
    }

    return NextResponse.json({
      success: true,
      expiredCount,
      totalLost,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    log.error('Error processing expired yields', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
