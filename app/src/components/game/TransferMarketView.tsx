'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, Search, DollarSign, X } from 'lucide-react';
import { GameState, Player } from '@/lib/types';
import { generateSquad, PVE_TEAMS } from '@/lib/game-engine';
import {
  ViewContainer,
  GlassCard,
  InputField,
  ChipGroup,
  PositionBadge,
  CoinDisplay,
  CrtButton,
  SectionTitle,
} from '@/components/crt';

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
    <ViewContainer className="gap-3">
      {/* Header */}
      <GlassCard glow className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00381a] flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-[#55e0a0]" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-[family-name:var(--font-pixel)] gold-glow-text">
              Mercado de Transferências
            </h1>
            <p className="text-[#55e0a0]/60 text-sm font-[family-name:var(--font-pixel)] text-[0.5rem]">
              Encontre reforços para o seu time
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FFDF00]/30 pointer-events-none z-10" />
          <InputField
            type="text"
            placeholder="Buscar jogador ou time..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FFDF00]/30 hover:text-[#FFDF00]/60"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <ChipGroup
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'GK', label: 'GK' },
            { value: 'DEF', label: 'DEF' },
            { value: 'MID', label: 'MID' },
            { value: 'FWD', label: 'FWD' },
          ]}
          selected={positionFilter}
          onSelect={setPositionFilter}
        />
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
              >
                <GlassCard
                  glow
                  onClick={() => setSelectedPlayer(selectedPlayer?.id === player.id ? null : player)}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* OVR Badge */}
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0 font-[family-name:var(--font-pixel)] ${
                        ovr >= 80 ? 'bg-[#00381a] text-[#FFDF00]' :
                        ovr >= 70 ? 'bg-[#00381a] text-gray-300' :
                        'bg-[#00381a] text-amber-500'
                      }`}
                    >
                      {ovr}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#FFDF00] truncate font-[family-name:var(--font-pixel)] text-[0.6rem]">
                          {player.name}
                        </p>
                        <PositionBadge position={player.position} />
                      </div>
                      <p className="text-xs text-[#55e0a0]/50 mt-0.5 font-[family-name:var(--font-pixel)]">
                        {player.team}
                      </p>
                    </div>

                    {/* Value */}
                    <div className="text-right flex-shrink-0">
                      <CoinDisplay amount={formatCurrency(player.value)} size="sm" />
                      <p className="text-[0.5rem] text-[#55e0a0]/30 font-[family-name:var(--font-pixel)]">Valor</p>
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
                        <div className="px-3 pb-3 pt-3 border-t border-[rgba(255,223,0,0.15)]">
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
                                <p className="text-[0.5rem] text-[#55e0a0]/50 font-[family-name:var(--font-pixel)]">{stat.label}</p>
                                <p className="text-sm font-bold text-[#FFDF00] font-[family-name:var(--font-pixel)]">{stat.value}</p>
                              </div>
                            ))}
                          </div>
                          <CrtButton
                            variant="primary"
                            className="w-full py-2 text-[0.55rem] flex items-center justify-center gap-2"
                            onClick={() => {}}
                          >
                            <DollarSign className="w-4 h-4" />
                            Fazer Proposta
                          </CrtButton>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-[#FFDF00]/10 mx-auto mb-3" />
            <p className="text-[#55e0a0]/40 text-sm font-[family-name:var(--font-pixel)] text-[0.55rem]">Nenhum jogador encontrado</p>
          </div>
        )}
      </div>
    </ViewContainer>
  );
}
