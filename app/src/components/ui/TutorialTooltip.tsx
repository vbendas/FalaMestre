'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TutorialTooltipProps {
  step: TutorialStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onPrevious?: () => void;
}

export function TutorialTooltip({
  step,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  onPrevious,
}: TutorialTooltipProps) {
  const [position, setPosition] = useState(step.position || 'bottom');
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={cn(
        'absolute z-50 w-72 bg-gradient-to-b from-[#012169] to-[#001845]',
        'rounded-xl border-2 border-[#FEDD00] shadow-2xl shadow-black/50',
        'overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#FEDD00] flex items-center justify-center">
            <span className="text-[#012169] font-bold text-sm">{currentStep + 1}</span>
          </div>
          <h3 className="text-white font-bold text-sm">{step.title}</h3>
        </div>
        <button
          onClick={onSkip}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Pular tutorial"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-white/80 text-sm leading-relaxed">{step.content}</p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pb-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              i === currentStep ? 'bg-[#FEDD00]' : 'bg-white/20'
            )}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-white/10 bg-white/5">
        {!isFirstStep && (
          <button
            onClick={onPrevious}
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            Anterior
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onNext}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm transition-all',
            'bg-[#009739] hover:bg-[#00b342] text-white'
          )}
        >
          {isLastStep ? 'Começar!' : 'Próximo'}
          {!isLastStep && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </motion.div>
  );
}

interface SpotlightProps {
  targetSelector?: string;
  children: React.ReactNode;
}

export function Spotlight({ targetSelector, children }: SpotlightProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!targetSelector) return;

    const updateRect = () => {
      const element = document.querySelector(targetSelector);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [targetSelector]);

  return (
    <>
      {children}
      {targetSelector && targetRect && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 pointer-events-none"
        >
          {/* Dark overlay with cutout */}
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <motion.rect
                  initial={{ x: targetRect.x - 8, y: targetRect.y - 8, width: targetRect.width + 16, height: targetRect.height + 16 }}
                  animate={{ x: targetRect.x - 12, y: targetRect.y - 12, width: targetRect.width + 24, height: targetRect.height + 24 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  rx="12"
                  fill="black"
                />
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#spotlight-mask)" />
          </svg>
          
          {/* Glow effect around target */}
          <motion.div
            initial={{ x: targetRect.x - 4, y: targetRect.y - 4, width: targetRect.width + 8, height: targetRect.height + 8 }}
            animate={{ x: targetRect.x - 8, y: targetRect.y - 8, width: targetRect.width + 16, height: targetRect.height + 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute rounded-xl border-2 border-[#FEDD00] shadow-lg shadow-[#FEDD00]/30 pointer-events-none"
          />
        </motion.div>
      )}
    </>
  );
}
