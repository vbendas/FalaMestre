'use client';

import React from 'react';
import { Activity, Heart, Users, AlertTriangle } from 'lucide-react';
import { Squad } from '@/lib/types';
import { GlassCard, ProgressBar, SectionTitle } from '@/components/crt';

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

function getMoraleColor(morale: number): string {
  if (morale >= 75) return '#00A859';
  if (morale >= 50) return '#FFA500';
  return '#FF3333';
}

function getFitnessColor(fitness: number): string {
  if (fitness >= 75) return '#00A859';
  if (fitness >= 50) return '#FFA500';
  return '#FF3333';
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
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>Saúde do Elenco</SectionTitle>
        <button
          onClick={onViewSquad}
          className="text-xs text-[#00A859] hover:text-[#55e0a0] transition-colors font-[family-name:var(--font-pixel)]"
        >
          Ver Elenco →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Heart className="w-3.5 h-3.5 text-[#55e0a0]" />
            <span className="text-xs text-white/50">Moral</span>
            <span className="text-xs ml-auto">{form.emoji}</span>
          </div>
          <ProgressBar value={squad.morale} height={8} color={getMoraleColor(squad.morale)} />
          <p className="text-right text-xs text-white/40 mt-1">{squad.morale}%</p>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-3.5 h-3.5 text-[#55e0a0]" />
            <span className="text-xs text-white/50">Condição</span>
          </div>
          <ProgressBar value={squad.fitness} height={8} color={getFitnessColor(squad.fitness)} />
          <p className="text-right text-xs text-white/40 mt-1">{squad.fitness}%</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-[#00A859]/30 text-[#00A859] px-2 py-0.5 rounded font-medium font-[family-name:var(--font-pixel)]">
          {squad.formation}
        </span>
        <div className="flex gap-3 text-xs text-white/40">
          <span>GK: {positionCounts.GK}</span>
          <span>DEF: {positionCounts.DEF}</span>
          <span>MID: {positionCounts.MID}</span>
          <span>FWD: {positionCounts.FWD}</span>
        </div>
      </div>

      {injuredPlayers.length > 0 && (
        <div className="bg-[#FF3333]/10 border border-[#FF3333]/30 rounded-lg p-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#FF3333] flex-shrink-0" />
          <span className="text-xs text-[#FF3333]/80">
            {injuredPlayers.length} jogador{injuredPlayers.length > 1 ? 'es' : ''} lesionado{injuredPlayers.length > 1 ? 's' : ''}
          </span>
          <span className="text-xs text-[#FF3333]/60 ml-auto">
            {injuredPlayers.map(p => p.name.split(' ')[1] || p.name.split(' ')[0]).join(', ')}
          </span>
        </div>
      )}

      {injuredPlayers.length === 0 && (
        <div className="bg-[#00A859]/10 border border-[#00A859]/20 rounded-lg p-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#00A859]" />
          <span className="text-xs text-[#00A859]/80">Todos os jogadores disponíveis</span>
        </div>
      )}
    </GlassCard>
  );
}
