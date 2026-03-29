'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Monitor, Smartphone, Camera, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VRTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartVR: () => void;
  mode?: 'entry' | 'tutorial';
}

const VR_FEATURES = [
  {
    icon: '🥽',
    title: 'Experiência Imersiva',
    description: 'Sinta-se dentro do estádio assistindo a partida em 3D!',
  },
  {
    icon: '📱',
    title: 'Use seu celular',
    description: 'Monte um visualizador VR com Google Cardboard ou similar.',
  },
  {
    icon: '👀',
    title: 'Olhe ao redor',
    description: 'Gire a cabeça para ver todo o estádio虚拟.',
  },
];

export function VRTutorialModal({
  isOpen,
  onClose,
  onStartVR,
  mode = 'entry',
}: VRTutorialModalProps) {
  const [step, setStep] = useState(0);
  const [hasSeenVRTutorial, setHasSeenVRTutorial] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      const seen = localStorage.getItem('vrTutorialSeen');
      setHasSeenVRTutorial(seen === 'true');
    }
  }, [isOpen]);

  const handleStartVR = () => {
    localStorage.setItem('vrTutorialSeen', 'true');
    onStartVR();
  };

  const handleDismiss = () => {
    localStorage.setItem('vrTutorialSeen', 'true');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-gradient-to-b from-[#012169] to-[#001845] rounded-2xl border-4 border-[#FEDD00] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="relative p-6 text-center bg-gradient-to-r from-purple-900/50 to-transparent">
              {!hasSeenVRTutorial && mode === 'entry' && (
                <button
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              )}
              
              <div className="text-6xl mb-4">🥽</div>
              <h2 className="text-2xl font-bold text-white pixel-text">Modo VR</h2>
              <p className="text-white/60 text-sm mt-1">
                {mode === 'entry' ? 'Experimente a partida em realidade virtual!' : 'Tutorial do Modo VR'}
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Features */}
              <div className="space-y-3">
                {VR_FEATURES.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-white/5 rounded-lg"
                  >
                    <span className="text-3xl">{feature.icon}</span>
                    <div>
                      <p className="text-white font-medium text-sm">{feature.title}</p>
                      <p className="text-white/50 text-xs">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Requirements */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-400 text-xs font-bold mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Requisitos:
                </p>
                <ul className="text-white/60 text-xs space-y-1">
                  <li>• celular ou tablet com giroscópio</li>
                  <li>• Google Cardboard ou similar (opcional)</li>
                  <li>• Chrome ou Safari atualizado</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-black/30">
              <div className="flex gap-3">
                <button
                  onClick={handleDismiss}
                  className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                >
                  Mais tarde
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartVR}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Monitor className="w-5 h-5" />
                  Entrar em Modo VR
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface VRModeIndicatorProps {
  isVRMode: boolean;
  onClick?: () => void;
}

export function VRModeIndicator({ isVRMode, onClick }: VRModeIndicatorProps) {
  if (!isVRMode) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed top-20 right-4 z-40 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1.5"
    >
      <span>🥽</span>
      <span>VR Ativo</span>
    </motion.button>
  );
}
