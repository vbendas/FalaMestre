import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { predictions, predictionHistory, userBets } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAuthenticatedUser, requireAuth } from '@/lib/auth-helpers';
import { withApiRoute, ApiContext } from '@/lib/api-route';

export const GET = withApiRoute('predictions', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  try {
    const sessionUserId = await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status'); // 'open', 'closed', 'settled'
    
    if (sessionUserId && userId && userId !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    let query = db.query.predictions.findMany({
      orderBy: [desc(predictions.createdAt)],
      limit: 50,
    });
    
    if (status) {
      query = db.query.predictions.findMany({
        where: eq(predictions.status, status),
        orderBy: [desc(predictions.createdAt)],
        limit: 50,
      });
    }
    
    const predictionList = await query;
    
    if (userId) {
      const userBetHistory = await db.query.userBets.findMany({
        where: eq(userBets.userId, userId),
        orderBy: [desc(userBets.createdAt)],
        limit: 20,
      });
      
      const history = await db.query.predictionHistory.findFirst({
        where: eq(predictionHistory.userId, userId),
      });
      
      return NextResponse.json({
        predictions: predictionList,
        userBets: userBetHistory,
        history: history || {
          userId,
          totalBets: 0,
          correctBets: 0,
          currentStreak: 0,
          bestStreak: 0,
          expertLevel: 0,
          totalWinnings: 0
        }
      });
    }
    
    return NextResponse.json({ predictions: predictionList });
    
  } catch (error) {
    log.error('Error fetching predictions', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withApiRoute('predictions', async (
  request: NextRequest,
  { log }: ApiContext
) => {
  try {
    const authError = await requireAuth();
    if (authError) {
      return authError;
    }
    
    const sessionUserId = await getAuthenticatedUser();
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // This endpoint would be called by admin/cron to create new predictions
    // For now, we'll just return a placeholder
    
    return NextResponse.json({ 
      message: 'Prediction creation handled by cron job',
      note: 'Use internal function createPrediction for now'
    });
    
  } catch (error) {
    log.error('Error creating prediction', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});