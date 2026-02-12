/**
 * Weekly cron job for intent cluster discovery.
 * Runs every Monday at 5 AM UTC.
 * 
 * This job:
 * 1. Fetches embeddings from last 7 days
 * 2. Runs K-means clustering with multiple K values
 * 3. Labels clusters using GPT-4o-mini
 * 4. Stores centroids and back-fills message embeddings
 */

import { NextRequest, NextResponse } from 'next/server';
import { discoverIntentClusters } from '@/lib/clustering/intent-discovery';
import { requireCronAuth } from '@/lib/cron-auth';

export async function GET(request: NextRequest) {
  try {
    const authError = requireCronAuth(request);
    if (authError) {
      return authError;
    }

    // 2. Run intent discovery
    const result = await discoverIntentClusters();

    return NextResponse.json({
      status: 'ok',
      clustersFound: result.clustersFound,
      messagesProcessed: result.messagesProcessed,
      labels: result.labels,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Intent discovery cron error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}
