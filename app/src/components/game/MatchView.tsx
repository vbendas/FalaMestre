'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GameState, Match } from '@/lib/types';
import { motion } from 'framer-motion';
import { getTeamData } from '@/lib/team-data';
import Image from 'next/image';
import { Home, Plane, Trophy, Swords } from 'lucide-react';
import { MatchSimulation } from './MatchSimulation';

interface MatchViewProps {
  gameState: GameState;
  isLoading: boolean;
  onPlayMatch: () => void;
  onPlayMatchWithResult?: () => Promise<{
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
  } | null>;
}

interface ParsedEvent {
  minute: number;
  type: 'goal_home' | 'goal_away' | 'card' | 'other';
  description: string;
}

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: string;
  events: string[];
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

// Parse match events from strings to structured data
function parseMatchEvents(events: string[], userTeam: string, opponent: string): ParsedEvent[] {
  return events.map(event => {
    // Extract minute from format like "⚽ 23' - Player Name"
    const minuteMatch = event.match(/(\d+)'/);
    const minute = minuteMatch ? parseInt(minuteMatch[1]) : 0;
    
    // Determine event type
    let type: ParsedEvent['type'] = 'other';
    if (event.includes('⚽')) {
      // Check which team scored
      if (event.includes(userTeam)) {
        type = 'goal_home';
      } else if (event.includes(opponent)) {
        type = 'goal_away';
      }
    } else if (event.includes('🟨') || event.includes('🟥')) {
      type = 'card';
    }
    
    return {
      minute,
      type,
      description: event,
    };
  }).sort((a, b) => a.minute - b.minute);
}

export function MatchView({ gameState, isLoading, onPlayMatch, onPlayMatchWithResult }: MatchViewProps) {
  const { user, season, squad } = gameState;
  const { nextMatch } = season;
  
  // Use refs to track interval and timeout for proper cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  
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
  const [matchEvents, setMatchEvents] = useState<ParsedEvent[]>([]);

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
    setIsSimulating(false);
    setIsCalculating(false);
    setMatchMinute(0);
    setHomeScore(0);
    setAwayScore(0);
    setCurrentEvent(null);
    setMatchResult(null);
    setMatchEvents([]);
  }, [gameState, cleanupTimers]);

  const handlePlayMatch = async () => {
    // Prevent multiple concurrent match starts
    if (isCalculating || isSimulating) {
      return;
    }
    
    setIsCalculating(true);
    
    try {
      let result: MatchResult | null = null;
      let parsedEvents: ParsedEvent[] = [];
      
      // If we have the new API, call it first to get real result
      if (onPlayMatchWithResult) {
        const data = await onPlayMatchWithResult();
        if (!isMountedRef.current) return; // Component unmounted during API call
        
        if (data) {
          result = data.result;
          setMatchResult(result);
          // Parse events for animation
          parsedEvents = parseMatchEvents(result.events, user.team, nextMatch.opponent);
          setMatchEvents(parsedEvents);
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
      
      if (!isMountedRef.current) return; // Component unmounted
      
      // Start simulation with real data
      setIsCalculating(false);
      setIsSimulating(true);
      setMatchMinute(0);
      setHomeScore(0);
      setAwayScore(0);
      setCurrentEvent(null);
      
      let currentHomeScore = 0;
      let currentAwayScore = 0;
      
      // Clear any existing interval
      cleanupTimers();
      
      // Simulate match progression with slower interval (200ms instead of 100ms)
      intervalRef.current = setInterval(() => {
        if (!isMountedRef.current) {
          cleanupTimers();
          return;
        }
        
        setMatchMinute(prev => {
          const newMinute = prev + 1;
          
          // Check for events at this minute
          const eventAtMinute = parsedEvents.find(e => e.minute === newMinute);
          
          if (eventAtMinute) {
            setCurrentEvent(eventAtMinute.description);
            
            // Update scores for goals
            if (eventAtMinute.type === 'goal_home') {
              currentHomeScore++;
              setHomeScore(currentHomeScore);
            } else if (eventAtMinute.type === 'goal_away') {
              currentAwayScore++;
              setAwayScore(currentAwayScore);
            }
          }
          
          // End of match
          if (newMinute >= 90) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            
            if (isMountedRef.current) {
              setCurrentEvent('Apita o árbitro! Fim de jogo!');
              
              // Use ref to track timeout for cleanup
              timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  setIsSimulating(false);
                  onPlayMatch(); // This will show the result modal
                }
                timeoutRef.current = null;
              }, 2000);
            }
          }
          
          return newMinute;
        });
      }, 200); // Slower simulation: 1 minute per 200ms (was 100ms)
    } catch (error) {
      console.error('Failed to play match:', error);
      if (isMountedRef.current) {
        setIsCalculating(false);
        // Fall back to old behavior
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
    return (
      <MatchSimulation 
        gameState={gameState}
        homeScore={homeScore}
        awayScore={awayScore}
        minute={matchMinute}
        currentEvent={currentEvent}
        isPlaying={true}
        events={matchEvents}
      />
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
