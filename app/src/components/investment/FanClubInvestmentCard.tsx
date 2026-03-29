'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/economy';
import type { FanClubInvestment, InvestmentYield } from '@/lib/types';
import { INVESTMENT_TIERS } from '@/lib/constants';

interface FanClubInvestmentCardProps {
  userBalance: number;
  activeInvestments: FanClubInvestment[];
  pendingYields: InvestmentYield[];
  onInvest: (option: 'A' | 'B' | 'C') => Promise<void>;
  onClaimYields: () => Promise<void>;
}

export function FanClubInvestmentCard({
  userBalance,
  activeInvestments,
  pendingYields,
  onInvest,
  onClaimYields,
}: FanClubInvestmentCardProps) {
  const totalYieldAvailable = pendingYields.reduce((sum, y) => sum + y.amount, 0);
  const totalMoraleBoost = activeInvestments.reduce((sum, i) => sum + i.moraleBoost, 0);
  const totalRevenueBoost = activeInvestments.reduce((sum, i) => sum + i.revenueBoostPerMatch, 0);

  const [investingOption, setInvestingOption] = useState<string | null>(null);

  const handleInvest = async (option: 'A' | 'B' | 'C') => {
    setInvestingOption(option);
    try {
      await onInvest(option);
    } finally {
      setInvestingOption(null);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💰</span>
        <h3 className="text-white font-bold">Investimento no Clube de Torcedores</h3>
      </div>

      {totalYieldAvailable > 0 && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-white/70 text-sm">Yields Pendentes</p>
              <p className="text-green-400 font-bold text-xl">{formatMoney(totalYieldAvailable)}</p>
            </div>
            <button
              onClick={onClaimYields}
              className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-lg font-bold text-sm"
            >
              Receber Tudo
            </button>
          </div>
        </div>
      )}

      {(totalMoraleBoost > 0 || totalRevenueBoost > 0) && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
          <p className="text-white/70 text-sm mb-2">Seus Bônus Ativos:</p>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-white/50">Moral do Time</p>
              <p className="text-yellow-400 font-bold">+{totalMoraleBoost}%</p>
            </div>
            <div>
              <p className="text-white/50">Receita/Jogo</p>
              <p className="text-green-400 font-bold">+{formatMoney(totalRevenueBoost)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-white/70 text-sm">Escolha seu investimento:</p>
        
        {(['A', 'B', 'C'] as const).map(option => {
          const tier = INVESTMENT_TIERS[option];
          const isAffordable = userBalance >= tier.amount;
          const isInvesting = investingOption === option;
          
          return (
            <button
              key={option}
              onClick={() => isAffordable && handleInvest(option)}
              disabled={!isAffordable || isInvesting}
              className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                isAffordable 
                  ? 'border-yellow-400/50 hover:border-yellow-400 bg-yellow-400/5' 
                  : 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-yellow-400 font-bold text-lg">Opção {option}</p>
                  <p className="text-white font-medium">{formatMoney(tier.amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/50 text-xs">{tier.lockPeriodDays} dias</p>
                  <p className="text-green-400 font-bold">+{formatMoney(tier.yieldPerDay)}/dia</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <div className="bg-white/5 rounded p-2">
                  <p className="text-white/50 text-xs">Bônus Moral</p>
                  <p className="text-yellow-400">+{tier.moraleBoost}%</p>
                </div>
                <div className="bg-white/5 rounded p-2">
                  <p className="text-white/50 text-xs">Receita/Jogo</p>
                  <p className="text-green-400">+{formatMoney(tier.revenueBoostPerMatch)}</p>
                </div>
              </div>
              
              {!isAffordable && (
                <p className="text-red-400 text-xs mt-2">Saldo insuficiente</p>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-white/40 text-xs mt-4 text-center">
        Os yields expiram em 7 dias se não forem recebidos!
      </p>
    </div>
  );
}