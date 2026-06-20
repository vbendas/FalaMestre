'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TeamCreationForm, type TeamFormData } from '@/components/onboarding/TeamCreationForm';
import { TeamPreviewCard } from '@/components/onboarding/TeamPreviewCard';
import { CrtCabinet } from '@/components/crt/CrtCabinet';
import { ViewContainer } from '@/components/crt/ViewContainer';
import { CrtButton } from '@/components/crt/CrtButton';
import { GlassCard } from '@/components/crt/GlassCard';
import { Divider } from '@/components/crt/Divider';

type Step = 'create' | 'preview' | 'confirm';

const STEP_LABELS: Record<Step, string> = {
  create: 'Crie Seu Time',
  preview: 'Confirme Seu Time',
  confirm: 'Bem-vindo!',
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('create');
  const [teamData, setTeamData] = useState<TeamFormData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateTeam = async (data: TeamFormData) => {
    setTeamData(data);
    setStep('preview');
  };

  const handleConfirmTeam = async () => {
    if (!teamData) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding/create-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: teamData.name,
          primaryColor: teamData.primaryColor,
          secondaryColor: teamData.secondaryColor,
          badgeStyle: teamData.badgeStyle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar time');
      }

      const result = await response.json();

      if (result.userId) {
        localStorage.setItem('falaMestreUserId', result.userId);
        localStorage.setItem('falaMestreJustOnboarded', 'true');
      }

      router.push('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    if (step === 'preview') {
      setStep('create');
      setTeamData(null);
    }
  };

  const stepIndex = step === 'create' ? 0 : step === 'preview' ? 1 : 2;

  return (
    <CrtCabinet>
      <div className="flex flex-col w-full h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(255,223,0,0.20)]">
          <span className="text-[0.6rem] gold-glow-text font-[family-name:var(--font-pixel)]">
            🏟️ FALA MESTRE!
          </span>
          <span className="text-xs text-[#55e0a0] font-[family-name:var(--font-pixel)]">
            {STEP_LABELS[step]}
          </span>

          {/* Step dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === stepIndex ? 12 : 6,
                  height: 6,
                  backgroundColor: i <= stepIndex ? '#FFDF00' : 'rgba(255,223,0,0.2)',
                  boxShadow: i === stepIndex ? '0 0 6px rgba(255,223,0,0.5)' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <ViewContainer className="flex-1 flex items-center justify-center">
          {step === 'create' && (
            <div className="w-full max-w-lg">
              <TeamCreationForm onSubmit={handleCreateTeam} isLoading={isLoading} />
            </div>
          )}

          {step === 'preview' && teamData && !isLoading && (
            <div className="flex flex-col items-center gap-4 w-full max-w-lg">
              <TeamPreviewCard teamData={teamData} />

              <div className="flex gap-3 w-full max-w-md">
                <CrtButton
                  variant="outline"
                  onClick={handleGoBack}
                  disabled={isLoading}
                  className="flex-1 py-2 text-[0.5rem]"
                >
                  ← VOLTAR
                </CrtButton>
                <CrtButton
                  variant="primary"
                  onClick={handleConfirmTeam}
                  disabled={isLoading}
                  pulse
                  className="flex-1 py-2 text-[0.5rem]"
                >
                  ✅ CONFIRMAR
                </CrtButton>
              </div>

              {error && (
                <GlassCard className="w-full max-w-md p-3 text-center border-[#FF3333]">
                  <p className="text-xs text-[#FF3333] font-[family-name:var(--font-pixel)]">
                    {error}
                  </p>
                </GlassCard>
              )}

              <p className="text-[0.5rem] text-[rgba(255,223,0,0.4)] font-[family-name:var(--font-pixel)]">
                Satisfeito com seu time? Clique em CONFIRMAR para começar!
              </p>
            </div>
          )}

          {isLoading && step === 'preview' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-2 border-[#FFDF00] border-t-transparent rounded-full animate-spin" />
              <p className="text-[0.55rem] gold-glow-text font-[family-name:var(--font-pixel)]">
                Criando seu time...
              </p>
            </div>
          )}
        </ViewContainer>
      </div>
    </CrtCabinet>
  );
}
