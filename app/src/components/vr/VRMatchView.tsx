// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

import { useEffect, useRef, useState, useMemo, Suspense, lazy } from 'react';
import { getFormationPositions, getOpponentFormationPositions, Formation, FormationPosition, MatchEvent } from './formations';
import { VRAdBoards } from './VRAdBoards';
// import { VRStadiumCrowd } from './VRStadiumCrowd';
import { VRErrorBoundary } from './VRErrorBoundary';

interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
}

interface VRMatchViewProps {
  homeTeam: {
    name: string;
    color: string;
    formation: Formation;
    players: Player[];
  };
  awayTeam: {
    name: string;
    color: string;
    formation: Formation;
    players: Player[];
  };
  currentMinute: number;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  currentEvent?: string;
  onExitVR: () => void;
}

const FIELD_LENGTH = 80;
const FIELD_WIDTH = 45;
const FIELD_HALF_X = FIELD_LENGTH / 2;
const FIELD_HALF_Z = FIELD_WIDTH / 2;

interface PlayerPosition {
  x: number;
  z: number;
}

interface CommentaryContext {
  mentionedPlayer: string | null;
  zone: 'center' | 'left_wing' | 'right_wing' | 'penalty_area' | 'buildup';
  direction: 'attack' | 'defense' | 'neutral';
}

function parseCommentary(commentary: string | undefined): CommentaryContext {
  if (!commentary) {
    return { mentionedPlayer: null, zone: 'center', direction: 'neutral' };
  }
  
  const text = commentary.toLowerCase();
  
  const nameMatch = commentary.match(/[A-Z][a-z]+ [A-Z][a-z]+/);
  const mentionedPlayer = nameMatch ? nameMatch[0] : null;
  
  let zone: CommentaryContext['zone'] = 'center';
  if (text.includes('extrema') || text.includes('lateral') || text.includes('asa') || 
      text.includes('pela esquerda') || text.includes('pela direita') || text.includes('pelas extremas') ||
      text.includes('lado esquerdo') || text.includes('lado direito') || text.includes('flanco')) {
    if (text.includes('esquerda') || text.includes('extrema esquerda') || text.includes('asa esquerda') || text.includes('lado esquerdo')) {
      zone = 'left_wing';
    } else if (text.includes('direita') || text.includes('extrema direita') || text.includes('asa direita') || text.includes('lado direito')) {
      zone = 'right_wing';
    } else {
      zone = 'left_wing';
    }
  } else if (text.includes('pênalti') || text.includes('penalty') || text.includes('área') || text.includes('area') || text.includes('grande área')) {
    zone = 'penalty_area';
  } else if (text.includes('constroi') || text.includes('buildup') || text.includes('prepara') || text.includes('construindo') || text.includes('organizando')) {
    zone = 'buildup';
  } else if (text.includes('meio') || text.includes('meio-campo') || text.includes('centro')) {
    zone = 'center';
  }
  
  let direction: CommentaryContext['direction'] = 'neutral';
  if (text.includes('acelera') || text.includes('ataca') || text.includes('avança') || text.includes('avançando') || 
      text.includes('pressiona') || text.includes('chuta') || text.includes('gol') || text.includes('finaliza') ||
      text.includes('contra-ataque') || text.includes('contraataca') || text.includes('的机会') || text.includes('机会')) {
    direction = 'attack';
  } else if (text.includes('defende') || text.includes('recua') || text.includes('retorna') || text.includes('marca') || 
             text.includes('marcando') || text.includes('defensiva') || text.includes('bloqueio') || text.includes('rebate')) {
    direction = 'defense';
  }
  
  console.log('[VR] Commentary parsed:', { mentionedPlayer, zone, direction, text: text.substring(0, 50) });
  return { mentionedPlayer, zone, direction };
}

function findPlayerByName(name: string | null, positions: FormationPosition[]): FormationPosition | null {
  if (!name) return null;
  
  const searchName = name.toLowerCase();
  for (const pos of positions) {
    const playerName = pos.id.toLowerCase().replace(/-/g, ' ');
    if (playerName.includes(searchName.split(' ')[0].toLowerCase()) || 
        searchName.includes(playerName.split(' ')[0].toLowerCase())) {
      return pos;
    }
  }
  return null;
}

function FieldMarkings() {
  return (
    <>
      <a-plane position="0 0.02 0" rotation="-90 0 0" width={1} height={FIELD_WIDTH - 2} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      <a-ring position="0 0.02 0" rotation="-90 0 0" radius-inner={9.1} radius-outer={9.15} color="white" material="shader: flat" />
      
      <a-plane position={`0 0.02 ${-FIELD_HALF_Z + 1}`} rotation="-90 0 0" width={18} height={1} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      <a-plane position={`0 0.02 ${FIELD_HALF_Z - 1}`} rotation="-90 0 0" width={18} height={1} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      
      <a-plane position={`${-FIELD_HALF_X + 1} 0.02 0`} rotation="-90 0 0" width={1} height={FIELD_WIDTH - 2} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      <a-plane position={`${FIELD_HALF_X - 1} 0.02 0`} rotation="-90 0 0" width={1} height={FIELD_WIDTH - 2} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      
      <a-ring position={`${-FIELD_HALF_X + 1} 0.02 0`} rotation="-90 0 0" radius-inner={9.1} radius-outer={9.15} color="white" material="shader: flat" />
      <a-ring position={`${FIELD_HALF_X - 1} 0.02 0`} rotation="-90 0 0" radius-inner={9.1} radius-outer={9.15} color="white" material="shader: flat" />
      
      <a-plane position={`${-FIELD_HALF_X + 1} 0.02 ${-FIELD_HALF_Z + 16.5}`} rotation="-90 0 0" width={1} height={16.5} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      <a-plane position={`${-FIELD_HALF_X + 1} 0.02 ${FIELD_HALF_Z - 16.5}`} rotation="-90 0 0" width={1} height={16.5} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      <a-plane position={`${-FIELD_HALF_X + 9.5} 0.02 ${-FIELD_HALF_Z + 1}`} rotation="-90 0 0" width={16.5} height={1} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      <a-plane position={`${-FIELD_HALF_X + 9.5} 0.02 ${FIELD_HALF_Z - 1}`} rotation="-90 0 0" width={16.5} height={1} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      
      <a-plane position={`${FIELD_HALF_X - 1} 0.02 ${-FIELD_HALF_Z + 16.5}`} rotation="-90 0 0" width={1} height={16.5} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      <a-plane position={`${FIELD_HALF_X - 1} 0.02 ${FIELD_HALF_Z - 16.5}`} rotation="-90 0 0" width={1} height={16.5} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      <a-plane position={`${FIELD_HALF_X - 9.5} 0.02 ${-FIELD_HALF_Z + 1}`} rotation="-90 0 0" width={16.5} height={1} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      <a-plane position={`${FIELD_HALF_X - 9.5} 0.02 ${FIELD_HALF_Z - 1}`} rotation="-90 0 0" width={16.5} height={1} color="white" material="shader: flat; opacity: 0.9; transparent: true" />
      
      <a-box position={`${-FIELD_HALF_X} 1.2 0`} width={0.15} height={2.4} depth={7.32} color="#DDDDDD" material="shader: flat; metalness: 0.6; roughness: 0.4" />
      <a-box position={`${-FIELD_HALF_X} 2.45 0`} width={0.15} height={0.1} depth={7.32} color="#FFFFFF" material="shader: flat" />
      <a-box position={`${-FIELD_HALF_X} 1.2 ${3.66}`} width={0.15} height={2.4} depth={0.15} color="#FFFFFF" material="shader: flat" />
      <a-box position={`${-FIELD_HALF_X} 1.2 ${-3.66}`} width={0.15} height={2.4} depth={0.15} color="#FFFFFF" material="shader: flat" />
      
      <a-box position={`${FIELD_HALF_X} 1.2 0`} width={0.15} height={2.4} depth={7.32} color="#DDDDDD" material="shader: flat; metalness: 0.6; roughness: 0.4" />
      <a-box position={`${FIELD_HALF_X} 2.45 0`} width={0.15} height={0.1} depth={7.32} color="#FFFFFF" material="shader: flat" />
      <a-box position={`${FIELD_HALF_X} 1.2 ${3.66}`} width={0.15} height={2.4} depth={0.15} color="#FFFFFF" material="shader: flat" />
      <a-box position={`${FIELD_HALF_X} 1.2 ${-3.66}`} width={0.15} height={2.4} depth={0.15} color="#FFFFFF" material="shader: flat" />
    </>
  );
}

function PlayerModel({ position, color, number }: { position: { x: number; z: number }; color: string; number: number }) {
  return (
    <a-entity position={`${position.x} 0 ${position.z}`}>
      <a-cylinder position="0 0.4 0" radius={0.35} height={0.7} color={color} material="shader: flat; metalness: 0.1; roughness: 0.8" />
      <a-cylinder position="0.25 0.35 0" radius={0.08} height={0.5} color={color} material="shader: flat" />
      <a-cylinder position="-0.25 0.35 0" radius={0.08} height={0.5} color={color} material="shader: flat" />
      <a-cylinder position="0.12 -0.15 0.08" radius={0.07} height={0.4} color="#F5DEB3" material="shader: flat" />
      <a-cylinder position="-0.12 -0.15 0.08" radius={0.07} height={0.4} color="#F5DEB3" material="shader: flat" />
      <a-cylinder position="0.12 -0.15 -0.08" radius={0.07} height={0.4} color="#F5DEB3" material="shader: flat" />
      <a-cylinder position="-0.12 -0.15 -0.08" radius={0.07} height={0.4} color="#F5DEB3" material="shader: flat" />
      <a-box position="0 -0.05 0" width={0.4} height={0.25} depth={0.22} color={color} material="shader: flat; opacity: 0.95" />
      <a-sphere position="0 0.92 0" radius={0.2} color="#8B4513" material="shader: flat" />
      <a-circle position="0 0.55 0.32" radius={0.15} color="#ffffff" material="shader: flat; side: double">
        <a-text value={number.toString()} position="0 0 0.01" align="center" width={0.8} color="#000000" />
      </a-circle>
      <a-circle position="0 0.55 -0.32" radius={0.15} color="#ffffff" material="shader: flat; side: double">
        <a-text value={number.toString()} position="0 0 0.01" align="center" width={0.8} color="#000000" rotation="0 180 0" />
      </a-circle>
      <a-circle position="0.32 0.85 0" rotation="0 90 0" radius={0.12} color="#ffffff" material="shader: flat; side: double">
        <a-text value={number.toString()} position="0 0 0.01" align="center" width={0.6} color="#000000" rotation="0 90 0" />
      </a-circle>
      <a-circle position="-0.32 0.85 0" rotation="0 -90 0" radius={0.12} color="#ffffff" material="shader: flat; side: double">
        <a-text value={number.toString()} position="0 0 0.01" align="center" width={0.6} color="#000000" rotation="0 -90 0" />
      </a-circle>
      <a-cylinder position="0.1 -0.5 0.05" radius={0.05} height={0.15} color="#111111" material="shader: flat" />
      <a-cylinder position="-0.1 -0.5 0.05" radius={0.05} height={0.15} color="#111111" material="shader: flat" />
      <a-cylinder position="0.1 -0.5 -0.05" radius={0.05} height={0.15} color="#111111" material="shader: flat" />
      <a-cylinder position="-0.1 -0.5 -0.05" radius={0.05} height={0.15} color="#111111" material="shader: flat" />
      <a-circle position="0 0.01 0" rotation="-90 0 0" radius={0.5} color="#000000" opacity={0.3} material="shader: flat; transparent: true" />
    </a-entity>
  );
}

function Ball({ position, height, rotation }: { position: { x: number; z: number }; height: number; rotation?: { x: number; y: number } }) {
  const rotX = rotation?.x || 0;
  const rotY = rotation?.y || 0;
  
  return (
    <a-entity position={`${position.x} ${height} ${position.z}`} rotation={`${rotX} ${rotY} 0`}>
      <a-sphere
        radius={0.35}
        color="#FFFFFF"
        material="metalness: 0.2; roughness: 0.6"
      />
      <a-sphere radius={0.12} color="#111111" position="0.2 0.15 0.1" material="shader: flat" />
      <a-sphere radius={0.12} color="#111111" position="-0.15 0.2 0.15" material="shader: flat" />
      <a-sphere radius={0.12} color="#111111" position="-0.1 -0.15 0.2" material="shader: flat" />
      <a-sphere radius={0.12} color="#111111" position="0.15 -0.18 -0.1" material="shader: flat" />
      <a-sphere radius={0.12} color="#111111" position="-0.2 -0.1 -0.15" material="shader: flat" />
      <a-sphere radius={0.12} color="#111111" position="0.1 0.25 -0.15" material="shader: flat" />
      <a-sphere radius={0.12} color="#111111" position="-0.05 -0.05 -0.25" material="shader: flat" />
      <a-sphere radius={0.12} color="#111111" position="0.22 -0.05 0.05" material="shader: flat" />
      <a-sphere radius={0.12} color="#111111" position="-0.18 0.05 -0.18" material="shader: flat" />
      <a-sphere radius={0.12} color="#111111" position="0.05 0.28 0.05" material="shader: flat" />
      <a-circle position="0 0.36 0" rotation="-90 0 0" radius={0.25} color="#FFFFFF" material="shader: flat; side: double">
        <a-ring position="0 0 0.01" rotation="-90 0 0" radius-inner={0.12} radius-outer={0.2} color="#111111" material="shader: flat" />
      </a-circle>
      <a-circle position="0 -0.36 0" rotation="90 0 0" radius={0.25} color="#FFFFFF" material="shader: flat; side: double">
        <a-ring position="0 0 0.01" rotation="90 0 0" radius-inner={0.12} radius-outer={0.2} color="#111111" material="shader: flat" />
      </a-circle>
      <a-circle position="0.36 0 0" rotation="0 90 0" radius={0.25} color="#FFFFFF" material="shader: flat; side: double">
        <a-ring position="0.01 0 0" rotation="0 90 0" radius-inner={0.12} radius-outer={0.2} color="#111111" material="shader: flat" />
      </a-circle>
      <a-circle position="-0.36 0 0" rotation="0 -90 0" radius={0.25} color="#FFFFFF" material="shader: flat; side: double">
        <a-ring position="-0.01 0 0" rotation="0 -90 0" radius-inner={0.12} radius-outer={0.2} color="#111111" material="shader: flat" />
      </a-circle>
      <a-circle position="0 0 0.36" radius={0.25} color="#FFFFFF" material="shader: flat; side: double">
        <a-ring position="0 0 0.01" radius-inner={0.12} radius-outer={0.2} color="#111111" material="shader: flat" />
      </a-circle>
      <a-circle position="0 0 -0.36" rotation="180 0 0" radius={0.25} color="#FFFFFF" material="shader: flat; side: double">
        <a-ring position="0 0 0.01" rotation="180 0 0" radius-inner={0.12} radius-outer={0.2} color="#111111" material="shader: flat" />
      </a-circle>
      <a-circle position="0 0.01 0" rotation="-90 0 0" radius={0.6} color="#000000" opacity={0.25} material="shader: flat; transparent: true" />
    </a-entity>
  );
}

function VRScene({
  homePositions,
  awayPositions,
  homeColor,
  awayColor,
  ballPosition,
  ballHeight,
  ballRotation
}: {
  homePositions: FormationPosition[];
  awayPositions: FormationPosition[];
  homeColor: string;
  awayColor: string;
  ballPosition: PlayerPosition;
  ballHeight: number;
  ballRotation: { x: number; y: number };
}) {
  return (
    <a-scene 
      embedded 
      vr-mode-ui="enabled: false"
      renderer="antialias: true; colorManagement: true; sortObjects: true;"
      webgl="context: webgl1"
      preserve-drawing-buffer="true"
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
      background="color: #1a4d1a"
    >
      <a-assets timeout={10000}>
        <img 
          id="grass" 
          src="https://cdn.aframe.io/a-painter/images/floor.jpg" 
          crossOrigin="anonymous" 
        />
      </a-assets>

      <a-sky color="#0a1a2e" radius={500}></a-sky>
      
      <a-light type="ambient" color="#FFE4B5" intensity={0.4}></a-light>
      <a-light type="directional" position="20 30 10" intensity={0.7} color="#FFFAF0"></a-light>
      <a-light type="directional" position="-20 25 -10" intensity={0.4} color="#E0FFFF"></a-light>
      <a-light type="point" position="0 25 0" intensity={0.5} color="#FFFACD" distance={60}></a-light>

      <a-entity position="0 0 0" rotation="0 0 0">
        <a-plane 
          position="0 -0.01 0" 
          rotation="-90 0 0" 
          width={FIELD_LENGTH + 4} 
          height={FIELD_WIDTH + 4} 
          color="#1a3d1a"
          material="shader: flat"
        />
        
        {Array.from({ length: 16 }).map((_, i) => (
          <a-plane
            key={`grass-stripe-${i}`}
            position={`${-FIELD_HALF_X + 1 + i * 5 + 2.5} 0 0`}
            rotation="-90 0 0"
            width={5}
            height={FIELD_WIDTH - 2}
            color={i % 2 === 0 ? '#2d5a27' : '#3d6a37'}
            material="shader: flat; depthTest: true; depthWrite: true"
          />
        ))}
        
        <a-plane 
          position="0 0.015 0" 
          rotation="-90 0 0" 
          width={FIELD_LENGTH - 1.5} 
          height={FIELD_WIDTH - 1.5} 
          color="#4a8c4a"
          material="shader: flat; opacity: 0.3; transparent: true; depthTest: true"
        />
        
        <FieldMarkings />
        
        <a-box
          position={`${-FIELD_HALF_X - 0.5} 0.3 0`}
          width={0.3}
          height={0.6}
          depth={2.5}
          color="#FFFFFF"
          material="shader: flat"
        />
        <a-box
          position={`${FIELD_HALF_X + 0.5} 0.3 0`}
          width={0.3}
          height={0.6}
          depth={2.5}
          color="#FFFFFF"
          material="shader: flat"
        />
        
        <a-cone
          position={`${-FIELD_HALF_X + 1} 0.6 2`}
          radius-bottom={0.15}
          radius-top={0.05}
          height={1.2}
          color="#FFFFFF"
          material="shader: flat"
        />
        <a-cone
          position={`${-FIELD_HALF_X + 1} 0.6 -2`}
          radius-bottom={0.15}
          radius-top={0.05}
          height={1.2}
          color="#FFFFFF"
          material="shader: flat"
        />
        <a-cone
          position={`${FIELD_HALF_X - 1} 0.6 2`}
          radius-bottom={0.15}
          radius-top={0.05}
          height={1.2}
          color="#FFFFFF"
          material="shader: flat"
        />
        <a-cone
          position={`${FIELD_HALF_X - 1} 0.6 -2`}
          radius-bottom={0.15}
          radius-top={0.05}
          height={1.2}
          color="#FFFFFF"
          material="shader: flat"
        />
      </a-entity>

      {homePositions.map((player, idx) => (
        <PlayerModel 
          key={`home-${player.id}-${idx}`} 
          position={player.position} 
          color={homeColor} 
          number={idx + 1}
        />
      ))}

      {awayPositions.map((player, idx) => (
        <PlayerModel 
          key={`away-${player.id}-${idx}`} 
          position={player.position} 
          color={awayColor} 
          number={idx + 1}
        />
      ))}

      <Ball position={ballPosition} height={ballHeight} rotation={ballRotation} />

      <a-entity position="0 18 35">
        <a-camera rotation="-20 0 0" look-controls="enabled: true" wasd-controls="acceleration: 30"></a-camera>
      </a-entity>

      <VRErrorBoundary>
        <VRAdBoards />
      </VRErrorBoundary>
      {/* <VRErrorBoundary>
        <VRStadiumCrowd homeColor={homeColor} awayColor={awayColor} />
      </VRErrorBoundary> */}
    </a-scene>
  );
}

export function VRMatchView({
  homeTeam,
  awayTeam,
  currentMinute,
  homeScore,
  awayScore,
  events,
  currentEvent,
  onExitVR,
}: VRMatchViewProps) {
  console.log('[VR] VRMatchView rendering with props:', { 
    homeTeam: homeTeam?.name, 
    awayTeam: awayTeam?.name,
    currentMinute,
    homeScore,
    awayScore,
    eventsCount: events?.length,
    currentEvent: currentEvent?.substring(0, 50)
  });
  
  const [ballPosition, setBallPosition] = useState<PlayerPosition>({ x: 0, z: 0 });
  const [ballHeight, setBallHeight] = useState(0.35);
  const [ballRotation, setBallRotation] = useState({ x: 0, y: 0 });
  const [isGoalCelebration, setIsGoalCelebration] = useState(false);
  const [homeHasBall, setHomeHasBall] = useState(true);
  const [homePositions, setHomePositions] = useState<FormationPosition[]>([]);
  const [awayPositions, setAwayPositions] = useState<FormationPosition[]>([]);
  
  const animationRef = useRef<number | null>(null);
  const movementStateRef = useRef<{
    homePositions: FormationPosition[];
    awayPositions: FormationPosition[];
    playerVelocities: { home: { x: number; z: number }[]; away: { x: number; z: number }[] };
  } | null>(null);

  const currentActiveEvent = useMemo(() => {
    const recentEvents = events.filter(e => 
      e.minute === currentMinute || 
      (currentMinute > 0 && e.minute === currentMinute - 1)
    );
    return recentEvents.length > 0 ? recentEvents[recentEvents.length - 1] : null;
  }, [events, currentMinute]);

  const baseHomePositions = getFormationPositions(homeTeam.formation || '4-3-3') || [];
  const baseAwayPositions = getOpponentFormationPositions(awayTeam.formation || '4-3-3') || [];
  
  useEffect(() => {
    if (!movementStateRef.current && baseHomePositions.length && baseAwayPositions.length) {
      movementStateRef.current = {
        homePositions: baseHomePositions.map(p => ({ ...p, position: { ...p.position } })),
        awayPositions: baseAwayPositions.map(p => ({ ...p, position: { ...p.position } })),
        playerVelocities: {
          home: baseHomePositions.map(() => ({ x: 0, z: 0 })),
          away: baseAwayPositions.map(() => ({ x: 0, z: 0 }))
        }
      };
      setHomePositions(movementStateRef.current.homePositions);
      setAwayPositions(movementStateRef.current.awayPositions);
    }
  }, [baseHomePositions, baseAwayPositions]);
  
  const homeColor = homeTeam.color || '#DC2626';
  const awayColor = awayTeam.color || '#2563EB';
  
  type LoadingState = 'detecting' | 'loading' | 'ready' | 'error';
  const [loadingState, setLoadingState] = useState<LoadingState>('detecting');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    webglSupported: boolean;
    aframeLoaded: boolean;
    aframeVersion: string | null;
    elementCount: number;
    error: string | null;
  }>({
    webglSupported: false,
    aframeLoaded: false,
    aframeVersion: null,
    elementCount: 0,
    error: null
  });

  useEffect(() => {
    const checkWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
          console.error('[VR] WebGL not supported');
          setDebugInfo(prev => ({ ...prev, webglSupported: false, error: 'WebGL not supported' }));
          return false;
        }

        const debugInfo = {
          webglSupported: true,
          version: gl.getParameter(gl.VERSION),
          renderer: gl.getParameter(gl.RENDERER),
          vendor: gl.getParameter(gl.VENDOR)
        };
        
        console.log('[VR] WebGL Debug:', debugInfo);
        setDebugInfo(prev => ({ ...prev, webglSupported: true }));
        return true;
      } catch (e) {
        console.error('[VR] WebGL check error:', e);
        setDebugInfo(prev => ({ ...prev, error: (e as Error).message }));
        return false;
      }
    };

    const checkAFrame = () => {
      const aframe = (window as any).AFRAME || (window as any).aframe;
      if (aframe) {
        console.log('[VR] A-Frame loaded:', aframe.version || 'unknown version');
        setDebugInfo(prev => ({ 
          ...prev, 
          aframeLoaded: true, 
          aframeVersion: aframe.version || 'unknown' 
        }));
        return true;
      }
      return false;
    };

    checkWebGL();
    
    const timer = setInterval(() => {
      if (checkAFrame()) {
        clearInterval(timer);
      }
    }, 200);

    const debugTimer = setTimeout(() => {
      const scene = document.querySelector('a-scene');
      if (scene) {
        const planes = scene.querySelectorAll('a-plane').length;
        const spheres = scene.querySelectorAll('a-sphere, a-cylinder, a-box').length;
        console.log('[VR] Scene elements - planes:', planes, '3D objects:', spheres);
        setDebugInfo(prev => ({ ...prev, elementCount: planes + spheres }));
      }
    }, 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(debugTimer);
    };
  }, []);

  useEffect(() => {
    console.log('[VR] Checking A-Frame availability...');
    
    const checkAFrame = () => {
      console.log('[VR] Window exists:', typeof window !== 'undefined');
      console.log('[VR] AFRAME:', typeof window?.AFRAME);
      console.log('[VR] aframe:', typeof window?.aframe);
      
      if (typeof window !== 'undefined' && (window.AFRAME || (window as any).aframe)) {
        console.log('[VR] A-Frame is available');
        return true;
      }
      return false;
    };
    
    if (checkAFrame()) {
      console.log('[VR] A-Frame already loaded, initializing...');
      setLoadingState('loading');
      setTimeout(() => setLoadingState('ready'), 500);
      return;
    }
    
    const timer = setInterval(() => {
      if (checkAFrame()) {
        console.log('[VR] A-Frame loaded after waiting');
        clearInterval(timer);
        setLoadingState('loading');
        setTimeout(() => setLoadingState('ready'), 500);
      }
    }, 100);
    
    const timeoutTimer = setTimeout(() => {
      if (loadingState !== 'ready') {
        console.error('[VR] A-Frame failed to load within timeout');
        clearInterval(timer);
        setLoadError('A-Frame library failed to load. Please check your internet connection and refresh the page.');
        setLoadingState('error');
      }
    }, 15000);
    
    return () => {
      clearInterval(timer);
      clearTimeout(timeoutTimer);
    };
  }, []);

  const handleRetry = () => {
    console.log('[VR] Retrying A-Frame load...');
    setLoadError(null);
    setLoadingState('detecting');
    window.location.reload();
  };

  useEffect(() => {
    console.log('[VR] 🔄 useEffect: Animation loop...');
    let lastTime = Date.now();
    let currentBallPos = { x: 0, z: 0 };
    let ballHeight = 0.35;
    let currentBallRotX = 0;
    let currentBallRotY = 0;
    
    const animate = () => {
      const now = Date.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      
      if (movementStateRef.current) {
        const { homePositions: homePos, awayPositions: awayPos, playerVelocities } = movementStateRef.current;
        
        const teamWithBall = homeHasBall ? homePos : awayPos;
        const ctx = parseCommentary(currentEvent);
        
        let targetX = 0;
        let targetZ = 0;
        let targetBallHeight = 0.35;
        
        const isHomeTeam = homeHasBall;
        
        if (currentActiveEvent) {
          console.log('[VR] Event-driven positioning:', currentActiveEvent.type, currentActiveEvent.team, currentActiveEvent.commentary?.substring(0, 40));
          
          switch (currentActiveEvent.type) {
            case 'goal':
              targetX = isHomeTeam ? FIELD_HALF_X - 3 : -FIELD_HALF_X + 3;
              targetZ = 0;
              targetBallHeight = 3.0;
              break;
            case 'shot':
              targetX = isHomeTeam ? FIELD_HALF_X - 5 : -FIELD_HALF_X + 5;
              targetZ = (Math.random() - 0.5) * 10;
              targetBallHeight = 1.2;
              break;
            case 'miss':
              targetX = isHomeTeam ? FIELD_HALF_X + 8 : -FIELD_HALF_X - 8;
              targetZ = (Math.random() - 0.5) * 44;
              targetBallHeight = 2.0;
              break;
            case 'pressure':
              targetX = isHomeTeam ? 20 : -20;
              targetZ = (Math.random() - 0.5) * 20;
              targetBallHeight = 0.4;
              break;
            case 'buildup':
              targetX = isHomeTeam ? 10 : -10;
              targetZ = (Math.random() - 0.5) * 15;
              targetBallHeight = 0.35;
              break;
            default:
              const mentionedPlayerPos = findPlayerByName(ctx.mentionedPlayer, teamWithBall);
              if (mentionedPlayerPos) {
                targetX = mentionedPlayerPos.position.x;
                targetZ = mentionedPlayerPos.position.z;
              } else {
                targetX = isHomeTeam ? 0 : 0;
                targetZ = (Math.random() - 0.5) * 10;
              }
          }
        } else if (currentEvent) {
          const mentionedPlayerPos = findPlayerByName(ctx.mentionedPlayer, teamWithBall);
          
          if (mentionedPlayerPos) {
            targetX = mentionedPlayerPos.position.x;
            targetZ = mentionedPlayerPos.position.z;
          } else if (ctx.zone !== 'center') {
            switch (ctx.zone) {
              case 'left_wing':
                targetX = isHomeTeam ? -8 : 8;
                targetZ = isHomeTeam ? -18 : 18;
                break;
              case 'right_wing':
                targetX = isHomeTeam ? -8 : 8;
                targetZ = isHomeTeam ? 18 : -18;
                break;
              case 'penalty_area':
                targetX = isHomeTeam ? 30 : -30;
                targetZ = 0;
                targetBallHeight = 0.6;
                break;
              case 'buildup':
                targetX = isHomeTeam ? -15 : 15;
                targetZ = 0;
                break;
              default:
                targetX = isHomeTeam ? -5 : 5;
            }
          } else if (ctx.direction === 'attack') {
            targetX = isHomeTeam ? 25 : -25;
            targetZ = teamWithBall[5]?.position.z ?? 0;
            targetBallHeight = 0.6;
          } else if (ctx.direction === 'defense') {
            targetX = isHomeTeam ? -25 : 25;
            targetZ = teamWithBall[5]?.position.z ?? 0;
          } else {
            targetX = isHomeTeam ? -10 : 10;
            targetZ = (Math.random() - 0.5) * 10;
          }
        } else {
          const playerIdx = Math.floor(now / 3000) % teamWithBall.length;
          targetX = teamWithBall[playerIdx]?.position.x ?? (isHomeTeam ? -10 : 10);
          targetZ = teamWithBall[playerIdx]?.position.z ?? 0;
        }
        
        const baseBallSpeed = currentActiveEvent?.type === 'shot' ? 5.0 : 
                             currentActiveEvent?.type === 'goal' ? 4.0 :
                             currentActiveEvent?.type === 'miss' ? 4.5 :
                             currentActiveEvent?.type === 'pressure' ? 3.0 :
                             ctx.direction === 'attack' ? 2.5 : 
                             ctx.direction === 'defense' ? 2.0 : 2.5;
        const ballSpeed = baseBallSpeed;
        const dx = targetX - currentBallPos.x;
        const dz = targetZ - currentBallPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist > 0.5) {
          currentBallPos.x += (dx / dist) * ballSpeed * delta;
          currentBallPos.z += (dz / dist) * ballSpeed * delta;
        } else if (dist > 0.1) {
          currentBallPos.x += (dx / dist) * ballSpeed * delta * 0.5;
          currentBallPos.z += (dz / dist) * ballSpeed * delta * 0.5;
        }
        
        ballHeight += (targetBallHeight - ballHeight) * 0.15;
        
        const ballMovementSpeed = Math.sqrt(
          Math.pow((dx / dist) * ballSpeed * delta, 2) + 
          Math.pow((dz / dist) * ballSpeed * delta, 2)
        );
        
        if (dist > 0.5) {
          currentBallRotY += ballMovementSpeed * 150;
          currentBallRotX += Math.abs(targetBallHeight - ballHeight) * 50;
        }
        
        const updateTeamPositions = (
          positions: FormationPosition[], 
          velocities: { x: number; z: number }[],
          hasBall: boolean
        ) => {
          let eventMult = 1.0;
          let focusX = 0;
          
          if (currentActiveEvent) {
            switch (currentActiveEvent.type) {
              case 'goal':
                eventMult = 3.0;
                focusX = hasBall ? FIELD_HALF_X - 5 : -FIELD_HALF_X + 5;
                break;
              case 'shot':
                eventMult = 2.5;
                focusX = hasBall ? FIELD_HALF_X - 8 : -FIELD_HALF_X + 8;
                break;
              case 'miss':
                eventMult = 1.5;
                focusX = hasBall ? FIELD_HALF_X + 10 : -FIELD_HALF_X - 10;
                break;
              case 'pressure':
                eventMult = 2.0;
                focusX = hasBall ? 18 : -18;
                break;
              case 'buildup':
                eventMult = 1.5;
                focusX = hasBall ? 8 : -8;
                break;
            }
          }
          
          positions.forEach((player, idx) => {
            const role = player.role;
            const phase = idx * 2.0;
            const baseSpeed = 2.0 + (idx % 3) * 0.8;
            const speed = baseSpeed * eventMult;
            
            let targetVx = 0;
            let targetVz = 0;
            
            const baseX = player.position.x;
            const baseZ = player.position.z;
            
            if (role === 'FWD') {
              if (hasBall) {
                targetVx = Math.sin(now * 0.003 + phase) * speed + (focusX - baseX) * 0.02;
                targetVz = Math.cos(now * 0.002 + phase * 1.2) * speed * 0.6;
              } else {
                targetVx = -Math.sin(now * 0.002 + phase) * speed * 0.6;
                targetVz = Math.cos(now * 0.002 + phase) * speed * 0.5;
              }
            } else if (role === 'MID') {
              if (hasBall) {
                targetVx = Math.sin(now * 0.002 + phase) * speed * 0.7 + (focusX - baseX) * 0.015;
                targetVz = Math.cos(now * 0.0015 + phase) * speed * 0.5;
              } else {
                targetVx = -Math.sin(now * 0.0015 + phase) * speed * 0.5;
                targetVz = Math.cos(now * 0.0015 + phase) * speed * 0.4;
              }
            } else if (role === 'DEF') {
              if (!hasBall) {
                targetVx = -Math.sin(now * 0.0015 + phase) * speed * 0.5;
                targetVz = Math.cos(now * 0.001 + phase) * speed * 0.4;
              } else {
                targetVx = Math.sin(now * 0.001 + phase) * speed * 0.3;
                targetVz = Math.cos(now * 0.001 + phase) * speed * 0.3;
              }
            } else if (role === 'GK') {
              targetVx = 0;
              targetVz = Math.sin(now * 0.0001 + phase) * 0.1;
            }
            
            velocities[idx].x += (targetVx - velocities[idx].x) * 0.05;
            velocities[idx].z += (targetVz - velocities[idx].z) * 0.05;
            
            player.position.x += velocities[idx].x * delta;
            player.position.z += velocities[idx].z * delta;
            
            player.position.x = Math.max(-FIELD_HALF_X + 2, Math.min(FIELD_HALF_X - 2, player.position.x));
            player.position.z = Math.max(-FIELD_HALF_Z + 1, Math.min(FIELD_HALF_Z - 1, player.position.z));
          });
        };
        
        updateTeamPositions(homePos, playerVelocities.home, homeHasBall);
        updateTeamPositions(awayPos, playerVelocities.away, !homeHasBall);
        
        setHomePositions([...homePos]);
        setAwayPositions([...awayPos]);
        setBallPosition({ ...currentBallPos });
        setBallHeight(ballHeight);
        setBallRotation({ x: currentBallRotX, y: currentBallRotY });
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [homeHasBall, currentActiveEvent, currentEvent]);

  useEffect(() => {
    console.log('[VR] 🔄 useEffect: Goal celebration...');
    if (currentActiveEvent?.type === 'goal') {
      setIsGoalCelebration(true);
      const timer = setTimeout(() => setIsGoalCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentActiveEvent, homeScore, awayScore]);

  useEffect(() => {
    console.log('[VR] 🔄 useEffect: Possession changes...');
    if (currentActiveEvent) {
      const eventType = currentActiveEvent.type;
      if (eventType === 'goal') {
        setHomeHasBall(currentActiveEvent.team !== 'home');
      } else if (eventType === 'shot' || eventType === 'miss') {
        setHomeHasBall(currentActiveEvent.team === 'home');
      } else if (eventType === 'pressure' || eventType === 'buildup') {
        setHomeHasBall(currentActiveEvent.team === 'home');
      }
    }
  }, [currentActiveEvent]);

  if (loadingState === 'detecting' || loadingState === 'loading') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 border-4 border-purple-500 rounded-full opacity-25"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
        </div>
        <div className="text-white text-xl mb-2">
          {loadingState === 'detecting' ? 'Detectando A-Frame...' : 'Carregando VR...'}
        </div>
        <div className="text-gray-400 text-sm">Carregando biblioteca 3D</div>
        <div className="text-gray-600 text-xs mt-4">Por favor aguarde</div>
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <div className="text-white text-xl mb-2">Erro ao carregar VR</div>
        <div className="text-gray-400 text-sm text-center max-w-md px-4 mb-4">
          {loadError || 'Não foi possível carregar a biblioteca 3D'}
        </div>
        <button
          onClick={handleRetry}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors"
        >
          Tentar Novamente
        </button>
        <button
          onClick={onExitVR}
          className="px-6 py-2 mt-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
        >
          Voltar ao Jogo
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ width: '100vw', height: '100vh' }}>
        <VRScene
          homePositions={homePositions}
          awayPositions={awayPositions}
          homeColor={homeColor}
          awayColor={awayColor}
          ballPosition={ballPosition}
          ballHeight={ballHeight}
          ballRotation={ballRotation}
        />
      </div>

      <div className="fixed bottom-4 right-4 z-50 bg-black/80 p-3 rounded-lg text-white text-xs pointer-events-auto max-w-xs">
        <div className="font-bold mb-2 text-purple-400">VR Debug</div>
        <div className="grid grid-cols-2 gap-1">
          <div className="text-gray-400">WebGL:</div>
          <div className={debugInfo.webglSupported ? 'text-green-400' : 'text-red-400'}>
            {debugInfo.webglSupported ? '✓ OK' : '✗ Fail'}
          </div>
          <div className="text-gray-400">A-Frame:</div>
          <div className={debugInfo.aframeLoaded ? 'text-green-400' : 'text-yellow-400'}>
            {debugInfo.aframeLoaded ? `v${debugInfo.aframeVersion}` : 'Loading...'}
          </div>
          <div className="text-gray-400">Elements:</div>
          <div className="text-blue-400">{debugInfo.elementCount || 'Counting...'}</div>
        </div>
        {debugInfo.error && (
          <div className="mt-2 text-red-400 text-xs">Error: {debugInfo.error}</div>
        )}
      </div>

      <div className="fixed bottom-4 left-4 z-50 bg-black/80 p-3 rounded-lg text-white text-xs pointer-events-auto max-w-xs">
        <div className="font-bold mb-2 text-green-400">Animation Debug</div>
        <div className="grid grid-cols-1 gap-1 text-xs">
          <div className="text-gray-400">Event: <span className="text-yellow-400">{currentActiveEvent?.type || 'none'}</span></div>
          <div className="text-gray-400">Team: <span className="text-yellow-400">{currentActiveEvent?.team || 'none'}</span></div>
          <div className="text-gray-400">Ball: <span className="text-blue-400">{ballPosition.x.toFixed(1)}, {ballPosition.z.toFixed(1)}</span></div>
          <div className="text-gray-400">Possession: <span className={homeHasBall ? 'text-green-400' : 'text-red-400'}>{homeHasBall ? 'Home' : 'Away'}</span></div>
        </div>
        {currentEvent && (
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs">
            <div className="text-gray-400">Commentary:</div>
            <div className="text-white truncate">{currentEvent.substring(0, 40)}</div>
          </div>
        )}
      </div>

      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className="bg-black/85 px-6 py-2 rounded-lg flex items-center gap-4">
            <span className="text-white font-bold text-lg">{homeTeam.name}</span>
            <span className="text-[#FEDD00] font-black text-2xl">{homeScore} - {awayScore}</span>
            <span className="text-white font-bold text-lg">{awayTeam.name}</span>
            <span className="text-[#FEDD00] font-bold text-xl ml-2">{currentMinute}'</span>
          </div>
        </div>

        {currentEvent && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <div className="bg-black/90 px-4 py-2 rounded-lg max-w-md">
              <p className="text-white text-center text-sm font-medium">{currentEvent}</p>
            </div>
          </div>
        )}

        {isGoalCelebration && currentActiveEvent && currentActiveEvent.type === 'goal' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-green-500/30 animate-pulse" />
            <div className="relative bg-black/80 px-12 py-8 rounded-2xl border-4 border-green-400">
              <p className="text-green-400 text-6xl font-black text-center animate-bounce">
                GOOOL!
              </p>
              <p className="text-white text-2xl font-bold text-center mt-2">
                {currentActiveEvent.team === 'home' ? homeTeam.name : awayTeam.name}
              </p>
              <p className="text-yellow-400 text-xl font-bold text-center mt-1">
                {homeScore} - {awayScore}
              </p>
            </div>
          </div>
        )}

        <div className="fixed top-4 right-4 z-50 pointer-events-auto">
          <button
            onClick={onExitVR}
            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-lg hover:bg-red-700 transition-colors"
          >
            Sair VR
          </button>
        </div>

        <div className="fixed bottom-4 left-4 z-50 bg-black/70 p-3 rounded-lg text-white text-sm pointer-events-auto">
          <p className="font-bold">Modo VR Ativo</p>
          <p className="text-xs opacity-80 mt-1">Use óculos VR para melhor experiência</p>
          <p className="text-xs opacity-60 mt-1">Sem óculos: W/A/S/D para mover, mouse para olhar</p>
        </div>
      </div>
    </>
  );
}
