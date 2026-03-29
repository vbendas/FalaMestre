'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GameState } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { STADIUM_UPGRADES } from '@/lib/constants';
import { Building, DollarSign, Users, ArrowRight, ChevronLeft, TrendingUp } from 'lucide-react';

interface StadiumViewProps {
  gameState: GameState;
  onViewChange: (view: ViewType) => void;
}

export function StadiumView({ gameState, onViewChange }: StadiumViewProps) {
  const { stadium, user, facilities } = gameState;
  const currentStadium = stadium.level >= STADIUM_UPGRADES.length - 1 
    ? STADIUM_UPGRADES[STADIUM_UPGRADES.length - 1]
    : STADIUM_UPGRADES[stadium.level];
    
  const nextStadium = stadium.level < STADIUM_UPGRADES.length - 1 
    ? STADIUM_UPGRADES[stadium.level + 1]
    : null;

  const canAffordUpgrade = nextStadium && (user.money || 0) >= nextStadium.cost;
  const isMaxLevel = stadium.level >= STADIUM_UPGRADES.length - 1;

  const handleUpgrade = async () => {
    if (!canAffordUpgrade) return;

    try {
      const response = await fetch('/api/stadium/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to upgrade stadium:', error);
    }
  };

  const estimatedMatchRevenue = stadium.capacity > 0
    ? Math.floor(
        stadium.capacity * 
        (0.7 + stadium.amenities / 500) * 
        stadium.ticketPrice * 
        0.7
      )
    : 0;

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
        <div className="flex items-center gap-3 mb-4">
          <Building className="w-8 h-8 text-[#FEDD00]" />
          <div>
            <h2 className="text-xl font-bold text-white">Estádio</h2>
            <p className="text-sm text-white/60">Nível {stadium.level}</p>
          </div>
        </div>

        {/* Current Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-[#004d00] rounded-lg p-3">
            <div className="flex items-center gap-2 text-white/60 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs">Capacidade</span>
            </div>
            <p className="text-2xl font-bold text-[#FEDD00]">{stadium.capacity.toLocaleString()}</p>
          </div>
          <div className="bg-[#004d00] rounded-lg p-3">
            <div className="flex items-center gap-2 text-white/60 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs">Preço Ingresso</span>
            </div>
            <p className="text-2xl font-bold text-[#FEDD00]">$ {stadium.ticketPrice}</p>
          </div>
        </div>

        {/* Revenue estimate */}
        {stadium.capacity > 0 && (
          <div className="bg-[#004d00] rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Receita Estimada por Partida</span>
            </div>
            <p className="text-xl font-bold text-white">$ {estimatedMatchRevenue.toLocaleString()}</p>
            <p className="text-xs text-white/40">70% da renda com cupons</p>
          </div>
        )}
      </motion.div>

      {/* Upgrade section */}
      {!isMaxLevel && nextStadium && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#006400] rounded-xl p-4 border-2 border-green-500/50"
        >
          <h3 className="text-lg font-bold text-white mb-3">Próxima Ampliação</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-[#004d00] rounded-lg p-3">
              <div className="text-white/60 text-xs mb-1">Nova Capacidade</div>
              <p className="text-xl font-bold text-white">{nextStadium.capacity.toLocaleString()}</p>
            </div>
            <div className="bg-[#004d00] rounded-lg p-3">
              <div className="text-white/60 text-xs mb-1">Novo Preço</div>
              <p className="text-xl font-bold text-white">$ {nextStadium.ticketPrice}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Custo da Upgrade</p>
              <p className={`text-xl font-bold ${canAffordUpgrade ? 'text-green-400' : 'text-red-400'}`}>
                $ {nextStadium.cost.toLocaleString()}
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={!canAffordUpgrade}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold ${
                canAffordUpgrade
                  ? 'bg-[#FEDD00] text-black hover:bg-[#ffea4d]'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {canAffordUpgrade ? 'Upgrade' : 'Saldo Insuficiente'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Max level reached */}
      {isMaxLevel && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#006400] rounded-xl p-4 border-2 border-yellow-500/50 text-center"
        >
          <p className="text-yellow-400 font-bold text-lg">Estádio no nível máximo!</p>
          <p className="text-white/60">Você alcançou a capacidade máxima</p>
        </motion.div>
      )}

      {/* No stadium yet */}
      {stadium.capacity === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-900/50 rounded-xl p-4 border-2 border-red-500/50"
        >
          <p className="text-red-300 font-medium mb-2">Você não tem um estádio ainda!</p>
          <p className="text-white/60 text-sm mb-3">
            Sem estádio, você só recebe receitas de jogos fora de casa. 
            Construa seu estádio para receber torcedores e aumentar seus lucros!
          </p>
          <button
            onClick={handleUpgrade}
            disabled={!canAffordUpgrade}
            className={`w-full py-3 rounded-lg font-bold ${
              canAffordUpgrade
                ? 'bg-[#FEDD00] text-black hover:bg-[#ffea4d]'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Construir Estádio - $ {nextStadium?.cost.toLocaleString()}
          </button>
        </motion.div>
      )}

      {/* Current Balance */}
      <div className="bg-[#004d00] rounded-lg p-3 text-center">
        <p className="text-white/60 text-sm">Saldo Atual</p>
        <p className="text-2xl font-bold text-[#FEDD00]">$ {(user.money || 0).toLocaleString()}</p>
      </div>
    </div>
  );
}