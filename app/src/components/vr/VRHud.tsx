'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface VRHudProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  currentMinute: number;
  currentEvent?: string;
  cameraMode: 'seat' | 'broadcast';
  trackingMode: 'gyro' | 'face' | 'mouse' | 'headset';
  onToggleCameraMode: () => void;
  onExitVR: () => void;
  onCalibrate?: () => void;
  isGoalCelebration?: boolean;
}

export function VRHud({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  currentMinute,
  currentEvent,
  cameraMode,
  trackingMode,
  onToggleCameraMode,
  onExitVR,
  onCalibrate,
  isGoalCelebration = false,
}: VRHudProps) {
  const trackingLabel = {
    gyro: '📱 Giroscópio',
    face: '👁 Face Tracking',
    mouse: '🖱 Mouse',
    headset: '🥽 Headset',
  };

  const cameraModeLabel = {
    seat: '📍 Torcida',
    broadcast: '📺 Transmissão',
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <div className="bg-black/85 px-6 py-2 rounded-lg flex items-center gap-4">
          <span className="text-white font-bold text-lg">{homeTeam}</span>
          <span className="text-[#FEDD00] font-black text-2xl">
            {homeScore} - {awayScore}
          </span>
          <span className="text-white font-bold text-lg">{awayTeam}</span>
          <span className="text-[#FEDD00] font-bold text-xl ml-2">{currentMinute}'</span>
        </div>
      </div>

      <AnimatePresence>
        {currentEvent && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
          >
            <div className="bg-black/90 px-4 py-2 rounded-lg max-w-md">
              <p className="text-white text-center text-sm font-medium">{currentEvent}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed top-4 right-4 z-50 pointer-events-auto">
        <button
          onClick={onExitVR}
          className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-lg hover:bg-red-700 transition-colors"
        >
          Sair VR
        </button>
      </div>

      <div className="fixed top-4 left-4 z-50 pointer-events-auto">
        <button
          onClick={onToggleCameraMode}
          className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg shadow-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          {cameraMode === 'seat' ? '📍 Torcida' : '📺 Transmissão'}
        </button>
      </div>

      <div className="fixed bottom-4 left-4 z-50 bg-black/70 p-3 rounded-lg text-white text-sm pointer-events-auto">
        <p className="font-bold">Modo VR Ativo</p>
        <p className="text-xs opacity-80 mt-1">{trackingLabel[trackingMode]}</p>
        <p className="text-xs opacity-60 mt-1">
          {cameraMode === 'seat'
            ? 'Olhe ao redor para ver o estádio'
            : 'Câmera segue a bola'}
        </p>
      </div>

      {onCalibrate && (
        <div className="fixed bottom-4 right-4 z-50 pointer-events-auto">
          <button
            onClick={onCalibrate}
            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
          >
            📱 Calibrar Giroscópio
          </button>
        </div>
      )}

      <AnimatePresence>
        {isGoalCelebration && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-16 py-8 rounded-2xl shadow-2xl border-4 border-white">
              <p className="text-white font-black text-8xl tracking-wider text-center animate-pulse">
                GOOOL!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
