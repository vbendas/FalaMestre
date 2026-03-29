'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Match, MatchEvent, MatchScript } from '@/lib/types';
import { generateUserId } from '@/lib/utils';

export type ViewType = 'dashboard' | 'squad' | 'match' | 'transfers' | 'standings' | 'stadium' | 'facilities' | 'youth' | 'staff' | 'apostas' | 'investir';

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
  matchScript?: MatchScript;
  pointsEarned: number;
  pointsChange: number;
  narration: string;
  nextMatch: Match;
  updatedGameState: GameState;
}

interface UseGameStateReturn {
  gameState: GameState | null;
  userId: string | null;
  isNewUser: boolean;
  hasCheckedUser: boolean;
  view: ViewType;
  setView: (view: ViewType) => void;
  playMatch: () => Promise<void>;
  playMatchAndGetResult: () => Promise<MatchAPIResult | null>;
  lastMatchResult: { result: MatchResult; pointsEarned: number; pointsChange: number } | null;
  showMatchModal: boolean;
  closeMatchModal: () => void;
  isLoading: boolean;
  updateGameState: (updater: (prev: GameState) => GameState) => void;
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
  const [isLoading, setIsLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(true);
  const [hasCheckedUser, setHasCheckedUser] = useState(false);
  const [view, setView] = useState<ViewType>('dashboard');
  const [lastMatchResult, setLastMatchResult] = useState<{ result: MatchResult; pointsEarned: number; pointsChange: number } | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [cachedMatchResult, setCachedMatchResult] = useState<MatchAPIResult | null>(null);
  
  // Use refs to track mounted state and abort controllers
  const isMountedRef = useRef(true);
  const abortControllersRef = useRef<AbortController[]>([]);
  const isLoadingGameStateRef = useRef(false);

  const closeMatchModal = useCallback(() => {
    console.log('[DEBUG closeMatchModal] Closing modal...');
    setShowMatchModal(false);
    // Clear cached match result after modal is closed
    setCachedMatchResult(null);
    setLastMatchResult(null);
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
          // Migrate old gameState structure to new one
          const gs = data.gameState as any;
          
          // Migrate sociosPoints to money
          if (gs.user?.sociosPoints !== undefined && gs.user?.money === undefined) {
            gs.user.money = gs.user.sociosPoints || 100000;
            delete gs.user.sociosPoints;
          }
          
          // Ensure money exists
          if (gs.user?.money === undefined) {
            gs.user.money = 100000;
          }
          
          // Ensure new structures exist
          if (!gs.stadium) {
            gs.stadium = { level: 0, capacity: 0, amenities: 0, ticketPrice: 0, maintenanceLevel: 1 };
          }
          if (!gs.facilities) {
            gs.facilities = { trainingCenter: 0, medicalCenter: 0, youthAcademy: 0, scoutOffice: 0 };
          }
          if (!gs.staff) {
            gs.staff = { headCoach: null, scout: null, medicalStaff: null };
          }
          if (!gs.teamStats) {
            gs.teamStats = { totalEarnings: 0, totalSpent: 0, matchesPlayed: 0, championshipsWon: 0, promotionCount: 0 };
          }
          if (!gs.youthAcademy) {
            gs.youthAcademy = { nextIntakeWeek: 4, playersAvailable: [], trainingFocus: null, lastIntakeWeek: 0 };
          }
          if (!gs.season?.division) {
            gs.season.division = 'Serie D';
          }
          
          setGameState(gs);
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
            if (mounted && !isLoadingGameStateRef.current) {
              // Retry once
              const retryResponse = await fetch(`/api/conversation?userId=${userId}`);
              if (mounted) {
                const retryData = await retryResponse.json();
                if (retryData.exists) {
                  setGameState(retryData.gameState);
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
    // Always fetch a new result when user explicitly clicks "Jogar"
    // This ensures fresh match data instead of showing cached stats
    let data = await playMatchAndGetResult();
    
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

    setGameState(data.updatedGameState);
  }, [playMatchAndGetResult, cachedMatchResult]);

   return {
    gameState,
    userId,
    isNewUser,
    hasCheckedUser,
    view,
    setView,
    playMatch,
    playMatchAndGetResult,
    lastMatchResult,
    showMatchModal,
    closeMatchModal,
    isLoading,
    updateGameState: (updater) => setGameState(prev => prev ? updater(prev) : prev),
  };
}
