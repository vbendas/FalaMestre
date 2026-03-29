'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GameState } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { FACILITY_UPGRADES } from '@/lib/constants';
import { Dumbbell, Heart, Users, Search, ChevronLeft, DollarSign } from 'lucide-react';

interface FacilitiesViewProps {
  gameState: GameState;
  onViewChange: (view: ViewType) => void;
}

const FACILITY_ICONS = {
  trainingCenter: Dumbbell,
  medicalCenter: Heart,
  youthAcademy: Users,
  scoutOffice: Search,
};

const FACILITY_LABELS = {
  trainingCenter: 'Centro de Treinamento',
  medicalCenter: 'Centro Médico',
  youthAcademy: 'Academia Juvenil',
  scoutOffice: 'Scout',
};

export function FacilitiesView({ gameState, onViewChange }: FacilitiesViewProps) {
  const { facilities, user } = gameState;
  
  const facilityTypes = Object.keys(FACILITY_UPGRADES) as Array<keyof typeof FACILITY_UPGRADES>;

  const getUpgradeCost = (facilityType: string, currentLevel: number) => {
    const facility = FACILITY_UPGRADES[facilityType as keyof typeof FACILITY_UPGRADES];
    if (!facility) return 0;
    if (currentLevel >= facility.maxLevel) return 0;
    return Math.floor(facility.baseCost * Math.pow(facility.costMultiplier, currentLevel));
  };

  const handleUpgrade = async (facilityType: string) => {
    const currentLevel = facilities[facilityType as keyof typeof facilities];
    const cost = getUpgradeCost(facilityType, currentLevel);
    
    if ((user.money || 0) < cost) return;

    try {
      const response = await fetch('/api/facilities/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          facilityType 
        }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to upgrade facility:', error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Back button */}
      <button
        onClick={() => onViewChange('dashboard')}
        className="flex items-center gap-2 text-white/60 hover:text-white"
      >
        <ChevronLeft className="w-5 h-5" />
        Voltar
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center gap-3">
          <Dumbbell className="w-8 h-8 text-[#FEDD00]" />
          <div>
            <h2 className="text-xl font-bold text-white">Instalações</h2>
            <p className="text-sm text-white/60">Melhore suas instalações para ter vantagens no jogo</p>
          </div>
        </div>
      </motion.div>

      {/* Facilities list */}
      {facilityTypes.map((facilityType, index) => {
        const currentLevel = facilities[facilityType];
        const facility = FACILITY_UPGRADES[facilityType as keyof typeof FACILITY_UPGRADES];
        const cost = getUpgradeCost(facilityType, currentLevel);
        const canAfford = (user.money || 0) >= cost;
        const isMaxLevel = currentLevel >= facility.maxLevel;
        
        const IconComponent = FACILITY_ICONS[facilityType as keyof typeof FACILITY_ICONS];

        return (
          <motion.div
            key={facilityType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/30"
          >
            <div className="flex items-center gap-3 mb-3">
              <IconComponent className="w-6 h-6 text-green-400" />
              <div>
                <h3 className="font-bold text-white">{FACILITY_LABELS[facilityType as keyof typeof FACILITY_LABELS]}</h3>
                <p className="text-xs text-white/60">Nível {currentLevel}/{facility.maxLevel}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-[#004d00] rounded-full overflow-hidden mb-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(currentLevel / facility.maxLevel) * 100}%` }}
                className="h-full bg-gradient-to-r from-green-600 to-green-400"
              />
            </div>

            {/* Effect description */}
            <p className="text-sm text-white/60 mb-3">
              {facilityType === 'trainingCenter' && `Aumenta o crescimento de atributos em +${facility.effectPerLevel}% por nível`}
              {facilityType === 'medicalCenter' && `Reduz dias de lesão em -${facility.effectPerLevel}% por nível`}
              {facilityType === 'youthAcademy' && `Gera +${(facility.effectPerLevel * 10).toFixed(0)}% jogadores na Academia por nível`}
              {facilityType === 'scoutOffice' && `Melhora a qualidade de jogadores encontrados em +${facility.effectPerLevel}% por nível`}
            </p>

            {/* Upgrade button */}
            {!isMaxLevel ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-xs">Custo do Upgrade</p>
                  <p className={`font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                    $ {cost.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleUpgrade(facilityType)}
                  disabled={!canAfford}
                  className={`px-4 py-2 rounded-lg font-bold ${
                    canAfford
                      ? 'bg-[#FEDD00] text-black hover:bg-[#ffea4d]'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Upgrade
                </button>
              </div>
            ) : (
              <p className="text-center text-yellow-400 font-bold">Nível Máximo!</p>
            )}
          </motion.div>
        );
      })}

      {/* Balance */}
      <div className="bg-[#004d00] rounded-lg p-3 text-center">
        <p className="text-white/60 text-sm">Saldo Atual</p>
        <p className="text-2xl font-bold text-[#FEDD00]">$ {(user.money || 0).toLocaleString()}</p>
      </div>
    </div>
  );
}