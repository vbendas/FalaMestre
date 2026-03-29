'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GameState, StaffMember, StaffRole } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { User, DollarSign, ChevronLeft, Cross, Search, Trophy, Trash2 } from 'lucide-react';

interface StaffViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: ViewType) => void;
}

const STAFF_ICONS = {
  headCoach: Trophy,
  scout: Search,
  medicalStaff: Cross,
};

const STAFF_LABELS = {
  headCoach: 'Técnico Principal',
  scout: 'Scout',
  medicalStaff: 'Staff Médico',
};

export function StaffView({ gameState, userId, onViewChange }: StaffViewProps) {
  const { user, staff } = gameState;
  
  const roles: StaffRole[] = ['headCoach', 'scout', 'medicalStaff'];
  
  const getTotalWeeklyWage = () => {
    let total = 0;
    roles.forEach(role => {
      if (staff[role]) {
        total += staff[role]!.weeklyWage;
      }
    });
    return total;
  };

  const handleHire = async (role: StaffRole, tier: 'rookie' | 'professional' | 'elite') => {
    const cost = tier === 'rookie' ? 50000 : tier === 'professional' ? 200000 : 1000000;
    
    if ((user.money || 0) < cost) return;

    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'hire', role, tier }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to hire staff:', error);
    }
  };

  const handleFire = async (role: StaffRole) => {
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'fire', role }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to fire staff:', error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={() => onViewChange('dashboard')}
        className="flex items-center gap-2 text-white/60 hover:text-white"
      >
        <ChevronLeft className="w-5 h-5" />
        Voltar
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/50"
      >
        <div className="flex items-center gap-3">
          <User className="w-8 h-8 text-blue-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Staff Técnico</h2>
            <p className="text-sm text-white/60">Contrate funcionários para melhorar seu time</p>
          </div>
        </div>
      </motion.div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white">Staff Atual</h3>
        
        {roles.map((role, index) => {
          const currentStaff = staff[role];
          const IconComponent = STAFF_ICONS[role];
          
          return (
            <motion.div
              key={role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-[#006400] rounded-xl p-4 border-2 border-[#FEDD00]/30"
            >
              <div className="flex items-center gap-3 mb-3">
                <IconComponent className="w-6 h-6 text-green-400" />
                <div>
                  <h4 className="font-bold text-white">{STAFF_LABELS[role]}</h4>
                  {currentStaff ? (
                    <p className="text-sm text-white/60">Nível {currentStaff.level} • {currentStaff.specialty}</p>
                  ) : (
                    <p className="text-sm text-red-400">Vago - Contrate alguém!</p>
                  )}
                </div>
              </div>

              {currentStaff ? (
                <div className="bg-[#004d00] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{currentStaff.name}</p>
                      <p className="text-sm text-green-400">
                        Salário semanal: $ {currentStaff.weeklyWage.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleFire(role)}
                      className="p-2 bg-red-900/50 hover:bg-red-800/50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleHire(role, 'rookie')}
                    disabled={(user.money || 0) < 50000}
                    className="p-2 bg-[#004d00] hover:bg-[#005500] rounded-lg text-xs disabled:opacity-50"
                  >
                    <p className="font-bold text-white">Iniciante</p>
                    <p className="text-green-400">$$ 50K</p>
                    <p className="text-white/50">Nív 1-10</p>
                  </button>
                  <button
                    onClick={() => handleHire(role, 'professional')}
                    disabled={(user.money || 0) < 200000}
                    className="p-2 bg-[#004d00] hover:bg-[#005500] rounded-lg text-xs disabled:opacity-50"
                  >
                    <p className="font-bold text-white">Profissional</p>
                    <p className="text-yellow-400">$$ 200K</p>
                    <p className="text-white/50">Nív 11-30</p>
                  </button>
                  <button
                    onClick={() => handleHire(role, 'elite')}
                    disabled={(user.money || 0) < 1000000}
                    className="p-2 bg-[#004d00] hover:bg-[#005500] rounded-lg text-xs disabled:opacity-50"
                  >
                    <p className="font-bold text-white">Elite</p>
                    <p className="text-red-400">$$ 1M</p>
                    <p className="text-white/50">Nív 31-50</p>
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="bg-[#004d00] rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-2 text-white/60 mb-1">
          <DollarSign className="w-4 h-4" />
          <span className="text-sm">Folha Semanal</span>
        </div>
        <p className="text-2xl font-bold text-[#FEDD00]">$$ {getTotalWeeklyWage().toLocaleString()}</p>
        <p className="text-xs text-white/40">Dedução automática semanal</p>
      </div>

      <div className="bg-[#004d00] rounded-lg p-3 text-center">
        <p className="text-white/60 text-sm">Saldo Atual</p>
        <p className="text-2xl font-bold text-[#FEDD00]">$$ {(user.money || 0).toLocaleString()}</p>
      </div>
    </div>
  );
}