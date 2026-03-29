'use client';

import { getExpertLevelName } from '@/lib/prediction-engine';
import { PREDICTION_MARKET } from '@/lib/constants';

interface ExpertFanBadgeProps {
  level: number;
  currentStreak: number;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export function ExpertFanBadge({
  level,
  currentStreak,
  size = 'md',
  showName = true,
}: ExpertFanBadgeProps) {
  const name = getExpertLevelName(level);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };
  
  const starEmoji = '⭐'.repeat(Math.min(level + 1, 5));
  const levelColors = [
    'bg-gray-500/20 border-gray-500/50 text-gray-300',
    'bg-blue-500/20 border-blue-500/50 text-blue-300',
    'bg-green-500/20 border-green-500/50 text-green-300',
    'bg-purple-500/20 border-purple-500/50 text-purple-300',
    'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    'bg-orange-500/20 border-orange-500/50 text-orange-300 border-2',
  ];
  
  const colorClass = levelColors[Math.min(level, levelColors.length - 1)];
  
  return (
    <div className={`inline-flex items-center gap-1 rounded-full border ${colorClass} ${sizeClasses[size]}`}>
      <span>{starEmoji}</span>
      {showName && <span className="font-medium">{name}</span>}
      {level > 0 && (
        <span className="text-white/50 text-xs ml-1">
          🔥{currentStreak}
        </span>
      )}
    </div>
  );
}

interface ExpertLevelProgressProps {
  currentLevel: number;
  currentStreak: number;
}

export function ExpertLevelProgress({ currentLevel, currentStreak }: ExpertLevelProgressProps) {
  const nextLevel = Math.min(currentLevel + 1, 5);
  const currentRequirement = PREDICTION_MARKET.EXPERT_LEVELS[currentLevel]?.minStreak || 0;
  const nextRequirement = PREDICTION_MARKET.EXPERT_LEVELS[nextLevel]?.minStreak || 50;
  
  const progress = currentLevel >= 5 
    ? 100 
    : ((currentStreak - currentRequirement) / (nextRequirement - currentRequirement)) * 100;
  
  return (
    <div className="bg-white/5 rounded-lg p-3 space-y-2">
      <p className="text-white/70 text-sm font-medium">Progresso Especialistas</p>
      
      <div className="flex justify-between items-center text-xs">
        <span className="text-white/50">Nível {currentLevel}</span>
        {currentLevel < 5 && (
          <span className="text-white/50">Nível {nextLevel}</span>
        )}
      </div>
      
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      
      {currentLevel < 5 && (
        <p className="text-white/40 text-xs text-center">
          Precisa de {nextRequirement - currentStreak} vitórias extras para next nível
        </p>
      )}
    </div>
  );
}