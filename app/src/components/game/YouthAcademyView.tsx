'use client';

import React, { useState, useEffect } from 'react';
import { GameState, YouthPlayer, TrainingFocus } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { Star, Check, X, Target } from 'lucide-react';
import {
  GlassCard,
  CrtButton,
  SectionTitle,
  PositionBadge,
  ProgressBar,
  ManagementLayout,
  ActionNotice,
} from '@/components/crt';
import { useGuardedAction } from '@/hooks/useGuardedAction';

interface YouthAcademyViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: ViewType) => void;
  /** Reloads the save from the server. Called after every academy action's reply. */
  onRefreshSave?: () => void | Promise<void>;
}

export function YouthAcademyView({ gameState, userId, onViewChange, onRefreshSave }: YouthAcademyViewProps) {
  const { user, facilities, season } = gameState;
  const [players, setPlayers] = useState<YouthPlayer[]>([]);
  const [weeksUntilIntake, setWeeksUntilIntake] = useState(4);
  const [focus, setFocus] = useState<TrainingFocus>(null);
  // Every academy action is a write to the save; a refusal (the save changed
  // under it) used to leave the prospect on screen with nothing said, which
  // read as a button that did nothing. The hook reports it and reloads.
  const action = useGuardedAction(onRefreshSave);
  const loading = action.pending;

  useEffect(() => {
    const academy = gameState.youthAcademy;
    if (academy) {
      setPlayers(academy.playersAvailable || []);
      setFocus(academy.trainingFocus);
      const weeks = academy.nextIntakeWeek - season.week;
      setWeeksUntilIntake(Math.max(0, weeks));
    }
  }, [gameState.youthAcademy, season.week]);

  const post = (body: Record<string, unknown>) =>
    fetch(`/api/youth?userId=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const handleGenerateIntake = async () => {
    await action.run<{ players?: YouthPlayer[]; action?: string }>(() => post({ action: 'generate' }), {
      onSuccess: (data) => setPlayers(data.players || []),
      successMessage: (data) =>
        data.action === 'intake_generated'
          ? `Nova turma: ${data.players?.length ?? 0} jogadores chegaram à base.`
          : null,
    });
  };

  const handleSignPlayer = async (playerId: string) => {
    const name = players.find((p) => p.id === playerId)?.name ?? 'Jogador';
    await action.run(() => post({ action: 'sign', playerId }), {
      onSuccess: () => setPlayers((prev) => prev.filter((p) => p.id !== playerId)),
      successMessage: () => `${name} promovido ao elenco principal.`,
    });
  };

  const handleRejectPlayer = async (playerId: string) => {
    await action.run(() => post({ action: 'reject', playerId }), {
      onSuccess: () => setPlayers((prev) => prev.filter((p) => p.id !== playerId)),
    });
  };

  const handleSetFocus = async (newFocus: TrainingFocus) => {
    await action.run(() => post({ action: 'set-focus', focus: newFocus }), {
      onSuccess: () => setFocus(newFocus),
    });
  };

  const renderStars = (stars: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`w-3 h-3 ${i <= stars ? 'text-[#FFDF00] fill-[#FFDF00]' : 'text-white/20'}`}
          />
        ))}
      </div>
    );
  };

  const academyLevel = facilities.youthAcademy;

  return (
    <ManagementLayout
      title="ACADEMIA DE JOVENS"
      icon="🌟"
      money={user.money || 0}
      onBack={() => onViewChange('dashboard')}
    >
      <div className="space-y-3">
        <ActionNotice notice={action.notice} onDismiss={action.dismiss} pending={action.pending} />

        {players.length === 0 && (
          <GlassCard className="p-4 text-center">
            <p className="text-white/70 text-xs font-[family-name:var(--font-pixel)] mb-2">
              PRÓXIMA TURMA DE JOGADORES JUNIORES
            </p>
            <p className="text-2xl font-bold text-[#FFDF00] font-[family-name:var(--font-pixel)] mb-1">
              {weeksUntilIntake} SEMANAS
            </p>
            <ProgressBar
              value={4 - weeksUntilIntake}
              max={4}
              height={6}
              color="#00A859"
              className="mb-3"
            />

            {academyLevel === 0 ? (
              <p className="text-[#FF3333] text-[0.5rem] font-[family-name:var(--font-pixel)]">
                CONSTRUA SUA ACADEMIA JUVENIL PARA RECEBER JOGADORES!
              </p>
            ) : (
              <CrtButton
                onClick={handleGenerateIntake}
                disabled={loading}
                variant="primary"
                pulse={!loading}
                className="text-[0.55rem] px-4 py-1.5"
              >
                {loading ? 'GERANDO...' : 'GERAR NOVA TURMA'}
              </CrtButton>
            )}
          </GlassCard>
        )}

        {players.length > 0 && (
          <>
            <GlassCard className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-[#55e0a0]" />
                <SectionTitle>FOCO DE TREINAMENTO</SectionTitle>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['technical', 'physical', 'tactical'] as const).map((f) => (
                  <CrtButton
                    key={f}
                    onClick={() => handleSetFocus(f)}
                    variant={focus === f ? 'control-active' : 'control'}
                    className="text-[0.5rem] py-1.5 w-full"
                  >
                    {f === 'technical' && 'TÉCNICO'}
                    {f === 'physical' && 'FÍSICO'}
                    {f === 'tactical' && 'TÁTICO'}
                  </CrtButton>
                ))}
              </div>
            </GlassCard>

            <SectionTitle>JOGADORES DISPONÍVEIS</SectionTitle>

            <div className="space-y-2">
              {players.map((player) => (
                <GlassCard key={player.id} glow className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <PositionBadge position={player.position} />
                        <span className="font-bold text-white text-sm truncate">
                          {player.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[0.5rem] text-white/50 font-[family-name:var(--font-pixel)]">
                        <span>IDADE: {player.age}</span>
                        <span>CA: {player.currentAbility}</span>
                        <span>PA: {player.potential}</span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[0.5rem] text-white/30 font-[family-name:var(--font-pixel)]">
                          SCOUT:
                        </span>
                        {renderStars(player.scoutAssessment)}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {player.personalityTraits.map((trait, i) => (
                          <span
                            key={i}
                            className="text-[0.5rem] px-1.5 py-0.5 rounded-sm bg-white/5 text-[#55e0a0]/70 font-[family-name:var(--font-pixel)]"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <CrtButton
                        onClick={() => handleRejectPlayer(player.id)}
                        variant="control-red"
                        className="p-1.5"
                      >
                        <X className="w-4 h-4" />
                      </CrtButton>
                      <CrtButton
                        onClick={() => handleSignPlayer(player.id)}
                        variant="control-cyan"
                        className="p-1.5"
                      >
                        <Check className="w-4 h-4" />
                      </CrtButton>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>
    </ManagementLayout>
  );
}
