'use client';

import { useState, useEffect } from 'react';
import type { Phase, PhaseUnlock } from '@/lib/types';
import { getPhaseDescription } from '@/lib/phase-system';

interface PhaseUnlockModalProps {
  unlock: PhaseUnlock;
  onDismiss: () => void;
  onNavigate?: (feature: string) => void;
}

export function PhaseUnlockModal({ unlock, onDismiss, onNavigate }: PhaseUnlockModalProps) {
  const [dismissed, setDismissed] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDismissed(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (dismissed) return null;
  
  const featureIcons: Record<string, string> = {
    prediction_market_unlock: '📊',
    fan_club_investment_unlock: '💰',
    tournament_unlock: '🏆'
  };
  
  const featureNames: Record<string, string> = {
    prediction_market_unlock: 'Mercado de Previsões',
    fan_club_investment_unlock: 'Clube de Torcedores',
    tournament_unlock: 'Torneios Especiais'
  };
  
  const icon = featureIcons[unlock.type] || '🎉';
  const name = featureNames[unlock.type] || 'Novo Recurso';
  
  return (
    <div className="fixed top-4 left-4 right-4 z-50">
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg shadow-xl p-4 animate-slide-in">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1">
            <p className="text-black font-bold text-sm">Novo Recurso Desbloqueado!</p>
            <p className="text-black/80 text-sm mt-1">{name}</p>
            <p className="text-black/60 text-xs mt-2">{unlock.message}</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-black/50 hover:text-black text-xl"
          >
            ✕
          </button>
        </div>
        
        {onNavigate && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onNavigate(unlock.type)}
              className="flex-1 bg-black text-yellow-400 py-2 rounded-lg font-bold text-sm"
            >
              Explorar →
            </button>
            <button
              onClick={onDismiss}
              className="px-4 bg-black/20 text-black py-2 rounded-lg font-medium text-sm"
            >
              Mais Tarde
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface PhaseProgressCardProps {
  currentPhase: Phase;
}

export function PhaseProgressCard({ currentPhase }: PhaseProgressCardProps) {
  const phases = [1, 2, 3, 4] as const;
  
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
      <p className="text-white/60 text-xs mb-3">Sua Progressão</p>
      
      <div className="flex items-center gap-1">
        {phases.map(phase => {
          const isCompleted = phase < currentPhase;
          const isCurrent = phase === currentPhase;
          const isLocked = phase > currentPhase;
          
          return (
            <div key={phase} className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                isCompleted 
                  ? 'bg-green-500 text-white'
                  : isCurrent
                    ? 'bg-yellow-500 text-black animate-pulse'
                    : 'bg-white/10 text-white/40'
              }`}>
                {isCompleted ? '✓' : phase}
              </div>
              
              {phase < 4 && (
                <div className={`flex-1 h-0.5 ${
                  phase < currentPhase ? 'bg-green-500' : 'bg-white/10'
                }`} />
              )}
            </div>
          );
        })}
      </div>
      
      <p className="text-white/40 text-xs mt-2 text-center">
        {getPhaseDescription(currentPhase)}
      </p>
    </div>
  );
}