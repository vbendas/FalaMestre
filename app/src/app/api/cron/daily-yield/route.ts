import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fanClubInvestments, investmentYields } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { calculateYieldExpiryDate } from '@/lib/economy';

// This cron job generates daily yields for all active investments
// Should be run once per day

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get all active investments
    const activeInvestments = await db.query.fanClubInvestments.findMany({
      where: eq(fanClubInvestments.active, true),
    });
    
    if (activeInvestments.length === 0) {
      return NextResponse.json({ 
        message: 'No active investments',
        yieldsCreated: 0 
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
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error generating daily yields:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}