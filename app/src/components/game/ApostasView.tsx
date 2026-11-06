'use client';

import { useCallback, useEffect, useState } from 'react';
import { GameState, Prediction, PredictionOption } from '@/lib/types';
import { formatMoney } from '@/lib/economy';
import { GlassCard, CrtButton, CoinDisplay, SectionTitle, ViewContainer, ActionNotice } from '@/components/crt';
import { useGuardedAction } from '@/hooks/useGuardedAction';

interface ApostasViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: string) => void;
  /** Reloads the save from the server. Called after the bets are placed. */
  onRefreshSave?: () => void | Promise<void>;
}

/** The market labels the screen shows, by the type the server stores. */
const MARKET_LABELS: Record<string, string> = {
  win_draw_loss: 'Resultado Final',
  first_scorer: 'Primeiro Gol',
  clean_sheet: 'Não Sofre Gol',
  score_range: 'Faixa de Placar',
};

/** A bet as the board read returns it (see GET /api/predictions). */
type PlacedBet = {
  id: string;
  homeTeam: string | null;
  awayTeam: string | null;
  optionLabel: string;
  amount: number;
  potentialWin: number;
  status: 'open' | 'in_play' | 'under_review' | 'won' | 'lost';
  payout: number | null;
  score: { homeScore: number; awayScore: number } | null;
};

const BET_STATUS_LABELS: Record<PlacedBet['status'], string> = {
  open: 'Aberta',
  in_play: 'Bola rolando',
  under_review: 'Em análise',
  won: 'Ganhou',
  lost: 'Perdeu',
};

/** One market selection: which prediction, which option, for how much. */
type Selection = { predictionId: string; optionId: string; amount: number };

export function ApostasView({ gameState, userId, onViewChange, onRefreshSave }: ApostasViewProps) {
  const nextMatch = gameState.season.nextMatch;
  const action = useGuardedAction(onRefreshSave);
  const [selectedBets, setSelectedBets] = useState<Map<string, Selection>>(new Map());
  const [betAmount, setBetAmount] = useState(50000);

  // The markets really open, from the server.
  //
  // They used to be a hardcoded list here, with ids made up on the spot
  // ('resultado', 'home_win') and the prediction identified as
  // `match-${week}`. `predictions.id` is a uuid column, so every bet the
  // screen sent was refused — the route answered 400 before it ever looked
  // at the market. Nothing can be bet on that the server does not know
  // about, so the list comes from the server.
  const [markets, setMarkets] = useState<Prediction[] | null>(null);
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadMarkets = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/predictions?status=open&userId=${encodeURIComponent(userId)}`
      );
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { predictions?: Prediction[]; bets?: PlacedBet[] };
      setMarkets(data.predictions ?? []);
      setPlacedBets(data.bets ?? []);
      setLoadFailed(false);
    } catch {
      setMarkets([]);
      setLoadFailed(true);
    }
  }, [userId]);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  // Keyed on the prediction, so a player backs at most one option per
  // market — which is also the only way the server will take them.
  const handleSelectBet = (predictionId: string, optionId: string) => {
    setSelectedBets(prev => {
      const newMap = new Map(prev);
      if (newMap.get(predictionId)?.optionId === optionId) {
        newMap.delete(predictionId);
      } else {
        newMap.set(predictionId, { predictionId, optionId, amount: betAmount });
      }
      return newMap;
    });
  };

  // Used to announce success whatever the route answered, and never reload
  // the balance it had just spent. Each bet's reply is read; the first one
  // refused stops the run and is shown, with the balance reloaded, and the
  // selection is only cleared once every bet was accepted.
  const handlePlaceBet = async () => {
    if (selectedBets.size === 0) return;

    const bets = Array.from(selectedBets.values());
    let placed = 0;
    for (const bet of bets) {
      const ok = await action.run<{ newBalance?: number }>(
        () =>
          fetch('/api/predictions/bet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              predictionId: bet.predictionId,
              optionId: bet.optionId,
              amount: bet.amount,
              userId,
            }),
          }),
        {
          successMessage: () =>
            placed + 1 === bets.length
              ? `${bets.length} ${bets.length === 1 ? 'aposta realizada' : 'apostas realizadas'}.`
              : null,
        }
      );
      if (!ok) break;
      placed += 1;
    }

    if (placed === bets.length) {
      setSelectedBets(new Map());
    }
    // The odds move with every bet taken, so the board is reread either way.
    await loadMarkets();
  };

  /** Odds of the option backed in `selection`, or 1 if it has gone away. */
  const oddsOf = (selection: Selection): number => {
    const market = markets?.find(m => m.id === selection.predictionId);
    const option = (market?.options as PredictionOption[] | undefined)?.find(
      o => o.id === selection.optionId
    );
    return option?.odds ?? 1;
  };

  const totalPotentialWin = Array.from(selectedBets.values()).reduce(
    (sum, bet) => sum + bet.amount * oddsOf(bet),
    0
  );

  return (
    <ViewContainer className="pb-24">
      <ActionNotice notice={action.notice} onDismiss={action.dismiss} pending={action.pending} />
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
          {/* Home on the left, as the market lists it. The player's team used
              to be labelled Casa whatever the fixture, so an away game showed
              both sides at home. */}
          <div className="text-center flex-1">
            <p className="text-white font-bold font-[family-name:var(--font-pixel)]">
              {nextMatch.isHome ? gameState.user.team : nextMatch.opponent}
            </p>
            <p className="text-[#00A859] text-xs font-[family-name:var(--font-pixel)]">Casa</p>
          </div>
          <div className="px-4">
            <p className="text-white/30 text-2xl font-[family-name:var(--font-pixel)]">VS</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-white font-bold font-[family-name:var(--font-pixel)]">
              {nextMatch.isHome ? nextMatch.opponent : gameState.user.team}
            </p>
            <p className="text-[#FF3333] text-xs font-[family-name:var(--font-pixel)]">Fora</p>
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

      {markets === null && (
        <GlassCard className="p-4">
          <p className="text-white/50 text-sm text-center font-[family-name:var(--font-pixel)]">
            Carregando mercados...
          </p>
        </GlassCard>
      )}

      {markets !== null && markets.length === 0 && (
        <GlassCard className="p-4">
          <p className="text-white/50 text-sm text-center font-[family-name:var(--font-pixel)]">
            {loadFailed
              ? 'Não foi possível carregar os mercados. Tente novamente mais tarde.'
              : 'Nenhum mercado aberto no momento.'}
          </p>
        </GlassCard>
      )}

      {(markets ?? []).map(market => (
        <GlassCard key={market.id} className="p-4">
          <p className="text-[#FFDF00] font-bold mb-1 font-[family-name:var(--font-pixel)]">
            {MARKET_LABELS[market.type] ?? market.type}
          </p>
          <p className="text-white/40 text-[0.6rem] mb-3 font-[family-name:var(--font-pixel)]">
            {market.homeTeam} vs {market.awayTeam}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(market.options as PredictionOption[]).map(opt => {
              const isSelected = selectedBets.get(market.id)?.optionId === opt.id;
              return (
                <CrtButton
                  key={opt.id}
                  onClick={() => handleSelectBet(market.id, opt.id)}
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

      <SectionTitle>Minhas Apostas</SectionTitle>
      {placedBets.length === 0 ? (
        <GlassCard className="p-4">
          <p className="text-white/50 text-sm text-center font-[family-name:var(--font-pixel)]">
            Nenhuma aposta ainda.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="p-4">
          {(['open', 'settled'] as const).map(group => {
            const list = placedBets.filter(b =>
              group === 'open' ? b.status === 'open' || b.status === 'in_play' || b.status === 'under_review' : b.status === 'won' || b.status === 'lost'
            );
            if (list.length === 0) return null;
            return (
              <div key={group} className="mb-3 last:mb-0">
                <p className="text-white/50 text-xs uppercase mb-2 font-[family-name:var(--font-pixel)]">
                  {group === 'open' ? 'Em aberto' : 'Liquidadas'}
                </p>
                <ul className="space-y-2">
                  {list.map(bet => (
                    <li
                      key={bet.id}
                      data-bet-status={bet.status}
                      className="flex items-center justify-between gap-2 text-xs font-[family-name:var(--font-pixel)]"
                    >
                      <div className="min-w-0">
                        <p className="text-white truncate">
                          {bet.homeTeam} {bet.score ? `${bet.score.homeScore} x ${bet.score.awayScore}` : 'vs'} {bet.awayTeam}
                        </p>
                        <p className="text-white/50">
                          {bet.optionLabel} · {formatMoney(bet.amount)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={bet.status === 'won' ? 'text-[#55e0a0]' : bet.status === 'lost' ? 'text-[#FF3333]' : 'text-[#FFDF00]'}>
                          {BET_STATUS_LABELS[bet.status]}
                        </p>
                        <p className="text-white/70">
                          {bet.payout === null
                            ? `Retorno ${formatMoney(bet.potentialWin)}`
                            : `Pagou ${formatMoney(bet.payout)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </GlassCard>
      )}

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
