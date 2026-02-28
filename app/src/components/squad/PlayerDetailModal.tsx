'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Dumbbell, Heart, Star, TrendingUp, TrendingDown, Minus, UserPlus } from 'lucide-react';
import { Player, GameState } from '@/lib/types';

interface PlayerDetailModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  onTrain: (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') => void;
  onRest: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
  isCaptain: boolean;
}

const ATTRIBUTE_LABELS: Record<string, { label: string; short: string }> = {
  pac: { label: 'Pace', short: 'PAC' },
  sho: { label: 'Shooting', short: 'SHO' },
  pas: { label: 'Passing', short: 'PAS' },
  dri: { label: 'Dribbling', short: 'DRI' },
  def: { label: 'Defending', short: 'DEF' },
  phy: { label: 'Physical', short: 'PHY' },
};

const HIDDEN_ATTRIBUTE_LABELS: Record<string, string> = {
  potential: 'Potencial',
  consistency: 'Consistência',
  bigMatchPlayer: 'Jogo Grande',
  leadership: 'Liderança',
  injuryProneness: 'Lesão',
};

const POSITION_COLORS: Record<string, string> = {
  GK: 'bg-purple-500',
  DEF: 'bg-blue-500',
  MID: 'bg-green-500',
  FWD: 'bg-red-500',
};

const TRAINING_OPTIONS = [
  { id: 'technical', label: 'Técnico', icon: '⚡', attrs: ['dri', 'pas'], cost: 15, color: 'bg-yellow-500' },
  { id: 'physical', label: 'Físico', icon: '💪', attrs: ['pac', 'phy'], cost: 20, color: 'bg-red-500' },
  { id: 'tactical', label: 'Tático', icon: '🧠', attrs: ['def', 'sho'], cost: 15, color: 'bg-blue-500' },
  { id: 'rest', label: 'Descanso', icon: '😴', attrs: [], cost: -20, color: 'bg-green-500' },
] as const;

function getOverall(player: Player): number {
  return Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
}

function getRatingColor(rating: number): string {
  if (rating >= 75) return 'bg-green-500';
  if (rating >= 65) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getRatingColorClass(rating: number): string {
  if (rating >= 75) return 'text-green-400';
  if (rating >= 65) return 'text-yellow-400';
  return 'text-red-400';
}

export function PlayerDetailModal({
  player,
  isOpen,
  onClose,
  gameState,
  onTrain,
  onRest,
  onSetCaptain,
  isCaptain,
}: PlayerDetailModalProps) {
  const [selectedTab, setSelectedTab] = useState<'stats' | 'training'>('stats');
  const [isTraining, setIsTraining] = useState(false);

  if (!player) return null;

  const overall = getOverall(player);
  const fitness = gameState.squad.fitness;
  const morale = gameState.squad.morale;

  const handleTrain = async (focus: 'technical' | 'physical' | 'tactical' | 'rest') => {
    setIsTraining(true);
    try {
      await onTrain(player.id, focus);
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-[#012169] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden pointer-events-auto border-2 border-[#FEDD00]/50"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-[#012169] to-[#009739] p-4 pb-6">
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 w-8 h-8 bg-[#012169] rounded-full flex items-center justify-center text-white/70 hover:bg-[#013399]"
                >
                  <X className="w-5 h-5" />
                </button>

                {isCaptain && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-[#FEDD00] text-[#012169] text-xs font-bold rounded flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> CAPITÃO
                  </div>
                )}

                <div className="flex items-center gap-4 mt-2">
                  {/* Avatar */}
                  <div className={`
                    w-20 h-20 rounded-full ${getRatingColor(overall)}
                    flex items-center justify-center text-3xl font-bold text-white
                    shadow-xl border-4 border-white/20
                  `}>
                    {overall}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${POSITION_COLORS[player.position]}`}>
                        {player.position}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white">{player.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-white/60">Geral: <span className={getRatingColorClass(overall)}>{overall}</span></span>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setSelectedTab('stats')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTab === 'stats' 
                        ? 'bg-[#FEDD00] text-[#012169]' 
                        : 'bg-[#012169] text-white/70 hover:bg-[#013399]'
                    }`}
                  >
                    📊 Atributos
                  </button>
                  <button
                    onClick={() => setSelectedTab('training')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTab === 'training' 
                        ? 'bg-[#FEDD00] text-[#012169]' 
                        : 'bg-[#012169] text-white/70 hover:bg-[#013399]'
                    }`}
                  >
                    🏋️ Treinar
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 bg-[#006400] max-h-[60vh] overflow-y-auto">
                {selectedTab === 'stats' ? (
                  <div className="space-y-4">
                    {/* Main Attributes */}
                    <div>
                      <h3 className="text-sm font-medium text-white/70 mb-2">Atributos Principais</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(ATTRIBUTE_LABELS).map(([key, { label }]) => {
                          const value = player[key as keyof Player] as number;
                          return (
                            <div key={key} className="bg-[#004d00] rounded-lg p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-white/50">{label}</span>
                                <span className={`text-lg font-bold ${getRatingColorClass(value)}`}>{value}</span>
                              </div>
                              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${value}%` }}
                                  transition={{ delay: 0.1, duration: 0.5 }}
                                  className={`h-full rounded-full ${getRatingColor(value)}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hidden Attributes */}
                    <div>
                      <h3 className="text-sm font-medium text-white/70 mb-2">Atributos Ocultos</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(HIDDEN_ATTRIBUTE_LABELS).map(([key, label]) => {
                          const value = player[key as keyof Player] as number;
                          const maxValue = key === 'potential' ? 95 : key === 'injuryProneness' ? 50 : 90;
                          return (
                            <div key={key} className="bg-[#004d00] rounded-lg p-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-white/40">?</span>
                                <span className="text-xs text-white/60">{label}</span>
                              </div>
                              <span className="text-xs font-bold text-white/80">{value}/{maxValue}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-white/40 mt-2">* Atributos ocultos afetam o desempenho mas não são visíveis aos adversários</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSetCaptain(player.id)}
                        disabled={isCaptain}
                        className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                          isCaptain
                            ? 'bg-[#FEDD00]/20 text-[#FEDD00] cursor-not-allowed'
                            : 'bg-[#012169] hover:bg-[#013399] text-white border border-[#FEDD00]/30'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${isCaptain ? 'fill-current' : ''}`} />
                        {isCaptain ? 'Capitão' : 'Tornar Capitão'}
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Status */}
                    <div className="flex gap-4">
                      <div className="flex-1 bg-[#004d00] rounded-lg p-3">
                        <div className="text-xs text-white/50 mb-1">Fitness</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${fitness}%` }}
                              className={`h-full rounded-full ${fitness >= 70 ? 'bg-green-500' : fitness >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            />
                          </div>
                          <span className="text-sm font-bold text-white">{fitness}%</span>
                        </div>
                      </div>
                      <div className="flex-1 bg-[#004d00] rounded-lg p-3">
                        <div className="text-xs text-white/50 mb-1">Moral</div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">
                            {morale >= 70 ? '😊' : morale >= 40 ? '😐' : '😟'}
                          </span>
                          <span className="text-sm font-bold text-white">{morale}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Training Options */}
                    <div>
                      <h3 className="text-sm font-medium text-white/70 mb-2">Escolha o Treino</h3>
                      <div className="space-y-2">
                        {TRAINING_OPTIONS.map((option) => (
                          <motion.button
                            key={option.id}
                            whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.1)' }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handleTrain(option.id as 'technical' | 'physical' | 'tactical' | 'rest')}
                            disabled={isTraining}
                            className={`
                              w-full p-3 rounded-lg flex items-center gap-3
                              bg-[#004d00] border border-[#FEDD00]/30 hover:border-[#FEDD00]/50
                              disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                          >
                            <div className={`w-10 h-10 rounded-lg ${option.color} flex items-center justify-center text-lg`}>
                              {option.icon}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-white">{option.label}</div>
                              <div className="text-xs text-white/50">
                                {option.id === 'rest' 
                                  ? '+20 Fitness, +5 Moral' 
                                  : `+${option.attrs.join(', ').toUpperCase()} (${option.cost} fitness)`
                                }
                              </div>
                            </div>
                            <div className="text-white/30">→</div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Training Info */}
                    <div className="bg-[#009739]/20 rounded-lg p-3 text-xs text-white/70">
                      💡 <strong>Dica:</strong> Jogadores com alto potencial se beneficiam mais dos treinos. Gerencie a energia do seu elenco com sabedoria!
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export type { PlayerDetailModalProps };
