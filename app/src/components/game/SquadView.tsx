'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Star } from 'lucide-react';
import { GameState, Player } from '@/lib/types';
import { ViewType } from '@/hooks/useGameState';
import { PlayerCard } from '@/components/squad/PlayerCard';
import { PlayerDetailModal } from '@/components/squad/PlayerDetailModal';
import { SquadStats } from '@/components/squad/SquadStats';
import { FormationSelector } from '@/components/squad/FormationSelector';

interface SquadViewProps {
  gameState: GameState;
  onViewChange: (view: ViewType) => void;
  onTrainPlayer?: (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') => Promise<void>;
  userId?: string | null;
}

export function SquadView({ gameState, onViewChange, onTrainPlayer, userId }: SquadViewProps) {
  const { squad, season, user } = gameState;
  
  // State for modals
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showFormationSelector, setShowFormationSelector] = useState(false);
  const [captainId, setCaptainId] = useState<string | null>(null);

  // Group players by position
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

  // Handle player selection (open detail modal)
  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
  };

  // Handle training
  const handleTrain = async (playerId: string, focus: 'technical' | 'physical' | 'tactical' | 'rest') => {
    if (onTrainPlayer) {
      await onTrainPlayer(playerId, focus);
    }
  };

  // Handle rest
  const handleRest = async (playerId: string) => {
    if (onTrainPlayer) {
      await onTrainPlayer(playerId, 'rest');
    }
  };

  // Handle set captain
  const handleSetCaptain = (playerId: string) => {
    setCaptainId(playerId);
  };

  // Handle formation change
  const handleFormationChange = async (formationId: string) => {
    if (!userId) return;
    
    try {
      const response = await fetch('/api/squad/formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, formation: formationId }),
      });
      
      if (response.ok) {
        // Update local state
        gameState.squad.formation = formationId;
        setShowFormationSelector(false);
      }
    } catch (error) {
      console.error('Formation change failed:', error);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Squad Stats Dashboard */}
      <SquadStats 
        gameState={gameState}
        onFormationClick={() => setShowFormationSelector(true)}
      />

      {/* Players List with position groups */}
      {(Object.keys(playersByPosition) as Array<keyof typeof playersByPosition>).map((pos) => (
        <motion.div
          key={pos}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-xl p-3 border border-white/10"
        >
          {/* Position Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`
                px-2 py-0.5 rounded text-xs font-bold text-white
                ${pos === 'GK' ? 'bg-purple-500' : ''}
                ${pos === 'DEF' ? 'bg-blue-500' : ''}
                ${pos === 'MID' ? 'bg-green-500' : ''}
                ${pos === 'FWD' ? 'bg-red-500' : ''}
              `}>
                {positionLabels[pos]}
              </span>
              <span className="text-xs text-white/40">
                {playersByPosition[pos].length} jogadores
              </span>
            </div>
            {pos === 'FWD' && (
              <button
                onClick={() => onViewChange('chat')}
                className="text-xs text-[#FEDD00] hover:underline"
              >
                Ver no chat →
              </button>
            )}
          </div>

          {/* Players Grid */}
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

          {/* Empty state */}
          {playersByPosition[pos].length === 0 && (
            <div className="text-center py-4 text-white/30 text-sm">
              Nenhum jogador nesta posição
            </div>
          )}
        </motion.div>
      ))}

      {/* Player Detail Modal */}
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

      {/* Formation Selector Modal */}
      <FormationSelector
        isOpen={showFormationSelector}
        onClose={() => setShowFormationSelector(false)}
        currentFormation={squad.formation}
        players={squad.players}
        onSelectFormation={handleFormationChange}
      />
    </div>
  );
}
