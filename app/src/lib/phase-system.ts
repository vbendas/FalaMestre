/**
 * Phase System
 * Tracks user progress through soft-training phases
 */

import { db } from '@/db';
import { phaseProgress, tournamentTickets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { PHASE_CONFIG } from '@/lib/constants';
import type { Phase, PhaseProgress, PhaseUnlock } from '@/lib/types';

export async function getPhaseProgress(userId: string): Promise<PhaseProgress | null> {
  return db.query.phaseProgress.findFirst({
    where: eq(phaseProgress.userId, userId),
  });
}

export async function initializePhaseProgress(userId: string): Promise<PhaseProgress> {
  const existing = await getPhaseProgress(userId);
  
  if (existing) {
    return existing;
  }
  
  const now = new Date().toISOString();
  
  await db.insert(phaseProgress).values({
    userId,
    currentPhase: 1,
    phase2Unlocked: false,
    phase3Unlocked: false,
    phase4Unlocked: false,
    totalMatches: 0,
    totalPredictions: 0,
    predictionsWon: 0,
    totalInvestmentMade: 0,
    hoursPlayed: 0,
    lastUpdated: now,
  });
  
  return {
    userId,
    currentPhase: 1,
    phase2Unlocked: false,
    phase3Unlocked: false,
    phase4Unlocked: false,
    totalMatches: 0,
    totalPredictions: 0,
    predictionsWon: 0,
    totalInvestmentMade: 0,
    hoursPlayed: 0,
    lastUpdated: now
  };
}

export async function updatePhaseProgress(
  userId: string,
  updates: Partial<PhaseProgress>
): Promise<void> {
  const now = new Date().toISOString();
  
  await db.update(phaseProgress).set({
    ...updates,
    lastUpdated: now,
  }).where(eq(phaseProgress.userId, userId));
}

export async function incrementMatches(userId: string): Promise<void> {
  const progress = await getPhaseProgress(userId);
  
  if (progress) {
    await updatePhaseProgress(userId, {
      totalMatches: progress.totalMatches + 1
    });
  }
}

export async function incrementPredictions(
  userId: string, 
  won: boolean
): Promise<void> {
  const progress = await getPhaseProgress(userId);
  
  if (progress) {
    await updatePhaseProgress(userId, {
      totalPredictions: progress.totalPredictions + 1,
      predictionsWon: won ? progress.predictionsWon + 1 : progress.predictionsWon
    });
  }
}

export async function checkPhaseUnlock(userId: string): Promise<PhaseUnlock | null> {
  const progress = await getPhaseProgress(userId);
  
  if (!progress) {
    await initializePhaseProgress(userId);
    return null;
  }
  
  // Phase 2: After 10 matches, unlock Prediction Market
  if (!progress.phase2Unlocked && progress.totalMatches >= PHASE_CONFIG.PHASE_2_UNLOCK.matchesRequired) {
    return {
      type: 'prediction_market_unlock',
      phase: 2,
      priority: 'high',
      message: 'Mercado de Previsões foi desbloqueado! Agora você pode palpitar nos结果dos jogos e ganhar dinheiro extra!'
    };
  }
  
  // Phase 3: After 5 predictions won OR 20 hours played, unlock Fan Club Investment
  if (!progress.phase3Unlocked && 
      (progress.predictionsWon >= PHASE_CONFIG.PHASE_3_UNLOCK.predictionsWonRequired || 
       progress.hoursPlayed >= PHASE_CONFIG.PHASE_3_UNLOCK.hoursPlayedRequired)) {
    return {
      type: 'fan_club_investment_unlock',
      phase: 3,
      priority: 'high',
      message: 'Investimento no Clube de Torcedores foi desbloqueado! Invista no seu clube e ganhe bônus!'
    };
  }
  
  // Phase 4: Tournament unlock (requires ticket)
  if (!progress.phase4Unlocked) {
    const tickets = await db.query.tournamentTickets.findMany({
      where: and(
        eq(tournamentTickets.userId, userId),
        eq(tournamentTickets.earned, true),
        eq(tournamentTickets.used, false)
      ),
    });
    
    if (tickets.length > 0) {
      return {
        type: 'tournament_unlock',
        phase: 4,
        priority: 'medium',
        message: 'Você tem acesso a Torneios Especiais! Participe e concorra a prêmios reais!'
      };
    }
  }
  
  return null;
}

export async function finalizePhaseUnlock(
  userId: string,
  phase: 2 | 3 | 4
): Promise<void> {
  const progress = await getPhaseProgress(userId);
  
  if (!progress) return;
  
  const now = new Date().toISOString();
  
  if (phase === 2) {
    await updatePhaseProgress(userId, {
      currentPhase: 2,
      phase2Unlocked: true,
      phase2UnlockedAt: now
    });
  } else if (phase === 3) {
    await updatePhaseProgress(userId, {
      currentPhase: 3,
      phase3Unlocked: true,
      phase3UnlockedAt: now
    });
  } else if (phase === 4) {
    await updatePhaseProgress(userId, {
      currentPhase: 4,
      phase4Unlocked: true,
      phase4UnlockedAt: now
    });
  }
}

export function getPhaseDescription(phase: Phase): string {
  switch (phase) {
    case 1:
      return 'Fase inicial - Jogando partidas e aprendendo o jogo';
    case 2:
      return 'Mercado de Previsões unlocked - Palpites nos jogos';
    case 3:
      return 'Investimento no Clube - Ganha bônus investindo';
    case 4:
      return 'Torneios Especiais - Prêmios reais';
    default:
      return '';
  }
}