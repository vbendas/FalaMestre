'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GameState } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { SquadHealthPanel } from '@/components/dashboard/SquadHealthPanel';
import { TopPlayersCarousel } from '@/components/dashboard/TopPlayersCarousel';
import { PredictionMarketCard } from '@/components/predictions/PredictionMarketCard';
import { FanClubInvestmentCard } from '@/components/investment/FanClubInvestmentCard';
import type { Prediction, PredictionHistory, FanClubInvestment, InvestmentYield } from '@/lib/types';
import {
  GlassCard,
  CrtButton,
  StatCard,
  SectionTitle,
  CoinDisplay,
  ProgressBar,
  ViewContainer,
} from '@/components/crt';

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
  onClaimYields,
}: DashboardViewProps) {
  const { squad, season, user } = gameState;
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);

  return (
    <ViewContainer>
      {/* Next Match Card */}
      <GlassCard className="p-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex-1 min-w-0">
            <SectionTitle>PRÓXIMA PARTIDA</SectionTitle>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[0.6rem] gold-glow-text font-[family-name:var(--font-pixel)] truncate max-w-[100px] sm:max-w-none">
                {season.nextMatch.isHome ? user.team : season.nextMatch.opponent}
              </span>
              <span className="text-xs text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)]">VS</span>
              <span className="text-[0.6rem] text-white/70 font-[family-name:var(--font-pixel)] truncate max-w-[100px] sm:max-w-none">
                {season.nextMatch.isHome ? season.nextMatch.opponent : user.team}
              </span>
              <span className="text-[0.5rem] text-[#55e0a0] font-[family-name:var(--font-pixel)]">
                {season.nextMatch.isHome ? 'MANDANTE' : 'VISITANTE'}
              </span>
            </div>
          </div>
          <CrtButton
            pulse
            className="px-4 py-2 text-[0.5rem] font-[family-name:var(--font-pixel)] flex-shrink-0 self-start sm:self-center"
            onClick={() => onViewChange('match')}
          >
            ⚡ JOGAR
          </CrtButton>
        </div>

        {/* Win probability bar */}
        <div className="mt-2">
          <div className="flex justify-between text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)] mb-1">
            <span>VITÓRIA</span>
            <span>EMPATE</span>
            <span>DERROTA</span>
          </div>
          <div className="h-1.5 rounded-sm overflow-hidden flex bg-[rgba(0,0,0,0.3)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: season.nextMatch.isHome ? '55%' : '35%' }}
              transition={{ duration: 0.8 }}
              className="bg-[#00A859] rounded-l-sm"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '20%' }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-[rgba(255,223,0,0.5)]"
            />
            <div className="flex-1 bg-[#3EA0D4] rounded-r-sm" />
          </div>
        </div>
      </GlassCard>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          value={`${season.wins}V ${season.draws}E ${season.losses}D`}
          label="CAMPEONATO"
        />
        <StatCard
          value={`#${season.position}`}
          label="POSIÇÃO"
        />
        <StatCard
          value={`${season.points}`}
          label="PONTOS"
        />
      </div>

      {/* Season Progress */}
      <GlassCard className="p-2">
        <div className="flex justify-between items-center">
          <SectionTitle>TEMPORADA</SectionTitle>
          <span className="text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)]">
            RODADA {season.week}/38
          </span>
        </div>
        <ProgressBar value={season.week} max={38} height={4} color="#00A859" />
      </GlassCard>

      {/* Recent Form */}
      <GlassCard className="p-2">
        <SectionTitle>FORMA RECENTE</SectionTitle>
        <div className="flex gap-1.5 mt-1">
          {(() => {
            const total = season.wins + season.draws + season.losses;
            const results: Array<{ color: string; label: string }> = [];
            for (let i = 0; i < Math.min(5, total); i++) {
              if (i < season.wins) results.push({ color: 'bg-[#00A859]', label: 'V' });
              else if (i < season.wins + season.draws) results.push({ color: 'bg-[rgba(255,223,0,0.5)]', label: 'E' });
              else results.push({ color: 'bg-[#FF3333]', label: 'D' });
            }
            while (results.length < 5) {
              results.unshift({ color: 'bg-[rgba(255,223,0,0.1)]', label: '-' });
            }
            return results.map((r, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-sm ${r.color} flex items-center justify-center`}
              >
                <span className="text-white text-[0.5rem] font-[family-name:var(--font-pixel)]">
                  {r.label}
                </span>
              </div>
            ));
          })()}
        </div>
      </GlassCard>

      {/* Squad Health */}
      <SquadHealthPanel squad={squad} onViewSquad={() => onViewChange('squad')} />

      {/* Top Players */}
      <TopPlayersCarousel players={squad.players} onViewSquad={() => onViewChange('squad')} />

      {/* Prediction Market */}
      {predictions.length > 0 && onPlaceBet && (
        <PredictionMarketCard
          predictions={predictions}
          userHistory={userPredictionHistory}
          onViewDetails={(pred) => setSelectedPrediction(pred)}
        />
      )}

      {/* Fan Club Investment */}
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
    </ViewContainer>
  );
}
