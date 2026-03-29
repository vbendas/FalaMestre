'use client';

import { motion } from 'framer-motion';
import { Trophy, Star, Medal, Crown, Zap, Target, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: 'trophy' | 'star' | 'medal' | 'crown' | 'zap' | 'target' | 'users';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: Date;
}

const ICON_MAP = {
  trophy: Trophy,
  star: Star,
  medal: Medal,
  crown: Crown,
  zap: Zap,
  target: Target,
  users: Users,
};

const RARITY_COLORS = {
  common: { bg: 'bg-gray-500/20', border: 'border-gray-500', text: 'text-gray-400', glow: 'shadow-gray-500/20' },
  rare: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  epic: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  legendary: { bg: 'bg-[#FFD700]/20', border: 'border-[#FFD700]', text: 'text-[#FFD700]', glow: 'shadow-[#FFD700]/50' },
};

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  onClick?: () => void;
}

export function AchievementBadge({ 
  achievement, 
  size = 'md',
  showTooltip = true,
  onClick 
}: AchievementBadgeProps) {
  const Icon = ICON_MAP[achievement.icon];
  const colors = RARITY_COLORS[achievement.rarity];
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'relative rounded-xl border-2 flex items-center justify-center transition-all',
        sizeClasses[size],
        achievement.unlockedAt ? colors.bg : 'bg-gray-500/10',
        achievement.unlockedAt ? colors.border : 'border-gray-600',
        achievement.unlockedAt ? `shadow-lg ${colors.glow}` : 'opacity-50',
        onClick && 'cursor-pointer'
      )}
    >
      <Icon className={cn(iconSizes[size], achievement.unlockedAt ? colors.text : 'text-gray-500')} />
      
      {/* Locked overlay */}
      {!achievement.unlockedAt && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
          <span className="text-white/50 text-xs">🔒</span>
        </div>
      )}
      
      {/* Rarity indicator */}
      {achievement.unlockedAt && (
        <div className={cn(
          'absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#012169]',
          colors.bg
        )} />
      )}
    </motion.button>
  );
}

interface AchievementGridProps {
  achievements: Achievement[];
  size?: 'sm' | 'md' | 'lg';
  onAchievementClick?: (achievement: Achievement) => void;
}

export function AchievementGrid({ achievements, size = 'md', onAchievementClick }: AchievementGridProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {achievements.map((achievement) => (
        <AchievementBadge
          key={achievement.id}
          achievement={achievement}
          size={size}
          onClick={onAchievementClick ? () => onAchievementClick(achievement) : undefined}
        />
      ))}
    </div>
  );
}

interface LevelBadgeProps {
  level: number;
  xp: number;
  xpToNextLevel: number;
  size?: 'sm' | 'md';
}

export function LevelBadge({ level, xp, xpToNextLevel, size = 'md' }: LevelBadgeProps) {
  const progress = (xp / xpToNextLevel) * 100;
  
  const sizeClasses = size === 'sm' ? {
    badge: 'w-8 h-8 text-sm',
    text: 'text-xs',
    bar: 'h-1',
  } : {
    badge: 'w-12 h-12 text-lg',
    text: 'text-sm',
    bar: 'h-2',
  };

  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={cn(
          'rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center font-bold text-[#012169] shadow-lg',
          sizeClasses.badge
        )}
      >
        {level}
      </motion.div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className={cn('font-bold text-white', sizeClasses.text)}>Level {level}</span>
          <span className={cn('text-white/50', size === 'sm' ? 'text-[10px]' : 'text-xs')}>
            {xp}/{xpToNextLevel} XP
          </span>
        </div>
        <div className={cn('bg-white/10 rounded-full overflow-hidden', sizeClasses.bar)}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-[#009739] to-[#FEDD00] rounded-full"
          />
        </div>
      </div>
    </div>
  );
}

// Sample achievements for display
export const SAMPLE_ACHIEVEMENTS: Achievement[] = [
  { id: '1', title: 'Primeira Vitória', description: 'Ganhe sua primeira partida', icon: 'trophy', rarity: 'common', unlockedAt: new Date() },
  { id: '2', title: '连胜 Mestre', description: 'Ganhe 5 partidas seguidas', icon: 'zap', rarity: 'rare', unlockedAt: new Date() },
  { id: '3', title: 'Time Perfeito', description: 'Monte um time com rating 85+', icon: 'star', rarity: 'epic' },
  { id: '4', title: 'Lenda do Futebol', description: 'Ganhe 100 partidas', icon: 'crown', rarity: 'legendary' },
  { id: '5', title: 'Amizade', description: 'Tenha 11 jogadores no elenco', icon: 'users', rarity: 'common', unlockedAt: new Date() },
  { id: '6', title: 'Finalizador', description: 'Marque 10 gols', icon: 'target', rarity: 'rare' },
];
