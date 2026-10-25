import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fanClubInvestments, investmentYields } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { calculateYieldExpiryDate } from '@/lib/economy';
import { requireCronAuth } from '@/lib/cron-auth';
import { withApiRoute, ApiContext } from '@/lib/api-route';

export const GET = withApiRoute('cron-daily-yield', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    const activeInvestments = await db.query.fanClubInvestments.findMany({
      where: eq(fanClubInvestments.active, true),
    });

    if (activeInvestments.length === 0) {
      return NextResponse.json({
        message: 'No active investments',
        yieldsCreated: 0,
      });
    }

    let yieldsCreated = 0;

    for (const investment of activeInvestments) {
      const yieldExpiry = calculateYieldExpiryDate(new Date());

      await db.insert(investmentYields).values({
        investmentId: investment.id,
        userId: investment.userId,
        amount: investment.yieldPerDay,
        createdAt: new Date().toISOString(),
        claimed: false,
        expiryDate: yieldExpiry.toISOString(),
      });

      yieldsCreated++;
    }

    return NextResponse.json({
      success: true,
      investmentsProcessed: activeInvestments.length,
      yieldsCreated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Error generating daily yields', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
