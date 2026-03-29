import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { predictions, userBets, predictionHistory, gameStates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { settlePrediction, calculateUserBetOutcome, updatePredictionHistory } from '@/lib/prediction-engine';

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
    
    // This endpoint is typically called by admin/cron after match completion
    // But also allows users to check their settled predictions
    
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    const { predictionId, homeScore, awayScore } = body;
    
    if (!predictionId || homeScore === undefined || awayScore === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: predictionId, homeScore, awayScore' 
      }, { status: 400 });
    }
    
    // Get the prediction
    const prediction = await db.query.predictions.findFirst({
      where: eq(predictions.id, predictionId),
    });
    
    if (!prediction) {
      return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });
    }
    
    if (prediction.status === 'settled') {
      return NextResponse.json({ error: 'Prediction already settled' }, { status: 400 });
    }
    
    const winner = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
    
    // Settle the prediction
    const settledPrediction = settlePrediction(
      prediction,
      winner,
      homeScore,
      awayScore
    );
    
    // Update prediction in DB
    await db.update(predictions).set({
      status: 'settled',
      settledAt: new Date().toISOString(),
      options: settledPrediction.options,
    }).where(eq(predictions.id, predictionId));
    
    // Get all bets for this prediction and settle them
    const allBets = await db.query.userBets.findMany({
      where: eq(userBets.predictionId, predictionId),
    });
    
    let totalPayouts = 0;
    
    for (const bet of allBets) {
      const outcome = calculateUserBetOutcome(bet, settledPrediction);
      
      await db.update(userBets).set({
        settled: true,
        won: outcome.won,
        settledAt: new Date().toISOString(),
      }).where(eq(userBets.id, bet.id));
      
      if (outcome.won && outcome.payout > 0) {
        // Add winnings to user's balance
        const userGameState = await db.query.gameStates.findFirst({
          where: eq(gameStates.userId, bet.userId),
        });
        
        if (userGameState) {
          const newBalance = userGameState.currentState.user.money + outcome.payout;
          
          await db.update(gameStates).set({
            currentState: {
              ...userGameState.currentState,
              user: {
                ...userGameState.currentState.user,
                money: newBalance
              }
            }
          }).where(eq(gameStates.userId, bet.userId));
        }
        
        // Update user's prediction history
        const userHistory = await db.query.predictionHistory.findFirst({
          where: eq(predictionHistory.userId, bet.userId),
        });
        
        if (userHistory) {
          const updatedHistory = updatePredictionHistory(
            userHistory,
            outcome.won,
            outcome.payout
          );
          
          await db.update(predictionHistory).set(updatedHistory).where(
            eq(predictionHistory.userId, bet.userId)
          );
        }
        
        totalPayouts += outcome.payout;
      }
    }
    
    return NextResponse.json({
      success: true,
      prediction: settledPrediction,
      totalBets: allBets.length,
      totalPayouts,
      winner: settledPrediction.options.find(o => o.result === 'won')?.label || 'Draw'
    });
    
  } catch (error) {
    console.error('Error settling prediction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}