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
import { ViewContainer, GlassCard, PositionBadge, CrtButton } from '@/components/crt';

const MotionGlassCard = motion(GlassCard);

interface SquadViewProps {
  gameState: GameState;
  onViewChange: (view: ViewType) => void;
  onTrainPlayer?: (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') => Promise<void>;
  userId?: string | null;
  isLoading?: boolean;
}

export function SquadView({ gameState, onViewChange, onTrainPlayer, userId, isLoading = false }: SquadViewProps) {
  const { squad, season, user } = gameState;

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showFormationSelector, setShowFormationSelector] = useState(false);
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
    setSelectedPlayer(player);
  };

  const handleTrain = async (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') => {
    if (onTrainPlayer) {
      await onTrainPlayer(playerId, focus);
    }
  };

  const handleRest = async (playerId: string) => {
    if (onTrainPlayer) {
      await onTrainPlayer(playerId, 'rest');
    }
  };

  const handleSetCaptain = (playerId: string) => {
    setCaptainId(playerId);
  };

  const handleFormationChange = async (formationId: string) => {
    if (!userId) return;

    try {
      const response = await fetch('/api/squad/formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, formation: formationId }),
      });

      if (response.ok) {
        setPickedFormation(formationId);
        setShowFormationSelector(false);
      }
    } catch (error) {
      console.error('Formation change failed:', error);
    }
  };

  return (
    <ViewContainer className="pb-20 gap-3">
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
        onClose={() => setSelectedPlayer(null)}
        gameState={gameState}
        onTrain={handleTrain}
        onRest={handleRest}
        onSetCaptain={handleSetCaptain}
        isCaptain={selectedPlayer ? captainId === selectedPlayer.id : false}
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
