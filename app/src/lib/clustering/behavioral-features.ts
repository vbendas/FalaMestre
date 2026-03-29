/**
 * Behavioral feature aggregation service.
 * Computes behavioral features from raw analytics events and conversations.
 */

import { db } from '@/db';
import { analyticsEvents, conversations, gameStates } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { BehavioralFeatures } from './types';

// Type for analytics events
interface AnalyticsEvent {
  id: string;
  userId: string | null;
  eventType: string | null;
  properties: unknown;
  sessionId: string | null;
  createdAt: Date | null;
}

// Type for conversations
interface Conversation {
  id: string;
  userId: string | null;
  messageType: string | null;
  content: string | null;
  intent: string | null;
  gameStateSnapshot: unknown;
  createdAt: Date | null;
}

/**
 * Compute behavioral features for a single user from raw events.
 * 
 * @param userId - The user ID
 * @returns BehavioralFeatures object with all computed metrics
 */
export async function computeBehavioralFeatures(userId: string): Promise<BehavioralFeatures> {
  // Get current timestamp and cutoff times
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // 1. Query analytics events for engagement metrics
  const userAnalyticsEvents = (await db
    .select()
    .from(analyticsEvents)
    .where(eq(analyticsEvents.userId, userId))) as AnalyticsEvent[];
  
  // 2. Query conversations for message patterns
  const userConversations = (await db
    .select()
    .from(conversations)
    .where(and(
      eq(conversations.userId, userId),
      eq(conversations.messageType, 'user')
    ))) as Conversation[];
  
  // 3. Query game state for performance metrics
  const gameStateRecord = await db.query.gameStates.findFirst({
    where: eq(gameStates.userId, userId),
  });
  
  // Calculate metrics
  
  // Session metrics
  const sessionIds = new Set(userAnalyticsEvents.map((e: { sessionId: string | null }) => e.sessionId));
  const totalSessions = sessionIds.size;
  
  // Events by time window
  const eventsLast7d = userAnalyticsEvents.filter(e => 
    e.createdAt && new Date(e.createdAt) >= sevenDaysAgo
  );
  const sessionsLast7d = new Set(eventsLast7d.map(e => e.sessionId)).size;
  
  const eventsLast30d = userAnalyticsEvents.filter(e => 
    e.createdAt && new Date(e.createdAt) >= thirtyDaysAgo
  );
  const sessionsLast30d = new Set(eventsLast30d.map(e => e.sessionId)).size;
  
  // Days active (unique days with events)
  const uniqueDays = new Set(userAnalyticsEvents.map(e => {
    const date = new Date(e.createdAt || 0);
    return date.toISOString().split('T')[0];
  }));
  const daysActive = uniqueDays.size;
  
  // Days since last active
  const lastEvent = userAnalyticsEvents
    .filter(e => e.createdAt)
    .sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    )[0];
  const daysSinceLastActive = lastEvent?.createdAt
    ? Math.floor((now.getTime() - new Date(lastEvent.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 365; // Assume very inactive if no events
  
  // Preferred play hour (mode of event hours)
  const hours = userAnalyticsEvents.map(e => {
    return new Date(e.createdAt || 0).getHours();
  });
  const hourCounts = new Map<number, number>();
  hours.forEach(h => hourCounts.set(h, (hourCounts.get(h) || 0) + 1));
  const preferredPlayHour = Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 12;
  
  // Weekday vs weekend ratio
  const weekdayEvents = userAnalyticsEvents.filter(e => {
    const day = new Date(e.createdAt || 0).getDay();
    return day >= 1 && day <= 5; // Mon-Fri
  }).length;
  const weekendEvents = userAnalyticsEvents.length - weekdayEvents;
  const weekdayVsWeekend = userAnalyticsEvents.length > 0 
    ? weekdayEvents / Math.max(weekendEvents, 1)
    : 1;
  
  // Consistency score (inverse of std dev of session gaps)
  const sessionDates = Array.from(sessionIds).map(sessionId => {
    const sessionEvents = userAnalyticsEvents.filter(e => e.sessionId === sessionId);
    const timestamps = sessionEvents
      .map(e => e.createdAt ? new Date(e.createdAt).getTime() : 0)
      .filter(t => t > 0);
    return timestamps.length > 0 ? Math.min(...timestamps) : 0;
  }).filter(t => t > 0).sort((a, b) => a - b);
  
  let consistencyScore = 0;
  if (sessionDates.length >= 2) {
    const gaps = [];
    for (let i = 1; i < sessionDates.length; i++) {
      gaps.push(sessionDates[i] - sessionDates[i - 1]);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    // Lower std dev = higher consistency (inverse relationship)
    consistencyScore = Math.max(0, 100 - (stdDev / (1000 * 60 * 60 * 24))); // Normalize by days
  } else {
    consistencyScore = 0;
  }
  
  // Game performance from game state
  let matchesPlayed = 0;
  let matchWinRate = 0;
  let totalPoints = 0;
  
  if (gameStateRecord) {
    const gameState = gameStateRecord.currentState as any;
    matchesPlayed = gameState?.season?.week || 0;
    const wins = gameState?.season?.wins || 0;
    const losses = gameState?.season?.losses || 0;
    const totalGames = wins + losses;
    matchWinRate = totalGames > 0 ? wins / totalGames : 0;
    totalPoints = gameState?.user?.money || 0;
  }
  
  // Conversation metrics
  const totalMessages = userConversations.length;
  const avgMessageLength = totalMessages > 0
    ? userConversations.reduce((sum, c) => sum + (c.content?.length || 0), 0) / totalMessages
    : 0;
  
  const questionCount = userConversations.filter(c => 
    c.content?.includes('?')
  ).length;
  const questionRatio = totalMessages > 0 ? questionCount / totalMessages : 0;
  
  const uniqueIntents = new Set(userConversations.map(c => c.intent).filter(Boolean)).size;
  
  // Decision patterns from conversation intents
  const aggressiveDecisions = userConversations.filter(c => 
    c.intent?.includes('aggressive')
  ).length;
  const defensiveDecisions = userConversations.filter(c => 
    c.intent?.includes('defensive')
  ).length;
  const spendingDecisions = userConversations.filter(c => 
    c.intent?.includes('spending')
  ).length;
  
  // Social actions (would need more tracking in Phase 2+3)
  const socialActions = 0; // Placeholder for now
  
  // Average session duration (estimated from events per session)
  let avgSessionDurationSec = 0;
  if (totalSessions > 0) {
    // Rough estimate: 3 minutes per conversation event per session
    avgSessionDurationSec = (totalMessages * 180) / totalSessions;
  }
  
  // Average points per session
  const avgPointsPerSession = totalSessions > 0 ? totalPoints / totalSessions : 0;
  
  return {
    totalSessions,
    avgSessionDurationSec,
    sessionsLast7d,
    sessionsLast30d,
    daysActive,
    daysSinceLastActive,
    matchesPlayed,
    matchWinRate,
    avgPointsPerSession,
    totalPoints,
    aggressiveDecisions,
    defensiveDecisions,
    spendingDecisions,
    socialActions,
    totalMessages,
    avgMessageLength,
    questionRatio,
    uniqueIntents,
    preferredPlayHour,
    weekdayVsWeekend,
    consistencyScore,
  };
}

/**
 * Get list of user IDs that had activity in the last N hours.
 * Queries analytics_events.created_at.
 * 
 * @param hoursAgo - Number of hours to look back
 * @returns Array of user IDs
 */
export async function getActiveUserIds(hoursAgo: number): Promise<string[]> {
  const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  
  const result = await db
    .selectDistinct({ userId: analyticsEvents.userId })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, cutoffTime));
  
  return result
    .map((r: { userId: string | null }) => r.userId)
    .filter((id: string | null): id is string => id !== null);
}

/**
 * Get user IDs that need feature recomputation (haven't been updated recently).
 * 
 * @param hoursAgo - Minimum age of last profile update
 * @returns Array of user IDs
 */
export async function getUsersNeedingFeatureUpdate(hoursAgo: number): Promise<string[]> {
  const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  
  // Get users who were active recently but haven't been updated recently
  const activeUserIds = await getActiveUserIds(48); // Active in last 48h
  
  // For now, return all active users
  // In production, you'd also check userProfiles.updatedAt
  return activeUserIds;
}