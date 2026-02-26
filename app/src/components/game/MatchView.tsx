'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GameState, Match, MatchEvent } from '@/lib/types';
import { NARRATION_SPEED_CONFIG } from '@/lib/constants';
import { motion } from 'framer-motion';
import { getTeamData } from '@/lib/team-data';
import Image from 'next/image';
import { Home, Plane, Trophy, Swords, Glasses } from 'lucide-react';
import { MatchSimulation } from './MatchSimulation';
import { VRMatchView } from '@/components/vr';
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
    pointsEarned: number;
    pointsChange: number;
    narration: string;
    nextMatch: Match;
    updatedGameState: GameState;
  } | null>;
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
  awayColor 
}: { 
  label: string; 
  homeValue: number; 
  awayValue: number;
  homeColor: string;
  awayColor: string;
}) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/60">
        <span>{homeValue}</span>
        <span className="font-medium">{label}</span>
        <span>{awayValue}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${homePercent}%` }}
          transition={{ duration: 1, delay: 0.5 }}
          className="h-full"
          style={{ backgroundColor: homeColor }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${100 - homePercent}%` }}
          transition={{ duration: 1, delay: 0.5 }}
          className="h-full"
          style={{ backgroundColor: awayColor }}
        />
      </div>
    </div>
  );
}

export function MatchView({ gameState, isLoading, onPlayMatch, onPlayMatchWithResult }: MatchViewProps) {
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
  const [error, setError] = useState<string | null>(null);
  const [isVRMode, setIsVRMode] = useState(false);

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
  }, []);

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
    // Reset state when gameState changes (user navigated to different view)
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
  }, [gameState, cleanupTimers]);

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
      
      // Get narration speed from settings (default to normal if not set)
      const narrationSpeed = gameState.user.matchSettings?.narrationSpeed || 'normal';
      const msPerMinute = NARRATION_SPEED_CONFIG[narrationSpeed].msPerMinute;
      
      // Simulate match progression with configurable interval
      intervalRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          cleanupTimers();
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
      }, msPerMinute * 4);
    } catch (err) {
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
        <VRMatchView
          homeTeam={{
            name: user.team,
            color: homeTeamData?.primaryColor || '#EF4444',
            formation: (gameState.squad.formation as Formation) || '4-3-3',
            players: squad.players.slice(0, 11).map((p, i) => ({
              id: p.id,
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
              id: `cpu-${i}`,
              name: `CPU ${i + 1}`,
              number: i + 1,
              position: i < 4 ? 'DEF' : i < 8 ? 'MID' : 'FWD',
            })),
          }}
          currentMinute={matchMinute}
          homeScore={homeScore}
          awayScore={awayScore}
          events={matchEvents}
          currentEvent={currentEvent || undefined}
          onExitVR={() => setIsVRMode(false)}
        />
      );
    }
    
    // Standard mode - show both MatchSimulation and VR toggle button
    return (
      <div className="relative">
        <div className="absolute top-2 right-2 z-10">
          <Button
            onClick={() => setIsVRMode(true)}
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* VS Screen */}
      <Card className="pixel-card overflow-hidden">
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
            className="mt-6 pt-4 border-t border-white/10"
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

      {/* Team Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#012169]/60 rounded p-4 border-2 border-[#FEDD00]/50 pixel-border-thin"
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
          />
          
          <ComparisonBar
            label="Força do Elenco"
            homeValue={avgRating}
            awayValue={opponentRating}
            homeColor={homeTeamData?.primaryColor || '#EF4444'}
            awayColor={awayTeamData?.primaryColor || '#3B82F6'}
          />
        </div>
      </motion.div>

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
            className="w-full h-16 text-xl font-bold rounded bg-[#009739] hover:bg-[#00b342] border-4 border-[#FEDD00] text-white pixel-text pixel-btn"
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
