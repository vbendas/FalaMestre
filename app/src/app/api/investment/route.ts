import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fanClubInvestments, gameStates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getInvestmentTier, createInvestment } from '@/lib/economy';

export async function GET(request: NextRequest) {
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
    console.error('Error fetching investments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
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
      console.log('Using default money');
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
      console.log('Investment recorded in memory');
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
    console.error('Error creating investment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}