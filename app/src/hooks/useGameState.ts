'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, GameState, Match } from '@/lib/types';
import { generateUserId, generateMessageId } from '@/lib/utils';

export type ViewType = 'chat' | 'squad' | 'match';

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: string;
  events: string[];
}

interface MatchAPIResult {
  result: {
    homeScore: number;
    awayScore: number;
    winner: string;
    events: string[];
  };
  pointsEarned: number;
  pointsChange: number;
  narration: string;
  nextMatch: Match;
  updatedGameState: GameState;
}

interface UseGameStateReturn {
  gameState: GameState | null;
  messages: Message[];
  input: string;
  isLoading: boolean;
  userId: string | null;
  isNewUser: boolean;
  view: ViewType;
  setView: (view: ViewType) => void;
  setInput: (input: string) => void;
  sendMessage: (messageText?: string) => Promise<void>;
  playMatch: () => Promise<void>;
  playMatchAndGetResult: () => Promise<MatchAPIResult | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  lastMatchResult: { result: MatchResult; pointsEarned: number; pointsChange: number } | null;
  showMatchModal: boolean;
  closeMatchModal: () => void;
}

export function useGameState(): UseGameStateReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(true);
  const [view, setView] = useState<ViewType>('chat');
  const [lastMatchResult, setLastMatchResult] = useState<{ result: MatchResult; pointsEarned: number; pointsChange: number } | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const closeMatchModal = useCallback(() => {
    setShowMatchModal(false);
  }, []);

  // Initialize user ID
  useEffect(() => {
    let id = localStorage.getItem('falaMestreUserId');
    if (!id) {
      id = generateUserId();
      localStorage.setItem('falaMestreUserId', id);
    }
    setUserId(id);
  }, []);

  // Load existing game state
  useEffect(() => {
    if (userId) {
      loadGameState();
    }
  }, [userId]);

  const loadGameState = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversation?userId=${userId}`);
      const data = await response.json();
      if (data.exists) {
        setGameState(data.gameState);
        setMessages(data.conversationHistory || []);
        setIsNewUser(false); // User has game state, not new
      } else {
        // First time user - show onboarding
        setIsNewUser(true);
      }
    } catch (error) {
      console.error('Failed to load game state:', error);
      setIsNewUser(true); // On error, treat as new user
    }
  }, [userId]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const message = messageText || input.trim();
    if (!message || !userId) return;

    setInput('');
    setIsLoading(true);

    // Add user message
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message }),
      });

      const data = await response.json();

      // Add AI response
      const aiMessage: Message = {
        id: generateMessageId(),
        role: 'ai',
        content: data.response,
        timestamp: new Date(),
        actions: data.actions,
      };
      setMessages(prev => [...prev, aiMessage]);
      setGameState(data.gameState);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: generateMessageId(),
        role: 'ai',
        content: '❌ Desculpe, ocorreu um erro. Tente novamente.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, userId]);

  // Core function to play match and return result data
  const playMatchAndGetResult = useCallback(async (): Promise<MatchAPIResult | null> => {
    if (!userId) return null;
    setIsLoading(true);

    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as MatchAPIResult;
    } catch (error) {
      console.error('Failed to play match:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Wrapper that handles UI updates after match
  const playMatch = useCallback(async () => {
    const data = await playMatchAndGetResult();
    if (!data) return;

    // Store match result for modal
    setLastMatchResult({
      result: data.result,
      pointsEarned: data.pointsEarned,
      pointsChange: data.pointsChange
    });
    setShowMatchModal(true);

    // Add match result as AI message
    const matchMessage: Message = {
      id: generateMessageId(),
      role: 'ai',
      content: `⚽ ${data.narration}\n\n📊 Resultado: ${data.result.homeScore}x${data.result.awayScore}\n🏆 ${data.result.winner}\n➕ +${data.pointsChange} Socios Points`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, matchMessage]);
    setGameState(data.updatedGameState);
    setView('chat');
  }, [playMatchAndGetResult]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

   return {
    gameState,
    messages,
    input,
    isLoading,
    userId,
    isNewUser,
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
  };
}
