import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { investmentYields } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';

// This cron job expires yields that haven't been claimed within 7 days
// Should be run once per day

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const now = new Date();
    
    // Find unclaimed yields older than 7 days
    const expiredYields = await db.query.investmentYields.findMany({
      where: eq(investmentYields.claimed, false),
    });
    
    // Filter for expired yields
    const sevenDaysAgoMs = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const actuallyExpired = expiredYields.filter((y: { createdAt: string }) => {
      const createdMs = new Date(y.createdAt).getTime();
      return createdMs < sevenDaysAgoMs;
    });
    
    if (actuallyExpired.length === 0) {
      return NextResponse.json({
        message: 'No expired yields to process',
        expiredCount: 0
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
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('Error processing expired yields:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}