'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';
import {
  Header,
  ViewTabs,
  DashboardView,
  SquadView,
  MatchView,
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
import { FloatingBottomNav } from '@/components/ui/FloatingBottomNav';
import { FloatingWidgets } from '@/components/ui/FloatingWidgets';
import { PredictionDetailModal } from '@/components/predictions/PredictionDetailModal';
import { FanClubInvestmentCard } from '@/components/investment/FanClubInvestmentCard';
import { ApostasView } from '@/components/game/ApostasView';
import { InvestirView } from '@/components/game/InvestirView';
import { formatMoney } from '@/lib/economy';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Wallet } from 'lucide-react';

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
    lastMatchResult,
    showMatchModal,
    closeMatchModal,
    isNewUser,
    hasCheckedUser,
    updateGameState,
  } = useGameState();

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isVRMode, setIsVRMode] = useState(false);
  const [showPredictionsModal, setShowPredictionsModal] = useState(false);
  const [showInvestmentsModal, setShowInvestmentsModal] = useState(false);

  const handleMoneyUpdate = useCallback((newBalance: number) => {
    updateGameState(prev => ({
      ...prev,
      user: { ...prev.user, money: newBalance },
    }));
  }, [updateGameState]);

  // Redirect to onboarding if new user (only after checking)
  useEffect(() => {
    if (hasCheckedUser && isNewUser) {
      router.push('/onboarding');
    }
  }, [hasCheckedUser, isNewUser, router]);

  const handleActionClick = (action: string) => {
    if (action === 'play_match') {
      playMatch();
    } else if (action === 'view_squad') {
      setView('squad');
    } else if (action === 'predictions') {
      setShowPredictionsModal(true);
    } else if (action === 'investments') {
      setShowInvestmentsModal(true);
    }
  };

  // Handle player training
  const handleTrainPlayer = async (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') => {
    if (!userId) return;

    try {
      const response = await fetch('/api/squad/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, playerId, focus }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[Training] API error:', error);
      }
    } catch (error) {
      console.error('[Training] Network error:', error);
    }
  };

  // Show loading screen while checking user status
  if (!userId || (hasCheckedUser && isNewUser)) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen text-white">
      {!isVRMode && <Header gameState={gameState} />}

      {/* Floating Widgets (Dicas & Recompensa) */}
      {!isVRMode && gameState && userId && (
        <FloatingWidgets 
          gameState={gameState} 
          userId={userId} 
          onMoneyUpdate={handleMoneyUpdate}
        />
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 pt-20 pb-24">
        {/* Dashboard View */}
        {view === 'dashboard' && gameState && (
          <DashboardView
            gameState={gameState}
            onViewChange={setView}
          />
        )}

        {/* Squad View */}
        {view === 'squad' && gameState && (
          <SquadView
            gameState={gameState}
            onViewChange={setView}
            onTrainPlayer={handleTrainPlayer}
            userId={userId}
          />
        )}

        {/* Match View */}
        {view === 'match' && gameState && (
          <MatchView
            gameState={gameState}
            isLoading={isLoading}
            onPlayMatch={playMatch}
            onPlayMatchWithResult={playMatchAndGetResult}
            onVRModeChange={setIsVRMode}
          />
        )}

        {/* Transfers View */}
        {view === 'transfers' && gameState && userId && (
          <TransferMarketView
            gameState={gameState}
            userId={userId}
          />
        )}

        {/* Standings View */}
        {view === 'standings' && gameState && (
          <StandingsView gameState={gameState} />
        )}

        {/* Stadium View */}
        {view === 'stadium' && gameState && (
          <StadiumView gameState={gameState} onViewChange={setView} />
        )}

        {/* Facilities View */}
        {view === 'facilities' && gameState && (
          <FacilitiesView gameState={gameState} onViewChange={setView} />
        )}

        {/* Youth Academy View */}
        {view === 'youth' && gameState && userId && (
          <YouthAcademyView
            gameState={gameState}
            userId={userId}
            onViewChange={setView}
          />
        )}

        {/* Apostas View */}
        {view === 'apostas' && gameState && userId && (
          <ApostasView
            gameState={gameState}
            userId={userId}
            onViewChange={(v) => setView(v as any)}
          />
        )}

        {/* Investir View */}
        {view === 'investir' && gameState && userId && (
          <InvestirView
            gameState={gameState}
            userId={userId}
            onViewChange={(v) => setView(v as any)}
            onMoneyUpdate={handleMoneyUpdate}
          />
        )}

        {/* Staff View */}
        {view === 'staff' && gameState && userId && (
          <StaffView
            gameState={gameState}
            userId={userId}
            onViewChange={setView}
          />
        )}

        {/* Show loading when gameState is missing */}
        {!gameState && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Trophy className="w-16 h-16 text-[#FEDD00]" />
            </motion.div>
            <div className="text-xl font-bold text-white">Carregando dados do jogo...</div>
            <p className="text-white/60 text-center max-w-md">
              Por favor, aguarde enquanto carregamos os dados do seu time.
            </p>
          </div>
        )}
      </div>

      {/* Floating Bottom Navigation */}
      {!isVRMode && gameState && (
        <FloatingBottomNav
          currentView={view}
          onViewChange={setView}
        />
      )}

      {/* Match Result Modal */}
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

      {/* Login Prompt Modal */}
      <LoginPromptModal
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        message="Para jogar partidas e interagir com o jogo, você precisa fazer login."
      />
    </div>
  );
}
