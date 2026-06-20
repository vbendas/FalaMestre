'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';
import {
  LoadingScreen,
  MatchResultModal,
} from '@/components/game';
import { TransferMarketView } from '@/components/game/TransferMarketView';
import { StandingsView } from '@/components/game/StandingsView';
import { StadiumView } from '@/components/game/StadiumView';
import { FacilitiesView } from '@/components/game/FacilitiesView';
import { YouthAcademyView } from '@/components/game/YouthAcademyView';
import { StaffView } from '@/components/game/StaffView';
import { LoginPromptModal } from '@/components/game/LoginPromptModal';
import { ApostasView } from '@/components/game/ApostasView';
import { InvestirView } from '@/components/game/InvestirView';
import { CrtCabinet } from '@/components/crt/CrtCabinet';
import { SidebarNav } from '@/components/crt/SidebarNav';
import { DashboardView } from '@/components/game/DashboardView';
import { SquadView } from '@/components/game/SquadView';
import { MatchView } from '@/components/game/MatchView';

export default function Home() {
  const router = useRouter();
  const {
    gameState,
    isLoading,
    userId,
    view,
    setView,
    playMatch,
    playMatchAndGetResult,
    showMatchResult,
    lastMatchResult,
    showMatchModal,
    closeMatchModal,
    isNewUser,
    hasCheckedUser,
    updateGameState,
  } = useGameState();

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const handleMoneyUpdate = useCallback((newBalance: number) => {
    updateGameState(prev => ({
      ...prev,
      user: { ...prev.user, money: newBalance },
    }));
  }, [updateGameState]);

  useEffect(() => {
    if (hasCheckedUser && isNewUser) {
      router.push('/onboarding');
    }
  }, [hasCheckedUser, isNewUser, router]);

  const handleTrainPlayer = async (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') => {
    if (!userId) return;

    try {
      await fetch('/api/squad/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, playerId, focus }),
      });
    } catch (error) {
      console.error('[Training] Network error:', error);
    }
  };

  if (!userId || (hasCheckedUser && isNewUser)) {
    return (
      <CrtCabinet>
        <div className="w-full h-full flex items-center justify-center">
          <LoadingScreen />
        </div>
      </CrtCabinet>
    );
  }

  return (
    <CrtCabinet>
      <div className="flex w-full h-full">
        <SidebarNav
          view={view}
          onViewChange={setView}
          gameState={gameState}
        />

        <main className="flex-1 overflow-hidden">
          {view === 'dashboard' && gameState && (
            <DashboardView
              gameState={gameState}
              onViewChange={setView}
            />
          )}

          {view === 'squad' && gameState && (
            <SquadView
              gameState={gameState}
              onViewChange={setView}
              onTrainPlayer={handleTrainPlayer}
              userId={userId}
            />
          )}

          {view === 'match' && gameState && (
            <MatchView
              gameState={gameState}
              isLoading={isLoading}
              onPlayMatch={playMatch}
              onPlayMatchWithResult={playMatchAndGetResult}
              onShowMatchResult={showMatchResult}
            />
          )}

          {view === 'transfers' && gameState && userId && (
            <TransferMarketView
              gameState={gameState}
              userId={userId}
            />
          )}

          {view === 'standings' && gameState && (
            <StandingsView gameState={gameState} />
          )}

          {view === 'stadium' && gameState && (
            <StadiumView gameState={gameState} onViewChange={setView} />
          )}

          {view === 'facilities' && gameState && (
            <FacilitiesView gameState={gameState} onViewChange={setView} />
          )}

          {view === 'youth' && gameState && userId && (
            <YouthAcademyView
              gameState={gameState}
              userId={userId}
              onViewChange={setView}
            />
          )}

          {view === 'apostas' && gameState && userId && (
            <ApostasView
              gameState={gameState}
              userId={userId}
              onViewChange={(v) => setView(v as any)}
            />
          )}

          {view === 'investir' && gameState && userId && (
            <InvestirView
              gameState={gameState}
              userId={userId}
              onViewChange={(v) => setView(v as any)}
              onMoneyUpdate={handleMoneyUpdate}
            />
          )}

          {view === 'staff' && gameState && userId && (
            <StaffView
              gameState={gameState}
              userId={userId}
              onViewChange={setView}
            />
          )}

          {!gameState && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-[0.6rem] text-[rgba(255,223,0,0.5)] font-[family-name:var(--font-pixel)]">
                Carregando...
              </div>
            </div>
          )}
        </main>
      </div>

      {gameState && (
        <MatchResultModal
          isOpen={showMatchModal}
          result={lastMatchResult?.result || null}
          gameState={gameState}
          pointsEarned={lastMatchResult?.pointsEarned || 0}
          pointsChange={lastMatchResult?.pointsChange || 0}
          onClose={closeMatchModal}
        />
      )}

      <LoginPromptModal
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        message="Para jogar partidas e interagir com o jogo, você precisa fazer login."
      />
    </CrtCabinet>
  );
}
