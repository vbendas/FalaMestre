'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Heart, Users, AlertTriangle } from 'lucide-react';
import { Squad } from '@/lib/types';

interface SquadHealthPanelProps {
  squad: Squad;
  onViewSquad: () => void;
}

function getFormIcon(morale: number): { emoji: string; color: string } {
  if (morale >= 80) return { emoji: '🔥', color: 'text-red-400' };
  if (morale >= 60) return { emoji: '👍', color: 'text-green-400' };
  if (morale >= 40) return { emoji: '😐', color: 'text-yellow-400' };
  return { emoji: '😤', color: 'text-orange-400' };
}

function getFitnessColor(fitness: number): string {
  if (fitness >= 75) return 'bg-green-500';
  if (fitness >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getMoraleColor(morale: number): string {
  if (morale >= 75) return 'bg-purple-500';
  if (morale >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function SquadHealthPanel({ squad, onViewSquad }: SquadHealthPanelProps) {
  const injuredPlayers = squad.players.filter(p => p.isInjured);
  const form = getFormIcon(squad.morale);

  const positionCounts = {
    GK: squad.players.filter(p => p.position === 'GK').length,
    DEF: squad.players.filter(p => p.position === 'DEF').length,
    MID: squad.players.filter(p => p.position === 'MID').length,
    FWD: squad.players.filter(p => p.position === 'FWD').length,
  };

  return (
    <div className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
          Saúde do Elenco
        </h3>
        <button
          onClick={onViewSquad}
          className="text-xs text-[#009739] hover:text-[#00b347] transition-colors"
        >
          Ver Elenco →
        </button>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Morale */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Heart className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-white/50">Moral</span>
            <span className="text-xs ml-auto">{form.emoji}</span>
          </div>
          <div className="h-2 bg-[#004d00] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${squad.morale}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${getMoraleColor(squad.morale)}`}
            />
          </div>
          <p className="text-right text-xs text-white/40 mt-1">{squad.morale}%</p>
        </div>

        {/* Fitness */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-white/50">Condição</span>
          </div>
          <div className="h-2 bg-[#004d00] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${squad.fitness}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${getFitnessColor(squad.fitness)}`}
            />
          </div>
          <p className="text-right text-xs text-white/40 mt-1">{squad.fitness}%</p>
        </div>
      </div>

      {/* Formation & Position counts */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-[#009739]/30 text-[#009739] px-2 py-0.5 rounded font-medium">
          {squad.formation}
        </span>
        <div className="flex gap-3 text-xs text-white/40">
          <span>GK: {positionCounts.GK}</span>
          <span>DEF: {positionCounts.DEF}</span>
          <span>MID: {positionCounts.MID}</span>
          <span>FWD: {positionCounts.FWD}</span>
        </div>
      </div>

      {/* Injured players alert */}
      {injuredPlayers.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">
            {injuredPlayers.length} jogador{injuredPlayers.length > 1 ? 'es' : ''} lesionado{injuredPlayers.length > 1 ? 's' : ''}
          </span>
          <span className="text-xs text-red-400/60 ml-auto">
            {injuredPlayers.map(p => p.name.split(' ')[1] || p.name.split(' ')[0]).join(', ')}
          </span>
        </div>
      )}

      {injuredPlayers.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-green-400" />
          <span className="text-xs text-green-300">Todos os jogadores disponíveis</span>
        </div>
      )}
    </div>
  );
}
