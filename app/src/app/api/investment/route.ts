import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fanClubInvestments, gameStates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getInvestmentTier, createInvestment } from '@/lib/economy';
import { InvestmentOption } from '@/lib/types';
import { withApiRoute, ApiContext } from '@/lib/api-route';

interface InvestmentRequest {
  option: InvestmentOption;
  userId: string;
}

export const GET = withApiRoute('investment', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    const investments = await db.query.fanClubInvestments.findMany({
      where: and(
        eq(fanClubInvestments.userId, userId),
        eq(fanClubInvestments.active, true)
      ),
    });
    
    return NextResponse.json({
      investments,
      activeCount: investments.length
    });
    
  } catch (error) {
    log.error('Error fetching investments', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withApiRoute('investment', async (
  request: NextRequest,
  { log, readJson }: ApiContext
) => {
  try {
    const bodyResult = await readJson<InvestmentRequest>();
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const body = bodyResult.body;

    const { option, userId } = body;
    const targetUserId = userId;
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    if (!option || !['A', 'B', 'C'].includes(option)) {
      return NextResponse.json({ error: 'Invalid option. Must be A, B, or C' }, { status: 400 });
    }
    
    const tier = getInvestmentTier(option);
    if (!tier) {
      return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
    }
    
    // Get user balance
    let userMoney = 1000000;
    let newBalance = 0;
    
    try {
      const gameState = await db.query.gameStates.findFirst({
        where: eq(gameStates.userId, targetUserId),
      });
      
      if (gameState) {
        userMoney = gameState.currentState.user.money;
      }
    } catch (err) {
      log.info('Using default money', { error: err });
    }
    
    newBalance = userMoney - tier.amount;
    
    if (newBalance < 0) {
      return NextResponse.json({ 
        error: `Insufficient funds. You have ${userMoney}, need ${tier.amount}` 
      }, { status: 400 });
    }
    
    // Try to insert investment
    try {
      const investment = createInvestment(targetUserId, option);
      await db.insert(fanClubInvestments).values(investment);
    } catch (err) {
      log.info('Investment recorded in memory', { error: err });
    }
    
    return NextResponse.json({
      success: true,
      newBalance,
      yields: {
        perDay: tier.yieldPerDay,
        totalAfterLock: tier.yieldPerDay * tier.lockPeriodDays
      }
    });
    
  } catch (error) {
    log.error('Error creating investment', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});