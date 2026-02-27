export type Formation = '4-3-3' | '4-4-2' | '3-5-2' | '5-3-2';

export interface PlayerPosition {
  x: number;
  z: number;
}

export interface FormationPosition {
  id: string;
  position: PlayerPosition;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
}

export interface MatchEvent {
  id: string;
  minute: number;
  type: string;
  team: 'home' | 'away';
  description?: string;
  commentary?: string;
}

// Field dimensions should match VRMatchView.tsx
const FIELD_LENGTH = 80;
const FIELD_WIDTH = 45;

export function getFormationPositions(formation: Formation): FormationPosition[] {
  const formations: Record<Formation, FormationPosition[]> = {
    '4-3-3': [
      { id: 'gk', position: { x: -35, z: 0 }, role: 'GK' },
      { id: 'lb', position: { x: -25, z: -18 }, role: 'DEF' },
      { id: 'cb1', position: { x: -22, z: -6 }, role: 'DEF' },
      { id: 'cb2', position: { x: -22, z: 6 }, role: 'DEF' },
      { id: 'rb', position: { x: -25, z: 18 }, role: 'DEF' },
      { id: 'cm1', position: { x: -5, z: -12 }, role: 'MID' },
      { id: 'cm2', position: { x: -2, z: 0 }, role: 'MID' },
      { id: 'cm3', position: { x: -5, z: 12 }, role: 'MID' },
      { id: 'lw', position: { x: 15, z: -18 }, role: 'FWD' },
      { id: 'st', position: { x: 25, z: 0 }, role: 'FWD' },
      { id: 'rw', position: { x: 15, z: 18 }, role: 'FWD' },
    ],
    '4-4-2': [
      { id: 'gk', position: { x: -35, z: 0 }, role: 'GK' },
      { id: 'lb', position: { x: -25, z: -18 }, role: 'DEF' },
      { id: 'cb1', position: { x: -22, z: -6 }, role: 'DEF' },
      { id: 'cb2', position: { x: -22, z: 6 }, role: 'DEF' },
      { id: 'rb', position: { x: -25, z: 18 }, role: 'DEF' },
      { id: 'lm', position: { x: -5, z: -20 }, role: 'MID' },
      { id: 'cm1', position: { x: -8, z: -8 }, role: 'MID' },
      { id: 'cm2', position: { x: -8, z: 8 }, role: 'MID' },
      { id: 'rm', position: { x: -5, z: 20 }, role: 'MID' },
      { id: 'st1', position: { x: 22, z: -6 }, role: 'FWD' },
      { id: 'st2', position: { x: 22, z: 6 }, role: 'FWD' },
    ],
    '3-5-2': [
      { id: 'gk', position: { x: -35, z: 0 }, role: 'GK' },
      { id: 'cb1', position: { x: -25, z: -15 }, role: 'DEF' },
      { id: 'cb2', position: { x: -23, z: 0 }, role: 'DEF' },
      { id: 'cb3', position: { x: -25, z: 15 }, role: 'DEF' },
      { id: 'lm', position: { x: -8, z: -20 }, role: 'MID' },
      { id: 'cm1', position: { x: -8, z: -10 }, role: 'MID' },
      { id: 'cm2', position: { x: -2, z: 0 }, role: 'MID' },
      { id: 'cm3', position: { x: -8, z: 10 }, role: 'MID' },
      { id: 'rm', position: { x: -8, z: 20 }, role: 'MID' },
      { id: 'st1', position: { x: 22, z: -6 }, role: 'FWD' },
      { id: 'st2', position: { x: 22, z: 6 }, role: 'FWD' },
    ],
    '5-3-2': [
      { id: 'gk', position: { x: -35, z: 0 }, role: 'GK' },
      { id: 'lwb', position: { x: -22, z: -20 }, role: 'DEF' },
      { id: 'cb1', position: { x: -25, z: -10 }, role: 'DEF' },
      { id: 'cb2', position: { x: -27, z: 0 }, role: 'DEF' },
      { id: 'cb3', position: { x: -25, z: 10 }, role: 'DEF' },
      { id: 'rwb', position: { x: -22, z: 20 }, role: 'DEF' },
      { id: 'cm1', position: { x: -5, z: -10 }, role: 'MID' },
      { id: 'cm2', position: { x: -2, z: 0 }, role: 'MID' },
      { id: 'cm3', position: { x: -5, z: 10 }, role: 'MID' },
      { id: 'st1', position: { x: 22, z: -6 }, role: 'FWD' },
      { id: 'st2', position: { x: 22, z: 6 }, role: 'FWD' },
    ],
  };

  return formations[formation];
}

export function getOpponentFormationPositions(formation: Formation): FormationPosition[] {
  const positions = getFormationPositions(formation);
  
  return positions.map((pos) => ({
    ...pos,
    position: {
      x: -pos.position.x,
      z: -pos.position.z,
    },
  }));
}

export function interpolatePosition(
  from: PlayerPosition,
  to: PlayerPosition,
  progress: number
): PlayerPosition {
  return {
    x: from.x + (to.x - from.x) * progress,
    z: from.z + (to.z - from.z) * progress,
  };
}

export function getDynamicPlayerPositions(
  basePositions: FormationPosition[],
  currentMinute: number,
  teamHasBall: boolean,
  event?: MatchEvent | null,
  continuousTime?: number
): FormationPosition[] {
  const time = continuousTime ?? (currentMinute * 0.5 + currentMinute * 0.02);
  
  let eventIntensity = 0;
  
  if (event) {
    const eventTeam = event.team;
    const isMyTeam = (teamHasBall && eventTeam === 'home') || (!teamHasBall && eventTeam === 'away');
    
    switch (event.type) {
      case 'goal':
        eventIntensity = isMyTeam ? 1 : 0.5;
        break;
      case 'shot':
      case 'pressure':
        eventIntensity = isMyTeam ? 0.6 : 0.3;
        break;
      case 'save':
      case 'miss':
        eventIntensity = 0.3;
        break;
      case 'buildup':
        eventIntensity = 0.2;
        break;
    }
  }
  
  return basePositions.map((pos, index) => {
    const playerPhase = index * 1.3;
    const playerId = pos.id.charCodeAt(0) + (pos.id.charCodeAt(1) || 0);
    const playerRandom = (playerId % 10) / 10;
    
    const wobbleAmp = 0.8 + playerRandom * 0.5;
    
    let baseX = 0;
    let baseZ = 0;
    let wobbleX = 0;
    let wobbleZ = 0;
    
    // CRITICAL: Use LINEAR time progression for continuous directional movement
    // No sine/cosine for the main drift - they cause oscillation/reset!
    const driftSpeed = 0.3 + playerRandom * 0.2;
    const driftRangeX = 4 + playerRandom * 4;
    const driftRangeZ = 5 + playerRandom * 5;
    
    // Linear drift using just time (directional, not oscillating)
    // Uses modulo to create patrol routes that wrap around
    const xDrift = ((time * driftSpeed + playerPhase * 10) % (driftRangeX * 2)) - driftRangeX;
    const zDrift = ((time * driftSpeed * 0.7 + playerPhase * 8) % (driftRangeZ * 2)) - driftRangeZ;
    
    // Add small wobble on top of linear drift (subtle breathing)
    wobbleX = Math.sin(time * 2 + playerPhase) * wobbleAmp * 0.3;
    wobbleZ = Math.cos(time * 1.5 + playerPhase) * wobbleAmp * 0.3;
    
    if (teamHasBall) {
      if (pos.role === 'FWD') {
        // Attackers - move toward opponent goal
        baseX = pos.position.x + xDrift * 1.2;
        baseZ = pos.position.z + zDrift;
      } else if (pos.role === 'MID') {
        // Midfielders - central movement
        baseX = pos.position.x + xDrift * 0.8;
        baseZ = pos.position.z + zDrift * 1.2;
      } else if (pos.role === 'DEF') {
        // Defenders - hold tight
        baseX = pos.position.x + xDrift * 0.4;
        baseZ = pos.position.z + zDrift * 0.8;
      }
    } else {
      if (pos.role === 'DEF') {
        // Defenders - hold ground tighter
        baseX = pos.position.x - xDrift * 0.3;
        baseZ = pos.position.z + zDrift * 0.6;
      } else if (pos.role === 'MID') {
        // Midfielders - drop back
        baseX = pos.position.x - xDrift * 0.5;
        baseZ = pos.position.z + zDrift;
      } else if (pos.role === 'FWD') {
        // Forwards - wait for counter
        baseX = pos.position.x + xDrift;
        baseZ = pos.position.z + zDrift * 1.5;
      }
    }
    
    if (pos.role === 'GK') {
      // Goalkeeper - stay near goal line
      baseX = pos.position.x;
      baseZ = pos.position.z + ((time * 0.5 + playerPhase) % 4) - 2;
      wobbleX = Math.sin(time * 1 + playerPhase) * 0.2;
      wobbleZ = Math.cos(time * 0.8 + playerPhase) * 0.2;
    }
    
    const eventDriftX = eventIntensity * (teamHasBall ? 5 : -3);
    const eventDriftZ = eventIntensity * Math.sin(time * 2 + playerPhase) * 2;
    
    let finalX = baseX + wobbleX + eventDriftX;
    let finalZ = baseZ + wobbleZ + eventDriftZ;
    
    const fieldHalfLength = 38;
    const fieldHalfWidth = 21;
    finalX = Math.max(-fieldHalfLength + 2, Math.min(fieldHalfLength - 2, finalX));
    finalZ = Math.max(-fieldHalfWidth + 1, Math.min(fieldHalfWidth - 1, finalZ));
    
    return {
      ...pos,
      position: {
        x: finalX,
        z: finalZ,
      },
    };
  });
}
