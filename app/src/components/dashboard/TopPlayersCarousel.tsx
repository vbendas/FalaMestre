'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Player } from '@/lib/types';
import { Shield, Zap, Target, Users as UsersIcon } from 'lucide-react';

interface TopPlayersCarouselProps {
  players: Player[];
  onViewSquad: () => void;
}

function getOverall(player: Player): number {
  return Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
}

function getPositionLabel(pos: string): string {
  switch (pos) {
    case 'GK': return 'Goleiro';
    case 'DEF': return 'Zagueiro';
    case 'MID': return 'Meia';
    case 'FWD': return 'Atacante';
    default: return pos;
  }
}

function getPositionColor(pos: string): string {
  switch (pos) {
    case 'GK': return 'bg-yellow-500/20 text-yellow-400';
    case 'DEF': return 'bg-blue-500/20 text-blue-400';
    case 'MID': return 'bg-green-500/20 text-green-400';
    case 'FWD': return 'bg-red-500/20 text-red-400';
    default: return 'bg-white/20 text-white';
  }
}

function getTopStat(player: Player): { label: string; value: number } {
  const stats = [
    { label: 'PAC', value: player.pac },
    { label: 'SHO', value: player.sho },
    { label: 'PAS', value: player.pas },
    { label: 'DRI', value: player.dri },
    { label: 'DEF', value: player.def },
    { label: 'PHY', value: player.phy },
  ];
  stats.sort((a, b) => b.value - a.value);
  return stats[0];
}

export function TopPlayersCarousel({ players, onViewSquad }: TopPlayersCarouselProps) {
  const sorted = [...players].sort((a, b) => getOverall(b) - getOverall(a));
  const topPlayers = sorted.slice(0, 3);

  if (topPlayers.length === 0) return null;

  return (
    <div className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
          Melhores Jogadores
        </h3>
        <button
          onClick={onViewSquad}
          className="text-xs text-[#009739] hover:text-[#00b347] transition-colors"
        >
          Ver Todos →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {topPlayers.map((player, i) => {
          const ovr = getOverall(player);
          const topStat = getTopStat(player);
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#004d00] rounded-lg p-3 border border-[#FEDD00]/30 text-center hover:bg-[#009739] transition-colors"
            >
              {/* OVR Badge */}
              <div className="flex justify-center mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                  ovr >= 80 ? 'bg-[#004d00] text-[#FEDD00]' :
                  ovr >= 70 ? 'bg-[#004d00] text-gray-300' :
                  'bg-[#004d00] text-amber-500'
                }`}>
                  {ovr}
                </div>
              </div>

              {/* Name */}
              <p className="text-xs font-medium text-white truncate mb-1">
                {player.name.split(' ').slice(-1)[0]}
              </p>

              {/* Position badge */}
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${getPositionColor(player.position)}`}>
                {player.position}
              </span>

              {/* Top stat */}
              <p className="text-[10px] text-white/40 mt-1.5">
                {topStat.label}: <span className="text-white/70">{topStat.value}</span>
              </p>

              {/* Form indicator */}
              {player.isInjured && (
                <span className="text-[10px] text-red-400 mt-1 block">🏥</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
