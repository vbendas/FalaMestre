'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Flame, Check } from 'lucide-react';

interface DailyRewardCardProps {
  money: number;
  onClaim?: (amount: number) => void;
}

const DAILY_REWARDS = [
  { day: 1, amount: 5000, label: 'Seg' },
  { day: 2, amount: 7500, label: 'Ter' },
  { day: 3, amount: 10000, label: 'Qua' },
  { day: 4, amount: 15000, label: 'Qui' },
  { day: 5, amount: 20000, label: 'Sex' },
  { day: 6, amount: 30000, label: 'Sáb' },
  { day: 7, amount: 50000, label: 'Dom' },
];

export function DailyRewardCard({ money, onClaim }: DailyRewardCardProps) {
  const [streak, setStreak] = useState(1);
  const [claimed, setClaimed] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    const lastClaim = localStorage.getItem('falaMestreLastClaim');
    const savedStreak = localStorage.getItem('falaMestreStreak');

    if (savedStreak) {
      setStreak(parseInt(savedStreak, 10) % 7 || 1);
    }

    if (lastClaim) {
      const lastDate = new Date(lastClaim);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 1) {
        setClaimed(true);
      } else if (diffDays > 1) {
        setStreak(1);
        localStorage.setItem('falaMestreStreak', '1');
      }
    }
  }, []);

  const handleClaim = async () => {
    if (claimed) return;
    
    const todayReward = DAILY_REWARDS[(streak - 1) % 7];
    
    setClaimed(true);
    setShowAnimation(true);
    localStorage.setItem('falaMestreLastClaim', new Date().toISOString());
    localStorage.setItem('falaMestreStreak', String(streak % 7 + 1));

    if (onClaim) {
      onClaim(todayReward.amount);
    }

    setTimeout(() => setShowAnimation(false), 2000);
  };

  const todayReward = DAILY_REWARDS[(streak - 1) % 7];

  return (
    <div className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50 relative overflow-hidden">
      <AnimatePresence>
        {showAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-2xl">+$$</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-[#FEDD00]" />
          <span className="text-sm font-medium text-white">Recompensa Diária</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs text-orange-400 font-medium">{streak} dias</span>
        </div>
      </div>

      {/* Reward grid */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {DAILY_REWARDS.map((reward, i) => {
          const dayIndex = (streak - 1) % 7;
          const isPast = i < dayIndex;
          const isToday = i === dayIndex;
          const isFuture = i > dayIndex;

          return (
            <div
              key={reward.day}
              className={`text-center p-1.5 rounded-lg border transition-all ${
                isToday && !claimed
                  ? 'border-[#FEDD00]/50 bg-[#004d00]'
                  : isPast || (isToday && claimed)
                  ? 'border-[#009739]/50 bg-[#004d00]'
                  : 'border-[#FEDD00]/30 bg-[#004d00]'
              }`}
            >
              <p className="text-[10px] text-white/40 mb-0.5">{reward.label}</p>
              <p className={`text-[10px] font-bold ${
                isToday ? 'text-[#FEDD00]' : isPast || (isToday && claimed) ? 'text-green-400' : 'text-white/30'
              }`}>
                {isPast || (isToday && claimed) ? (
                  <Check className="w-3 h-3 mx-auto text-green-400" />
                ) : (
                  `+$ {(reward.amount / 1000)}K`
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* Claim button */}
          {!claimed ? (
            <motion.button
              onClick={handleClaim}
              whileTap={{ scale: 0.95 }}
              className="w-full py-2 bg-[#FEDD00] hover:bg-[#ffea4d] rounded-lg text-black font-bold text-sm transition-colors"
            >
              Resgatar +$ {todayReward.amount.toLocaleString()}
            </motion.button>
          ) : (
            <div className="w-full py-2 bg-[#004d00] rounded-lg text-green-400 font-medium text-sm text-center">
          ✓ Resgatado hoje
        </div>
      )}
    </div>
  );
}