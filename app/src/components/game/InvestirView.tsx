'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { GameState } from '@/lib/types';
import { formatMoney } from '@/lib/economy';

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

  // Active investments (mock for now - in real app would come from DB)
  const activeInvestments: any[] = [];

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <h2 className="text-white font-bold text-xl">💰 Investimentos</h2>
        <p className="text-white/70 text-sm">Invista no seu clube para ganhar vantagens estratégicas</p>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-white/50 text-xs">Seu Saldo</p>
            <p className="text-yellow-400 font-bold text-xl">{formatMoney(gameState.user.money)}</p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-xs">Investimentos Ativos</p>
            <p className="text-white font-bold text-xl">{activeInvestments.length}</p>
          </div>
        </div>
      </motion.div>

      {/* Active Investments */}
      {activeInvestments.length > 0 && (
        <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/30">
          <p className="text-green-400 font-bold mb-3">Seus Investimentos Ativos</p>
          <div className="space-y-2">
            {activeInvestments.map((inv, i) => (
              <div key={i} className="bg-white/10 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <p className="text-white font-bold">{inv.name}</p>
                  <p className="text-white/50 text-xs">{inv.daysRemaining} dias restantes</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400">+{formatMoney(inv.dailyYield)}/dia</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Investments */}
      <div className="space-y-3">
        <h3 className="text-white font-bold px-2">Opções de Investimento</h3>
        
        {INVESTMENT_TYPES.map(investment => (
          <div key={investment.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === investment.id ? null : investment.id)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{investment.icon}</span>
                <div>
                  <p className="text-white font-bold">{investment.name}</p>
                  <p className="text-white/50 text-xs">Custo: {formatMoney(investment.cost)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-bold text-sm">
                  +{investment.strategicBonusValue}%
                </p>
                <p className="text-white/30 text-xs">{investment.durationDays} dias</p>
              </div>
            </button>

            {/* Expanded Details */}
            {expandedId === investment.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="px-4 pb-4 border-t border-white/10"
              >
                <p className="text-white/70 text-sm mt-3">{investment.description}</p>
                
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/10 rounded p-2">
                    <p className="text-white/50">Rendimento Diário</p>
                    <p className="text-green-400">{investment.dailyYield > 0 ? formatMoney(investment.dailyYield) + '/dia' : 'N/A'}</p>
                  </div>
                  <div className="bg-white/10 rounded p-2">
                    <p className="text-white/50">Bônus Estratégico</p>
                    <p className="text-yellow-400">+{investment.strategicBonusValue}% {investment.strategicBonusType}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleInvest(investment)}
                  disabled={gameState.user.money < investment.cost || investing === investment.id}
                  className={`w-full mt-3 py-3 rounded-lg font-bold transition-colors ${
                    gameState.user.money >= investment.cost
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                      : 'bg-white/20 text-white/50 cursor-not-allowed'
                  }`}
                >
                  {investing === investment.id 
                    ? 'Investindo...' 
                    : gameState.user.money < investment.cost 
                      ? 'Saldo Insuficiente' 
                      : `Investir ${formatMoney(investment.cost)}`}
                </button>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}