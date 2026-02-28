'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameState, MatchEvent } from '@/lib/types';
import { getTeamData } from '@/lib/team-data';
import Image from 'next/image';
import { X, Trophy, Circle, AlertCircle, Sparkles } from 'lucide-react';
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
    return [...Array(20)].map((_, i) => ({
      id: i,
      initialX: Math.random() * 400 - 200,
      rotateEnd: Math.random() * 720 - 360,
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 0.5,
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][i % 5],
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{
            x: piece.initialX,
            y: -20,
            rotate: 0,
            opacity: 1
          }}
          animate={{
            y: 400,
            rotate: piece.rotateEnd,
            opacity: 0
          }}
          transition={{
            duration: piece.duration,
            ease: "easeOut",
            delay: piece.delay
          }}
          className="absolute left-1/2 top-0 w-3 h-3 rounded-full"
          style={{
            backgroundColor: piece.color
          }}
        />
      ))}
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
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    {homeTeamData && (
                      <Image
                        src={homeTeamData.logo}
                        alt={homeTeam}
                        fill
                        className="object-contain"
                      />
                    )}
                  </div>
                  <div className="text-sm font-medium text-white/80 truncate">{homeTeam}</div>
                </div>
                
                {/* Score */}
                <div className="px-4">
                  <div className="flex items-center gap-3 text-5xl font-black">
                    <AnimatedCounter value={homeScore} />
                    <span className="text-white/30">x</span>
                    <AnimatedCounter value={awayScore} />
                  </div>
                </div>
                
                {/* Away Team */}
                <div className="flex-1 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    {awayTeamData && (
                      <Image
                        src={awayTeamData.logo}
                        alt={awayTeam}
                        fill
                        className="object-contain"
                      />
                    )}
                  </div>
                  <div className="text-sm font-medium text-white/80 truncate">{awayTeam}</div>
                </div>
              </div>
            </div>
            
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
            
            {/* Continue Button */}
            <div className="p-6">
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
