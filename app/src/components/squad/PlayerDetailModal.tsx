'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Dumbbell, Heart, Star, TrendingUp, TrendingDown, Minus, UserPlus, Zap, Info } from 'lucide-react';
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
  { id: 'technical', label: 'Técnico', icon: '⚡', attrs: ['dri', 'pas'], improvement: 3, cost: 15, color: 'bg-yellow-500' },
  { id: 'physical', label: 'Físico', icon: '💪', attrs: ['pac', 'phy'], improvement: 3, cost: 20, color: 'bg-red-500' },
  { id: 'tactical', label: 'Tático', icon: '🧠', attrs: ['def', 'sho'], improvement: 3, cost: 15, color: 'bg-blue-500' },
  { id: 'rest', label: 'Descanso', icon: '😴', attrs: [], improvement: 0, cost: -20, color: 'bg-green-500' },
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

function getRecommendedTraining(player: Player): string {
  const lowestAttrs: Array<{ attr: string; value: number }> = [
    { attr: 'pac', value: player.pac },
    { attr: 'sho', value: player.sho },
    { attr: 'pas', value: player.pas },
    { attr: 'dri', value: player.dri },
    { attr: 'def', value: player.def },
    { attr: 'phy', value: player.phy },
  ].sort((a, b) => a.value - b.value);

  const lowest = lowestAttrs.slice(0, 2).map((a) => a.attr);
  
  if (lowest.includes('pac') || lowest.includes('phy')) return 'physical';
  if (lowest.includes('def') || lowest.includes('sho')) return 'tactical';
  return 'technical';
}

function getRestRecommendation(fitness: number, fatigue: number): { shouldRest: boolean; message: string } {
  if (fitness < 50 || fatigue < 30) {
    return {
      shouldRest: true,
      message: 'Jogador precisa descansar! Alto risco de lesão.',
    };
  }
  if (fitness < 70 || fatigue < 50) {
    return {
      shouldRest: false,
      message: 'Treino leve recomendado. Considere descansar após.',
    };
  }
  return {
    shouldRest: false,
    message: 'Jogador em boa forma. Pode treinar normalmente.',
  };
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
  const [hoveredTraining, setHoveredTraining] = useState<string | null>(null);

  if (!player) return null;

  const overall = getOverall(player);
  const fitness = player.fatigue ?? 100;
  const morale = gameState.squad.morale;
  const weeklyTrainingCount = player.weeklyTrainingCount ?? 0;

  const recommendedTraining = getRecommendedTraining(player);
  const restRecommendation = getRestRecommendation(fitness, fitness);

  const handleTrain = async (focus: 'technical' | 'physical' | 'tactical' | 'rest') => {
    setIsTraining(true);
    try {
      await onTrain(player.id, focus);
    } finally {
      setIsTraining(false);
    }
  };

  const getTrainingPreview = (trainingId: string) => {
    const training = TRAINING_OPTIONS.find((t) => t.id === trainingId);
    if (!training || trainingId === 'rest') return null;

    return training.attrs.map((attr) => {
      const currentValue = player[attr as keyof Player] as number;
      const newValue = Math.min(99, currentValue + training.improvement);
      return { attr, currentValue, newValue, improvement: training.improvement };
    });
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
                        <div className="text-xs text-white/50 mb-1">Energia</div>
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

                    {/* Rest Recommendation */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-lg p-3 ${
                        restRecommendation.shouldRest
                          ? 'bg-red-900/30 border border-red-500/50'
                          : 'bg-[#004d00] border border-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Info className={`w-4 h-4 mt-0.5 ${restRecommendation.shouldRest ? 'text-red-400' : 'text-white/50'}`} />
                        <p className={`text-xs ${restRecommendation.shouldRest ? 'text-red-200' : 'text-white/60'}`}>
                          {restRecommendation.message}
                        </p>
                      </div>
                    </motion.div>

                    {/* Weekly Training Count */}
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span>Treinos esta semana: {weeklyTrainingCount}/3</span>
                      {weeklyTrainingCount >= 3 && (
                        <span className="text-orange-400 font-medium">Limite atingido</span>
                      )}
                    </div>

                    {/* Training Preview */}
                    <AnimatePresence>
                      {hoveredTraining && hoveredTraining !== 'rest' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-[#012169]/50 rounded-lg p-3 border border-[#FEDD00]/30"
                        >
                          <p className="text-xs text-white/70 mb-2 font-medium">Prévia do Treino:</p>
                          <div className="space-y-2">
                            {getTrainingPreview(hoveredTraining)?.map((preview) => (
                              <div key={preview.attr} className="flex items-center justify-between">
                                <span className="text-xs text-white/60">{ATTRIBUTE_LABELS[preview.attr].label}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-white/40">{preview.currentValue}</span>
                                  <TrendingUp className="w-3 h-3 text-green-400" />
                                  <span className="text-sm font-bold text-green-400">+{preview.improvement}</span>
                                  <span className="text-xs text-white/40">= {preview.newValue}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Training Options */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-white/70">Escolha o Treino</h3>
                        <button
                          onClick={() => handleTrain(recommendedTraining as 'technical' | 'physical' | 'tactical')}
                          className="text-xs text-[#FEDD00] hover:text-yellow-400 flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" />
                          Recomendado
                        </button>
                      </div>
                      <div className="space-y-2">
                        {TRAINING_OPTIONS.map((option) => (
                          <motion.button
                            key={option.id}
                            whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.1)' }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handleTrain(option.id as 'technical' | 'physical' | 'tactical' | 'rest')}
                            onMouseEnter={() => setHoveredTraining(option.id)}
                            onMouseLeave={() => setHoveredTraining(null)}
                            disabled={isTraining || (option.id !== 'rest' && weeklyTrainingCount >= 3)}
                            className={`
                              w-full p-3 rounded-lg flex items-center gap-3
                              bg-[#004d00] border border-[#FEDD00]/30 hover:border-[#FEDD00]/50
                              disabled:opacity-50 disabled:cursor-not-allowed
                              ${option.id === recommendedTraining && option.id !== 'rest' ? 'ring-2 ring-[#FEDD00]' : ''}
                            `}
                          >
                            <div className={`w-10 h-10 rounded-lg ${option.color} flex items-center justify-center text-lg`}>
                              {option.icon}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="font-medium text-white flex items-center gap-2">
                                {option.label}
                                {option.id === recommendedTraining && option.id !== 'rest' && (
                                  <span className="px-1.5 py-0.5 bg-[#FEDD00] text-[#012169] text-[10px] font-bold rounded">
                                    ✨
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-white/50">
                                {option.id === 'rest' 
                                  ? '+20 Energia, +5 Moral' 
                                  : `+${option.attrs.map(a => ATTRIBUTE_LABELS[a].short).join(', ')} (${option.cost} energia)`
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
