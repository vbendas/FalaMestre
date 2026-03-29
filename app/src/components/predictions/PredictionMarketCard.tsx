'use client';

import { useState, useEffect } from 'react';
import { formatMoney } from '@/lib/economy';
import type { Prediction, PredictionHistory } from '@/lib/types';

interface PredictionMarketCardProps {
  predictions: Prediction[];
  userHistory?: PredictionHistory;
  onViewDetails: (prediction: Prediction) => void;
}

export function PredictionMarketCard({
  predictions,
  userHistory,
  onViewDetails,
}: PredictionMarketCardProps) {
  const openPredictions = predictions.filter(p => p.status === 'open').slice(0, 3);

  if (openPredictions.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📊</span>
          <h3 className="text-white font-bold">Mercado de Previsões</h3>
        </div>
        <p className="text-white/60 text-sm">Nenhuma previsão disponível no momento.</p>
        <p className="text-white/40 text-xs mt-2">Volte em breve!</p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-white font-bold">Mercado de Previsões</h3>
        </div>
        {userHistory && (
          <div className="flex items-center gap-1">
            <span className="text-yellow-400">🔥</span>
            <span className="text-white text-sm font-medium">
              {userHistory.currentStreak} sequência
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {openPredictions.map(prediction => {
          const deadline = new Date(prediction.deadline);
          const isUrgent = deadline.getTime() - Date.now() < 3600000;

          return (
            <button
              key={prediction.id}
              onClick={() => onViewDetails(prediction)}
              className="w-full bg-white/5 hover:bg-white/10 rounded-lg p-3 text-left transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-white font-medium text-sm">
                    {prediction.homeTeam} vs {prediction.awayTeam}
                  </p>
                  <p className="text-white/50 text-xs">
                    {prediction.type === 'win_draw_loss' ? 'Resultado' : 
                     prediction.type === 'first_scorer' ? 'Primeiro Marcador' :
                     prediction.type === 'clean_sheet' ? 'Clean Sheet' : 'Placar'}
                  </p>
                </div>
                {isUrgent && (
                  <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded">
                    Urgente
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {prediction.options.slice(0, 3).map(option => (
                  <div
                    key={option.id}
                    className="flex-1 bg-white/5 rounded px-2 py-1 text-center"
                  >
                    <p className="text-white text-xs truncate">{option.label}</p>
                    <p className="text-yellow-400 text-xs font-bold">
                      {option.odds.toFixed(1)}x
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-2">
                <p className="text-white/40 text-xs">
                  Custo: {formatMoney(prediction.entryCost)}
                </p>
                <span className="text-blue-400 text-xs">Apostar →</span>
              </div>
            </button>
          );
        })}
      </div>

      <button className="w-full mt-3 py-2 text-center text-white/60 text-sm hover:text-white">
        Ver Todas as Previsões →
      </button>
    </div>
  );
}