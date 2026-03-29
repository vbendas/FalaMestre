'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, RefreshCw, WifiOff, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'error' | 'success' | 'warning' | 'info' | 'network';

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

const toastIcons: Record<ToastType, React.ReactNode> = {
  error: <AlertCircle className="w-5 h-5" />,
  success: <CheckCircle className="w-5 h-5" />,
  warning: <AlertCircle className="w-5 h-5" />,
  info: <AlertCircle className="w-5 h-5" />,
  network: <WifiOff className="w-5 h-5" />,
};

const toastColors: Record<ToastType, string> = {
  error: 'bg-red-900/90 border-red-500 text-red-100',
  success: 'bg-green-900/90 border-green-500 text-green-100',
  warning: 'bg-yellow-900/90 border-yellow-500 text-yellow-100',
  info: 'bg-blue-900/90 border-blue-500 text-blue-100',
  network: 'bg-orange-900/90 border-orange-500 text-orange-100',
};

export function Toast({ type, message, action, duration = 5000 }: ToastProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border-2 backdrop-blur-sm shadow-lg',
        toastColors[type]
      )}
    >
      <div className="flex-shrink-0">{toastIcons[type]}</div>
      <p className="flex-1 text-sm font-medium">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition-colors"
        >
          {type === 'network' && <RefreshCw className="w-4 h-4" />}
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: ToastProps[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              id={toast.id}
              type={toast.type}
              message={toast.message}
              action={toast.action}
              duration={toast.duration}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface NetworkStatusProps {
  isOnline: boolean;
}

export function NetworkStatusBanner({ isOnline }: NetworkStatusProps) {
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-orange-600 text-white py-2 px-4 text-center text-sm font-medium"
        >
          <WifiOff className="w-4 h-4 inline mr-2" />
          Você está offline. Algumas funcionalidades podem estar limitadas.
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
}

export function ErrorBoundaryFallback({ error, resetError }: ErrorBoundaryFallbackProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-red-900/50 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Algo deu errado</h3>
      <p className="text-white/60 mb-4 max-w-md">
        {error.message || 'Ocorreu um erro inesperado. Por favor, tente novamente.'}
      </p>
      <button
        onClick={resetError}
        className="flex items-center gap-2 px-4 py-2 bg-[#009739] hover:bg-[#00b342] text-white font-bold rounded-lg transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Tentar novamente
      </button>
    </motion.div>
  );
}

interface ConnectionLostModalProps {
  isOpen: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ConnectionLostModal({ isOpen, onRetry, onDismiss }: ConnectionLostModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-gradient-to-b from-[#012169] to-[#001845] rounded-xl border-4 border-[#FEDD00] p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-orange-900/50 flex items-center justify-center"
            >
              <WifiOff className="w-10 h-10 text-orange-400" />
            </motion.div>
            
            <h3 className="text-xl font-bold text-white mb-2">Conexão Perdida</h3>
            <p className="text-white/60 mb-6">
              A conexão com o servidor foi perdida. Verifique sua internet e tente novamente.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={onDismiss}
                className="flex-1 py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onRetry}
                className="flex-1 py-3 px-4 bg-[#009739] hover:bg-[#00b342] text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reconectar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
