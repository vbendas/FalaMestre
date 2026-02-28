'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TeamCreationForm, type TeamFormData } from '@/components/onboarding/TeamCreationForm';
import { TeamPreviewCard } from '@/components/onboarding/TeamPreviewCard';

type Step = 'create' | 'preview' | 'confirm';

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
      // Call API to create team
      const response = await fetch('/api/onboarding/create-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      // Store userId in localStorage
      if (result.userId) {
        localStorage.setItem('falaMestreUserId', result.userId);
        localStorage.setItem('falaMestreJustOnboarded', 'true');
      }

      // Redirect to game
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#012169] via-[#009739] to-[#006400] text-white pixel-bg-grid">
      {/* Header */}
      <div className="bg-black bg-opacity-50 border-b-4 border-yellow-400 py-6">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-center mb-2">🏟️ Fala Mestre!</h1>
          <p className="text-center text-gray-300 text-lg">
            {step === 'create' && 'Crie Seu Time Personalizado'}
            {step === 'preview' && 'Confirme Seu Time'}
            {step === 'confirm' && 'Bem-vindo ao Jogo!'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Progress Indicator */}
        <div className="flex justify-between mb-12 max-w-md mx-auto">
          <div
            className={`flex-1 h-1 rounded mr-2 transition ${
              step === 'create' || step === 'preview' || step === 'confirm'
                ? 'bg-yellow-400'
                : 'bg-gray-600'
            }`}
          />
          <div
            className={`flex-1 h-1 rounded mr-2 transition ${
              step === 'preview' || step === 'confirm' ? 'bg-yellow-400' : 'bg-gray-600'
            }`}
          />
          <div
            className={`flex-1 h-1 rounded transition ${
              step === 'confirm' ? 'bg-yellow-400' : 'bg-gray-600'
            }`}
          />
        </div>

        {/* Step: Create Team */}
        {step === 'create' && (
          <div className="flex flex-col items-center">
            <TeamCreationForm onSubmit={handleCreateTeam} isLoading={isLoading} />
            <p className="mt-8 text-center text-gray-400 text-sm">
              💡 Dica: Escolha cores que representem sua personalidade como treinador!
            </p>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && teamData && (
          <div className="flex flex-col items-center gap-8">
            <TeamPreviewCard teamData={teamData} />

            <div className="flex gap-4 max-w-md w-full">
              <button
                onClick={handleGoBack}
                disabled={isLoading}
                className="flex-1 py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Voltar
              </button>
              <button
                onClick={handleConfirmTeam}
                disabled={isLoading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '⏳ Confirmando...' : '✅ Confirmar'}
              </button>
            </div>

            {error && (
              <div className="max-w-md w-full bg-red-900 bg-opacity-70 border-2 border-red-500 rounded-lg p-4 text-center text-red-200">
                {error}
              </div>
            )}

            <p className="text-center text-gray-400 text-sm">
              Satisfeito com seu time? Clique em "Confirmar" para começar a jogar!
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && step === 'preview' && (
          <div className="flex flex-col items-center gap-6">
            <div className="animate-spin">
              <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full" />
            </div>
            <p className="text-xl font-bold text-yellow-400">Criando seu time...</p>
            <p className="text-gray-400">Por favor aguarde um momento</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-black bg-opacity-50 border-t border-yellow-400 py-4 text-center text-gray-400 text-sm">
        <p>Fala Mestre! © 2024 • Powered by Claude AI</p>
      </div>
    </div>
  );
}
