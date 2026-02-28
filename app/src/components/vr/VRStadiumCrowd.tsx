// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

import { useEffect, useState, useMemo } from 'react';

const FIELD_LENGTH = 80;
const FIELD_WIDTH = 45;
const FIELD_HALF_X = FIELD_LENGTH / 2;
const FIELD_HALF_Z = FIELD_WIDTH / 2;
const STADIUM_DISTANCE = 12;
const TIER_HEIGHT = 2.5;
const TIER_COUNT = 3;

const CROWD_COLORS = {
  home: ['#DC2626', '#EF4444', '#F87171', '#B91C1C', '#991B1B', '#7F1D1D'],
  away: ['#2563EB', '#3B82F6', '#60A5FA', '#1D4ED8', '#1E40AF', '#1E3A8A'],
  neutral: ['#6B7280', '#9CA3AF', '#4B5563', '#D1D5DB', '#E5E7EB', '#F3F4F6']
};

interface CrowdPersonProps {
  position: { x: number; y: number; z: number };
  color: string;
}

function CrowdPerson({ position, color }: CrowdPersonProps) {
  return (
    <a-entity position={`${position.x} ${position.y} ${position.z}`}>
      <a-cylinder
        position="0 0.35 0"
        radius={0.18}
        height={0.7}
        color={color}
        material="shader: flat"
      />
      <a-sphere
        position="0 0.85 0"
        radius={0.15}
        color="#8B4513"
        material="shader: flat"
      />
    </a-entity>
  );
}

interface CrowdSectionProps {
  startX: number;
  endX: number;
  z: number;
  tier: number;
  teamColors: string[];
}

function CrowdSection({ startX, endX, z, tier, teamColors }: CrowdSectionProps) {
  const people = useMemo(() => {
    const result: { position: { x: number; y: number; z: number }; color: string }[] = [];
    const spacingX = 1.8;
    const start = Math.min(startX, endX);
    const end = Math.max(startX, endX);
    const maxPeople = 15;
    let count = 0;
    
    for (let x = start; x <= end && count < maxPeople; x += spacingX) {
      const colorIdx = Math.floor(Math.random() * teamColors.length);
      result.push({
        position: { x, y: tier * TIER_HEIGHT + 0.15, z },
        color: teamColors[colorIdx]
      });
      count++;
    }
    
    return result;
  }, [startX, endX, z, tier, teamColors]);

  return (
    <>
      {people.map((person, idx) => (
        <CrowdPerson
          key={`crowd-${tier}-${z}-${idx}`}
          position={person.position}
          color={person.color}
        />
      ))}
    </>
  );
}

interface StadiumStandProps {
  side: 'left' | 'right' | 'top' | 'bottom';
}

function StadiumStand({ side }: StadiumStandProps) {
  const tiers = useMemo(() => {
    const result: JSX.Element[] = [];
    
    for (let t = 0; t < TIER_COUNT; t++) {
      const y = t * TIER_HEIGHT;
      const height = TIER_HEIGHT;
      
      let startX: number, endX: number, startZ: number, endZ: number;
      let zOffset = 0, xOffset = 0;
      
      switch (side) {
        case 'left':
          startX = -FIELD_HALF_X + 8;
          endX = FIELD_HALF_X - 8;
          zOffset = -FIELD_HALF_Z - STADIUM_DISTANCE - (t * 1.5);
          break;
        case 'right':
          startX = -FIELD_HALF_X + 8;
          endX = FIELD_HALF_X - 8;
          zOffset = FIELD_HALF_Z + STADIUM_DISTANCE + (t * 1.5);
          break;
        case 'top':
          startZ = -FIELD_HALF_Z + 8;
          endZ = FIELD_HALF_Z - 8;
          xOffset = FIELD_HALF_X + STADIUM_DISTANCE + (t * 1.5);
          break;
        case 'bottom':
          startZ = -FIELD_HALF_Z + 8;
          endZ = FIELD_HALF_Z - 8;
          xOffset = -FIELD_HALF_X - STADIUM_DISTANCE - (t * 1.5);
          break;
      }
      
      const teamColors = side === 'left' || side === 'bottom' ? CROWD_COLORS.home : CROWD_COLORS.away;
      
      if (side === 'left' || side === 'right') {
        result.push(
          <CrowdSection
            key={`crowd-${side}-${t}`}
            startX={startX}
            endX={endX}
            z={zOffset + (side === 'left' ? -2.5 : 2.5)}
            tier={t}
            teamColors={teamColors}
          />
        );
      } else {
        result.push(
          <CrowdSection
            key={`crowd-${side}-${t}`}
            startX={startZ}
            endX={endZ}
            z={xOffset}
            tier={t}
            teamColors={teamColors}
          />
        );
      }
    }
    
    return result;
  }, [side]);

  return <>{tiers}</>;
}

interface CornerCrowdProps {
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

function CornerCrowd({ corner }: CornerCrowdProps) {
  const people = useMemo(() => {
    const result: { position: { x: number; y: number; z: number }; color: string }[] = [];
    const colors = CROWD_COLORS.neutral;
    
    const xBase = corner.includes('left') ? -FIELD_HALF_X - STADIUM_DISTANCE - 3 : FIELD_HALF_X + STADIUM_DISTANCE + 3;
    const zBase = corner.includes('top') ? -FIELD_HALF_Z - STADIUM_DISTANCE - 3 : FIELD_HALF_Z + STADIUM_DISTANCE + 3;
    
    for (let t = 0; t < TIER_COUNT; t++) {
      for (let i = 0; i < 4 && result.length < 20; i++) {
        const angle = (i / 4) * Math.PI / 2;
        const radius = 3 + i * 0.8;
        const x = xBase + Math.cos(corner.includes('left') ? angle : -angle) * radius;
        const z = zBase + Math.sin(corner.includes('top') ? angle : -angle) * radius;
        const colorIdx = Math.floor(Math.random() * colors.length);
        
        result.push({
          position: { x, y: t * TIER_HEIGHT + 0.15, z },
          color: colors[colorIdx]
        });
      }
    }
    
    return result;
  }, [corner]);

  return (
    <>
      {people.map((person, idx) => (
        <CrowdPerson
          key={`corner-crowd-${corner}-${idx}`}
          position={person.position}
          color={person.color}
        />
      ))}
    </>
  );
}

export function VRStadiumCrowd({ homeColor = '#DC2626', awayColor = '#2563EB' }: { homeColor?: string; awayColor?: string }) {
  CROWD_COLORS.home[0] = homeColor;
  CROWD_COLORS.away[0] = awayColor;

  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    return null;
  }

  return (
    <a-entity id="stadium-crowd">
      <StadiumStand side="left" />
      <StadiumStand side="right" />
      <StadiumStand side="top" />
      <StadiumStand side="bottom" />
      
      <CornerCrowd corner="top-left" />
      <CornerCrowd corner="top-right" />
      <CornerCrowd corner="bottom-left" />
      <CornerCrowd corner="bottom-right" />
    </a-entity>
  );
}

export { CROWD_COLORS };
