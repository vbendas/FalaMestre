'use client';

import React from 'react';
import { GameState } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { FACILITY_UPGRADES } from '@/lib/constants';
import {
  GlassCard,
  CrtButton,
  ProgressBar,
  CoinDisplay,
  ManagementLayout,
  SectionTitle,
} from '@/components/crt';

interface FacilitiesViewProps {
  gameState: GameState;
  onViewChange: (view: ViewType) => void;
}

const FACILITY_ICONS: Record<string, string> = {
  trainingCenter: '🏋️',
  medicalCenter: '🏥',
  youthAcademy: '🎓',
  scoutOffice: '🔍',
};

const FACILITY_LABELS: Record<string, string> = {
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
          facilityType,
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
    <ManagementLayout
      title="INSTALAÇÕES"
      icon="⚙️"
      money={user.money || 0}
      onBack={() => onViewChange('dashboard')}
    >
      <div className="space-y-3">
        <SectionTitle>Instalações do Clube</SectionTitle>

        {facilityTypes.map((facilityType) => {
          const currentLevel = facilities[facilityType];
          const facility = FACILITY_UPGRADES[facilityType as keyof typeof FACILITY_UPGRADES];
          const cost = getUpgradeCost(facilityType, currentLevel);
          const canAfford = (user.money || 0) >= cost;
          const isMaxLevel = currentLevel >= facility.maxLevel;

          return (
            <GlassCard key={facilityType} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{FACILITY_ICONS[facilityType]}</span>
                <div className="flex-1">
                  <div className="font-[family-name:var(--font-pixel)] text-[0.6rem] gold-glow-text">
                    {FACILITY_LABELS[facilityType]}
                  </div>
                  <div className="section-title">
                    Nível {currentLevel}/{facility.maxLevel}
                  </div>
                </div>
              </div>

              <ProgressBar
                value={currentLevel}
                max={facility.maxLevel}
                height={6}
                color="#00A859"
              />

              <p className="text-[0.5rem] text-[#55e0a0]/70 font-[family-name:var(--font-pixel)]">
                {facilityType === 'trainingCenter' &&
                  `Aumenta o crescimento de atributos em +${facility.effectPerLevel}% por nível`}
                {facilityType === 'medicalCenter' &&
                  `Reduz dias de lesão em -${facility.effectPerLevel}% por nível`}
                {facilityType === 'youthAcademy' &&
                  `Gera +${(facility.effectPerLevel * 10).toFixed(0)}% jogadores na Academia por nível`}
                {facilityType === 'scoutOffice' &&
                  `Melhora a qualidade de jogadores encontrados em +${facility.effectPerLevel}% por nível`}
              </p>

              {!isMaxLevel ? (
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="section-title">Custo do Upgrade</div>
                    <CoinDisplay amount={cost} size="sm" />
                  </div>
                  <CrtButton
                    onClick={() => handleUpgrade(facilityType)}
                    disabled={!canAfford}
                    variant={canAfford ? 'primary' : 'outline'}
                  >
                    UPGRADE
                  </CrtButton>
                </div>
              ) : (
                <p className="text-center text-[0.5rem] text-[#FFDF00] font-[family-name:var(--font-pixel)]">
                  NÍVEL MÁXIMO!
                </p>
              )}
            </GlassCard>
          );
        })}
      </div>
    </ManagementLayout>
  );
}
