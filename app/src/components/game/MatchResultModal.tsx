'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameState, MatchEvent } from '@/lib/types';
import { getTeamData } from '@/lib/team-data';
import Image from 'next/image';
import { X, Trophy, Circle, AlertCircle, Sparkles, Share2, Star, ChevronDown, ChevronUp, Crown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: string;
  events: MatchEvent[];
}

interface MatchResultModalProps {
  isOpen: boolean;
  result: MatchResult | null;
  gameState: GameState;
  pointsEarned: number;
  pointsChange: number;
  onClose: () => void;
}

// Confetti component
function Confetti() {
  const pieces = useMemo(() => {
    return [...Array(30)].map((_, i) => ({
      id: i,
      initialX: Math.random() * 400 - 200,
      rotateEnd: Math.random() * 720 - 360,
      duration: 2.5 + Math.random() * 2,
      delay: Math.random() * 0.5,
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF69B4'][i % 6],
      size: 4 + Math.random() * 4,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{
            x: piece.initialX,
            y: -50,
            rotate: 0,
            opacity: 1
          }}
          animate={{
            y: 500,
            rotate: piece.rotateEnd,
            opacity: [1, 1, 0]
          }}
          transition={{
            duration: piece.duration,
            ease: "easeOut",
            delay: piece.delay
          }}
          className="absolute left-1/2 top-0 rounded-full"
          style={{
            backgroundColor: piece.color,
            width: piece.size,
            height: piece.size,
          }}
        />
      ))}
    </div>
  );
}

// Man of the Match Component
function ManOfTheMatch({ playerName, playerRating, teamColor }: {
  playerName: string;
  playerRating: number;
  teamColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6 }}
      className="flex items-center gap-3 bg-gradient-to-r from-[#FFD700]/20 to-transparent rounded-lg p-3 border border-[#FFD700]/30"
    >
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: teamColor }}
      >
        <Crown className="w-6 h-6 text-white" />
      </motion.div>
      <div className="flex-1">
        <p className="text-[#FFD700] text-xs font-bold uppercase tracking-wider">🏆 Homem do Jogo</p>
        <p className="text-white font-semibold">{playerName}</p>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-[#FFD700]">{playerRating}</div>
        <div className="text-[10px] text-white/50">rating</div>
      </div>
    </motion.div>
  );
}

// Expandable Stats Section
function ExpandableStats({ events }: { events: MatchEvent[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const stats = useMemo(() => {
    const goals = events.filter(e => e.type === 'goal');
    const cards = events.filter(e => e.type === 'foul');
    const saves = events.filter(e => e.type === 'save');
    
    return {
      goals: goals.length,
      cards: cards.length,
      saves: saves.length,
      possession: { home: 55 + Math.random() * 10, away: 45 - Math.random() * 10 },
    };
  }, [events]);

  return (
    <div className="border-t border-white/10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <span className="text-sm text-white/70">Estatísticas da Partida</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-white/50" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/50" />
        )}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-lg font-bold text-white">{stats.goals}</div>
                  <div className="text-[10px] text-white/50">Gols</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-lg font-bold text-white">{stats.saves}</div>
                  <div className="text-[10px] text-white/50">Defesas</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-lg font-bold text-white">{stats.cards}</div>
                  <div className="text-[10px] text-white/50">Faltas</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Posse de Bola</span>
                  <span className="text-white/70">{Math.round(stats.possession.home)}% - {Math.round(stats.possession.away)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.possession.home}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="h-full bg-green-500"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.possession.away}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="h-full bg-blue-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Animated counter
function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      setCount(Math.floor(progress * value));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);
  
  return <span>{count}</span>;
}

export function MatchResultModal({ 
  isOpen, 
  result, 
  gameState, 
  pointsEarned, 
  pointsChange,
  onClose 
}: MatchResultModalProps) {
  if (!isOpen || !result) return null;
  
  const { user, season } = gameState;
  
  // API now handles home/away correctly, so result is already in correct context
  // result.homeScore = user's goals if playing at home, opponent's goals if playing away
  const homeTeam = user.team;
  const awayTeam = season.nextMatch.opponent;
  const homeScore = result.homeScore;
  const awayScore = result.awayScore;
  
  const homeTeamData = getTeamData(homeTeam);
  const awayTeamData = getTeamData(awayTeam);
  
  const isWin = result.winner === user.team;
  const isDraw = result.winner === 'Empate';

  const handleShare = async () => {
    const text = `⚽ ${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}\n${isWin ? '🎉 Vitória!' : isDraw ? '🤝 Empate' : '😢 Derrota'}\n#FalaMestre`;
    
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const motmName = gameState.squad.players[0]?.name || 'Jogador';
  const motmRating = Math.round(75 + Math.random() * 10);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          {isWin && <Confetti />}
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-gradient-to-b from-[#012169] to-[#001845] rounded border-4 border-[#FEDD00] overflow-hidden shadow-2xl pixel-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
            
            {/* Header */}
            <div className="text-center pt-8 pb-4">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm font-medium text-white/60 uppercase tracking-wider mb-2"
              >
                Fim de Jogo
              </motion.div>
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.3 }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                  isWin 
                    ? 'bg-green-500/20 text-green-400' 
                    : isDraw 
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                }`}
              >
                <Trophy className="w-4 h-4" />
                {isWin ? 'Vitória!' : isDraw ? 'Empate' : 'Derrota'}
              </motion.div>
            </div>
            
            {/* Scoreboard */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Home Team */}
                <div className="flex-1 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.35 }}
                    className="relative w-16 h-16 mx-auto mb-2"
                  >
                    {homeTeamData && (
                      <Image
                        src={homeTeamData.logo}
                        alt={homeTeam}
                        fill
                        className="object-contain"
                      />
                    )}
                  </motion.div>
                  <div className="text-sm font-medium text-white/80 truncate">{homeTeam}</div>
                </div>
                
                {/* Score */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.4 }}
                  className="px-4"
                >
                  <div className="flex items-center gap-3 text-5xl font-black">
                    <AnimatedCounter value={homeScore} />
                    <span className="text-white/30">x</span>
                    <AnimatedCounter value={awayScore} />
                  </div>
                </motion.div>
                
                {/* Away Team */}
                <div className="flex-1 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.45 }}
                    className="relative w-16 h-16 mx-auto mb-2"
                  >
                    {awayTeamData && (
                      <Image
                        src={awayTeamData.logo}
                        alt={awayTeam}
                        fill
                        className="object-contain"
                      />
                    )}
                  </motion.div>
                  <div className="text-sm font-medium text-white/80 truncate">{awayTeam}</div>
                </div>
              </div>
            </div>
            
            {/* Man of the Match */}
            {isWin && (
              <ManOfTheMatch 
                playerName={motmName}
                playerRating={motmRating}
                teamColor={homeTeamData?.primaryColor || '#009739'}
              />
            )}
            
            {/* Events Timeline */}
            <div className="px-6 py-4 border-t border-white/10">
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {result.events.slice(0, 5).map((event, idx) => (
                  <motion.div
                    key={`${event.id}-${idx}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                    className="flex items-center gap-3 text-sm"
                  >
                    <div className="w-8 text-right font-mono text-white/40">
                      {event.minute}'
                    </div>
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                      {event.type === 'goal' ? (
                        <Circle className="w-3 h-3 fill-white text-white" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-yellow-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 text-white/80 truncate">{event.commentary}</div>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Expandable Stats */}
            <ExpandableStats events={result.events} />
            
            {/* Points Earned */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="px-6 py-4 bg-[#FEDD00]/20 border-t-2 border-[#FEDD00]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="text-white/80">Socios Points</span>
                </div>
                <div className="text-2xl font-bold text-yellow-400">
                  +{pointsChange}
                </div>
              </div>
              
              <div className="mt-2 text-xs text-white/50">
                {pointsEarned === 3 ? 'Vitória: +3 pontos na tabela' : 
                 pointsEarned === 1 ? 'Empate: +1 ponto na tabela' : 
                 'Derrota: +0 pontos na tabela'}
              </div>
            </motion.div>
            
            {/* Action Buttons */}
            <div className="p-6 space-y-3">
              {/* Share Button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar Resultado
              </motion.button>
              
              {/* Continue Button */}
              <Button
                onClick={onClose}
                className="w-full h-12 rounded bg-[#009739] text-white hover:bg-[#00b342] font-bold pixel-text border-2 border-[#FEDD00] pixel-btn"
              >
                Continuar
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
