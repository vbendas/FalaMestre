// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

import { useEffect, useState, useMemo } from 'react';

const FIELD_LENGTH = 80;
const FIELD_WIDTH = 45;
const FIELD_HALF_X = FIELD_LENGTH / 2;
const FIELD_HALF_Z = FIELD_WIDTH / 2;
const STADIUM_DISTANCE = 15;
const BOTTOM_TIER_Y = 0;
const TOP_TIER_Y = 3;
const PLATFORM_THICKNESS = 0.5;
const PLATFORM_DEPTH = 3;

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
        radius={0.2}
        height={0.7}
        color={color}
        material="shader: flat"
      />
      <a-sphere
        position="0 0.85 0"
        radius={0.18}
        color="#8B4513"
        material="shader: flat"
      />
    </a-entity>
  );
}

interface StadiumTierProps {
  position: { x: number; z: number };
  y: number;
  width: number;
  depth: number;
  isHorizontal: boolean;
  maxPeople: number;
  teamColors: string[];
}

function StadiumTier({ position, y, width, depth, isHorizontal, maxPeople, teamColors }: StadiumTierProps) {
  const people = useMemo(() => {
    const result: { x: number; z: number; color: string }[] = [];
    const spacing = 1.2;
    
    if (isHorizontal) {
      // Span along X axis (left/right sides)
      const startX = position.x - width / 2;
      const endX = position.x + width / 2;
      for (let x = startX; x <= endX && result.length < maxPeople; x += spacing) {
        const colorIdx = Math.floor(Math.random() * teamColors.length);
        const zOffset = (Math.random() - 0.5) * 0.5;
        result.push({ x, z: position.z + zOffset, color: teamColors[colorIdx] });
      }
    } else {
      // Span along Z axis (top/bottom sides)
      const startZ = position.z - width / 2;
      const endZ = position.z + width / 2;
      for (let z = startZ; z <= endZ && result.length < maxPeople; z += spacing) {
        const colorIdx = Math.floor(Math.random() * teamColors.length);
        const xOffset = (Math.random() - 0.5) * 0.5;
        result.push({ x: position.x + xOffset, z, color: teamColors[colorIdx] });
      }
    }
    
    return result;
  }, [position, width, isHorizontal, maxPeople, teamColors]);

  return (
    <a-entity>
      {/* Concrete platform */}
      <a-box
        position={`${position.x} ${y} ${position.z}`}
        width={isHorizontal ? width + 2 : depth}
        height={PLATFORM_THICKNESS}
        depth={isHorizontal ? depth : width + 2}
        color="#555555"
        material="shader: flat"
      />
      
      {/* Crowd on platform */}
      {people.map((person, idx) => (
        <CrowdPerson
          key={`person-${y}-${idx}`}
          position={{ x: person.x, y: y + PLATFORM_THICKNESS, z: person.z }}
          color={person.color}
        />
      ))}
    </a-entity>
  );
}

interface StadiumStandProps {
  side: 'left' | 'right' | 'top' | 'bottom';
  peoplePerTier: number;
  homeColors: string[];
  awayColors: string[];
}

function StadiumStand({ side, peoplePerTier, homeColors, awayColors }: StadiumStandProps) {
  const tiers = useMemo(() => {
    const result: JSX.Element[] = [];
    const teamColors = side === 'left' || side === 'bottom' ? homeColors : awayColors;
    
    switch (side) {
      case 'left':
        // Long side, spans X axis
        result.push(
          <StadiumTier
            key={`${side}-bottom`}
            position={{ x: 0, z: -FIELD_HALF_Z - STADIUM_DISTANCE }}
            y={BOTTOM_TIER_Y}
            width={FIELD_LENGTH - 16}
            depth={PLATFORM_DEPTH}
            isHorizontal={true}
            maxPeople={peoplePerTier}
            teamColors={teamColors}
          />,
          <StadiumTier
            key={`${side}-top`}
            position={{ x: 0, z: -FIELD_HALF_Z - STADIUM_DISTANCE }}
            y={TOP_TIER_Y}
            width={FIELD_LENGTH - 16}
            depth={PLATFORM_DEPTH}
            isHorizontal={true}
            maxPeople={peoplePerTier}
            teamColors={teamColors}
          />
        );
        break;
        
      case 'right':
        // Long side, spans X axis
        result.push(
          <StadiumTier
            key={`${side}-bottom`}
            position={{ x: 0, z: FIELD_HALF_Z + STADIUM_DISTANCE }}
            y={BOTTOM_TIER_Y}
            width={FIELD_LENGTH - 16}
            depth={PLATFORM_DEPTH}
            isHorizontal={true}
            maxPeople={peoplePerTier}
            teamColors={teamColors}
          />,
          <StadiumTier
            key={`${side}-top`}
            position={{ x: 0, z: FIELD_HALF_Z + STADIUM_DISTANCE }}
            y={TOP_TIER_Y}
            width={FIELD_LENGTH - 16}
            depth={PLATFORM_DEPTH}
            isHorizontal={true}
            maxPeople={peoplePerTier}
            teamColors={teamColors}
          />
        );
        break;
        
      case 'top':
        // Short side, spans Z axis
        result.push(
          <StadiumTier
            key={`${side}-bottom`}
            position={{ x: FIELD_HALF_X + STADIUM_DISTANCE, z: 0 }}
            y={BOTTOM_TIER_Y}
            width={FIELD_WIDTH - 16}
            depth={PLATFORM_DEPTH}
            isHorizontal={false}
            maxPeople={peoplePerTier}
            teamColors={teamColors}
          />,
          <StadiumTier
            key={`${side}-top`}
            position={{ x: FIELD_HALF_X + STADIUM_DISTANCE, z: 0 }}
            y={TOP_TIER_Y}
            width={FIELD_WIDTH - 16}
            depth={PLATFORM_DEPTH}
            isHorizontal={false}
            maxPeople={peoplePerTier}
            teamColors={teamColors}
          />
        );
        break;
        
      case 'bottom':
        // Short side, spans Z axis
        result.push(
          <StadiumTier
            key={`${side}-bottom`}
            position={{ x: -FIELD_HALF_X - STADIUM_DISTANCE, z: 0 }}
            y={BOTTOM_TIER_Y}
            width={FIELD_WIDTH - 16}
            depth={PLATFORM_DEPTH}
            isHorizontal={false}
            maxPeople={peoplePerTier}
            teamColors={teamColors}
          />,
          <StadiumTier
            key={`${side}-top`}
            position={{ x: -FIELD_HALF_X - STADIUM_DISTANCE, z: 0 }}
            y={TOP_TIER_Y}
            width={FIELD_WIDTH - 16}
            depth={PLATFORM_DEPTH}
            isHorizontal={false}
            maxPeople={peoplePerTier}
            teamColors={teamColors}
          />
        );
        break;
    }
    
    return result;
  }, [side, peoplePerTier]);

  return <>{tiers}</>;
}

export function VRStadiumCrowd({ homeColor = '#DC2626', awayColor = '#2563EB' }: { homeColor?: string; awayColor?: string }) {
  const [isClient, setIsClient] = useState(false);
  
  const homeColors = useMemo(() => [
    homeColor,
    ...CROWD_COLORS.home.slice(1)
  ], [homeColor]);
  
  const awayColors = useMemo(() => [
    awayColor,
    ...CROWD_COLORS.away.slice(1)
  ], [awayColor]);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    return null;
  }

  // 240 total people / 4 stands / 2 tiers = 30 people per section
  const peoplePerTier = 30;

  return (
    <a-entity id="stadium-crowd">
      <StadiumStand side="left" peoplePerTier={peoplePerTier} homeColors={homeColors} awayColors={awayColors} />
      <StadiumStand side="right" peoplePerTier={peoplePerTier} homeColors={homeColors} awayColors={awayColors} />
      <StadiumStand side="top" peoplePerTier={peoplePerTier} homeColors={homeColors} awayColors={awayColors} />
      <StadiumStand side="bottom" peoplePerTier={peoplePerTier} homeColors={homeColors} awayColors={awayColors} />
    </a-entity>
  );
}

export { CROWD_COLORS };
