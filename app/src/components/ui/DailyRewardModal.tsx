'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Star, X, CheckCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyReward {
  day: number;
  points: number;
  bonus?: string;
}

const DAILY_REWARDS: DailyReward[] = [
  { day: 1, points: 50 },
  { day: 2, points: 75 },
  { day: 3, points: 100 },
  { day: 4, points: 150 },
  { day: 5, points: 200 },
  { day: 6, points: 250 },
  { day: 7, points: 500, bonus: 'Especial!' },
];

interface DailyRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStreak: number;
  onClaim?: (day: number) => void;
}

export function DailyRewardModal({
  isOpen,
  onClose,
  currentStreak,
  onClaim,
}: DailyRewardModalProps) {
  const [claimedToday, setClaimedToday] = useState(false);
  const [selectedDay, setSelectedDay] = useState(currentStreak % 7 || 7);

  useEffect(() => {
    const todayClaimed = localStorage.getItem('dailyRewardClaimed');
    if (todayClaimed) {
      const claimDate = new Date(todayClaimed);
      const today = new Date();
      if (claimDate.toDateString() === today.toDateString()) {
        setClaimedToday(true);
      }
    }
  }, []);

  const handleClaim = (day: number) => {
    if (claimedToday) return;
    
    setClaimedToday(true);
    localStorage.setItem('dailyRewardClaimed', new Date().toISOString());
    onClaim?.(day);
    
    setTimeout(onClose, 2000);
  };

  const getDayStatus = (day: number) => {
    if (day < currentStreak % 7 || (currentStreak >= 7 && day <= currentStreak % 7)) {
      return 'completed';
    }
    if (day === (currentStreak % 7) + 1 || (currentStreak >= 7 && day === 1)) {
      return 'available';
    }
    return 'locked';
  };

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
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-gradient-to-b from-[#012169] to-[#001845] rounded-2xl border-4 border-[#FEDD00] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="relative p-6 text-center bg-gradient-to-r from-[#FFD700]/20 to-transparent">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>

              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Gift className="w-16 h-16 mx-auto text-[#FFD700]" />
              </motion.div>
              
              <h2 className="mt-4 text-2xl font-bold text-white pixel-text">Recompensa Diária!</h2>
              <p className="text-white/60 text-sm mt-1">
                Conecte-se todos os dias para ganhar pontos!
              </p>
            </div>

            {/* Calendar Grid */}
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/60">Sequência: {currentStreak} dias</span>
                </div>
                {claimedToday && (
                  <span className="text-xs text-green-400 font-medium">✓ Coletado hoje</span>
                )}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {DAILY_REWARDS.map((reward) => {
                  const status = getDayStatus(reward.day);
                  const isToday = status === 'available';
                  
                  return (
                    <motion.button
                      key={reward.day}
                      whileHover={status !== 'locked' ? { scale: 1.1 } : {}}
                      whileTap={status !== 'locked' ? { scale: 0.95 } : {}}
                      onClick={() => status !== 'locked' && handleClaim(reward.day)}
                      disabled={status === 'locked' || claimedToday}
                      className={cn(
                        'relative aspect-square rounded-lg flex flex-col items-center justify-center font-bold transition-all',
                        status === 'completed' && 'bg-green-500/30 border-2 border-green-500 text-green-400',
                        status === 'available' && !claimedToday && 'bg-[#FEDD00]/20 border-2 border-[#FEDD00] text-[#FEDD00] cursor-pointer',
                        status === 'available' && claimedToday && 'bg-green-500/30 border-2 border-green-500 text-green-400',
                        status === 'locked' && 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                      )}
                    >
                      <span className="text-lg">{reward.day}</span>
                      {reward.bonus && (
                        <span className="absolute -top-1 -right-1 text-[8px] bg-purple-500 text-white px-1 rounded">
                          ✨
                        </span>
                      )}
                      {status === 'available' && !claimedToday && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="absolute inset-0 border-2 border-[#FFD700] rounded-lg"
                        />
                      )}
                      {status === 'completed' && (
                        <CheckCircle className="absolute bottom-0.5 right-0.5 w-3 h-3 text-green-400" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Reward Preview */}
              <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-[#FFD700]" />
                  <span className="text-white font-medium">
                    {DAILY_REWARDS[selectedDay - 1]?.points} pontos
                  </span>
                </div>
                {claimedToday ? (
                  <span className="text-green-400 text-sm font-medium">✓ Coletado!</span>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleClaim(selectedDay)}
                    className="px-4 py-2 bg-[#009739] hover:bg-[#00b342] text-white font-bold rounded-lg text-sm transition-colors"
                  >
                    Coletar
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
