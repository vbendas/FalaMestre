import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { predictions, userBets, predictionHistory, gameStates } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
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
      console.error('Error updating balance:', err);
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
    console.error('Error placing bet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}