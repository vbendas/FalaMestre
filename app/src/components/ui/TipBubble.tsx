'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIPS = [
  'Você pode tocar nos nomes dos jogadores para ver detalhes e treiná-los!',
  'Jogadores descansados têm melhor desempenho nas partidas.',
  'Não se esqueça de verificar o mercado de transferências para reforços!',
  'Mudanças táticas podem virar uma partida equilibrada.',
  'Jogadores com moral alta rendem melhor em campo!',
  'Equilíbrio entre treino e descanso é a chave do sucesso.',
  'Observe os atributos dos jogadores antes de comprar.',
  'Partidas em casa geralmente dão vantagem ao seu time.',
  'Você pode tornar qualquer jogador capitão do time!',
  'A energia do jogador afeta diretamente seu desempenho.',
];

interface TipBubbleProps {
  tipIndex?: number;
  delay?: number;
  className?: string;
}

export function TipBubble({ 
  tipIndex,
  delay = 30000,
  className,
}: TipBubbleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(tipIndex ?? Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    if (dismissed) return;

    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(showTimer);
  }, [delay, dismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
  };

  const handleNextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % TIPS.length);
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={cn(
            'fixed bottom-32 right-4 z-40 w-72',
            'bg-gradient-to-b from-[#012169] to-[#001845]',
            'rounded-xl border-2 border-[#FEDD00]/50 shadow-xl shadow-black/30',
            'overflow-hidden',
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-[#FEDD00]/10">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#FEDD00]/20 flex items-center justify-center">
                <Lightbulb className="w-3.5 h-3.5 text-[#FEDD00]" />
              </div>
              <span className="text-[#FEDD00] font-bold text-xs">Dica</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNextTip}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Próxima dica"
              >
                <span className="text-white/40 text-[10px]">{currentTipIndex + 1}/{TIPS.length}</span>
              </button>
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Fechar"
              >
                <X className="w-3.5 h-3.5 text-white/40" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-3">
            <p className="text-white/80 text-sm leading-relaxed">
              {TIPS[currentTipIndex]}
            </p>
          </div>

          {/* Decorative element */}
          <div className="absolute bottom-0 right-0 w-16 h-16 opacity-10">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="80" cy="80" r="60" fill="#FEDD00" />
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface AchievementPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function AchievementPopup({
  isOpen,
  onClose,
  title,
  description,
  icon,
}: AchievementPopupProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-80"
        >
          <div className="bg-gradient-to-b from-[#FFD700] to-[#FFA500] rounded-xl p-4 shadow-xl shadow-black/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                {icon || <Trophy className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1">
                <p className="text-[#012169] font-bold text-sm">Conquista Desbloqueada!</p>
                <p className="text-[#012169]/80 font-medium text-xs">{title}</p>
              </div>
            </div>
            <p className="mt-2 text-[#012169]/70 text-xs">{description}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
