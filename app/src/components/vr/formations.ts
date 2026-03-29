export type Formation = '4-3-3' | '4-4-2' | '4-5-1' | '3-5-2' | '3-4-3' | '5-3-2';

export interface PlayerPosition {
  x: number;
  z: number;
}

export interface FormationPosition {
  id: string;
  position: PlayerPosition;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  playerName?: string;
  playerNumber?: number;
}

export interface PlayerData {
  id: string;
  name: string;
  number: number;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
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
    '4-5-1': [
      { id: 'gk', position: { x: -35, z: 0 }, role: 'GK' },
      { id: 'lb', position: { x: -25, z: -18 }, role: 'DEF' },
      { id: 'cb1', position: { x: -22, z: -6 }, role: 'DEF' },
      { id: 'cb2', position: { x: -22, z: 6 }, role: 'DEF' },
      { id: 'rb', position: { x: -25, z: 18 }, role: 'DEF' },
      { id: 'lm', position: { x: -8, z: -20 }, role: 'MID' },
      { id: 'cdm', position: { x: -12, z: 0 }, role: 'MID' },
      { id: 'cm1', position: { x: -5, z: -8 }, role: 'MID' },
      { id: 'cm2', position: { x: -5, z: 8 }, role: 'MID' },
      { id: 'rm', position: { x: -8, z: 20 }, role: 'MID' },
      { id: 'st', position: { x: 25, z: 0 }, role: 'FWD' },
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
    '3-4-3': [
      { id: 'gk', position: { x: -35, z: 0 }, role: 'GK' },
      { id: 'cb1', position: { x: -25, z: -15 }, role: 'DEF' },
      { id: 'cb2', position: { x: -23, z: 0 }, role: 'DEF' },
      { id: 'cb3', position: { x: -25, z: 15 }, role: 'DEF' },
      { id: 'lm', position: { x: -8, z: -18 }, role: 'MID' },
      { id: 'cm1', position: { x: -5, z: -6 }, role: 'MID' },
      { id: 'cm2', position: { x: -5, z: 6 }, role: 'MID' },
      { id: 'rm', position: { x: -8, z: 18 }, role: 'MID' },
      { id: 'lw', position: { x: 15, z: -18 }, role: 'FWD' },
      { id: 'st', position: { x: 25, z: 0 }, role: 'FWD' },
      { id: 'rw', position: { x: 15, z: 18 }, role: 'FWD' },
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

export function mapPlayersToFormation(
  formation: Formation,
  players: PlayerData[]
): FormationPosition[] {
  const basePositions = getFormationPositions(formation);
  
  // SAFETY CHECK: If formation lookup fails, default to 4-3-3
  if (!basePositions || !Array.isArray(basePositions) || basePositions.length === 0) {
    console.error(`[Formation] ⚠️ Formation "${formation}" not found or invalid, defaulting to 4-3-3`);
    return mapPlayersToFormation('4-3-3', players);
  }
  
  // Validation: Ensure we have exactly 11 positions
  if (basePositions.length !== 11) {
    console.error(`[Formation] ❌ Formation "${formation}" has ${basePositions.length} positions (expected 11), defaulting to 4-3-3`);
    return mapPlayersToFormation('4-3-3', players);
  }
  
  const formationByRole = {
    GK: basePositions.filter(p => p.role === 'GK'),
    DEF: basePositions.filter(p => p.role === 'DEF'),
    MID: basePositions.filter(p => p.role === 'MID'),
    FWD: basePositions.filter(p => p.role === 'FWD'),
  };
  
  const playersByPosition = {
    GK: players.filter(p => p.position === 'GK'),
    DEF: players.filter(p => p.position === 'DEF'),
    MID: players.filter(p => p.position === 'MID'),
    FWD: players.filter(p => p.position === 'FWD'),
  };
  
  const mappedPositions: FormationPosition[] = [];
  
  const gkPosition = formationByRole.GK[0];
  const gkPlayer = playersByPosition.GK[0];
  if (gkPosition && gkPlayer) {
    mappedPositions.push({
      ...gkPosition,
      id: gkPlayer.id,
      playerName: gkPlayer.name,
      playerNumber: gkPlayer.number,
    });
  } else if (gkPosition) {
    mappedPositions.push({
      ...gkPosition,
      id: 'gk-fallback',
      playerName: 'GK',
      playerNumber: 1,
    });
  }
  
  formationByRole.DEF.forEach((pos, idx) => {
    const player = playersByPosition.DEF[idx];
    if (player) {
      mappedPositions.push({
        ...pos,
        id: player.id,
        playerName: player.name,
        playerNumber: player.number,
      });
    } else {
      mappedPositions.push({
        ...pos,
        id: `def-${idx}`,
        playerName: `DEF ${idx + 1}`,
        playerNumber: idx + 2,
      });
    }
  });
  
  formationByRole.MID.forEach((pos, idx) => {
    const player = playersByPosition.MID[idx];
    if (player) {
      mappedPositions.push({
        ...pos,
        id: player.id,
        playerName: player.name,
        playerNumber: player.number,
      });
    } else {
      mappedPositions.push({
        ...pos,
        id: `mid-${idx}`,
        playerName: `MID ${idx + 1}`,
        playerNumber: formationByRole.DEF.length + idx + 2,
      });
    }
  });
  
  formationByRole.FWD.forEach((pos, idx) => {
    const player = playersByPosition.FWD[idx];
    if (player) {
      mappedPositions.push({
        ...pos,
        id: player.id,
        playerName: player.name,
        playerNumber: player.number,
      });
    } else {
      mappedPositions.push({
        ...pos,
        id: `fwd-${idx}`,
        playerName: `FWD ${idx + 1}`,
        playerNumber: formationByRole.DEF.length + formationByRole.MID.length + idx + 2,
      });
    }
  });
  
  console.log('[Formation] Mapped players to formation:', {
    formation,
    playerCount: players.length,
    mappedCount: mappedPositions.length,
    positions: mappedPositions.map(p => ({ id: p.id, name: p.playerName, role: p.role }))
  });
  
  return mappedPositions;
}

export function mapOpponentPlayersToFormation(
  formation: Formation,
  players: PlayerData[]
): FormationPosition[] {
  const mappedPositions = mapPlayersToFormation(formation, players);
  
  return mappedPositions.map((pos) => ({
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
  continuousTime?: number,
  ballPosition?: { x: number; z: number }
): FormationPosition[] {
  const time = continuousTime ?? (currentMinute * 0.5);
  
  let eventIntensity = 0;
  let eventType = 'neutral';
  
  if (event) {
    eventType = event.type;
    const eventTeam = event.team;
    const isMyTeam = (teamHasBall && eventTeam === 'home') || (!teamHasBall && eventTeam === 'away');
    
    switch (event.type) {
      case 'goal':
        eventIntensity = isMyTeam ? 1 : 0.5;
        break;
      case 'shot':
      case 'pressure':
        eventIntensity = isMyTeam ? 0.7 : 0.4;
        break;
      case 'save':
      case 'miss':
        eventIntensity = 0.3;
        break;
      case 'buildup':
        eventIntensity = 0.2;
        break;
      default:
        eventIntensity = 0.1;
    }
  }
  
  const ballX = ballPosition?.x ?? 0;
  const ballZ = ballPosition?.z ?? 0;
  
  const isAttacking = teamHasBall;
  
  return basePositions.map((pos, index) => {
    const playerPhase = index * 0.8;
    
    let targetX = pos.position.x;
    let targetZ = pos.position.z;
    
    const direction = isAttacking ? 1 : -1;
    
    if (pos.role === 'GK') {
      const baseX = pos.position.x;
      const baseZ = pos.position.z;
      
      const gkDriftZ = Math.sin(time * 0.3 + playerPhase) * 1.5;
      
      targetX = Math.max(baseX - 1, Math.min(baseX + 1, baseX));
      targetZ = baseZ + gkDriftZ;
      
      targetZ = Math.max(-4, Math.min(4, targetZ));
    } 
    else if (pos.role === 'DEF') {
      const lineShift = isAttacking ? 3 : -2;
      targetX = pos.position.x + lineShift;
      
      const spreadFactor = pos.position.z > 0 ? 1 : -1;
      const lateralShift = isAttacking ? 1.5 : 0.5;
      targetZ = pos.position.z + spreadFactor * lateralShift;
    } 
    else if (pos.role === 'MID') {
      const lineShift = isAttacking ? 5 : -3;
      targetX = pos.position.x + lineShift;
      
      const lateralSpread = isAttacking ? 2 : 1;
      targetZ = pos.position.z;
    } 
    else if (pos.role === 'FWD') {
      const lineShift = isAttacking ? 7 : -1;
      targetX = pos.position.x + lineShift;
      
      const widthStretch = isAttacking ? 3 : 1;
      targetZ = pos.position.z;
    }
    
    const pullToBallStrength = eventIntensity * 0.3;
    if (pullToBallStrength > 0) {
      const dx = ballX - targetX;
      const dz = ballZ - targetZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist > 0.1) {
        const pull = Math.min(pullToBallStrength, dist * 0.2);
        targetX += (dx / dist) * pull;
        targetZ += (dz / dist) * pull;
      }
    }
    
    const wobbleX = Math.sin(time * 1.2 + playerPhase) * 0.3;
    const wobbleZ = Math.cos(time * 0.9 + playerPhase) * 0.3;
    
    let finalX = targetX + wobbleX;
    let finalZ = targetZ + wobbleZ;
    
    if (eventType === 'goal' || eventType === 'shot') {
      const intensity = eventType === 'goal' ? 3 : 2;
      finalX += direction * intensity;
    }
    
    const fieldHalfLength = 38;
    const fieldHalfWidth = 21;
    finalX = Math.max(-fieldHalfLength + 3, Math.min(fieldHalfLength - 3, finalX));
    finalZ = Math.max(-fieldHalfWidth + 2, Math.min(fieldHalfWidth - 2, finalZ));
    
    return {
      ...pos,
      position: {
        x: finalX,
        z: finalZ,
      },
    };
  });
}

export function normalizeFormation(formation: string | undefined | null): Formation {
  if (!formation) {
    console.warn('[Formation] Empty formation provided, defaulting to 4-3-3');
    return '4-3-3';
  }
  
  // Remove all non-digit characters
  const cleaned = formation.replace(/[^0-9]/g, '');
  
  // Mapping of digit-only versions to proper Formation types
  const formationMap: Record<string, Formation> = {
    '433': '4-3-3',
    '442': '4-4-2',
    '451': '4-5-1',
    '352': '3-5-2',
    '343': '3-4-3',
    '532': '5-3-2',
  };
  
  // Check if it's already in correct format
  const validFormations: Formation[] = ['4-3-3', '4-4-2', '4-5-1', '3-5-2', '3-4-3', '5-3-2'];
  if (validFormations.includes(formation as Formation)) {
    return formation as Formation;
  }
  
  // Try to map from cleaned version
  const normalized = formationMap[cleaned];
  if (normalized) {
    console.log(`[Formation] Normalized "${formation}" → "${normalized}"`);
    return normalized;
  }
  
  // Fallback to default
  console.warn(`[Formation] Unknown formation "${formation}", defaulting to 4-3-3`);
  return '4-3-3';
}
