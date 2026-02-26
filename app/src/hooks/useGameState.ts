'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, GameState, Match, MatchEvent } from '@/lib/types';
import { generateUserId, generateMessageId } from '@/lib/utils';

export type ViewType = 'chat' | 'squad' | 'match';

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: string;
  events: MatchEvent[];
}

interface MatchAPIResult {
  result: {
    homeScore: number;
    awayScore: number;
    winner: string;
    events: MatchEvent[];
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
  hasCheckedUser: boolean;
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

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 30000;

/**
 * Wrapper for fetch with timeout and abort controller
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export function useGameState(): UseGameStateReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(true);
  const [hasCheckedUser, setHasCheckedUser] = useState(false);
  const [view, setView] = useState<ViewType>('chat');
  const [lastMatchResult, setLastMatchResult] = useState<{ result: MatchResult; pointsEarned: number; pointsChange: number } | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [cachedMatchResult, setCachedMatchResult] = useState<MatchAPIResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Use refs to track mounted state and abort controllers
  const isMountedRef = useRef(true);
  const abortControllersRef = useRef<AbortController[]>([]);
  const isLoadingGameStateRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const closeMatchModal = useCallback(() => {
    console.log('[DEBUG closeMatchModal] Closing modal...');
    setShowMatchModal(false);
    // Clear cached match result after modal is closed
    setCachedMatchResult(null);
  }, []);

  // Cleanup function for all resources
  const cleanup = useCallback(() => {
    // Abort all pending requests
    abortControllersRef.current.forEach(controller => {
      try {
        controller.abort();
      } catch (e) {
        // Ignore abort errors
      }
    });
    abortControllersRef.current = [];
    
    // Clear any pending timeouts
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  // Handle component unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Initialize user ID
  useEffect(() => {
    const justOnboarded = localStorage.getItem('falaMestreJustOnboarded') === 'true';
    console.log('[useGameState] justOnboarded:', justOnboarded);
    
    let id = localStorage.getItem('falaMestreUserId');
    if (!id) {
      id = generateUserId();
      localStorage.setItem('falaMestreUserId', id);
      console.log('[useGameState] Generated new userId:', id);
    } else {
      console.log('[useGameState] Found existing userId:', id);
    }
    setUserId(id);
    
    // Clear the justOnboarded flag after reading
    if (justOnboarded) {
      localStorage.removeItem('falaMestreJustOnboarded');
    }
  }, []);

  // Load existing game state with proper cleanup and concurrency handling
  useEffect(() => {
    if (!userId || isLoadingGameStateRef.current) return;
    
    let controller: AbortController;
    let mounted = true;
    
    const loadGameState = async () => {
      isLoadingGameStateRef.current = true;
      
      // Create abort controller for this request
      controller = new AbortController();
      abortControllersRef.current.push(controller);
      
      try {
        const response = await fetchWithTimeout(
          `/api/conversation?userId=${userId}`,
          { signal: controller.signal },
          10000 // 10 second timeout
        );
        
        if (!mounted) return;
        
        const data = await response.json();
        
        if (!mounted) return;
        
        if (data.exists) {
          setGameState(data.gameState);
          setMessages(data.conversationHistory || []);
          setIsNewUser(false);
          
          // Auto-migrate training fields if needed (run in background)
          fetch('/api/squad/migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          }).catch(() => {
            // Silently fail - migration will happen on next action
          });
        } else {
          // If this is a fresh onboarded user and gameState doesn't exist yet,
          // wait and retry (database might not have committed yet)
          const justOnboarded = localStorage.getItem('falaMestreJustOnboarded') === 'true';
          if (justOnboarded) {
            console.log('[useGameState] GameState not found, retrying for onboarded user...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
            if (mounted && isLoadingGameStateRef.current === false) {
              // Retry once
              const retryResponse = await fetch(`/api/conversation?userId=${userId}`);
              if (mounted) {
                const retryData = await retryResponse.json();
                if (retryData.exists) {
                  setGameState(retryData.gameState);
                  setMessages(retryData.conversationHistory || []);
                  setIsNewUser(false);
                } else {
                  setIsNewUser(true);
                }
              }
            }
          } else {
            setIsNewUser(true);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[useGameState] Game state fetch aborted');
          return;
        }
        console.error('[useGameState] Failed to load game state:', error);
        if (mounted) {
          setIsNewUser(true);
        }
      } finally {
        isLoadingGameStateRef.current = false;
        // Remove this controller from the list
        if (controller) {
          const index = abortControllersRef.current.indexOf(controller);
          if (index > -1) {
            abortControllersRef.current.splice(index, 1);
          }
        }
        if (mounted) {
          setHasCheckedUser(true);
        }
      }
    };

    mounted = true;
    loadGameState();
    
    return () => {
      mounted = false;
    };
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

    // Create abort controller for this request
    const controller = new AbortController();
    abortControllersRef.current.push(controller);

    try {
      const response = await fetchWithTimeout(
        '/api/conversation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, message }),
          signal: controller.signal,
        },
        REQUEST_TIMEOUT
      );

      if (!isMountedRef.current) return;

      const data = await response.json();
      
      if (!isMountedRef.current) return;

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
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[useGameState] Send message aborted');
        return;
      }
      console.error('[useGameState] Failed to send message:', error);
      if (isMountedRef.current) {
        const errorMessage: Message = {
          id: generateMessageId(),
          role: 'ai',
          content: '❌ Desculpe, ocorreu um erro. Tente novamente.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      // Remove this controller from the list
      const index = abortControllersRef.current.indexOf(controller);
      if (index > -1) {
        abortControllersRef.current.splice(index, 1);
      }
    }
  }, [input, userId]);

  // Core function to play match and return result data
  const playMatchAndGetResult = useCallback(async (): Promise<MatchAPIResult | null> => {
    if (!userId) return null;
    setIsLoading(true);

    // Clear any existing cache at start of new match
    console.log('[DEBUG playMatchAndGetResult] Clearing old cache, fetching new result');
    setCachedMatchResult(null);

    // Create abort controller for this request
    const controller = new AbortController();
    abortControllersRef.current.push(controller);

    try {
      const response = await fetchWithTimeout(
        '/api/match',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
          signal: controller.signal,
        },
        REQUEST_TIMEOUT
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!isMountedRef.current) return null;

      const data = await response.json();
      
      console.log('[DEBUG playMatchAndGetResult] API returned:', data);
      console.log('[DEBUG playMatchAndGetResult] result.homeScore:', data?.result?.homeScore, 'result.awayScore:', data?.result?.awayScore);
      
      // Cache the result so playMatch can reuse it instead of making a new API call
      setCachedMatchResult(data as MatchAPIResult);
      
      return data as MatchAPIResult;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[useGameState] Play match aborted');
        return null;
      }
      console.error('[useGameState] Failed to play match:', error);
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      // Remove this controller from the list
      const index = abortControllersRef.current.indexOf(controller);
      if (index > -1) {
        abortControllersRef.current.splice(index, 1);
      }
    }
  }, [userId]);

  // Wrapper that handles UI updates after match
  const playMatch = useCallback(async () => {
    // Use cached result from simulation instead of making a new API call
    let data = cachedMatchResult;
    
    console.log('[DEBUG playMatch] cachedMatchResult exists:', !!data);
    
    // If no cached result (called directly without simulation), fetch new result
    if (!data) {
      console.log('[DEBUG playMatch] No cache, calling API...');
      data = await playMatchAndGetResult();
    }
    
    console.log('[DEBUG playMatch] Final data used:', data);
    console.log('[DEBUG playMatch] result.homeScore:', data?.result?.homeScore, 'result.awayScore:', data?.result?.awayScore);
    
    if (!data || !isMountedRef.current) return;

    // Store match result for modal
    console.log('[DEBUG playMatch] Setting lastMatchResult:', data.result);
    console.log('[DEBUG playMatch] Setting showMatchModal to true');
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
    console.log('[DEBUG playMatch] Adding message with result:', data.result.homeScore, 'x', data.result.awayScore, 'winner:', data.result.winner);
    setMessages(prev => [...prev, matchMessage]);
    setGameState(data.updatedGameState);
    setView('chat');
  }, [playMatchAndGetResult, cachedMatchResult]);

  // Auto-scroll to bottom when messages change (with debouncing)
  useEffect(() => {
    // Clear any existing scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce scroll to prevent excessive updates
    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollRef.current && isMountedRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      scrollTimeoutRef.current = null;
    }, 50); // 50ms debounce

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [messages]);

   return {
    gameState,
    messages,
    input,
    isLoading,
    userId,
    isNewUser,
    hasCheckedUser,
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
