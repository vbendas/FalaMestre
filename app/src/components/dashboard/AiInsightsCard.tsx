'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { GameState } from '@/lib/types';

interface Insight {
  title: string;
  text: string;
  icon: string;
}

interface AiInsightsCardProps {
  gameState: GameState;
}

// Tier 1: Static pool of general football tips (always available, zero cost)
const STATIC_INSIGHTS: Insight[] = [
  { title: 'Dica Tática', text: 'Sua formação atual favorece ataque pelas laterais. Considere usar pontas rápidos para explorar o espaço.', icon: '⚽' },
  { title: 'Físico do Time', text: 'Jogadores com mais de 80% de condição têm 15% mais chance de marcar. Cuide da recuperação!', icon: '💪' },
  { title: 'Próximo Adversário', text: 'Seu próximo oponente usa defesa alta. Um contra-ataque rápido pode ser a chave para vencer.', icon: '🎯' },
  { title: 'Mercado', text: 'Há bons zagueiros disponíveis no mercado. Reforçar a defesa pode mudar o rumo da temporada.', icon: '📈' },
  { title: 'Moral do Elenco', text: 'Vitórias consecutivas aumentam o moral em 10%. Uma sequência boa pode transformar o time.', icon: '🔥' },
  { title: 'Juventude', text: 'Jogadores jovens (menos de 23 anos) melhoram mais rápido com treino. Invista no futuro!', icon: '🌟' },
  { title: 'Formação', text: 'Alternar entre formações pode surpreender adversários. Treine o 3-5-2 para mais controle no meio.', icon: '🔄' },
  { title: 'Reservas', text: 'Manter reservas em boa condição é essencial. Rodar o elenco evita lesões por excesso de jogos.', icon: '🔄' },
  { title: 'Mentalidade', text: 'Times com alta moral jogam 20% melhor. Vitórias em sequência constroem confiança no elenco.', icon: '🧠' },
];

// Tier 2: Rule-based contextual tips (instant, zero cost)
function getRuleBasedInsights(gs: GameState): Insight[] {
  const tips: Insight[] = [];

  if (gs.squad.morale < 50) {
    tips.push({ title: 'Moral Baixo', text: `O moral está em ${gs.squad.morale}%. Considere descansar jogadores ou fazer uma contratação motivadora.`, icon: '😤' });
  }
  if (gs.squad.fitness < 60) {
    tips.push({ title: 'Condição Física', text: `A condição está em ${gs.squad.fitness}%. Reduza a intensidade do treino para evitar lesões.`, icon: '💪' });
  }
  const injured = gs.squad.players.filter(p => p.isInjured);
  if (injured.length > 2) {
    tips.push({ title: 'Crise de Lesões', text: `${injured.length} jogadores lesionados. Priorize a recuperação e busque reforços.`, icon: '🏥' });
  }
  if (gs.season.losses > gs.season.wins && gs.season.wins + gs.season.losses >= 3) {
    tips.push({ title: 'Má Fase', text: 'O time está em má fase. Mude a estratégia e experimente uma nova formação.', icon: '📉' });
  }
  if (gs.season.position <= 4) {
    tips.push({ title: 'No G4!', text: 'Seu time está no G4! Mantenha a consistência e foque em não perder jogos decisivos.', icon: '🏆' });
  }
  if (gs.season.position >= 16) {
    tips.push({ title: 'Zona de Perigo', text: 'O time está na zona de rebaixamento. Busque vitórias urgentes!', icon: '⚠️' });
  }

  return tips;
}

const SESSION_CACHE_KEY = 'falaMestreInsightsCache';

export function AiInsightsCard({ gameState }: AiInsightsCardProps) {
  const [allInsights, setAllInsights] = useState<Insight[]>([]);
  const [currentInsight, setCurrentInsight] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial insights (Tier 1 + Tier 2) and fetch AI
  useEffect(() => {
    const ruleBased = getRuleBasedInsights(gameState);
    const initial = [...ruleBased, ...STATIC_INSIGHTS];
    setAllInsights(initial);

    // Check sessionStorage cache
    try {
      const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
      if (cached) {
        const { insights, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 60 * 60 * 1000 && insights.length > 0) {
          setAllInsights([...insights, ...ruleBased, ...STATIC_INSIGHTS]);
          setIsLoading(false);
          return;
        }
      }
    } catch {}

    // Fetch AI insights from API
    const userId = gameState.user.id;
    if (!userId) {
      setIsLoading(false);
      return;
    }

    fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.insights?.length > 0) {
          const aiInsights: Insight[] = data.insights;
          // AI tips first (personalized), then rule-based, then static
          const merged = [...aiInsights, ...ruleBased, ...STATIC_INSIGHTS];
          setAllInsights(merged);

          // Cache in sessionStorage
          try {
            sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
              insights: aiInsights,
              timestamp: Date.now(),
            }));
          } catch {}
        }
      })
      .catch(() => {
        // Silent fail — stay with Tier 1 + 2
      })
      .finally(() => setIsLoading(false));
  }, [gameState]);

  const goTo = useCallback((index: number) => {
    setDirection(index > currentInsight ? 1 : -1);
    setCurrentInsight(index);
  }, [currentInsight]);

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrentInsight(prev => (prev + 1) % allInsights.length);
  }, [allInsights.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setCurrentInsight(prev => (prev - 1 + allInsights.length) % allInsights.length);
  }, [allInsights.length]);

  // Auto-rotate every 8 seconds
  useEffect(() => {
    if (allInsights.length <= 1) return;
    const timer = setInterval(goNext, 8000);
    return () => clearInterval(timer);
  }, [goNext, allInsights.length]);

  const insight = allInsights[currentInsight];
  if (!insight) return null;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[#009739]" />
        <span className="text-sm font-medium text-white">Dicas</span>
      </div>

      <div className="relative overflow-hidden min-h-[72px]">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 p-1"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentInsight}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">{insight.icon}</span>
                <div>
                  <p className="text-xs font-medium text-[#009739] mb-0.5">{insight.title}</p>
                  <p className="text-xs text-white/60 leading-relaxed">{insight.text}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <button
            onClick={goNext}
            className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 p-1"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1 mt-2">
        {allInsights.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              i === currentInsight ? 'bg-[#009739]' : 'bg-[#004d00]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
