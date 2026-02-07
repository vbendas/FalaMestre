'use client';

import { useEffect } from 'react';
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
import { getTeamData } from '@/lib/team-data';

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
  } = useGameState();

  // Redirect to onboarding if new user
  useEffect(() => {
    if (userId && isNewUser) {
      router.push('/onboarding');
    }
  }, [userId, isNewUser, router]);

  const handleActionClick = (action: string) => {
    if (action === 'play_match') {
      playMatch();
    } else {
      sendMessage(action);
    }
  };

  if (!userId || isNewUser) {
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
          <SquadView gameState={gameState} onViewChange={setView} />
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
    </div>
  );
}
