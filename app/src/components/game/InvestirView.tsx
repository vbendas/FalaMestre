'use client';

import { useState } from 'react';
import { GameState } from '@/lib/types';
import { formatMoney } from '@/lib/economy';
import {
  ViewContainer,
  GlassCard,
  CrtButton,
  CoinDisplay,
  SectionTitle,
} from '@/components/crt';

interface InvestirViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: string) => void;
  onMoneyUpdate: (newBalance: number) => void;
}

interface InvestmentType {
  id: string;
  name: string;
  icon: string;
  cost: number;
  dailyYield: number;
  durationDays: number;
  strategicBonusType: string;
  strategicBonusValue: number;
  description: string;
}

const INVESTMENT_TYPES: InvestmentType[] = [
  {
    id: 'clube_torcedores',
    name: 'Clube de Torcedores',
    icon: '💰',
    cost: 50000,
    dailyYield: 10000,
    durationDays: 3,
    strategicBonusType: 'morale',
    strategicBonusValue: 2,
    description: 'Investimento no clube de torcedores. Aumenta a moral do time em 2% e gera rendimento diário.'
  },
  {
    id: 'marketing_digital',
    name: 'Marketing Digital',
    icon: '📱',
    cost: 200000,
    dailyYield: 0,
    durationDays: 7,
    strategicBonusType: 'ticket_sales',
    strategicBonusValue: 15,
    description: 'Campanha digital para atrair mais torcedores. Aumenta receita de bilheteria em 15%.'
  },
  {
    id: 'social_media',
    name: 'Campanha Redes Sociais',
    icon: '📣',
    cost: 150000,
    dailyYield: 0,
    durationDays: 14,
    strategicBonusType: 'viral_events',
    strategicBonusValue: 20,
    description: 'Campanha viral nas redes sociais. Aumenta chances de eventos especiais em 20%.'
  },
  {
    id: 'academia_base',
    name: 'Academia de Base',
    icon: '🌟',
    cost: 300000,
    dailyYield: 0,
    durationDays: 30,
    strategicBonusType: 'youth_quality',
    strategicBonusValue: 20,
    description: 'Investimento na academia de base. Melhora a qualidade dos jovems jogadores em 20%.'
  },
  {
    id: 'staff_esportivo',
    name: 'Staff Esportivo',
    icon: '👔',
    cost: 400000,
    dailyYield: 0,
    durationDays: 14,
    strategicBonusType: 'training_speed',
    strategicBonusValue: 20,
    description: 'Contratar staff adicional. Aumenta velocidade de treinamento em 20%.'
  },
  {
    id: 'scout_network',
    name: 'Rede de Scouts',
    icon: '🔍',
    cost: 250000,
    dailyYield: 0,
    durationDays: 21,
    strategicBonusType: 'player_discovery',
    strategicBonusValue: 25,
    description: 'Melhor rede de songadores. Aumenta qualidade de descobertas de jogadores em 25%.'
  },
  {
    id: 'infraestrutura',
    name: 'Infraestrutura',
    icon: '🏟️',
    cost: 500000,
    dailyYield: 0,
    durationDays: 30,
    strategicBonusType: 'match_earnings',
    strategicBonusValue: 30,
    description: 'Melhorias na infraestrutura do estadio. Aumenta receita por jogo em 30%.'
  }
];

export function InvestirView({ gameState, userId, onViewChange, onMoneyUpdate }: InvestirViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [investing, setInvesting] = useState<string | null>(null);

  const handleInvest = async (investment: InvestmentType) => {
    if (gameState.user.money < investment.cost) {
      alert('Saldo insuficiente!');
      return;
    }

    setInvesting(investment.id);

    try {
      const response = await fetch('/api/investment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option: investment.id === 'clube_torcedores' ? 'A' : 
                 investment.id === 'marketing_digital' ? 'B' : 'C',
          userId
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`Investimento "${investment.name}" realizado!`);
        if (data.newBalance !== undefined) {
          onMoneyUpdate(data.newBalance);
        }
      } else {
        alert(data.error || 'Erro ao investir');
      }
    } catch (error) {
      console.error('Investment error:', error);
      alert('Erro ao realizar investimento');
    } finally {
      setInvesting(null);
    }
  };

  const activeInvestments: any[] = [];

  return (
    <ViewContainer className="pb-24">
      <GlassCard glow className="p-4 space-y-3">
        <h2 className="font-[family-name:var(--font-pixel)] text-[0.7rem] gold-glow-text">
          💰 INVESTIMENTOS
        </h2>
        <p className="text-[0.5rem] text-[#55e0a0]/70 font-[family-name:var(--font-pixel)]">
          Invista no seu clube para ganhar vantagens estratégicas
        </p>
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="section-title">Seu Saldo</div>
            <CoinDisplay amount={gameState.user.money} size="md" />
          </div>
          <div className="text-right">
            <div className="section-title">Investimentos Ativos</div>
            <span className="font-[family-name:var(--font-pixel)] text-[0.6rem] text-[#FFDF00]">
              {activeInvestments.length}
            </span>
          </div>
        </div>
      </GlassCard>

      {activeInvestments.length > 0 && (
        <GlassCard className="p-3 space-y-2">
          <p className="font-[family-name:var(--font-pixel)] text-[0.6rem] text-[#00A859]">
            Seus Investimentos Ativos
          </p>
          <div className="space-y-2">
            {activeInvestments.map((inv, i) => (
              <div key={i} className="frosted-card p-3 flex justify-between items-center">
                <div>
                  <p className="font-[family-name:var(--font-pixel)] text-[0.55rem] text-[#FFDF00]">
                    {inv.name}
                  </p>
                  <p className="text-xs text-[#55e0a0]/60 font-[family-name:var(--font-pixel)]">
                    {inv.daysRemaining} dias restantes
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[0.5rem] text-[#00A859] font-[family-name:var(--font-pixel)]">
                    +{formatMoney(inv.dailyYield)}/dia
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="space-y-2">
        <SectionTitle>Opções de Investimento</SectionTitle>

        {INVESTMENT_TYPES.map(investment => {
          const canAfford = gameState.user.money >= investment.cost;
          const isExpanded = expandedId === investment.id;

          return (
            <GlassCard
              key={investment.id}
              className="overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : investment.id)}
                className="w-full p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{investment.icon}</span>
                  <div>
                    <p className="font-[family-name:var(--font-pixel)] text-[0.55rem] gold-glow-text">
                      {investment.name}
                    </p>
                    <CoinDisplay amount={investment.cost} size="sm" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-[family-name:var(--font-pixel)] text-[0.5rem] text-[#00A859]">
                    +{investment.strategicBonusValue}%
                  </p>
                  <p className="text-[0.5rem] text-[#55e0a0]/50 font-[family-name:var(--font-pixel)]">
                    {investment.durationDays} dias
                  </p>
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 border-t border-[#55e0a0]/20">
                  <p className="text-[0.5rem] text-[#55e0a0]/70 font-[family-name:var(--font-pixel)] mt-3">
                    {investment.description}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="frosted-card p-2">
                      <p className="text-[0.5rem] text-[#55e0a0]/60 font-[family-name:var(--font-pixel)]">
                        Rendimento Diário
                      </p>
                      <p className="text-[0.5rem] text-[#00A859] font-[family-name:var(--font-pixel)]">
                        {investment.dailyYield > 0 ? formatMoney(investment.dailyYield) + '/dia' : 'N/A'}
                      </p>
                    </div>
                    <div className="frosted-card p-2">
                      <p className="text-[0.5rem] text-[#55e0a0]/60 font-[family-name:var(--font-pixel)]">
                        Bônus Estratégico
                      </p>
                      <p className="text-[0.5rem] text-[#FFDF00] font-[family-name:var(--font-pixel)]">
                        +{investment.strategicBonusValue}% {investment.strategicBonusType}
                      </p>
                    </div>
                  </div>

                  <CrtButton
                    onClick={() => handleInvest(investment)}
                    disabled={!canAfford || investing === investment.id}
                    variant={canAfford ? 'primary' : 'outline'}
                    className="w-full mt-3 py-2 text-[0.55rem]"
                  >
                    {investing === investment.id
                      ? 'Investindo...'
                      : !canAfford
                        ? 'Saldo Insuficiente'
                        : `Investir ${formatMoney(investment.cost)}`}
                  </CrtButton>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </ViewContainer>
  );
}
