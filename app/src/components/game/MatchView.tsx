'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GameState, Match, MatchEvent, MatchScript, Player } from '@/lib/types';
import { NARRATION_SPEED_CONFIG } from '@/lib/constants';
import { motion } from 'framer-motion';
import { getTeamData } from '@/lib/team-data';
import Image from 'next/image';
import { Home, Plane, Trophy, Swords, Glasses, TrendingUp, Users, Zap, Target } from 'lucide-react';
import { MatchSimulation } from './MatchSimulation';
import { HighlightOverlay } from './HighlightOverlay';
import { ThreeMatchView, VRTutorialModal, VRModeIndicator } from '@/components/vr';
import { Formation } from '@/components/vr/formations';

interface MatchViewProps {
  gameState: GameState;
  isLoading: boolean;
  onPlayMatch: () => void;
  onPlayMatchWithResult?: () => Promise<{
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
  } | null>;
  onVRModeChange?: (isActive: boolean) => void;
}

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: string;
  events: MatchEvent[];
}

// Comparison Bar Component
function ComparisonBar({ 
  label, 
  homeValue, 
  awayValue, 
  homeColor, 
  awayColor,
  showPercentage = false,
  homeLabel,
  awayLabel
}: { 
  label: string; 
  homeValue: number; 
  awayValue: number;
  homeColor: string;
  awayColor: string;
  showPercentage?: boolean;
  homeLabel?: string;
  awayLabel?: string;
}) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-white/60">
        <span className="flex items-center gap-1">
          {homeLabel && <span className="text-white/40">{homeLabel}</span>}
          <span>{homeValue}</span>
        </span>
        <span className="font-medium text-white/80">{label}</span>
        <span className="flex items-center gap-1">
          <span>{awayValue}</span>
          {awayLabel && <span className="text-white/40">{awayLabel}</span>}
        </span>
      </div>
      <div className="h-3 bg-[#004d00] rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${homePercent}%` }}
          transition={{ duration: 1, delay: 0.5 }}
          className="h-full relative"
          style={{ backgroundColor: homeColor }}
        >
          {showPercentage && homePercent > 20 && (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/80">
              {Math.round(homePercent)}%
            </span>
          )}
        </motion.div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${100 - homePercent}%` }}
          transition={{ duration: 1, delay: 0.5 }}
          className="h-full relative"
          style={{ backgroundColor: awayColor }}
        >
          {showPercentage && (100 - homePercent) > 20 && (
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/80">
              {Math.round(100 - homePercent)}%
            </span>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// Pre-match Preview Component
function MatchPreview({ homeTeam, awayTeam, homeColor, awayColor }: {
  homeTeam: string;
  awayTeam: string;
  homeColor: string;
  awayColor: string;
}) {
  const narratives = [
    `${homeTeam} entra confiante para este confronto contra ${awayTeam}. A torcida estáansiosa!`,
    `O técnico prepara a equipe para um grande espetáculo. Será que vem vitória por aí?`,
    `Ambos os times querem a vitória. Prepare-se para um grande jogo!`,
  ];
  const narrative = narratives[Math.floor(Math.random() * narratives.length)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
    >
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-4 h-4 text-[#FEDD00]" />
        <span className="text-xs font-bold text-[#FEDD00] uppercase tracking-wider">Prévia da Partida</span>
      </div>
      <p className="text-white/80 text-sm leading-relaxed">
        {narrative}
      </p>
    </motion.div>
  );
}

// Key Players Component  
function KeyPlayers({ players, teamName, color }: { players: Player[]; teamName: string; color: string }) {
  if (players.length === 0) return null;
  
  return (
    <div className="bg-[#006400] rounded-lg p-3 border-2 border-[#FEDD00]/50">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-white/60" />
        <span className="text-xs text-white/60">Destaques - {teamName}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {players.slice(0, 3).map((player) => {
          const overall = Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
          return (
            <div key={player.id} className="flex-shrink-0 flex items-center gap-2 bg-[#004d00] rounded-lg px-2 py-1.5">
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {overall}
              </div>
              <span className="text-xs text-white/80 truncate max-w-[80px]">{player.name.split(' ').pop()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Win Probability Component
function WinProbability({ homeRating, awayRating, homeColor, awayColor }: {
  homeRating: number;
  awayRating: number;
  homeColor: string;
  awayColor: string;
}) {
  const total = homeRating + awayRating;
  const homeProb = Math.round((homeRating / total) * 100);
  const drawProb = 100 - homeProb - Math.round(((awayRating - homeRating) / total) * 100);
  const clampedDraw = Math.max(5, Math.min(40, drawProb));
  const remaining = 100 - clampedDraw;
  const homeWin = Math.round(remaining * 0.6);
  const awayWin = 100 - clampedDraw - homeWin;

  return (
    <div className="bg-[#006400] rounded-lg p-3 border-2 border-[#FEDD00]/50">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-[#FEDD00]" />
        <span className="text-xs text-white/60">Probabilidades</span>
      </div>
      <div className="flex gap-1">
        <div 
          className="flex-1 text-center py-2 rounded-lg"
          style={{ backgroundColor: `${homeColor}40` }}
        >
          <div className="text-lg font-bold" style={{ color: homeColor }}>{homeWin}%</div>
          <div className="text-[10px] text-white/50">Vitória</div>
        </div>
        <div className="flex-1 text-center py-2 bg-[#004d00] rounded-lg">
          <div className="text-lg font-bold text-white/70">{clampedDraw}%</div>
          <div className="text-[10px] text-white/50">Empate</div>
        </div>
        <div 
          className="flex-1 text-center py-2 rounded-lg"
          style={{ backgroundColor: `${awayColor}40` }}
        >
          <div className="text-lg font-bold" style={{ color: awayColor }}>{awayWin}%</div>
          <div className="text-[10px] text-white/50">Derrota</div>
        </div>
      </div>
    </div>
  );
}

export function MatchView({ gameState, isLoading, onPlayMatch, onPlayMatchWithResult, onVRModeChange }: MatchViewProps) {
  const { user, season, squad } = gameState;
  const { nextMatch } = season;

  // Show helpful message if no nextMatch yet (new user or after season end)
  if (!nextMatch || !nextMatch.opponent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Trophy className="w-16 h-16 text-[#FEDD00]" />
        </motion.div>
        <div className="text-xl font-bold text-white">Preparando próxima partida...</div>
        <p className="text-white/60 text-center max-w-md">
          Sua equipe está se preparando para o próximo jogo. 
          Volte para o Chat e converse com o técnico para agendar uma partida!
        </p>
      </div>
    );
  }
  
  // Use refs to track interval and timeout for proper cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const intervalStartedRef = useRef(false);
  const isHighlightModeRef = useRef(false);
  
  const homeTeamData = getTeamData(user.team);
  const awayTeamData = getTeamData(nextMatch.opponent);
  
  // Calculate squad rating
  const avgRating = squad.players.length > 0 
    ? Math.round(squad.players.reduce((sum, p) => sum + (p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6, 0) / squad.players.length)
    : 70;
  
  // Opponent rating (simulated) - stable value based on opponent name
  const opponentRating = useMemo(() => {
    // Generate consistent pseudo-random rating based on opponent name
    let hash = 0;
    for (let i = 0; i < nextMatch.opponent.length; i++) {
      hash = ((hash << 5) - hash) + nextMatch.opponent.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return 68 + (Math.abs(hash) % 15); // Rating between 68-82
  }, [nextMatch.opponent]);

  // Match simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [matchMinute, setMatchMinute] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [matchScript, setMatchScript] = useState<MatchScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVRMode, setIsVRMode] = useState(false);
  const [showVRTutorial, setShowVRTutorial] = useState(false);
  
  // Highlight mode state for special moments
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [highlightEvent, setHighlightEvent] = useState<MatchEvent | null>(null);
  
  // Retry button state for loading timeout
  const [showRetry, setShowRetry] = useState(false);
  
  // Show retry button after 15 seconds of calculating
  useEffect(() => {
    if (isCalculating) {
      const timer = setTimeout(() => setShowRetry(true), 15000);
      return () => clearTimeout(timer);
    } else {
      setShowRetry(false);
    }
  }, [isCalculating]);
  
  // Refs for highlight mode
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pausedMinuteRef = useRef<number>(0);
  const simulationEventsRef = useRef<MatchEvent[]>([]);

  // Cleanup function for intervals and timeouts
  const cleanupTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  }, []);

  // Function to trigger highlight mode and pause simulation
  const triggerHighlight = useCallback((event: MatchEvent) => {
    if (isHighlightMode) return; // Already in highlight mode
    
    // Save current minute before pausing
    pausedMinuteRef.current = matchMinute;
    
    // Pause the simulation by clearing the interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    intervalStartedRef.current = false;
    
    // Set highlight state
    setHighlightEvent(event);
    setIsHighlightMode(true);
    
    // Auto-exit after 8 seconds
    highlightTimeoutRef.current = setTimeout(() => {
      exitHighlight();
    }, 8000);
  }, [isHighlightMode, matchMinute]);

  // Function to exit highlight mode and resume simulation
  const exitHighlight = useCallback(() => {
    // Clear timeout if exists
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    
    // Clear highlight state
    isHighlightModeRef.current = false;
    setIsHighlightMode(false);
    setHighlightEvent(null);
    
    // Resume simulation from paused minute
    if (isMountedRef.current && simulationEventsRef.current.length > 0) {
      const pausedMinute = pausedMinuteRef.current;
      const narrationSpeed = gameState.user.matchSettings?.narrationSpeed || 'normal';
      const msPerMinute = NARRATION_SPEED_CONFIG[narrationSpeed].msPerMinute;
      
      intervalStartedRef.current = true;
      intervalRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          cleanupTimers();
          return;
        }
        
        setMatchMinute(prev => {
          const newMinute = prev + 1;
          
          // Get ALL events up to current minute to calculate live score correctly
          const eventsSoFar = simulationEventsRef.current.filter(e => e.minute <= newMinute);
          const liveHomeScore = eventsSoFar.filter(e => e.type === 'goal' && e.team === 'home').length;
          const liveAwayScore = eventsSoFar.filter(e => e.type === 'goal' && e.team === 'away').length;
          
          // Update scores based on all events so far
          setHomeScore(liveHomeScore);
          setAwayScore(liveAwayScore);
          
          // Get the latest event to show as current event
          const eventAtMinute = simulationEventsRef.current.find(e => e.minute === newMinute);
          
          if (eventAtMinute) {
            setCurrentEvent(eventAtMinute.commentary || eventAtMinute.description);
            
            // Trigger highlight for highlight events (but not if already in highlight mode)
            if (eventAtMinute.highlight && !isHighlightModeRef.current) {
              // Use setTimeout to avoid calling setState during render
              setTimeout(() => {
                if (isMountedRef.current && !isHighlightModeRef.current) {
                  isHighlightModeRef.current = true;
                  setHighlightEvent(eventAtMinute);
                  setIsHighlightMode(true);
                  pausedMinuteRef.current = newMinute;
                  
                  // Clear interval to pause
                  if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                  }
                  intervalStartedRef.current = false;
                  
                  // Auto-exit after 8 seconds
                  highlightTimeoutRef.current = setTimeout(() => {
                    exitHighlight();
                  }, 8000);
                }
              }, 0);
            }
          }
          
          // End of match
          if (newMinute >= 90) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            intervalStartedRef.current = false;
            
            if (isMountedRef.current) {
              setCurrentEvent('Apita o árbitro! Fim de jogo!');
              
              timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  setIsSimulating(false);
                  onPlayMatch();
                }
                timeoutRef.current = null;
              }, 2000);
            }
          }
          
          return newMinute;
        });
      }, msPerMinute);
    }
  }, [gameState.user.matchSettings, isHighlightMode, triggerHighlight, cleanupTimers, onPlayMatch]);

  // Set up mount/unmount tracking and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      cleanupTimers();
    };
  }, [cleanupTimers]);

  // Cleanup on gameState change (navigation)
  useEffect(() => {
    if (isSimulating || isCalculating) return;
    cleanupTimers();
    intervalStartedRef.current = false;
    setIsSimulating(false);
    setIsCalculating(false);
    setMatchMinute(0);
    setHomeScore(0);
    setAwayScore(0);
    setCurrentEvent(null);
    setMatchResult(null);
    setMatchEvents([]);
    setError(null);
    setIsVRMode(false);
    onVRModeChange?.(false);
    setIsHighlightMode(false);
    setHighlightEvent(null);
  }, [gameState, cleanupTimers, isSimulating, isCalculating]);

  const handlePlayMatch = async () => {
    // Prevent multiple concurrent match starts
    if (isCalculating || isSimulating) {
      return;
    }
    
    setIsCalculating(true);
    setError(null);
    
    try {
      let result: MatchResult | null = null;
      
      // If we have the new API, call it first to get real result
      if (onPlayMatchWithResult) {
        const data = await onPlayMatchWithResult();
        if (!isMountedRef.current) return;
        
        if (data) {
          result = data.result;
          setMatchResult(result);
          
          if (data.matchScript) {
            setMatchScript(data.matchScript);
          }
          
          if (!result.events || result.events.length === 0) {
            setError('Nenhum evento recebido');
            setIsCalculating(false);
            onPlayMatch();
            return;
          }
          
          setMatchEvents(result.events);
        }
      }
      
      // If API failed or we don't have the new prop, fall back to old behavior
      if (!result) {
        intervalStartedRef.current = false;
        if (isMountedRef.current) {
          setIsCalculating(false);
          onPlayMatch();
        }
        return;
      }
      
      if (!isMountedRef.current) return;
      
      // Start simulation with real data
      setIsCalculating(false);
      setIsSimulating(true);
      setMatchMinute(0);
      setHomeScore(0);
      setAwayScore(0);
      setCurrentEvent(null);
      
      // Clear any existing interval
      cleanupTimers();
      
      // Prevent duplicate interval creation
      if (intervalStartedRef.current) {
        return;
      }
      intervalStartedRef.current = true;
      
      // Get match events for this simulation
      const simulationEvents = result.events;
      simulationEventsRef.current = simulationEvents;
      
      // Get narration speed from settings (default to normal if not set)
      const narrationSpeed = gameState.user.matchSettings?.narrationSpeed || 'normal';
      const msPerMinute = NARRATION_SPEED_CONFIG[narrationSpeed].msPerMinute;
      
      // Simulate match progression with configurable interval
      intervalRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          cleanupTimers();
          return;
        }
        
        // Skip if in highlight mode (use ref to avoid stale closure)
        if (isHighlightModeRef.current) {
          return;
        }
        
        setMatchMinute(prev => {
          const newMinute = prev + 1;
          
          // Get ALL events up to current minute to calculate live score correctly
          const eventsSoFar = simulationEvents.filter(e => e.minute <= newMinute);
          const liveHomeScore = eventsSoFar.filter(e => e.type === 'goal' && e.team === 'home').length;
          const liveAwayScore = eventsSoFar.filter(e => e.type === 'goal' && e.team === 'away').length;
          
          // Update scores based on all events so far
          setHomeScore(liveHomeScore);
          setAwayScore(liveAwayScore);
          
          // Get the latest event to show as current event
          const eventAtMinute = simulationEvents.find(e => e.minute === newMinute);
          
          if (eventAtMinute) {
            setCurrentEvent(eventAtMinute.commentary || eventAtMinute.description);
            
            // Trigger highlight for highlight events (use ref to avoid state issues during render)
            if (eventAtMinute.highlight && !isHighlightModeRef.current) {
              // Defer to next tick to avoid setState during render
              setTimeout(() => {
                if (isMountedRef.current && !isHighlightModeRef.current) {
                  isHighlightModeRef.current = true;
                  setHighlightEvent(eventAtMinute);
                  setIsHighlightMode(true);
                  pausedMinuteRef.current = newMinute;
                  
                  // Clear interval to pause
                  if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                  }
                  intervalStartedRef.current = false;
                  
                  // Auto-exit after 8 seconds
                  highlightTimeoutRef.current = setTimeout(() => {
                    exitHighlight();
                  }, 8000);
                }
              }, 0);
            }
          }
          
          // End of match
          if (newMinute >= 90) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            intervalStartedRef.current = false; // Reset for next match
            
            if (isMountedRef.current) {
              setCurrentEvent('Apita o árbitro! Fim de jogo!');
              
              // Use ref to track timeout for cleanup
              timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  setIsSimulating(false);
                  onPlayMatch();
                }
                timeoutRef.current = null;
              }, 2000);
            }
          }
          
          return newMinute;
        });
      }, msPerMinute);
    } catch (err) {
      intervalStartedRef.current = false;
      if (isMountedRef.current) {
        setError('Erro ao carregar partida');
        setIsCalculating(false);
        onPlayMatch();
      }
    }
  };

  // Show loading state while calculating result
  if (isCalculating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Swords className="w-16 h-16 text-[#FEDD00]" />
        </motion.div>
        <div className="text-xl font-bold text-white">Calculando resultado...</div>
        <div className="text-white/60">O juiz está analisando o VAR</div>
        {showRetry && (
          <button
            onClick={() => {
              setIsCalculating(false);
              intervalStartedRef.current = false;
              handlePlayMatch();
            }}
            className="mt-4 px-4 py-2 bg-[#FEDD00] text-black font-bold rounded-lg"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  // Show match simulation when simulating
  if (isSimulating && matchResult) {
    // VR Mode - Full screen A-Frame scene
    if (isVRMode) {
      const homeTeamData = getTeamData(user.team);
      const awayTeamData = getTeamData(nextMatch.opponent);
      
      return (
        <ThreeMatchView
          homeTeam={{
            name: user.team,
            color: homeTeamData?.primaryColor || '#EF4444',
            formation: (gameState.squad.formation as Formation) || '4-3-3',
            players: squad.players.slice(0, 11).map((p, i) => ({
              id: p.id || `home-${i}`,
              name: p.name.split(' ').pop() || p.name,
              number: i + 1,
              position: p.position,
            })),
          }}
          awayTeam={{
            name: nextMatch.opponent,
            color: awayTeamData?.primaryColor || '#3B82F6',
            formation: '4-3-3',
            players: Array.from({ length: 11 }, (_, i) => ({
              id: `away-${i}`,
              name: `CPU ${i + 1}`,
              number: i + 1,
              position: i === 0 ? 'GK' : i <= 4 ? 'DEF' : i <= 7 ? 'MID' : 'FWD',
            })),
          }}
          currentMinute={matchMinute}
          homeScore={homeScore}
          awayScore={awayScore}
          events={matchEvents}
          currentEvent={currentEvent || undefined}
          matchScript={matchScript || undefined}
          onExitVR={() => { setIsVRMode(false); onVRModeChange?.(false); }}
        />
      );
    }
    
    // Standard mode - show both MatchSimulation and VR toggle button
    return (
      <div className="relative">
        <div className="absolute top-2 right-2 z-10">
          <Button
            onClick={() => {
              const seenVR = localStorage.getItem('vrTutorialSeen');
              if (seenVR === 'true') {
                setIsVRMode(true);
                onVRModeChange?.(true);
              } else {
                setShowVRTutorial(true);
              }
            }}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold"
            size="sm"
          >
            <Glasses className="w-4 h-4" />
            VR Mode
          </Button>
        </div>
        <MatchSimulation 
          gameState={gameState}
          homeScore={homeScore}
          awayScore={awayScore}
          minute={matchMinute}
          currentEvent={currentEvent}
          isPlaying={true}
          events={matchEvents}
        />
        
        {/* Highlight Overlay for special moments */}
        {isHighlightMode && highlightEvent && (
          <HighlightOverlay
            event={highlightEvent}
            homeTeam={user.team}
            awayTeam={nextMatch.opponent}
            homeColor={homeTeamData?.primaryColor || '#EF4444'}
            awayColor={awayTeamData?.primaryColor || '#3B82F6'}
            onSkip={exitHighlight}
          />
        )}
        
        {/* VR Tutorial Modal */}
        <VRTutorialModal
          isOpen={showVRTutorial}
          onClose={() => setShowVRTutorial(false)}
          onStartVR={() => {
            setShowVRTutorial(false);
            setIsVRMode(true);
            onVRModeChange?.(true);
          }}
          mode="entry"
        />
        
        {/* VR Mode Indicator */}
        <VRModeIndicator 
          isVRMode={isVRMode} 
          onClick={() => { setIsVRMode(false); onVRModeChange?.(false); }} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* VS Screen */}
      <Card className="pixel-card overflow-hidden bg-[#006400] border-2 border-[#FEDD00]/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            {/* Home Team */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                className="relative w-20 h-20 mx-auto mb-3"
              >
                {homeTeamData && (
                  <Image
                    src={homeTeamData.logo}
                    alt={user.team}
                    fill
                    className="object-contain"
                  />
                )}
              </motion.div>
              <div className="font-bold text-white text-lg">{user.team}</div>
              <div className="flex items-center justify-center gap-1 text-sm text-white/60 mt-1">
                <Home className="w-4 h-4" />
                <span>Em Casa</span>
              </div>
            </motion.div>
            
            {/* VS */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
              className="px-4"
            >
              <div className="text-4xl font-black text-[#FEDD00] pixel-text">VS</div>
            </motion.div>
            
            {/* Away Team */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.4 }}
                className="relative w-20 h-20 mx-auto mb-3"
              >
                {awayTeamData && (
                  <Image
                    src={awayTeamData.logo}
                    alt={nextMatch.opponent}
                    fill
                    className="object-contain"
                  />
                )}
              </motion.div>
              <div className="font-bold text-white text-lg">{nextMatch.opponent}</div>
              <div className="flex items-center justify-center gap-1 text-sm text-white/60 mt-1">
                <Plane className="w-4 h-4" />
                <span>Fora</span>
              </div>
            </motion.div>
          </div>
          
          {/* Match Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 pt-4 border-t border-[#004d00]"
          >
            <div className="flex items-center justify-center gap-4 text-sm"
            >
              <div className="flex items-center gap-1.5 text-white/60">
                <Trophy className="w-4 h-4" />
                <span>{nextMatch.competition}</span>
              </div>
              <span className="text-white/20">|</span>
              <div className="text-white/60">
                {homeTeamData?.stadium || 'Estádio'}
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>

      {/* Match Preview */}
      <MatchPreview 
        homeTeam={user.team}
        awayTeam={nextMatch.opponent}
        homeColor={homeTeamData?.primaryColor || '#EF4444'}
        awayColor={awayTeamData?.primaryColor || '#3B82F6'}
      />

      {/* Key Players */}
      <div className="grid grid-cols-2 gap-2">
        <KeyPlayers 
          players={squad.players.slice(0, 5)}
          teamName={user.team}
          color={homeTeamData?.primaryColor || '#EF4444'}
        />
        <div className="bg-[#006400] rounded-lg p-3 border-2 border-[#FEDD00]/50">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-white/60" />
            <span className="text-xs text-white/60">Destaques - {nextMatch.opponent}</span>
          </div>
          <div className="flex gap-2">
            {['Jogador A', 'Jogador B', 'Jogador C'].map((name, i) => (
              <div key={i} className="flex-shrink-0 flex items-center gap-2 bg-[#004d00] rounded-lg px-2 py-1.5">
                <div className="w-6 h-6 rounded-full bg-[#004d00] flex items-center justify-center text-[10px] font-bold text-white">
                  {70 + i * 3}
                </div>
                <span className="text-xs text-white/80 truncate max-w-[60px]">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Comparison & Win Probability */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
            className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
        >
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Swords className="w-4 h-4" />
            Comparação de Equipes
          </h3>
          
          <div className="space-y-4">
            <ComparisonBar
              label="Moral"
              homeValue={squad.morale}
              awayValue={70}
              homeColor={homeTeamData?.primaryColor || '#EF4444'}
              awayColor={awayTeamData?.primaryColor || '#3B82F6'}
              homeLabel={user.team.substring(0, 3)}
              awayLabel={nextMatch.opponent.substring(0, 3)}
            />
            
            <ComparisonBar
              label="Força do Elenco"
              homeValue={avgRating}
              awayValue={opponentRating}
              homeColor={homeTeamData?.primaryColor || '#EF4444'}
              awayColor={awayTeamData?.primaryColor || '#3B82F6'}
              homeLabel={user.team.substring(0, 3)}
              awayLabel={nextMatch.opponent.substring(0, 3)}
            />

            <ComparisonBar
              label="Energia"
              homeValue={gameState.squad.fitness}
              awayValue={75}
              homeColor={homeTeamData?.primaryColor || '#EF4444'}
              awayColor={awayTeamData?.primaryColor || '#3B82F6'}
              homeLabel={user.team.substring(0, 3)}
              awayLabel={nextMatch.opponent.substring(0, 3)}
            />
          </div>
        </motion.div>

        <WinProbability 
          homeRating={avgRating}
          awayRating={opponentRating}
          homeColor={homeTeamData?.primaryColor || '#EF4444'}
          awayColor={awayTeamData?.primaryColor || '#3B82F6'}
        />
      </div>

      {/* Play Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <motion.div
          animate={!isLoading && !isSimulating ? {
            scale: [1, 1.02, 1],
            boxShadow: [
              '0 0 0 0 rgba(0, 151, 57, 0)',
              '0 0 20px 5px rgba(254, 221, 0, 0.3)',
              '0 0 0 0 rgba(0, 151, 57, 0)'
            ]
          } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Button
            onClick={handlePlayMatch}
            disabled={isLoading || isSimulating || isCalculating}
            className="w-full py-4 text-xl font-bold bg-[#009739] hover:bg-[#00b344] border-4 border-[#FEDD00] text-white flex items-center justify-center gap-3"
          >
            {isLoading || isSimulating || isCalculating ? (
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Swords className="w-6 h-6" />
                </motion.div>
                <span>{isCalculating ? 'Calculando...' : 'Simulando partida...'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Swords className="w-6 h-6" />
                <span>JOGAR AGORA</span>
              </div>
            )}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
