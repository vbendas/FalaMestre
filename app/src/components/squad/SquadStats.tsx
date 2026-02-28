'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Trophy, Star, Target, Users, TrendingUp, TrendingDown, Minus, Shield, Zap } from 'lucide-react';
import { GameState, Player } from '@/lib/types';

interface SquadStatsProps {
  gameState: GameState;
  onFormationClick?: () => void;
}

interface StatBoxProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
  trend?: 'up' | 'down' | 'stable';
  onClick?: () => void;
}

function StatBox({ icon, value, label, color, trend, onClick }: StatBoxProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-yellow-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`
        bg-[#006400] rounded-xl p-3 border-2 border-[#FEDD00]/50 
        ${onClick ? 'cursor-pointer hover:border-[#FEDD00]' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </div>
        {trend && <TrendIcon className={`w-3 h-3 ${trendColor}`} />}
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-white/50">{label}</div>
    </motion.div>
  );
}

function calculateAverageRating(players: Player[]): number {
  if (players.length === 0) return 0;
  const total = players.reduce((sum, p) => {
    return sum + Math.round((p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6);
  }, 0);
  return Math.round(total / players.length);
}

function getPositionCounts(players: Player[]): Record<string, number> {
  return players.reduce((acc, p) => {
    acc[p.position] = (acc[p.position] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function getFitPlayersCount(players: Player[], fitness: number): number {
  return players.filter(() => Math.random() > 0.3).length; // Simplified for now
}

export function SquadStats({ gameState, onFormationClick }: SquadStatsProps) {
  const { squad, season, user } = gameState;
  const avgRating = calculateAverageRating(squad.players);
  const positionCounts = getPositionCounts(squad.players);
  
  // Training budget
  const trainingBudget = squad.weeklyTrainingBudget ?? 15;
  const maxBudget = 15;
  
  // Injured players - use fallback for isInjured
  const injuredCount = squad.players.filter(p => p.isInjured ?? false).length;
  
  // Average form
  const formScores: Record<string, number> = { hot: 5, good: 4, average: 3, poor: 2, cold: 1 };
  const avgFormScore = squad.players.reduce((sum, p) => sum + (formScores[p.currentForm] || 3), 0) / squad.players.length;
  const avgFormEmoji = avgFormScore >= 4.5 ? '🔥' : avgFormScore >= 3.5 ? '😊' : avgFormScore >= 2.5 ? '😐' : avgFormScore >= 1.5 ? '😟' : '❄️';
  
  const getRatingTrend = (rating: number): 'up' | 'down' | 'stable' => {
    if (rating >= 75) return 'up';
    if (rating >= 65) return 'stable';
    return 'down';
  };

  return (
    <div className="space-y-3">
      {/* Training Budget Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#006400] rounded-xl p-3 border-2 border-[#FEDD00]/50"
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#FEDD00]" />
            Treinos (Semana)
          </span>
          <span className="text-lg font-bold text-[#FEDD00]">{trainingBudget}/{maxBudget}</span>
        </div>
        <div className="h-3 bg-[#004d00] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(trainingBudget / maxBudget) * 100}%` }}
            className="h-full bg-[#FEDD00] rounded-full"
          />
        </div>
      </motion.div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox
          icon={<Users className="w-4 h-4" style={{ color: '#00D4FF' }} />}
          value={avgRating}
          label="Média Geral"
          color="#00D4FF"
          trend={getRatingTrend(avgRating)}
        />
        <StatBox
          icon={<Heart className="w-4 h-4" style={{ color: '#FF6B6B' }} />}
          value={`${squad.morale}%`}
          label="Moral do Time"
          color="#FF6B6B"
          trend={squad.morale >= 75 ? 'up' : squad.morale >= 50 ? 'stable' : 'down'}
        />
        <StatBox
          icon={<Zap className="w-4 h-4" style={{ color: '#4ADE80' }} />}
          value={`${squad.fitness}%`}
          label="Condição Física"
          color="#4ADE80"
          trend={squad.fitness >= 70 ? 'up' : squad.fitness >= 40 ? 'stable' : 'down'}
        />
        <StatBox
          icon={<Trophy className="w-4 h-4" style={{ color: '#FEDD00' }} />}
          value={`${season.position}º`}
          label="Posição"
          color="#FEDD00"
          trend={season.position <= 4 ? 'up' : season.position <= 10 ? 'stable' : 'down'}
        />
      </div>

      {/* Formation & Squad Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#006400] rounded-xl p-3 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#FEDD00]" />
            <span className="text-sm font-medium text-white">Formação</span>
          </div>
          <button
            onClick={onFormationClick}
            className="text-xs text-[#FEDD00] hover:underline"
          >
            Mudar →
          </button>
        </div>

        {/* Formation Display */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#009739]/30 rounded-lg flex items-center justify-center relative overflow-hidden">
            {/* Mini pitch */}
            <div className="absolute inset-1 border border-white/20 rounded">
              {/* Formation dots */}
              <div className="absolute inset-0 flex flex-col justify-around p-1">
                <div className="flex justify-center gap-1">
                  {[1, 2, 3].map((i) => (
                    <div key={`fwd-${i}`} className="w-2 h-2 rounded-full bg-red-500" />
                  ))}
                </div>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={`mid-${i}`} className="w-2 h-2 rounded-full bg-green-500" />
                  ))}
                </div>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={`def-${i}`} className="w-2 h-2 rounded-full bg-blue-500" />
                  ))}
                </div>
                <div className="flex justify-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="text-lg font-bold text-white">{squad.formation}</div>
            <div className="flex gap-2 mt-1">
              {Object.entries(positionCounts).map(([pos, count]) => (
                <span
                  key={pos}
                  className={`
                    px-1.5 py-0.5 rounded text-[10px] font-bold
                    ${pos === 'GK' ? 'bg-purple-500/20 text-purple-400' : ''}
                    ${pos === 'DEF' ? 'bg-blue-500/20 text-blue-400' : ''}
                    ${pos === 'MID' ? 'bg-green-500/20 text-green-400' : ''}
                    ${pos === 'FWD' ? 'bg-red-500/20 text-red-400' : ''}
                  `}
                >
                  {pos}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2"
      >
        <div className="flex-1 bg-[#004d00] rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white">{squad.players.length}</div>
          <div className="text-[10px] text-white/50">Jogadores</div>
        </div>
        <div className="flex-1 bg-[#004d00] rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white">{season.points}</div>
          <div className="text-[10px] text-white/50">Pontos</div>
        </div>
        <div className={`flex-1 rounded-lg p-2 text-center ${injuredCount > 0 ? 'bg-red-900/50 border border-red-500/50' : 'bg-[#004d00]'}`}>
          <div className={`text-lg font-bold ${injuredCount > 0 ? 'text-red-400' : 'text-white'}`}>
            {injuredCount}
          </div>
          <div className="text-[10px] text-white/50">Lesionados</div>
        </div>
        <div className="flex-1 bg-[#004d00] rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white text-2xl">{avgFormEmoji}</div>
          <div className="text-[10px] text-white/50">Moral</div>
        </div>
      </motion.div>
    </div>
  );
}

export type { SquadStatsProps };
