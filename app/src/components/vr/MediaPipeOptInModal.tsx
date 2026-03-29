'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface MediaPipeOptInModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  onEnable: () => void;
  onSkip: () => void;
}

export function MediaPipeOptInModal({
  isOpen,
  isLoading,
  error,
  onEnable,
  onSkip,
}: MediaPipeOptInModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 p-6 rounded-xl max-w-md w-full mx-4 border border-gray-700"
          >
            <h2 className="text-2xl font-bold text-white mb-4 text-center">
              Quer uma experiência ainda mais imersiva?
            </h2>

            <p className="text-gray-300 mb-6 text-center">
              Ative o rastreamento facial para mover a câmera com a cabeça, como se
              estivesse no estádio. Sua câmera não é gravada.
            </p>

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm text-center">{error}</p>
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                <p className="text-gray-400">Carregando...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={onEnable}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  📷 Ativar Câmera
                </button>

                <button
                  onClick={onSkip}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                >
                  Usar Mouse
                </button>
              </div>
            )}

            <p className="text-gray-500 text-xs text-center mt-4">
              Você pode alterar isso depois nas configurações
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
