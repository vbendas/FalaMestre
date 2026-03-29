'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Gift, X } from 'lucide-react';
import { GameState } from '@/lib/types';
import { AiInsightsCard } from '@/components/dashboard/AiInsightsCard';
import { DailyRewardCard } from '@/components/dashboard/DailyRewardCard';

interface FloatingWidgetsProps {
  gameState: GameState;
  userId: string;
  onMoneyUpdate: (newBalance: number) => void;
}

export function FloatingWidgets({ 
  gameState, 
  userId, 
  onMoneyUpdate,
}: FloatingWidgetsProps) {
  const [activeWidget, setActiveWidget] = useState<'dicas' | 'recompensa' | null>(null);

  const userIdentifier = userId || gameState?.user?.id;

  const handleDailyRewardClaim = useCallback(async (amount: number) => {
    try {
      const response = await fetch('/api/daily-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userIdentifier,
          lastClaimDate: localStorage.getItem('falaMestreLastClaim'),
          currentStreak: parseInt(localStorage.getItem('falaMestreStreak') || '1'),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          onMoneyUpdate(data.newBalance);
        }
      }
    } catch (error) {
      console.error('[DailyReward] Claim failed:', error);
    }
  }, [userIdentifier, onMoneyUpdate]);

  return (
    <div className="max-w-4xl mx-auto px-4 pt-24">
      <div className="flex gap-2">
        {/* Dicas */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveWidget(activeWidget === 'dicas' ? null : 'dicas')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-medium transition-all ${
            activeWidget === 'dicas'
              ? 'bg-[#009739] text-white'
              : 'bg-[#006400] text-white/80 border border-[#FEDD00]/30 hover:border-[#FEDD00]/60'
          }`}
        >
          <Sparkles className="w-3 h-3 text-[#FEDD00]" />
          <span>Dicas</span>
          {activeWidget === 'dicas' && <X className="w-3 h-3 ml-1" />}
        </motion.button>

        {/* Recompensa Diária */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveWidget(activeWidget === 'recompensa' ? null : 'recompensa')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-medium transition-all ${
            activeWidget === 'recompensa'
              ? 'bg-[#009739] text-white'
              : 'bg-[#006400] text-white/80 border border-[#FEDD00]/30 hover:border-[#FEDD00]/60'
          }`}
        >
          <Gift className="w-3 h-3 text-[#FEDD00]" />
          <span>Recompensa</span>
          {activeWidget === 'recompensa' && <X className="w-3 h-3 ml-1" />}
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {activeWidget === 'dicas' && (
          <motion.div
            key="dicas"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-2 mb-4"
          >
            <AiInsightsCard gameState={gameState} />
          </motion.div>
        )}

        {activeWidget === 'recompensa' && (
          <motion.div
            key="recompensa"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-2 mb-4"
          >
            <DailyRewardCard money={gameState.user.money || 0} onClaim={handleDailyRewardClaim} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}