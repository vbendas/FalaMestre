'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { Formation, getFormationOptions, calculateFormationFit, suggestBestFormation } from '@/lib/formations';
import { Player } from '@/lib/types';

interface FormationSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentFormation: string;
  players: Player[];
  onSelectFormation: (formationId: string) => void;
}

export function FormationSelector({
  isOpen,
  onClose,
  currentFormation,
  players,
  onSelectFormation,
}: FormationSelectorProps) {
  const formations = getFormationOptions();
  const suggestedFormation = suggestBestFormation(players);
  const [selectedIndex, setSelectedIndex] = useState(
    formations.findIndex(f => f.id === currentFormation)
  );

  const handlePrev = () => {
    setSelectedIndex(prev => (prev > 0 ? prev - 1 : formations.length - 1));
  };

  const handleNext = () => {
    setSelectedIndex(prev => (prev < formations.length - 1 ? prev + 1 : 0));
  };

  const handleSelect = (formation: Formation) => {
    onSelectFormation(formation.id);
    onClose();
  };

  const selectedFormation = formations[selectedIndex];
  const fitScore = calculateFormationFit(players, selectedFormation.id);

  const getFitColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
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
              className="bg-[#012169] w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-hidden pointer-events-auto border-2 border-[#FEDD00]/50"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#012169] to-[#009739] p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#FEDD00]" />
                    Escolher Formação
                  </h2>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 bg-[#012169] rounded-full flex items-center justify-center text-white/70 hover:bg-[#013399]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    className="w-10 h-10 bg-[#012169] rounded-lg flex items-center justify-center text-white hover:bg-[#013399]"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex-1 text-center">
                    <span className="text-2xl font-bold text-white">{selectedFormation.shortName}</span>
                    <div className="text-xs text-white/60">{selectedFormation.name}</div>
                  </div>

                  <button
                    onClick={handleNext}
                    className="w-10 h-10 bg-[#012169] rounded-lg flex items-center justify-center text-white hover:bg-[#013399]"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Formation Preview */}
                <div className="bg-[#009739]/20 rounded-xl p-4">
                  <div className="flex justify-center mb-4">
                    <div className="w-48 h-64 bg-[#009739]/30 rounded-lg relative border border-white/10">
                      {/* Pitch lines */}
                      <div className="absolute inset-2 border border-white/20 rounded">
                        {/* Center circle */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white/20 rounded-full" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white/20 rounded-full" />
                        {/* Goal areas */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-8 border border-white/20 border-t-0" />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-8 border border-white/20 border-b-0" />
                      </div>

                      {/* Player positions */}
                      {selectedFormation.positions.map((pos, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          className={`
                            absolute w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white
                            ${pos.role === 'GK' ? 'bg-purple-500' : ''}
                            ${pos.role.includes('CB') || pos.role === 'LB' || pos.role === 'RB' || pos.role.includes('WB') ? 'bg-blue-500' : ''}
                            ${pos.role.includes('CM') || pos.role.includes('CDM') || pos.role === 'LM' || pos.role === 'RM' ? 'bg-green-500' : ''}
                            ${pos.role === 'ST' || pos.role === 'LW' || pos.role === 'RW' ? 'bg-red-500' : ''}
                          `}
                          style={{
                            left: `${pos.x}%`,
                            top: `${pos.y}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          {pos.role}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex justify-center gap-6">
                    <div className="text-center">
                      <div className="text-xs text-white/50 mb-1">Ataque</div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                          <div
                            key={i}
                            className={`w-2 h-4 rounded-sm ${
                              i <= selectedFormation.balance.attack ? 'bg-red-500' : 'bg-white/10'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-white/50 mb-1">Defesa</div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                          <div
                            key={i}
                            className={`w-2 h-4 rounded-sm ${
                              i <= selectedFormation.balance.defense ? 'bg-blue-500' : 'bg-white/10'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fit Score */}
                <div className="flex items-center justify-between bg-[#004d00] rounded-lg p-3">
                  <span className="text-sm text-white/70">Compatibilidade com Elenco</span>
                  <span className={`text-lg font-bold ${getFitColor(fitScore)}`}>
                    {fitScore}%
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-white/60 text-center">
                  {selectedFormation.description}
                </p>

                {/* Suggestion Badge */}
                {selectedFormation.id === suggestedFormation && (
                  <div className="flex items-center justify-center gap-2 text-[#FEDD00]">
                    <Zap className="w-4 h-4" />
                    <span className="text-sm font-medium">Recomendado para seu elenco!</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="flex-1 py-3 bg-[#004d00] hover:bg-[#006400] rounded-lg font-medium text-white border border-[#FEDD00]/30"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(selectedFormation)}
                    className="flex-1 py-3 bg-[#FEDD00] hover:bg-[#ffea00] rounded-lg font-bold text-[#012169]"
                  >
                    Confirmar
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export type { FormationSelectorProps };
