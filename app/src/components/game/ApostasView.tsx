'use client';

import { useState } from 'react';
import { GameState } from '@/lib/types';
import { formatMoney } from '@/lib/economy';
import { GlassCard, CrtButton, CoinDisplay, SectionTitle, ViewContainer } from '@/components/crt';

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
    <ViewContainer className="pb-24">
      <GlassCard glow className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#FFDF00] font-bold text-lg font-[family-name:var(--font-pixel)]">📊 Apostas</h2>
            <p className="text-[#55e0a0] text-xs font-[family-name:var(--font-pixel)]">Aposte nos próximos jogos</p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-xs font-[family-name:var(--font-pixel)]">Seu Saldo</p>
            <CoinDisplay amount={gameState.user.money} size="lg" />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <p className="text-white/50 text-xs uppercase font-[family-name:var(--font-pixel)]">
          Próxima Partida - Rodada {gameState.season.week}
        </p>
        <div className="flex items-center justify-between mt-2">
          <div className="text-center flex-1">
            <p className="text-white font-bold font-[family-name:var(--font-pixel)]">{gameState.user.team}</p>
            <p className="text-[#00A859] text-xs font-[family-name:var(--font-pixel)]">Casa</p>
          </div>
          <div className="px-4">
            <p className="text-white/30 text-2xl font-[family-name:var(--font-pixel)]">VS</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-white font-bold font-[family-name:var(--font-pixel)]">{nextMatch.opponent}</p>
            <p className="text-[#FF3333] text-xs font-[family-name:var(--font-pixel)]">{nextMatch.isHome ? 'Fora' : 'Casa'}</p>
          </div>
        </div>
        <p className="text-white/50 text-xs text-center mt-2 font-[family-name:var(--font-pixel)]">{nextMatch.competition}</p>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/70 text-sm font-[family-name:var(--font-pixel)]">Valor da Aposta</span>
          <CoinDisplay amount={betAmount} size="md" />
        </div>
        <input
          type="range"
          min={10000}
          max={Math.min(200000, gameState.user.money)}
          step={10000}
          value={betAmount}
          onChange={e => setBetAmount(Number(e.target.value))}
          className="w-full accent-[#FFDF00]"
        />
      </GlassCard>

      <SectionTitle>Mercados Disponíveis</SectionTitle>

      {activePredictions.map(pred => (
        <GlassCard key={pred.type} className="p-4">
          <p className="text-[#FFDF00] font-bold mb-3 font-[family-name:var(--font-pixel)]">{pred.label}</p>
          <div className="grid grid-cols-3 gap-2">
            {pred.options.map(opt => {
              const isSelected = selectedBets.has(pred.type);
              return (
                <CrtButton
                  key={opt.id}
                  onClick={() => handleSelectBet(pred.type, opt.id, opt.odds)}
                  variant={isSelected ? 'control-active' : 'control'}
                  className="flex flex-col items-center gap-1 p-2"
                >
                  <span className="text-xs">{opt.label}</span>
                  <span className="text-[#FFDF00] font-bold text-xs">{opt.odds}x</span>
                </CrtButton>
              );
            })}
          </div>
        </GlassCard>
      ))}

      {selectedBets.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 bg-[#00381a]/95 p-4 border-t-2 border-[#FFDF00]/50 z-[90]">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm font-[family-name:var(--font-pixel)]">
                {selectedBets.size} aposta(s) selecionada(s)
              </p>
              <p className="gold-glow-text font-bold font-[family-name:var(--font-pixel)]">
                Retorno: {formatMoney(totalPotentialWin)}
              </p>
            </div>
            <CrtButton onClick={handlePlaceBet} pulse>
              APOSTAR
            </CrtButton>
          </div>
        </div>
      )}
    </ViewContainer>
  );
}
