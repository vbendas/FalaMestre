'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';
import { GameState } from '@/lib/types';
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
import { ChatView } from '@/components/game/ChatView';
import { SquadView } from '@/components/game/SquadView';
import { MatchView } from '@/components/game/MatchView';

export default function Home() {
  const router = useRouter();
  const {
    gameState,
    userId,
    view,
    setView,
    showMatchResult,
    lastMatchResult,
    showMatchModal,
    closeMatchModal,
    isNewUser,
    hasCheckedUser,
    requiresSignIn,
    updateGameState,
    refreshGameState,
  } = useGameState();

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // The chat reply carries the save the server read; adopting it keeps the
  // other screens from showing a copy older than the conversation.
  const handleServerGameState = useCallback((state: GameState) => {
    updateGameState(() => state);
  }, [updateGameState]);

  useEffect(() => {
    // Sign-in comes before anything else: with auth on, a signed-out player
    // cannot load or create a save, so sending them to onboarding would only
    // waste the time they spend designing a team.
    if (requiresSignIn) {
      router.push('/login');
      return;
    }
    if (hasCheckedUser && isNewUser) {
      router.push('/onboarding');
    }
  }, [requiresSignIn, hasCheckedUser, isNewUser, router]);

  // The squad screen reads the reply (a refused session used to look like
  // it worked) and reloads the save after it; this only sends the request.
  const handleTrainPlayer = (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') =>
    fetch('/api/squad/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, playerId, focus }),
    });

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

          {view === 'chat' && gameState && userId && (
            <ChatView
              gameState={gameState}
              userId={userId}
              onViewChange={setView}
              onGameState={handleServerGameState}
            />
          )}

          {view === 'squad' && gameState && (
            <SquadView
              gameState={gameState}
              onViewChange={setView}
              onTrainPlayer={handleTrainPlayer}
              userId={userId}
              onRefreshSave={refreshGameState}
            />
          )}

          {view === 'match' && gameState && (
            <MatchView
              gameState={gameState}
              onShowMatchResult={showMatchResult}
              onRefreshSave={refreshGameState}
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
            <StadiumView gameState={gameState} onViewChange={setView} onRefreshSave={refreshGameState} />
          )}

          {view === 'facilities' && gameState && (
            <FacilitiesView gameState={gameState} onViewChange={setView} onRefreshSave={refreshGameState} />
          )}

          {view === 'youth' && gameState && userId && (
            <YouthAcademyView
              gameState={gameState}
              userId={userId}
              onViewChange={setView}
              onRefreshSave={refreshGameState}
            />
          )}

          {view === 'apostas' && gameState && userId && (
            <ApostasView
              gameState={gameState}
              userId={userId}
              onViewChange={(v) => setView(v as any)}
              onRefreshSave={refreshGameState}
            />
          )}

          {view === 'investir' && gameState && userId && (
            <InvestirView
              gameState={gameState}
              userId={userId}
              onViewChange={(v) => setView(v as any)}
              onRefreshSave={refreshGameState}
            />
          )}

          {view === 'staff' && gameState && userId && (
            <StaffView
              gameState={gameState}
              userId={userId}
              onViewChange={setView}
              onRefreshSave={refreshGameState}
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
          fixture={lastMatchResult?.fixture ?? null}
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
