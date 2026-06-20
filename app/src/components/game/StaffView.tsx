'use client';

import React from 'react';
import { GameState, StaffRole } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import {
  GlassCard,
  CrtButton,
  CoinDisplay,
  SectionTitle,
  ManagementLayout,
} from '@/components/crt';

interface StaffViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: ViewType) => void;
}

const STAFF_ICONS: Record<StaffRole, string> = {
  headCoach: '🏆',
  scout: '🔍',
  medicalStaff: '🏥',
};

const STAFF_LABELS: Record<StaffRole, string> = {
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
    <ManagementLayout
      title="COMISSÃO TÉCNICA"
      icon="👔"
      money={user.money || 0}
      onBack={() => onViewChange('dashboard')}
    >
      <div className="space-y-3">
        <SectionTitle>Staff Atual</SectionTitle>

        {roles.map((role) => {
          const currentStaff = staff[role];

          return (
            <GlassCard key={role} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{STAFF_ICONS[role]}</span>
                <div className="flex-1">
                  <div className="font-[family-name:var(--font-pixel)] text-[0.6rem] gold-glow-text">
                    {STAFF_LABELS[role]}
                  </div>
                  {currentStaff ? (
                    <div className="section-title">
                      Nível {currentStaff.level} • {currentStaff.specialty}
                    </div>
                  ) : (
                    <div className="section-title text-[#FF3333]">Vago - Contrate alguém!</div>
                  )}
                </div>
              </div>

              {currentStaff ? (
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-[family-name:var(--font-pixel)] text-[0.6rem] text-[#FFDF00]">
                      {currentStaff.name}
                    </div>
                    <CoinDisplay amount={currentStaff.weeklyWage} size="sm" />
                  </div>
                  <CrtButton
                    onClick={() => handleFire(role)}
                    variant="control-red"
                    className="text-[0.5rem] px-2 py-1"
                  >
                    DEMITIR
                  </CrtButton>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <CrtButton
                    onClick={() => handleHire(role, 'rookie')}
                    disabled={(user.money || 0) < 50000}
                    variant="control-cyan"
                    className="flex flex-col items-center py-2 px-1"
                  >
                    <span className="text-[0.5rem] text-[#FFDF00]">Iniciante</span>
                    <span className="text-xs text-[#55e0a0]">50K</span>
                    <span className="text-[0.5rem] text-white/50">Nív 1-10</span>
                  </CrtButton>
                  <CrtButton
                    onClick={() => handleHire(role, 'professional')}
                    disabled={(user.money || 0) < 200000}
                    variant="control-cyan"
                    className="flex flex-col items-center py-2 px-1"
                  >
                    <span className="text-[0.5rem] text-[#FFDF00]">Profissional</span>
                    <span className="text-xs text-[#55e0a0]">200K</span>
                    <span className="text-[0.5rem] text-white/50">Nív 11-30</span>
                  </CrtButton>
                  <CrtButton
                    onClick={() => handleHire(role, 'elite')}
                    disabled={(user.money || 0) < 1000000}
                    variant="control-cyan"
                    className="flex flex-col items-center py-2 px-1"
                  >
                    <span className="text-[0.5rem] text-[#FFDF00]">Elite</span>
                    <span className="text-xs text-[#55e0a0]">1M</span>
                    <span className="text-[0.5rem] text-white/50">Nív 31-50</span>
                  </CrtButton>
                </div>
              )}
            </GlassCard>
          );
        })}

        <GlassCard className="p-3 text-center space-y-1">
          <div className="section-title">Folha Semanal</div>
          <CoinDisplay amount={getTotalWeeklyWage()} size="lg" />
          <div className="text-xs text-white/40 font-[family-name:var(--font-pixel)]">
            Dedução automática semanal
          </div>
        </GlassCard>
      </div>
    </ManagementLayout>
  );
}
