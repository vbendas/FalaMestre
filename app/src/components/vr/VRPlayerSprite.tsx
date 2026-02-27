// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

import { useEffect, useRef } from 'react';

interface PlayerPosition {
  x: number;
  z: number;
}

export interface VRPlayerSpriteProps {
  id: string;
  position: PlayerPosition;
  team: 'home' | 'away';
  playerNumber: number;
  playerName: string;
  spriteUrl?: string;
  animationState?: 'idle' | 'running' | 'celebrating' | 'defending';
}

export function VRPlayerSprite({
  id,
  position,
  team,
  playerNumber,
  playerName,
  spriteUrl,
  animationState = 'idle',
}: VRPlayerSpriteProps) {
  const playerRef = useRef<HTMLDivElement>(null);

  const teamColor = team === 'home' ? '#EF4444' : '#3B82F6';
  
  const getAnimationScale = () => {
    switch (animationState) {
      case 'running':
        return '1 1 1';
      case 'celebrating':
        return '1.2 1.2 1.2';
      case 'defending':
        return '0.9 0.9 0.9';
      default:
        return '1 1 1';
    }
  };

  return (
    <a-entity
      id={`player-${id}`}
      position={`${position.x} 1 ${position.z}`}
      animation={`property: scale; to: ${getAnimationScale()}; dur: 300; easing: easeInOutQuad`}
    >
      <a-cylinder
        position="0 0 0"
        radius={0.8}
        height={1.6}
        color={teamColor}
        material="opacity: 0.9"
      />
      
      <a-sphere
        position="0 1.1 0"
        radius={0.5}
        color="#8B4513"
      />

      <a-circle
        position="0 1.1 0.45"
        radius={0.35}
        color="#ffffff"
        material="side: double"
      >
        <a-text
          value={playerNumber.toString()}
          position="0 0 0.01"
          align="center"
          width={2}
          color="#000000"
          font="mozillavr"
        />
      </a-circle>

      <a-text
        value={playerName.substring(0, 8)}
        position="0 2 0"
        align="center"
        width={4}
        color="#ffffff"
        font="mozillavr"
        side="double"
      />
    </a-entity>
  );
}

export function VRBall({ position, isMoving }: { position: PlayerPosition; isMoving: boolean }) {
  return (
    <a-sphere
      id="match-ball"
      position={`${position.x} 0.3 ${position.z}`}
      radius={0.3}
      color="#ffffff"
      material="metalness: 0.3; roughness: 0.7"
      animation={isMoving ? {
        property: 'position',
        to: `${position.x} 1 ${position.z}`,
        dur: 500,
        easing: 'easeInOutQuad',
        loop: true,
        dir: 'alternate',
      } : undefined}
    >
      <a-sphere
        radius={0.15}
        color="#000000"
        position="0.15 0 0"
      />
      <a-sphere
        radius={0.15}
        color="#000000"
        position="-0.1 0.1 0.1"
      />
    </a-sphere>
  );
}
