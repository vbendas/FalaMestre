'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, MatchEvent } from '@/lib/types';
import { usePlayerId } from './usePlayerId';

export type ViewType = 'dashboard' | 'chat' | 'squad' | 'match' | 'transfers' | 'standings' | 'stadium' | 'facilities' | 'youth' | 'staff' | 'apostas' | 'investir';

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: string;
  events: MatchEvent[];
}

/**
 * The fixture a result belongs to. The modal needs it because the save moves
 * on as soon as a match is banked: by the time the result is on screen,
 * `season.nextMatch` is next week's game, not the one just played.
 */
interface PlayedFixture {
  opponent: string;
  isHome: boolean;
}

interface UseGameStateReturn {
  gameState: GameState | null;
  userId: string | null;
  /** Auth is enforced and nobody is signed in: the caller sends them to /login. */
  requiresSignIn: boolean;
  isNewUser: boolean;
  hasCheckedUser: boolean;
  view: ViewType;
  setView: (view: ViewType) => void;
  /**
   * Shows the result of a match the server has banked. The match screen calls
   * this with what /api/match/finalize returned; nothing here plays a match.
   */
  showMatchResult: (
    result: MatchResult,
    pointsEarned: number,
    updatedState?: GameState,
    fixture?: PlayedFixture,
  ) => void;
  lastMatchResult: {
    result: MatchResult;
    pointsEarned: number;
    fixture: PlayedFixture | null;
  } | null;
  showMatchModal: boolean;
  closeMatchModal: () => void;
  updateGameState: (updater: (prev: GameState) => GameState) => void;
  /** Re-reads the save from the server; see the implementation for why. */
  refreshGameState: () => Promise<void>;
}

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

/**
 * Fills in the parts of a save that predate the features that use them, so an
 * old save loads into the current screens. Applied wherever a save arrives
 * from the server — the first load and every refresh.
 */
function withBackfills(state: GameState): GameState {
  const gs = state as any;

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

  return gs as GameState;
}

export function useGameState(): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const { userId, requiresSignIn } = usePlayerId();
  const [isNewUser, setIsNewUser] = useState(true);
  const [hasCheckedUser, setHasCheckedUser] = useState(false);
  const [view, setView] = useState<ViewType>('dashboard');
  const [lastMatchResult, setLastMatchResult] = useState<{
    result: MatchResult;
    pointsEarned: number;
    fixture: PlayedFixture | null;
  } | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  
  // Use refs to track mounted state and abort controllers
  const isMountedRef = useRef(true);
  const abortControllersRef = useRef<AbortController[]>([]);
  const isLoadingGameStateRef = useRef(false);

  const closeMatchModal = useCallback(() => {
    setShowMatchModal(false);
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

  // The id saves are keyed on comes from usePlayerId: the session user when
  // signed in, the local id otherwise. It stays null until the session settles,
  // which holds the load below until there is a real id to load.

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
          const gs = withBackfills(data.gameState);

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
          // One retry per onboarding, so the flag is spent as soon as it is read.
          localStorage.removeItem('falaMestreJustOnboarded');
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

  /**
   * Re-reads the save from the server.
   *
   * The match screen calls this whenever a finalize is refused: the client's
   * copy may be behind the save — the match may in fact have been banked, by
   * this tab or another — and without a re-read the screen keeps offering the
   * same fixture and every further attempt is refused for the same reason.
   */
  const refreshGameState = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetchWithTimeout(
        `/api/conversation?userId=${userId}`,
        {},
        10000
      );
      if (!response.ok) return;
      const data = await response.json();
      if (!isMountedRef.current || !data?.exists) return;
      setGameState(withBackfills(data.gameState));
    } catch (error) {
      // A refresh that fails leaves the screen as it was; the player can
      // reload. Nothing here is worth interrupting them for.
      console.error('[useGameState] Failed to refresh game state:', error);
    }
  }, [userId]);

  const showMatchResult = useCallback((
    result: MatchResult,
    pointsEarned: number,
    updatedState?: GameState,
    fixture?: PlayedFixture,
  ) => {
    setLastMatchResult({ result, pointsEarned, fixture: fixture ?? null });
    setShowMatchModal(true);
    if (updatedState) setGameState(updatedState);
  }, []);

  return {
    gameState,
    userId,
    requiresSignIn,
    isNewUser,
    hasCheckedUser,
    view,
    setView,
    showMatchResult,
    lastMatchResult,
    showMatchModal,
    closeMatchModal,
    updateGameState: (updater) => setGameState(prev => prev ? updater(prev) : prev),
    refreshGameState,
  };
}
