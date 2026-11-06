'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GameState, Player } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { PlayerCard } from '@/components/squad/PlayerCard';
import { PlayerDetailModal } from '@/components/squad/PlayerDetailModal';
import { SquadStats } from '@/components/squad/SquadStats';
import { FormationSelector } from '@/components/squad/FormationSelector';
import { SquadViewSkeleton } from '@/components/ui/SkeletonLoader';
import { ViewContainer, GlassCard, PositionBadge, CrtButton, ActionNotice } from '@/components/crt';
import { useGuardedAction } from '@/hooks/useGuardedAction';

const MotionGlassCard = motion(GlassCard);

interface SquadViewProps {
  gameState: GameState;
  onViewChange: (view: ViewType) => void;
  /** Sends a training request. The reply is read here, not by the caller. */
  onTrainPlayer?: (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') => Promise<Response>;
  userId?: string | null;
  isLoading?: boolean;
  /** Reloads the save from the server. Called after every training and formation reply. */
  onRefreshSave?: () => void | Promise<void>;
}

export function SquadView({ gameState, onViewChange, onTrainPlayer, userId, isLoading = false, onRefreshSave }: SquadViewProps) {
  const { squad, season, user } = gameState;

  // The id, not a copy of the player: after a session the save is reloaded
  // and the modal must show the player as they now are, not as they were
  // when the card was pressed.
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const selectedPlayer: Player | null = squad.players.find((p) => p.id === selectedPlayerId) ?? null;
  const [showFormationSelector, setShowFormationSelector] = useState(false);
  const training = useGuardedAction(onRefreshSave);
  const formation = useGuardedAction(onRefreshSave);
  const [captainId, setCaptainId] = useState<string | null>(null);
  // Formation picked in this view, kept locally until the next gameState refresh.
  const [pickedFormation, setPickedFormation] = useState<string | null>(null);

  if (isLoading) {
    return <SquadViewSkeleton />;
  }

  const currentFormation = pickedFormation ?? squad.formation;
  const displayedGameState: GameState = pickedFormation
    ? { ...gameState, squad: { ...squad, formation: pickedFormation } }
    : gameState;

  const playersByPosition = {
    GK: squad.players.filter(p => p.position === 'GK'),
    DEF: squad.players.filter(p => p.position === 'DEF'),
    MID: squad.players.filter(p => p.position === 'MID'),
    FWD: squad.players.filter(p => p.position === 'FWD'),
  };

  const positionLabels = {
    GK: 'Goleiros',
    DEF: 'Defensores',
    MID: 'Meio-campistas',
    FWD: 'Atacantes'
  };

  const handlePlayerSelect = (player: Player) => {
    training.dismiss();
    setSelectedPlayerId(player.id);
  };

  // A session that is refused (the save changed under it, the player is
  // injured, the budget is spent) is reported in the modal and the save is
  // reloaded; one that goes through reports what the route said happened.
  const handleTrain = async (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') => {
    if (!onTrainPlayer) return;
    await training.run<{ message?: string }>(() => onTrainPlayer(playerId, focus), {
      successMessage: (body) => body.message ?? null,
    });
  };

  const handleRest = (playerId: string) => handleTrain(playerId, 'rest');

  const handleSetCaptain = (playerId: string) => {
    setCaptainId(playerId);
  };

  const handleFormationChange = async (formationId: string) => {
    if (!userId) return;
    // A refused change leaves the formation as the reloaded save has it and
    // says so above the squad; the selector closes either way, since it
    // closes itself on a pick.
    await formation.run(
      () =>
        fetch('/api/squad/formation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, formation: formationId }),
        }),
      {
        onSuccess: () => setPickedFormation(formationId),
        successMessage: () => `Formação alterada para ${formationId}.`,
      }
    );
  };

  return (
    <ViewContainer className="pb-20 gap-3">
      <ActionNotice notice={formation.notice} onDismiss={formation.dismiss} pending={formation.pending} />
      <SquadStats
        gameState={displayedGameState}
        onFormationClick={() => setShowFormationSelector(true)}
      />

      {(Object.keys(playersByPosition) as Array<keyof typeof playersByPosition>).map((pos) => (
        <MotionGlassCard
          key={pos}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-3"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PositionBadge position={pos} className="text-white font-bold" />
              <span className="text-xs text-[#55e0a0]/60 font-[family-name:var(--font-pixel)]">
                {playersByPosition[pos].length} jogadores
              </span>
            </div>
            {pos === 'FWD' && (
              <CrtButton
                variant="outline"
                onClick={() => onViewChange('dashboard')}
                className="text-[0.55rem] px-2 py-0.5"
              >
                Ver início →
              </CrtButton>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            {playersByPosition[pos].map((player, idx) => (
              <PlayerCard
                key={player.id}
                player={player}
                index={idx}
                onPlayerSelect={handlePlayerSelect}
              />
            ))}
          </div>

          {playersByPosition[pos].length === 0 && (
            <div className="text-center py-4 text-[#55e0a0]/30 text-sm font-[family-name:var(--font-pixel)]">
              Nenhum jogador nesta posição
            </div>
          )}
        </MotionGlassCard>
      ))}

      <PlayerDetailModal
        player={selectedPlayer}
        isOpen={!!selectedPlayer}
        onClose={() => {
          training.dismiss();
          setSelectedPlayerId(null);
        }}
        gameState={gameState}
        onTrain={handleTrain}
        onRest={handleRest}
        onSetCaptain={handleSetCaptain}
        isCaptain={selectedPlayer ? captainId === selectedPlayer.id : false}
        trainingNotice={
          <ActionNotice notice={training.notice} onDismiss={training.dismiss} pending={training.pending} />
        }
      />

      <FormationSelector
        isOpen={showFormationSelector}
        onClose={() => setShowFormationSelector(false)}
        currentFormation={currentFormation}
        players={squad.players}
        onSelectFormation={handleFormationChange}
      />
    </ViewContainer>
  );
}
