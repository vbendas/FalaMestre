'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '@/lib/types';

interface PlayerCardProps {
  player: Player;
  index: number;
  onPlayerSelect: (player: Player) => void;
}

const ATTRIBUTE_LABELS: Record<string, { label: string; short: string }> = {
  pac: { label: 'Pace', short: 'PAC' },
  sho: { label: 'Shooting', short: 'SHO' },
  pas: { label: 'Passing', short: 'PAS' },
  dri: { label: 'Dribbling', short: 'DRI' },
  def: { label: 'Defending', short: 'DEF' },
  phy: { label: 'Physical', short: 'PHY' },
};

const POSITION_COLORS: Record<string, string> = {
  GK: 'bg-purple-500',
  DEF: 'bg-blue-500',
  MID: 'bg-green-500',
  FWD: 'bg-red-500',
};

const POSITION_COLORS_LIGHT: Record<string, string> = {
  GK: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DEF: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  MID: 'bg-green-500/20 text-green-400 border-green-500/30',
  FWD: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function getOverall(player: Player): number {
  return Math.round((player.pac + player.sho + player.pas + player.dri + player.def + player.phy) / 6);
}

function getRatingColor(rating: number): string {
  if (rating >= 75) return 'bg-green-500';
  if (rating >= 65) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getFitnessColor(fitness: number): string {
  if (fitness >= 70) return 'bg-green-500';
  if (fitness >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getMoraleEmoji(morale: number): string {
  if (morale >= 70) return '😊';
  if (morale >= 40) return '😐';
  return '😟';
}

function getFormIndicator(): 'up' | 'down' | 'stable' {
  const forms: ('up' | 'down' | 'stable')[] = ['up', 'stable', 'down'];
  return forms[Math.floor(Math.random() * 3)];
}

function getRelevantAttributes(position: string): string[] {
  switch (position) {
    case 'GK': return ['pac', 'pas', 'phy'];
    case 'DEF': return ['def', 'phy', 'pas'];
    case 'MID': return ['pas', 'dri', 'phy'];
    case 'FWD': return ['sho', 'dri', 'pac'];
    default: return ['pac', 'sho', 'pas'];
  }
}

export function PlayerCard({ player, index, onPlayerSelect }: PlayerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Default values for migration - handle undefined from old game states
  const fatigue = player.fatigue ?? 100;
  const isInjured = player.isInjured ?? false;
  const currentForm = player.currentForm ?? 'average';
  const weeklyTrainingCount = player.weeklyTrainingCount ?? 0;
  const injuryWeeksRemaining = player.injuryWeeksRemaining ?? 0;
  
  const overall = getOverall(player);
  const relevantAttrs = getRelevantAttributes(player.position);
  const canTrain = !isInjured && fatigue > 20;

  const handlePress = () => {
    setIsExpanded(!isExpanded);
  };

  const handleLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    onPlayerSelect(player);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      layout
    >
      <motion.div
        onClick={handlePress}
        onDoubleClick={() => onPlayerSelect(player)}
        whileHover={{ scale: 1.01, backgroundColor: '#013399' }}
        whileTap={{ scale: 0.99 }}
        className={`
          bg-[#006400] rounded-xl border-2 border-[#FEDD00]/50 overflow-hidden cursor-pointer
          transition-colors relative
          ${isExpanded ? 'border-[#FEDD00]' : ''}
          ${!canTrain ? 'opacity-75' : ''}
        `}
      >
        {/* Cannot train overlay */}
        {!canTrain && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-xl">
            <div className="bg-red-900/80 px-3 py-2 rounded-lg border border-red-500">
              {isInjured ? (
                <span className="text-xs font-bold text-white">🏥 Lesionado ({injuryWeeksRemaining}sem)</span>
              ) : (
                <span className="text-xs font-bold text-white">😴 Exausto</span>
              )}
            </div>
          </div>
        )}
        
        <div className="p-3 flex items-center gap-3">
          {/* Overall Rating */}
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.03 + 0.1, type: 'spring' }}
              className={`
                w-12 h-12 rounded-full ${getRatingColor(overall)} 
                flex items-center justify-center text-white font-bold text-sm
                shadow-lg
              `}
            >
              {overall}
            </motion.div>
            {/* Form indicator based on player form */}
            {currentForm === 'hot' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px]">
                🔥
              </div>
            )}
            {currentForm === 'good' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[8px]">
                😊
              </div>
            )}
            {currentForm === 'poor' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[8px]">
                😟
              </div>
            )}
            {currentForm === 'cold' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-[8px]">
                ❄️
              </div>
            )}
            {/* Injury badge */}
            {isInjured && (
              <div className="absolute -top-1 -left-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[10px] border-2 border-white">
                🏥
              </div>
            )}
          </div>

          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${POSITION_COLORS[player.position]}`}>
                {player.position}
              </span>
              <span className="font-semibold text-white truncate">{player.name}</span>
            </div>

            {/* Compact attributes (collapsed state) */}
            <AnimatePresence mode="wait">
              {!isExpanded ? (
                <motion.div
                  key="compact"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-2 mt-2"
                >
                  {relevantAttrs.slice(0, 3).map((attr) => (
                    <div key={attr} className="flex-1 max-w-[60px]">
                      <div className="flex justify-between text-[9px] text-white/50 mb-0.5">
                        <span>{ATTRIBUTE_LABELS[attr].short}</span>
                        <span className="text-white/70">{player[attr as keyof Player] as number}</span>
                      </div>
                      <div className="h-1.5 bg-[#004d00] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(player[attr as keyof Player] as number)}%` }}
                          transition={{ delay: index * 0.03 + 0.2, duration: 0.4 }}
                          className={`h-full rounded-full ${getRatingColor(player[attr as keyof Player] as number)}`}
                        />
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Status indicators */}
          <div className="flex flex-col gap-1 items-end">
            {/* Fitness bar */}
            <div className="w-8">
              <div className="h-1.5 bg-[#004d00] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${fatigue}%` }}
                  className={`h-full rounded-full ${getFitnessColor(fatigue)}`}
                />
              </div>
              <span className="text-[8px] text-white/40">{fatigue}%</span>
            </div>
            {/* Form emoji */}
            <span className="text-sm">
              {currentForm === 'hot' ? '🔥' :
               currentForm === 'good' ? '😊' :
               currentForm === 'poor' ? '😟' :
               currentForm === 'cold' ? '❄️' : '😐'}
            </span>
          </div>
        </div>

        {/* Expanded attributes */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 border-t border-white/5 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(ATTRIBUTE_LABELS).map(([key, { label }]) => {
                    const value = player[key as keyof Player] as number;
                    return (
                      <div key={key} className="bg-white/5 rounded p-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-white/50">{label}</span>
                          <span className="text-xs font-bold text-white">{value}</span>
                        </div>
                        <div className="h-1.5 bg-[#004d00] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${value}%` }}
                            className={`h-full rounded-full ${getRatingColor(value)}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick action buttons */}
                <div className="flex gap-2 mt-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayerSelect(player);
                    }}
                    className="flex-1 py-2 bg-[#012169] hover:bg-[#013399] rounded-lg text-xs font-medium text-white border border-[#FEDD00]/30"
                  >
                    Ver Detalhes
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayerSelect(player);
                    }}
                    className="px-4 py-2 bg-green-600/80 hover:bg-green-600 rounded-lg text-xs font-medium text-white"
                  >
                    ⚡
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayerSelect(player);
                    }}
                    className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 rounded-lg text-xs font-medium text-white"
                  >
                    😴
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export type { PlayerCardProps };
