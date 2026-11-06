'use client';

import { useCallback, useEffect, useState } from 'react';
import { GameState } from '@/lib/types';
import { formatMoney } from '@/lib/economy';
import {
  ViewContainer,
  GlassCard,
  CrtButton,
  CoinDisplay,
  SectionTitle,
  ActionNotice,
} from '@/components/crt';
import { useGuardedAction } from '@/hooks/useGuardedAction';
import { INVESTMENT_PRODUCTS, type InvestmentProduct } from '@/lib/investments';

interface InvestirViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: string) => void;
  /** Reloads the save from the server. Called after every investment reply. */
  onRefreshSave?: () => void | Promise<void>;
}

// The catalogue is the definition of what exists, and the route prices a
// purchase off the same rows. The list that used to sit here held seven
// products but posted one of three server tiers, so five of the cards were
// bought at a price no card showed.
const INVESTMENT_TYPES = INVESTMENT_PRODUCTS;
type InvestmentType = InvestmentProduct;

/** One active investment, as /api/investment describes it. */
interface ActiveInvestment {
  id: string;
  option: string;
  /** Named by the server, so a retired 'A' tier row reads as a club name. */
  name: string;
  icon: string;
  amount: number;
  yieldPerDay: number;
  unlockDate: string;
  strategicBonus: { type: string; value: number; label: string } | null;
}

interface Portfolio {
  investments: ActiveInvestment[];
  pendingYieldTotal: number;
  pendingCount: number;
}

const EMPTY_PORTFOLIO: Portfolio = { investments: [], pendingYieldTotal: 0, pendingCount: 0 };

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

export function InvestirView({ gameState, userId, onViewChange, onRefreshSave }: InvestirViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [investing, setInvesting] = useState<string | null>(null);
  // What the player owns. The screen used to hard-code an empty array here,
  // so it reported no active investments however many had been bought, and
  // the yields the daily cron generated had nowhere on screen to be claimed
  // from — the only card with a claim button is never rendered.
  const [portfolio, setPortfolio] = useState<Portfolio>(EMPTY_PORTFOLIO);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);

  const loadPortfolio = useCallback(async () => {
    try {
      const response = await fetch(`/api/investment?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) return;
      const body = await response.json();
      setPortfolio({
        investments: Array.isArray(body.investments) ? body.investments : [],
        pendingYieldTotal: body.pendingYieldTotal ?? 0,
        pendingCount: Array.isArray(body.pendingYields) ? body.pendingYields.length : 0,
      });
    } catch {
      // Leave the last good list up rather than blanking the screen; the
      // notice from an action is what tells the player something went wrong.
    } finally {
      setLoadingPortfolio(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  // Both the save and the owned list are reloaded after every reply, so a
  // purchase shows up in the list and a claim empties the yield box without
  // the player navigating away and back.
  const refreshAll = useCallback(async () => {
    await onRefreshSave?.();
    await loadPortfolio();
  }, [onRefreshSave, loadPortfolio]);

  // Read the reply, reload the save, show a refusal (see StaffView). This
  // screen used to alert() with the reply's `error` label, so a refusal that
  // named a field reached the player as 'Validation failed' and nothing else.
  const action = useGuardedAction(refreshAll);

  const handleInvest = async (investment: InvestmentType) => {
    if (gameState.user.money < investment.cost) return;

    setInvesting(investment.id);
    try {
      await action.run<{ newBalance?: number }>(
        () =>
          fetch('/api/investment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // The card's own id. It used to be flattened onto one of three
            // server tiers here, which is how a card could be bought at a
            // price it did not print.
            body: JSON.stringify({ option: investment.id, userId }),
          }),
        { successMessage: () => `Investimento "${investment.name}" realizado!` }
      );
    } finally {
      setInvesting(null);
    }
  };

  const handleClaim = async () => {
    await action.run<{ claimed?: number; expired?: number }>(
      () =>
        fetch('/api/investment/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // userId for dev with auth off, exactly as the purchase sends it;
          // the route prefers the session when one exists.
          body: JSON.stringify({ claimAll: true, userId }),
        }),
      {
        successMessage: (body) =>
          `Rendimento recebido: ${formatMoney(body.claimed ?? 0)}` +
          (body.expired ? ` (${body.expired} expirado(s) e perdido(s))` : ''),
      }
    );
  };

  const { investments: activeInvestments, pendingYieldTotal, pendingCount } = portfolio;

  return (
    <ViewContainer className="pb-24">
      <ActionNotice notice={action.notice} onDismiss={action.dismiss} pending={action.pending} />
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
            <span
              className="font-[family-name:var(--font-pixel)] text-[0.6rem] text-[#FFDF00]"
              data-testid="active-investment-count"
            >
              {loadingPortfolio ? '…' : activeInvestments.length}
            </span>
          </div>
        </div>
      </GlassCard>

      {pendingYieldTotal > 0 && (
        <GlassCard glow className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="section-title">Rendimento a Receber</div>
              <CoinDisplay amount={pendingYieldTotal} size="md" />
              <p className="text-[0.5rem] text-[#55e0a0]/60 font-[family-name:var(--font-pixel)] mt-1">
                {pendingCount} pagamento(s) acumulado(s)
              </p>
            </div>
            <CrtButton
              onClick={handleClaim}
              disabled={action.pending}
              variant="primary"
              className="py-2 px-3 text-[0.55rem]"
            >
              {action.pending ? 'Recebendo...' : 'Receber Tudo'}
            </CrtButton>
          </div>
        </GlassCard>
      )}

      {activeInvestments.length > 0 && (
        <GlassCard className="p-3 space-y-2">
          <p className="font-[family-name:var(--font-pixel)] text-[0.6rem] text-[#00A859]">
            Seus Investimentos Ativos
          </p>
          <div className="space-y-2">
            {activeInvestments.map((inv) => (
              <div key={inv.id} className="frosted-card p-3 flex justify-between items-center gap-2">
                <div>
                  <p className="font-[family-name:var(--font-pixel)] text-[0.55rem] text-[#FFDF00]">
                    {inv.icon} {inv.name}
                  </p>
                  <p className="text-[0.5rem] text-[#55e0a0]/60 font-[family-name:var(--font-pixel)]">
                    Desbloqueio em {formatDate(inv.unlockDate)}
                  </p>
                  {inv.strategicBonus && (
                    <p className="text-[0.5rem] text-[#55e0a0]/60 font-[family-name:var(--font-pixel)]">
                      +{inv.strategicBonus.value}% {inv.strategicBonus.label}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[0.5rem] text-[#00A859] font-[family-name:var(--font-pixel)]">
                    {inv.yieldPerDay > 0 ? `+${formatMoney(inv.yieldPerDay)}/dia` : 'Sem rendimento'}
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
          const bonus = investment.strategicBonus;

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
                  {/* Only a bonus the game actually applies is printed here.
                      Two cards used to advertise boosts to systems that do
                      not exist (eventos especiais, descoberta de jogadores). */}
                  {bonus && (
                    <p className="font-[family-name:var(--font-pixel)] text-[0.5rem] text-[#00A859]">
                      +{bonus.value}%
                    </p>
                  )}
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
                        {investment.dailyYield > 0 ? formatMoney(investment.dailyYield) + '/dia' : 'Nenhum'}
                      </p>
                    </div>
                    <div className="frosted-card p-2">
                      <p className="text-[0.5rem] text-[#55e0a0]/60 font-[family-name:var(--font-pixel)]">
                        Bônus Estratégico
                      </p>
                      <p className="text-[0.5rem] text-[#FFDF00] font-[family-name:var(--font-pixel)]">
                        {bonus ? `+${bonus.value}% ${bonus.label}` : 'Nenhum'}
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
