'use client';

import { GameState } from '@/lib/types';
import { getTeamData } from '@/lib/team-data';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface HeaderProps {
  gameState: GameState | null;
}

export function Header({ gameState }: HeaderProps) {
  const teamData = gameState ? getTeamData(gameState.user.team) : null;
  const hasPendingMatch = gameState?.season.nextMatch !== undefined;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Main header */}
      <div 
        className="bg-[#012169]/90 backdrop-blur-md border-b-4 border-[#FEDD00] p-4 pixel-border-thin"
        style={{
          borderBottomColor: teamData ? teamData.primaryColor : '#FEDD00'
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Team Badge */}
            {teamData && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="relative w-10 h-10"
              >
                <Image
                  src={teamData.logo}
                  alt={teamData.name}
                  fill
                  className="object-contain"
                />
              </motion.div>
            )}
            
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#FEDD00] pixel-text relative">
                  <span
                    className="absolute inset-0"
                    style={{ color: 'rgba(255, 50, 50, 0.5)', transform: 'translate(-1.5px, 0.5px)' }}
                    aria-hidden="true"
                  >
                    Fala Mestre!
                  </span>
                  <span
                    className="absolute inset-0"
                    style={{ color: 'rgba(50, 100, 255, 0.4)', transform: 'translate(1.5px, -0.5px)' }}
                    aria-hidden="true"
                  >
                    Fala Mestre!
                  </span>
                  <span className="relative" style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 0 20px rgba(254, 221, 0, 0.3)' }}>
                    Fala Mestre!
                  </span>
                </h1>
                {/* Notification dot for pending match */}
                {hasPendingMatch && (
                  <motion.div
                    className="w-3 h-3 bg-[#FF6B00] rounded-full animate-pulse"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.7, 1]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                )}
              </div>
              {gameState && (
                <div className="text-sm text-[#FEDD00]/90 mt-0.5 flex items-center gap-2 font-[family-name:var(--font-retro)]">
                  <span className="font-medium">{gameState.user.team}</span>
                  <span className="text-white/30">|</span>
                  <span>Semana {gameState.season.week}</span>
                  <span className="text-white/30">|</span>
                  <span>Posição {gameState.season.position}º</span>
                </div>
              )}
            </div>
          </div>
          
          {gameState && (
            <div className="text-right">
              <AnimatePresence mode="wait">
                <motion.div
                  key={gameState.user.money || 0}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-2xl font-bold text-[#FFD700] pixel-text"
                >
                  $ {(gameState.user.money || 0).toLocaleString()}
                </motion.div>
              </AnimatePresence>
              <div className="text-xs text-[#FEDD00]/70 font-[family-name:var(--font-pixel)] uppercase tracking-wider">
                Conta Corrente
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Green accent line (flag tricolor) */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#009739] to-transparent opacity-60" />
      {/* Team gradient accent line */}
      {teamData && (
        <motion.div
          className="h-0.5 w-full"
          style={{
            background: `linear-gradient(90deg, ${teamData.primaryColor}, ${teamData.secondaryColor}, ${teamData.primaryColor})`
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      )}
    </div>
  );
}
