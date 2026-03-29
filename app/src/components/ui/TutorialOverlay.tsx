'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Trophy } from 'lucide-react';
import { TutorialStep, TutorialTooltip, Spotlight } from './TutorialTooltip';
import { cn } from '@/lib/utils';

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  steps: TutorialStep[];
  onComplete?: () => void;
}

export function TutorialOverlay({
  isOpen,
  onClose,
  steps,
  onComplete,
}: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete?.();
      onClose();
    }
  }, [currentStep, steps.length, onComplete, onClose]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          handleSkip();
          break;
        case 'ArrowRight':
        case 'Enter':
          handleNext();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrevious, handleSkip]);

  if (!isOpen || steps.length === 0) return null;

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Spotlight on target */}
        <Spotlight targetSelector={currentStepData.targetSelector}>
          <div />
        </Spotlight>

        {/* Tutorial Tooltip - positioned relative to spotlight */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto">
            <TutorialTooltip
              step={currentStepData}
              currentStep={currentStep}
              totalSteps={steps.length}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onSkip={handleSkip}
            />
          </div>
        </div>

        {/* Skip button in corner */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/60 hover:text-white text-sm transition-colors"
        >
          <span>Pular</span>
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

interface FirstTimeUserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const FIRST_TIME_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo!',
    content: 'Você é o manager do seu time de futebol! Vamos aprender como jogar.',
    position: 'center',
  },
  {
    id: 'chat',
    title: 'Chat com o Técnico',
    content: 'Use o chat para dar comandos ao seu técnico virtual. Ele vai te ajudar a gerenciar o time, jogar partidas e muito mais!',
    targetSelector: '[data-tutorial="chat-input"]',
    position: 'top',
  },
  {
    id: 'quick-actions',
    title: 'Ações Rápidas',
    content: 'Use os botões de ação rápida para jogar partidas, ver o elenco, acessar o mercado e configurar táticas.',
    targetSelector: '[data-tutorial="quick-actions"]',
    position: 'top',
  },
  {
    id: 'bottom-nav',
    title: 'Navegação',
    content: 'Use a barra de navegação abaixo para trocar entre as telas de Chat, Elenco e Jogo.',
    targetSelector: '[data-tutorial="bottom-nav"]',
    position: 'top',
  },
  {
    id: 'match',
    title: 'Jogar Partidas',
    content: 'Assista à simulação 3D da sua partida ou entre em modo VR para uma experiência imersiva!',
    targetSelector: '[data-tutorial="play-button"]',
    position: 'top',
  },
];

export function FirstTimeUserGuide({ isOpen, onClose }: FirstTimeUserGuideProps) {
  return (
    <TutorialOverlay
      isOpen={isOpen}
      onClose={onClose}
      steps={FIRST_TIME_STEPS}
      onComplete={() => {
        localStorage.setItem('tutorialCompleted', 'true');
      }}
    />
  );
}
