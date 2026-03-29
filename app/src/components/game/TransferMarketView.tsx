'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Search, Filter, DollarSign, TrendingUp, Star, X } from 'lucide-react';
import { GameState, Player } from '@/lib/types';
import { generateSquad, PVE_TEAMS } from '@/lib/game-engine';

interface TransferMarketViewProps {
  gameState: GameState;
  userId: string;
}

type PositionFilter = 'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD';

function getOverall(player: Player): number {
  return Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
}

function getValue(player: Player): number {
  const ovr = getOverall(player);
  const ageBonus = player.potential > 80 ? 1.5 : 1;
  return Math.round(ovr * ovr * ageBonus * (50 + Math.random() * 30));
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

export function TransferMarketView({ gameState, userId }: TransferMarketViewProps) {
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const marketPlayers = useMemo(() => {
    const allPlayers: Array<Player & { team: string; value: number }> = [];

    PVE_TEAMS.forEach(team => {
      const squad = generateSquad(team.name);
      squad.forEach(p => {
        allPlayers.push({ ...p, team: team.name, value: getValue(p) });
      });
    });

    allPlayers.sort((a, b) => getOverall(b) - getOverall(a));
    return allPlayers.slice(0, 40);
  }, []);

  const filtered = useMemo(() => {
    let result = marketPlayers;
    if (positionFilter !== 'ALL') {
      result = result.filter(p => p.position === positionFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }
    return result;
  }, [marketPlayers, positionFilter, searchQuery]);

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `$ ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$ ${(value / 1_000).toFixed(0)}K`;
    return `$ ${value}`;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#004d00] flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-[#009739]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Mercado de Transferências</h1>
            <p className="text-white/60 text-sm">Encontre reforços para o seu time</p>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar jogador ou time..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#004d00] border border-[#FEDD00]/30 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FEDD00]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as PositionFilter[]).map(pos => (
            <button
              key={pos}
              onClick={() => setPositionFilter(pos)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                positionFilter === pos
                  ? 'bg-[#009739] text-white border border-[#FEDD00]/50'
                  : 'bg-[#004d00] text-white/50 border border-[#FEDD00]/30 hover:bg-[#006400]'
              }`}
            >
              {pos === 'ALL' ? 'Todos' : pos}
            </button>
          ))}
        </div>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((player, i) => {
            const ovr = getOverall(player);
            return (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => setSelectedPlayer(selectedPlayer?.id === player.id ? null : player)}
                className="bg-[#006400] rounded-xl p-3 border-2 border-[#FEDD00]/50 hover:bg-[#009739] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {/* OVR Badge */}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                    ovr >= 80 ? 'bg-[#004d00] text-[#FEDD00]' :
                    ovr >= 70 ? 'bg-[#004d00] text-gray-300' :
                    'bg-[#004d00] text-amber-500'
                  }`}>
                    {ovr}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{player.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getPositionColor(player.position)}`}>
                        {player.position}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{player.team}</p>
                  </div>

                  {/* Value */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#FEDD00]">{formatCurrency(player.value)}</p>
                    <p className="text-[10px] text-white/30">Valor</p>
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {selectedPlayer?.id === player.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-[#004d00]">
                        <div className="grid grid-cols-6 gap-2 mb-3">
                          {[
                            { label: 'PAC', value: player.pac },
                            { label: 'SHO', value: player.sho },
                            { label: 'PAS', value: player.pas },
                            { label: 'DRI', value: player.dri },
                            { label: 'DEF', value: player.def },
                            { label: 'PHY', value: player.phy },
                          ].map(stat => (
                            <div key={stat.label} className="text-center">
                              <p className="text-[10px] text-white/40">{stat.label}</p>
                              <p className="text-sm font-bold text-white">{stat.value}</p>
                            </div>
                          ))}
                        </div>
                        <button
                          className="w-full py-2 bg-[#009739] hover:bg-[#00b347] rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <DollarSign className="w-4 h-4" />
                          Fazer Proposta
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-white/10 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Nenhum jogador encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
