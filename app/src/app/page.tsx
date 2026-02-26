'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';
import {
  Header,
  ViewTabs,
  ChatView,
  SquadView,
  MatchView,
  LoadingScreen,
  Footer,
  MatchResultModal,
} from '@/components/game';
import { LoginPromptModal } from '@/components/game/LoginPromptModal';
import { getTeamData } from '@/lib/team-data';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const {
    gameState,
    messages,
    input,
    isLoading,
    userId,
    view,
    setView,
    setInput,
    sendMessage,
    playMatch,
    playMatchAndGetResult,
    scrollRef,
    lastMatchResult,
    showMatchModal,
    closeMatchModal,
    isNewUser,
    hasCheckedUser,
  } = useGameState();

  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

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
      sendMessage(action);
    } else {
      sendMessage(action);
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

      if (response.ok) {
        const result = await response.json();
        // Show success message in chat
        sendMessage(result.message || '✅ Treino concluído com sucesso!');
      } else {
        // Handle error case - show error to user
        const error = await response.json();
        console.error('[Training] API error:', error);
        const errorMessage = error.details || error.error || 'Erro no treino';
        sendMessage(`❌ ${errorMessage}`);
      }
    } catch (error) {
      console.error('[Training] Network error:', error);
      sendMessage('❌ Erro de conexão. Tente novamente.');
    }
  };

  // Show loading screen while checking user status
  if (!userId || (hasCheckedUser && isNewUser)) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#012169] via-[#009739] to-[#006400] text-white pixel-bg-grid">
      <Header gameState={gameState} />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4">
        <ViewTabs view={view} onViewChange={setView} hasPendingMatch={!!gameState?.season.nextMatch} />

        {/* Chat View */}
        {view === 'chat' && (
          <ChatView
            messages={messages}
            input={input}
            isLoading={isLoading}
            onSend={sendMessage}
            onInputChange={setInput}
            onActionClick={handleActionClick}
            scrollRef={scrollRef}
            teamName={gameState?.user.team}
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
          />
        )}
        {/* Show loading when gameState is missing */}
        {view === 'match' && !gameState && (
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

      {/* Footer */}
      <Footer teamColor={gameState ? getTeamData(gameState.user.team)?.primaryColor : undefined} />

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
