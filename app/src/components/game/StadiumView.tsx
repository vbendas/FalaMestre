'use client';

import React from 'react';
import { GameState } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { STADIUM_UPGRADES } from '@/lib/constants';
import {
  GlassCard,
  CrtButton,
  StatCard,
  SectionTitle,
  CoinDisplay,
  ManagementLayout,
} from '@/components/crt';

interface StadiumViewProps {
  gameState: GameState;
  onViewChange: (view: ViewType) => void;
}

export function StadiumView({ gameState, onViewChange }: StadiumViewProps) {
  const { stadium, user, facilities } = gameState;
  const currentStadium = stadium.level >= STADIUM_UPGRADES.length - 1 
    ? STADIUM_UPGRADES[STADIUM_UPGRADES.length - 1]
    : STADIUM_UPGRADES[stadium.level];
    
  const nextStadium = stadium.level < STADIUM_UPGRADES.length - 1 
    ? STADIUM_UPGRADES[stadium.level + 1]
    : null;

  const canAffordUpgrade = nextStadium && (user.money || 0) >= nextStadium.cost;
  const isMaxLevel = stadium.level >= STADIUM_UPGRADES.length - 1;

  const handleUpgrade = async () => {
    if (!canAffordUpgrade) return;

    try {
      const response = await fetch('/api/stadium/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to upgrade stadium:', error);
    }
  };

  const estimatedMatchRevenue = stadium.capacity > 0
    ? Math.floor(
        stadium.capacity * 
        (0.7 + stadium.amenities / 500) * 
        stadium.ticketPrice * 
        0.7
      )
    : 0;

  return (
    <ManagementLayout
      title="ESTÁDIO"
      icon="🏟️"
      money={user.money || 0}
      onBack={() => onViewChange('dashboard')}
    >
      {/* Stadium Level Header */}
      <GlassCard className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle>NÍVEL {stadium.level}</SectionTitle>
          <span className="text-[0.5rem] text-[#55e0a0] font-[family-name:var(--font-pixel)]">
            {isMaxLevel ? 'NÍVEL MÁXIMO' : `PRÓXIMO: NÍVEL ${stadium.level + 1}`}
          </span>
        </div>

        {/* Current Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            value={stadium.capacity.toLocaleString()}
            label="CAPACIDADE"
          />
          <StatCard
            value={`$ ${stadium.ticketPrice}`}
            label="PREÇO INGRESSO"
          />
        </div>
      </GlassCard>

      {/* Revenue Estimate */}
      {stadium.capacity > 0 && (
        <GlassCard className="p-3">
          <SectionTitle>RECEITA ESTIMADA POR PARTIDA</SectionTitle>
          <div className="flex items-center justify-between">
            <CoinDisplay amount={estimatedMatchRevenue} size="lg" />
            <span className="text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)]">
              70% DA RENDA COM CUPONS
            </span>
          </div>
        </GlassCard>
      )}

      {/* No stadium yet */}
      {stadium.capacity === 0 && (
        <GlassCard className="p-3 border border-[#FF3333]/50">
          <SectionTitle>
            <span className="text-[#FF3333]">SEM ESTÁDIO</span>
          </SectionTitle>
          <p className="text-[0.5rem] text-white/60 font-[family-name:var(--font-pixel)] mb-3">
            SEM ESTÁDIO, VOCÊ SÓ RECEBE RECEITAS DE JOGOS FORA DE CASA.
            CONSTRUA SEU ESTÁDIO PARA RECEBER TORCEDORES E AUMENTAR SEUS LUCROS!
          </p>
          <CrtButton
            onClick={handleUpgrade}
            disabled={!canAffordUpgrade}
            pulse={!!canAffordUpgrade}
            className="w-full py-3 text-[0.5rem]"
          >
            CONSTRUIR ESTÁDIO - $ {nextStadium?.cost.toLocaleString()}
          </CrtButton>
        </GlassCard>
      )}

      {/* Upgrade Section */}
      {!isMaxLevel && nextStadium && (
        <GlassCard className="p-3" glow>
          <SectionTitle>PRÓXIMA AMPLIAÇÃO</SectionTitle>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <StatCard
              value={nextStadium.capacity.toLocaleString()}
              label="NOVA CAPACIDADE"
            />
            <StatCard
              value={`$ ${nextStadium.ticketPrice}`}
              label="NOVO PREÇO"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)]">
                CUSTO
              </div>
              <CoinDisplay
                amount={nextStadium.cost.toLocaleString()}
                size="md"
              />
            </div>
            <CrtButton
              onClick={handleUpgrade}
              disabled={!canAffordUpgrade}
              pulse={!!canAffordUpgrade}
              className="px-4 py-2 text-[0.5rem]"
            >
              {canAffordUpgrade ? 'UPGRADE →' : 'SALDO INSUFICIENTE'}
            </CrtButton>
          </div>
        </GlassCard>
      )}

      {/* Max level reached */}
      {isMaxLevel && (
        <GlassCard className="p-4 text-center">
          <p className="text-[0.6rem] gold-glow-text font-[family-name:var(--font-pixel)] mb-1">
            ESTÁDIO NO NÍVEL MÁXIMO!
          </p>
          <p className="text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)]">
            VOCÊ ALCANÇOU A CAPACIDADE MÁXIMA
          </p>
        </GlassCard>
      )}
    </ManagementLayout>
  );
}
