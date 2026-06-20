'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Player } from '@/lib/types';
import { GlassCard, PositionBadge, SectionTitle } from '@/components/crt';

interface TopPlayersCarouselProps {
  players: Player[];
  onViewSquad: () => void;
}

function getOverall(player: Player): number {
  return Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
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
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionTitle>Melhores Jogadores</SectionTitle>
        <button
          onClick={onViewSquad}
          className="text-xs text-[#00A859] hover:text-[#55e0a0] transition-colors font-[family-name:var(--font-pixel)]"
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
              className="bg-[rgba(0,0,0,0.3)] rounded-lg p-3 border border-[#FFDF00]/30 text-center hover:border-[#00A859]/50 hover:bg-[rgba(0,168,89,0.1)] transition-colors"
            >
              <div className="flex justify-center mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold font-[family-name:var(--font-pixel)] ${
                  ovr >= 80 ? 'bg-[rgba(0,0,0,0.4)] text-[#FFDF00]' :
                  ovr >= 70 ? 'bg-[rgba(0,0,0,0.4)] text-gray-300' :
                  'bg-[rgba(0,0,0,0.4)] text-[#FFA500]'
                }`}>
                  {ovr}
                </div>
              </div>

              <p className="text-xs font-medium text-white truncate mb-1">
                {player.name.split(' ').slice(-1)[0]}
              </p>

              <PositionBadge position={player.position} />

              <p className="text-[10px] text-white/40 mt-1.5">
                {topStat.label}: <span className="text-white/70">{topStat.value}</span>
              </p>

              {player.isInjured && (
                <span className="text-[10px] text-[#FF3333] mt-1 block">🏥</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
}
