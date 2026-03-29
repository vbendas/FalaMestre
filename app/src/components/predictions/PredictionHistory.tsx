'use client';

import { formatMoney } from '@/lib/economy';
import type { UserBet, Prediction } from '@/lib/types';
import { getExpertLevelName } from '@/lib/prediction-engine';

interface PredictionHistoryProps {
  bets: UserBet[];
  predictions: Prediction[];
}

export function PredictionHistory({ bets, predictions }: PredictionHistoryProps) {
  const sortedBets = [...bets].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 20);

  if (sortedBets.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
        <h3 className="text-white font-bold mb-3">Histórico de Apostas</h3>
        <p className="text-white/60 text-sm">Você ainda não fez nenhuma aposta.</p>
        <p className="text-white/40 text-xs mt-2">Teste suas previsões no Mercado de Previsões!</p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
      <h3 className="text-white font-bold mb-3">Histórico de Apostas</h3>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sortedBets.map(bet => {
          const prediction = predictions.find(p => p.id === bet.predictionId);
          const option = prediction?.options.find(o => o.id === bet.optionId);
          
          return (
            <div
              key={bet.id}
              className={`p-3 rounded-lg border ${
                bet.settled 
                  ? bet.won 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white text-sm font-medium">
                    {prediction?.homeTeam} vs {prediction?.awayTeam}
                  </p>
                  <p className="text-white/50 text-xs">
                    Palpite: {option?.label || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  {bet.settled ? (
                    <p className={`font-bold ${bet.won ? 'text-green-400' : 'text-red-400'}`}>
                      {bet.won ? `+${formatMoney(bet.potentialWin)}` : `-${formatMoney(bet.amount)}`}
                    </p>
                  ) : (
                    <p className="text-yellow-400 text-sm">Pendente</p>
                  )}
                  <p className="text-white/40 text-xs">
                    {new Date(bet.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface UserStatsProps {
  history: {
    totalBets: number;
    correctBets: number;
    currentStreak: number;
    bestStreak: number;
    expertLevel: number;
    totalWinnings: number;
  };
}

export function UserPredictionStats({ history }: UserStatsProps) {
  const winRate = history.totalBets > 0 
    ? Math.round((history.correctBets / history.totalBets) * 100) 
    : 0;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
      <h3 className="text-white font-bold mb-3">Suas Estatísticas</h3>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/50 text-xs">Total Apostas</p>
          <p className="text-white font-bold text-xl">{history.totalBets}</p>
        </div>
        
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/50 text-xs">Taxa de Acerto</p>
          <p className="text-yellow-400 font-bold text-xl">{winRate}%</p>
        </div>
        
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/50 text-xs">Melhor Sequência</p>
          <p className="text-orange-400 font-bold text-xl">🔥 {history.bestStreak}</p>
        </div>
        
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-white/50 text-xs">Total Ganho</p>
          <p className="text-green-400 font-bold text-xl">{formatMoney(history.totalWinnings)}</p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg">
        <div className="flex items-center justify-center gap-2">
          <span className="text-yellow-400">⭐</span>
          <p className="text-white font-medium">
            Nível: {getExpertLevelName(history.expertLevel)}
          </p>
        </div>
        <p className="text-white/60 text-xs text-center mt-1">
          {history.expertLevel < 5 
            ? `${5 - history.expertLevel} níveis para alcançar o próximo nível` 
            : 'Você atingiu o nível máximo!'}
        </p>
      </div>
    </div>
  );
}