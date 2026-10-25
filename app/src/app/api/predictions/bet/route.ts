import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { predictions, userBets, predictionHistory, gameStates } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withApiRoute, ApiContext } from '@/lib/api-route';

interface BetRequest {
  predictionId: string;
  optionId: string;
  amount: number;
  userId: string;
}

export const POST = withApiRoute('predictions-bet', async (
  request: NextRequest,
  { log, readJson }: ApiContext
) => {
  try {
    const bodyResult = await readJson<BetRequest>();
    if (!bodyResult.ok) {
      return bodyResult.response;
    }
    const body = bodyResult.body;

    const { predictionId, optionId, amount, userId } = body;
    const targetUserId = userId;
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    if (!predictionId || !optionId || !amount) {
      return NextResponse.json({ 
        error: 'Missing required fields: predictionId, optionId, amount' 
      }, { status: 400 });
    }
    
    // Get user's game state
    let userMoney = 1000000;
    let newBalance = 0;
    
    try {
      const gameState = await db.query.gameStates.findFirst({
        where: eq(gameStates.userId, targetUserId),
      });
      
      if (gameState) {
        userMoney = gameState.currentState.user.money;
        
        newBalance = userMoney - amount;
        
        // Only update if user has enough money
        if (newBalance < 0) {
          return NextResponse.json({ 
            error: `Insufficient funds. You have ${userMoney}, need ${amount}` 
          }, { status: 400 });
        }
        
        // Update balance in DB
        await db.update(gameStates).set({
          currentState: {
            ...gameState.currentState,
            user: {
              ...gameState.currentState.user,
              money: newBalance
            }
          }
        }).where(eq(gameStates.userId, targetUserId));
      } else {
        newBalance = userMoney - amount;
      }
    } catch (err) {
      log.error('Error updating balance', { error: err });
    }
    
    const potentialWin = Math.round(amount * 1.8);

    await db.insert(userBets).values({
      userId: targetUserId,
      predictionId,
      optionId,
      amount,
      potentialWin,
      settled: false,
    });

    await db.insert(predictionHistory).values({
      userId: targetUserId,
      totalBets: 1,
      lastBetAt: new Date(),
    }).onConflictDoUpdate({
      target: predictionHistory.userId,
      set: {
        totalBets: sql`${predictionHistory.totalBets} + 1`,
        lastBetAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      newBalance: newBalance,
      potentialWin: potentialWin,
      message: `Aposta de R$ ${amount.toLocaleString()} realizada!`
    });
    
  } catch (error) {
    log.error('Error placing bet', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});