import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fanClubInvestments, investmentYields, gameStates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { isYieldExpired } from '@/lib/economy';

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }
    
    const sessionUserId = await getAuthenticatedUser();
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    const { yieldId, claimAll } = body;
    
    // Get unclaimed yields
    const yields = await db.query.investmentYields.findMany({
      where: and(
        eq(investmentYields.userId, sessionUserId),
        eq(investmentYields.claimed, false)
      ),
    });
    
    if (yields.length === 0) {
      return NextResponse.json({ error: 'No yields to claim' }, { status: 400 });
    }
    
    let yieldsToClaim = yields;
    
    if (yieldId) {
      yieldsToClaim = yields.filter((y: { id: string }) => y.id === yieldId);
      if (yieldsToClaim.length === 0) {
        return NextResponse.json({ error: 'Yield not found' }, { status: 404 });
      }
    } else if (!claimAll) {
      yieldsToClaim = yields.slice(0, 1);
    }
    
    let totalClaimed = 0;
    const expiredYields: string[] = [];
    
    for (const yieldRecord of yieldsToClaim) {
      if (isYieldExpired(yieldRecord)) {
        expiredYields.push(yieldRecord.id);
        await db.update(investmentYields).set({
          claimed: true,
          claimedAt: new Date().toISOString(),
        }).where(eq(investmentYields.id, yieldRecord.id));
        continue;
      }
      
      totalClaimed += yieldRecord.amount;
      
      await db.update(investmentYields).set({
        claimed: true,
        claimedAt: new Date().toISOString(),
      }).where(eq(investmentYields.id, yieldRecord.id));
    }
    
    if (totalClaimed > 0) {
      const gameState = await db.query.gameStates.findFirst({
        where: eq(gameStates.userId, sessionUserId),
      });
      
      if (gameState) {
        const newBalance = gameState.currentState.user.money + totalClaimed;
        
        await db.update(gameStates).set({
          currentState: {
            ...gameState.currentState,
            user: {
              ...gameState.currentState.user,
              money: newBalance
            }
          }
        }).where(eq(gameStates.userId, sessionUserId));
      }
    }
    
    return NextResponse.json({
      success: true,
      claimed: totalClaimed,
      expired: expiredYields.length,
      message: expiredYields.length > 0 
        ? `${expiredYields.length} yields expired and were lost`
        : 'Yields claimed successfully'
    });
    
  } catch (error) {
    console.error('Error claiming yield:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}