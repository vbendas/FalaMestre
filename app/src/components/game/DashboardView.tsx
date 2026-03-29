'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GameState } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import {
  TrendingUp,
  Trophy,
  Calendar,
} from 'lucide-react';
import { SquadHealthPanel } from '@/components/dashboard/SquadHealthPanel';
import { TopPlayersCarousel } from '@/components/dashboard/TopPlayersCarousel';
import { PredictionMarketCard } from '@/components/predictions/PredictionMarketCard';
import { FanClubInvestmentCard } from '@/components/investment/FanClubInvestmentCard';
import type { Prediction, PredictionHistory, FanClubInvestment, InvestmentYield } from '@/lib/types';

interface DashboardViewProps {
  gameState: GameState;
  onViewChange: (view: ViewType) => void;
  predictions?: Prediction[];
  userPredictionHistory?: PredictionHistory;
  investments?: FanClubInvestment[];
  yields?: InvestmentYield[];
  onPlaceBet?: (predictionId: string, optionId: string, amount: number) => Promise<void>;
  onInvest?: (option: 'A' | 'B' | 'C') => Promise<void>;
  onClaimYields?: () => Promise<void>;
}

export function DashboardView({ 
  gameState, 
  onViewChange,
  predictions = [],
  userPredictionHistory,
  investments = [],
  yields = [],
  onPlaceBet,
  onInvest,
  onClaimYields
}: DashboardViewProps) {
  const { squad, season, user } = gameState;
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);

  return (
    <div className="space-y-4 pb-20">
      {/* 2. League Position Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#004d00] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#FEDD00]" />
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider">Posição no Campeonato</p>
              <p className="text-3xl font-bold text-white">{season.position}º</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs uppercase tracking-wider">Pontos</p>
            <p className="text-2xl font-bold text-[#FEDD00]">{season.points}</p>
          </div>
        </div>

        {/* Record */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-[#004d00]">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-green-400">{season.wins}</p>
            <p className="text-xs text-white/40">Vitórias</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-yellow-400">{season.draws}</p>
            <p className="text-xs text-white/40">Empates</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-red-400">{season.losses}</p>
            <p className="text-xs text-white/40">Derrotas</p>
          </div>
        </div>

        {/* Season progress */}
        <div className="mt-3 pt-3 border-t border-[#004d00]">
          <div className="flex justify-between text-[10px] text-white/40 mb-1">
            <span>Temporada</span>
            <span>Semana {season.week}/38</span>
          </div>
          <div className="h-1.5 bg-[#004d00] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(season.week / 38) * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full bg-[#009739]"
            />
          </div>
        </div>
      </motion.div>

      {/* 4. Next Match Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#009739]" />
            <span className="text-xs text-white/40 uppercase tracking-wider">Próximo Jogo</span>
          </div>
          <span className="text-xs text-white/40">{season.nextMatch.competition}</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <p className="text-lg font-bold text-white">
              {season.nextMatch.isHome ? user.team : season.nextMatch.opponent}
            </p>
            <p className="text-sm text-white/40">
              {season.nextMatch.isHome ? 'Casa' : 'Fora'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/30 text-sm">vs</span>
            <p className="text-lg font-bold text-white">
              {season.nextMatch.isHome ? season.nextMatch.opponent : user.team}
            </p>
          </div>
        </div>

        {/* Win probability */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-white/40 mb-1">
            <span>Prob. de Vitória</span>
            <span>{season.nextMatch.isHome ? '58%' : '42%'}</span>
          </div>
          <div className="h-2 bg-[#004d00] rounded-full overflow-hidden flex">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: season.nextMatch.isHome ? '58%' : '42%' }}
              transition={{ duration: 0.8 }}
              className="h-full bg-green-500"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '15%' }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="h-full bg-yellow-500"
            />
            <div className="h-full flex-1 bg-red-500/50" />
          </div>
          <div className="flex justify-between text-[10px] text-white/30 mt-1">
            <span>Vitória</span>
            <span>Empate</span>
            <span>Derrota</span>
          </div>
        </div>
      </motion.div>

      {/* 5. Squad Health Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SquadHealthPanel squad={squad} onViewSquad={() => onViewChange('squad')} />
      </motion.div>

      {/* 6. Top Players Carousel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <TopPlayersCarousel players={squad.players} onViewSquad={() => onViewChange('squad')} />
      </motion.div>

      {/* 7. Recent Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[#FEDD00]" />
          <span className="text-sm font-medium text-white">Forma Recente</span>
        </div>

        <div className="flex gap-2">
          {(() => {
            const total = season.wins + season.draws + season.losses;
            const results: Array<{ type: string; color: string; label: string }> = [];
            const w = season.wins;
            const d = season.draws;

            // Generate last 5 results based on stats
            for (let i = 0; i < Math.min(5, total); i++) {
              if (i < w && w > 0) {
                results.push({ type: 'W', color: 'bg-green-500', label: 'V' });
              } else if (i < w + d) {
                results.push({ type: 'D', color: 'bg-yellow-500', label: 'E' });
              } else {
                results.push({ type: 'L', color: 'bg-red-500', label: 'D' });
              }
            }

            // Fill remaining with dashes
            while (results.length < 5) {
              results.unshift({ type: '-', color: 'bg-[#004d00]', label: '-' });
            }

            return results.map((r, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-lg ${r.color} flex items-center justify-center`}
              >
                <span className="text-white text-xs font-bold">{r.label}</span>
              </div>
            ));
          })()}
        </div>
      </motion.div>

      {/* NEW: Prediction Market Card */}
      {predictions.length > 0 && onPlaceBet && (
        <PredictionMarketCard
          predictions={predictions}
          userHistory={userPredictionHistory}
          onViewDetails={(pred) => setSelectedPrediction(pred)}
        />
      )}

      {/* NEW: Fan Club Investment Card */}
      {onInvest && onClaimYields && (
        <FanClubInvestmentCard
          userBalance={user.money}
          activeInvestments={investments}
          pendingYields={yields}
          onInvest={async (option) => {
            if (onInvest) await onInvest(option);
          }}
          onClaimYields={async () => {
            if (onClaimYields) await onClaimYields();
          }}
        />
      )}
    </div>
  );
}
