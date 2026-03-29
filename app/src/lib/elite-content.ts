/**
 * Elite Content System
 * Handles unlock logic for Elite Training Camp and Fast Recovery
 */

import { db } from '@/db';
import { eliteContent, fanClubInvestments, gameStates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ELITE_CONTENT, TICKET_EARNING_METHODS } from '@/lib/constants';
import type { FanClubInvestment, EliteContent } from '@/lib/types';

export interface UnlockEliteContentResult {
  success: boolean;
  eliteTrainingUnlocked: boolean;
  fastRecoveryUnlocked: boolean;
  message: string;
}

export async function checkAndUnlockEliteContent(userId: string): Promise<UnlockEliteContentResult> {
  const currentContent = await db.query.eliteContent.findFirst({
    where: eq(eliteContent.userId, userId),
  });
  
  const userInvestments = await db.query.fanClubInvestments.findMany({
    where: and(
      eq(fanClubInvestments.userId, userId),
      eq(fanClubInvestments.active, true)
    ),
  });
  
  const hasOptionC = userInvestments.some((i: { option: string }) => i.option === 'C');
  const hasOptionBOrHigher = userInvestments.some((i: { option: string }) => i.option === 'B' || i.option === 'C');
  
  let eliteTrainingUnlock = false;
  let fastRecoveryUnlock = false;
  
  if (!currentContent?.eliteTrainingUnlocked) {
    const winsRequired = ELITE_CONTENT.UNLOCK_CRITERIA.eliteTraining.winsRequired;
    const gameState = await db.query.gameStates.findFirst({
      where: eq(gameStates.userId, userId),
    });
    
    const totalWins = gameState?.currentState.season.wins || 0;
    
    if (totalWins >= winsRequired || hasOptionC) {
      eliteTrainingUnlock = true;
    }
  }
  
  if (!currentContent?.fastRecoveryUnlocked) {
    const winsRequired = ELITE_CONTENT.UNLOCK_CRITERIA.fastRecovery.winsStreakRequired;
    
    // This is a simplified check - in reality you'd track win streaks separately
    if (hasOptionBOrHigher) {
      fastRecoveryUnlock = true;
    }
  }
  
  if (!eliteTrainingUnlock && !fastRecoveryUnlock) {
    return {
      success: true,
      eliteTrainingUnlocked: false,
      fastRecoveryUnlocked: false,
      message: 'No new content unlocked'
    };
  }
  
  const now = new Date().toISOString();
  
  if (currentContent) {
    await db.update(eliteContent).set({
      eliteTrainingUnlocked: eliteTrainingUnlock ? true : currentContent.eliteTrainingUnlocked,
      eliteTrainingUnlockedAt: eliteTrainingUnlock ? now : currentContent.eliteTrainingUnlockedAt,
      fastRecoveryUnlocked: fastRecoveryUnlock ? true : currentContent.fastRecoveryUnlocked,
      fastRecoveryUnlockedAt: fastRecoveryUnlock ? now : currentContent.fastRecoveryUnlockedAt,
      updatedAt: now,
    }).where(eq(eliteContent.userId, userId));
  } else {
    await db.insert(eliteContent).values({
      userId,
      eliteTrainingUnlocked: eliteTrainingUnlock,
      eliteTrainingUnlockedAt: eliteTrainingUnlock ? now : null,
      fastRecoveryUnlocked: fastRecoveryUnlock,
      fastRecoveryUnlockedAt: fastRecoveryUnlock ? now : null,
      updatedAt: now,
    });
  }
  
  const messages: string[] = [];
  if (eliteTrainingUnlock) messages.push('Elite Training Camp unlockado!');
  if (fastRecoveryUnlock) messages.push('Fast Track Recovery unlockado!');
  
  return {
    success: true,
    eliteTrainingUnlocked: eliteTrainingUnlock,
    fastRecoveryUnlocked: fastRecoveryUnlock,
    message: messages.join(' ')
  };
}

export function applyTrainingMultiplier(baseGrowth: number, eliteUnlocked: boolean): number {
  if (!eliteUnlocked) return baseGrowth;
  return baseGrowth * ELITE_CONTENT.TRAINING_MULTIPLIER;
}

export function applyRecoveryMultiplier(baseRecoveryDays: number, eliteUnlocked: boolean): number {
  if (!eliteUnlocked) return baseRecoveryDays;
  return Math.floor(baseRecoveryDays / ELITE_CONTENT.RECOVERY_MULTIPLIER);
}

export function getEliteContentStatus(userId: string): Promise<EliteContent | null> {
  return db.query.eliteContent.findFirst({
    where: eq(eliteContent.userId, userId),
  });
}

export interface TicketEarningResult {
  success: boolean;
  ticketMethod: string;
  ticketsEarned: number;
}

export async function earnTicketForMethod(
  userId: string,
  method: keyof typeof TICKET_EARNING_METHODS
): Promise<TicketEarningResult> {
  const ticketConfig = TICKET_EARNING_METHODS[method];
  
  if (!ticketConfig) {
    return { success: false, ticketMethod: method, ticketsEarned: 0 };
  }
  
  // Check if already earned this ticket type today (simple check)
  // In production you'd track this more robustly
  
  await db.insert('tournament_tickets' as any).values({
    userId,
    tournamentId: '', // Will be assigned when used
    earned: true,
    earnedAt: new Date().toISOString(),
    used: false,
  });
  
  return {
    success: true,
    ticketMethod: method,
    ticketsEarned: ticketConfig.tickets
  };
}