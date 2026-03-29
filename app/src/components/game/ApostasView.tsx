'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GameState } from '@/lib/types';
import { formatMoney } from '@/lib/economy';

interface ApostasViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: string) => void;
}

type PredictionType = 'resultado' | 'intervalo_final' | 'total_gols' | 'ambos_marcam' | 'primeiro_gol' | 'escantios' | 'cartoes' | 'placar_exato';

interface PredictionOption {
  id: string;
  label: string;
  odds: number;
}

interface MatchPrediction {
  type: PredictionType;
  label: string;
  options: PredictionOption[];
}

export function ApostasView({ gameState, userId, onViewChange }: ApostasViewProps) {
  const nextMatch = gameState.season.nextMatch;
  const [selectedBets, setSelectedBets] = useState<Map<string, { type: string; optionId: string; amount: number }>>(new Map());
  const [betAmount, setBetAmount] = useState(50000);

  // Rotating prediction types - select 3-4 randomly
  const allPredictionTypes: PredictionType[] = [
    'resultado', 'intervalo_final', 'total_gols', 'ambos_marcam', 
    'primeiro_gol', 'escantios', 'cartoes', 'placar_exato'
  ];

  const predictionLabels: Record<PredictionType, string> = {
    resultado: 'Resultado Final',
    intervalo_final: 'Intervalo/Final',
    total_gols: 'Total de Gols',
    ambos_marcam: 'Ambos Marcam',
    primeiro_gol: 'Primeiro Gol',
    escantios: 'Escantios Over/Under',
    cartoes: 'Cartões Over/Under',
    placar_exato: 'Placar Exato'
  };

  // For MVP, use a simple selection of 4 popular prediction types
  const activePredictions: MatchPrediction[] = [
    {
      type: 'resultado',
      label: 'Resultado Final',
      options: [
        { id: 'home_win', label: 'Vitória', odds: 1.8 },
        { id: 'draw', label: 'Empate', odds: 3.2 },
        { id: 'away_win', label: 'Derrota', odds: 2.5 }
      ]
    },
    {
      type: 'total_gols',
      label: 'Total de Gols',
      options: [
        { id: 'over_2.5', label: 'Over 2.5', odds: 1.7 },
        { id: 'under_2.5', label: 'Under 2.5', odds: 2.1 }
      ]
    },
    {
      type: 'ambos_marcam',
      label: 'Ambos Marcam',
      options: [
        { id: 'yes', label: 'Sim', odds: 1.6 },
        { id: 'no', label: 'Não', odds: 2.4 }
      ]
    },
    {
      type: 'placar_exato',
      label: 'Placar Exato',
      options: [
        { id: '1-0', label: '1-0', odds: 8.0 },
        { id: '2-0', label: '2-0', odds: 10.0 },
        { id: '2-1', label: '2-1', odds: 12.0 },
        { id: '3-0', label: '3-0', odds: 15.0 }
      ]
    }
  ];

  const handleSelectBet = (type: string, optionId: string, odds: number) => {
    setSelectedBets(prev => {
      const newMap = new Map(prev);
      if (newMap.has(type)) {
        newMap.delete(type);
      } else {
        newMap.set(type, { type, optionId, amount: betAmount });
      }
      return newMap;
    });
  };

  const handlePlaceBet = async () => {
    if (selectedBets.size === 0) return;
    
    for (const [, bet] of selectedBets) {
      try {
        const response = await fetch('/api/predictions/bet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            predictionId: `match-${gameState.season.week}`,
            optionId: bet.optionId,
            amount: bet.amount,
            userId
          }),
        });
        
        const data = await response.json();
        if (!response.ok) {
          alert(data.error || 'Erro ao fazer aposta');
        }
      } catch (error) {
        console.error('Bet error:', error);
      }
    }
    
    alert(`Apostas realizadas com sucesso! ${selectedBets.size} apostas.`);
    setSelectedBets(new Map());
  };

  const totalPotentialWin = Array.from(selectedBets.values()).reduce((sum, bet) => sum + bet.amount * 1.8, 0);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-xl">📊 Apostas</h2>
            <p className="text-white/70 text-sm">Aposte nos próximos jogos</p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-xs">Seu Saldo</p>
            <p className="text-yellow-400 font-bold text-xl">{formatMoney(gameState.user.money)}</p>
          </div>
        </div>
      </motion.div>

      {/* Next Match Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/10 rounded-xl p-4 border border-white/20"
      >
        <p className="text-white/50 text-xs uppercase">Próxima Partida - Rodada {gameState.season.week}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="text-center flex-1">
            <p className="text-white font-bold">{gameState.user.team}</p>
            <p className="text-green-400 text-xs">Casa</p>
          </div>
          <div className="px-4">
            <p className="text-white/30 text-2xl">VS</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-white font-bold">{nextMatch.opponent}</p>
            <p className="text-red-400 text-xs">{nextMatch.isHome ? 'Fora' : 'Casa'}</p>
          </div>
        </div>
        <p className="text-white/50 text-xs text-center mt-2">{nextMatch.competition}</p>
      </motion.div>

      {/* Bet Amount Slider */}
      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/70 text-sm">Valor da Aposta</span>
          <span className="text-yellow-400 font-bold">{formatMoney(betAmount)}</span>
        </div>
        <input
          type="range"
          min={10000}
          max={Math.min(200000, gameState.user.money)}
          step={10000}
          value={betAmount}
          onChange={e => setBetAmount(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Available Predictions */}
      <div className="space-y-3">
        <h3 className="text-white font-bold px-2">Mercados Disponíveis</h3>
        
        {activePredictions.map(pred => (
          <div key={pred.type} className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-white font-bold mb-3">{pred.label}</p>
            <div className="grid grid-cols-3 gap-2">
              {pred.options.map(opt => {
                const isSelected = selectedBets.has(pred.type);
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectBet(pred.type, opt.id, opt.odds)}
                    className={`p-3 rounded-lg text-center transition-colors ${
                      isSelected 
                        ? 'bg-yellow-600/30 border-2 border-yellow-500' 
                        : 'bg-white/10 border border-white/20 hover:bg-white/20'
                    }`}
                  >
                    <p className="text-white text-xs">{opt.label}</p>
                    <p className="text-yellow-400 font-bold">{opt.odds}x</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bet Slip - Fixed at Bottom */}
      {selectedBets.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 bg-[#012169] p-4 border-t-2 border-[#FEDD00]/50 z-[90]">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm">{selectedBets.size} aposta(s) selecionada(s)</p>
              <p className="text-yellow-400 font-bold">Retorno: {formatMoney(totalPotentialWin)}</p>
            </div>
            <button
              onClick={handlePlaceBet}
              className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 rounded-lg font-bold"
            >
              APOSTAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}