'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/economy';
import type { Prediction, PredictionHistory } from '@/lib/types';
import { PREDICTION_MARKET } from '@/lib/constants';

interface PredictionDetailModalProps {
  prediction: Prediction;
  userHistory?: PredictionHistory;
  userBalance: number;
  onPlaceBet: (optionId: string, amount: number) => Promise<void>;
  onClose: () => void;
}

export function PredictionDetailModal({
  prediction,
  userHistory,
  userBalance,
  onPlaceBet,
  onClose,
}: PredictionDetailModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(PREDICTION_MARKET.ENTRY_COSTS.win_draw_loss);
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  const expertLevel = userHistory?.expertLevel || 0;
  const currentStreak = userHistory?.currentStreak || 0;
  const discount = expertLevel * PREDICTION_MARKET.EXPERT_DISCOUNT_PER_LEVEL;
  const discountedAmount = Math.round(betAmount * (1 - discount));

  const selectedOptionData = prediction.options.find(o => o.id === selectedOption);
  const potentialWin = selectedOptionData 
    ? Math.round(discountedAmount * selectedOptionData.odds)
    : 0;

  const handlePlaceBet = async () => {
    if (!selectedOption) return;
    
    setIsPlacingBet(true);
    try {
      await onPlaceBet(selectedOption, betAmount);
    } catch (error) {
      console.error('Error placing bet:', error);
    } finally {
      setIsPlacingBet(false);
    }
  };

  const deadline = new Date(prediction.deadline);
  const timeRemaining = deadline.getTime() - Date.now();
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / 3600000));
  const minutesRemaining = Math.max(0, Math.floor((timeRemaining % 3600000) / 60000));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-white font-bold text-lg">Mercado de Previsões</h2>
              <p className="text-white/60 text-sm">
                {prediction.homeTeam} vs {prediction.awayTeam}
              </p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white">
              ✕
            </button>
          </div>
          
          <div className="mt-3 flex items-center gap-2">
            <span className="text-orange-400">⏱️</span>
            <span className="text-white/70 text-sm">
              Expira em {hoursRemaining}h {minutesRemaining}m
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {userHistory && (
            <div className="bg-white/5 rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="text-white/60 text-xs">Nível Especialistas</p>
                <p className="text-yellow-400 font-bold">⭐ {expertLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-xs">Sequência Atual</p>
                <p className="text-orange-400 font-bold">🔥 {currentStreak}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs">Desconto</p>
                <p className="text-green-400 font-bold">{Math.round(discount * 100)}%</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-white font-medium mb-3">Selecione seu palpite:</h3>
            <div className="space-y-2">
              {prediction.options.map(option => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-colors flex justify-between items-center ${
                    selectedOption === option.id
                      ? 'border-yellow-400 bg-yellow-400/10'
                      : 'border-white/10 bg-white/5 hover:border-white/30'
                  }`}
                >
                  <div>
                    <p className="text-white font-medium">{option.label}</p>
                    <p className="text-white/50 text-xs">
                      {option.totalBets > 0 
                        ? `${formatMoney(option.totalBets)} apostados` 
                        : 'Sem apostas ainda'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold text-xl">{option.odds.toFixed(2)}x</p>
                    <p className="text-white/50 text-xs">odd</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedOption && (
            <div className="bg-white/5 rounded-lg p-4 space-y-4">
              <div>
                <label className="text-white/70 text-sm">Valor da Aposta:</label>
                <input
                  type="range"
                  min={PREDICTION_MARKET.MIN_BET_AMOUNT}
                  max={Math.min(PREDICTION_MARKET.MAX_BET_AMOUNT, userBalance)}
                  step={10000}
                  value={betAmount}
                  onChange={e => setBetAmount(Number(e.target.value))}
                  className="w-full mt-2"
                />
                <div className="flex justify-between text-white/50 text-sm mt-1">
                  <span>{formatMoney(PREDICTION_MARKET.MIN_BET_AMOUNT)}</span>
                  <span className="text-white font-medium">{formatMoney(betAmount)}</span>
                </div>
                {discount > 0 && (
                  <p className="text-green-400 text-xs mt-1">
                    Com desconto (-{Math.round(discount * 100)}%): {formatMoney(discountedAmount)}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <div>
                  <p className="text-white/50 text-xs">Possível Retorno</p>
                  <p className="text-green-400 font-bold text-xl">{formatMoney(potentialWin)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/50 text-xs">Seu Saldo</p>
                  <p className="text-white font-medium">{formatMoney(userBalance)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handlePlaceBet}
            disabled={!selectedOption || betAmount > userBalance || isPlacingBet}
            className={`w-full py-3 rounded-lg font-bold transition-colors ${
              selectedOption && betAmount <= userBalance && !isPlacingBet
                ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                : 'bg-white/10 text-white/50 cursor-not-allowed'
            }`}
          >
            {isPlacingBet 
              ? '-processando...' 
              : betAmount > userBalance 
                ? 'Saldo Insuficiente'
                : selectedOption 
                  ? `Apostar ${formatMoney(discountedAmount)}` 
                  : 'Selecione um Palpite'}
          </button>
        </div>
      </div>
    </div>
  );
}