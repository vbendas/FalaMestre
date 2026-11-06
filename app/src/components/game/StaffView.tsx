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
  ActionNotice,
} from '@/components/crt';
import { useGuardedAction } from '@/hooks/useGuardedAction';

interface StaffViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: ViewType) => void;
  /** Reloads the save from the server. Called after every hire or fire reply. */
  onRefreshSave?: () => void | Promise<void>;
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

export function StaffView({ gameState, userId, onViewChange, onRefreshSave }: StaffViewProps) {
  const { user, staff } = gameState;
  const action = useGuardedAction(onRefreshSave);

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

  // Used to reload the page on success and do nothing on a refusal, so a
  // hire the save refused (another write landed first, or the money shown
  // here was already spent) left the screen as it was. Now every reply is
  // read, the save is reloaded after it, and a refusal is shown with the
  // same action one press away.
  const handleHire = async (role: StaffRole, tier: 'rookie' | 'professional' | 'elite') => {
    const cost = tier === 'rookie' ? 50000 : tier === 'professional' ? 200000 : 1000000;

    if ((user.money || 0) < cost) return;

    await action.run<{ staff?: { name?: string } }>(
      () =>
        fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, action: 'hire', role, tier }),
        }),
      { successMessage: (body) => `${body.staff?.name ?? 'Novo membro'} contratado para ${STAFF_LABELS[role]}.` }
    );
  };

  const handleFire = async (role: StaffRole) => {
    await action.run(
      () =>
        fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, action: 'fire', role }),
        }),
      { successMessage: () => `${STAFF_LABELS[role]} demitido.` }
    );
  };

  return (
    <ManagementLayout
      title="COMISSÃO TÉCNICA"
      icon="👔"
      money={user.money || 0}
      onBack={() => onViewChange('dashboard')}
    >
      <div className="space-y-3">
        <ActionNotice notice={action.notice} onDismiss={action.dismiss} pending={action.pending} />
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
