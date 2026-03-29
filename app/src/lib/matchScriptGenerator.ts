import { MatchEvent, GameAction, MatchScript, ActionType, PlayerPosition } from '@/lib/types';
import { Formation, FormationPosition, getFormationPositions, getOpponentFormationPositions, mapPlayersToFormation, mapOpponentPlayersToFormation, PlayerData } from '@/components/vr/formations';

const FIELD_LENGTH = 80;
const FIELD_WIDTH = 45;
const FIELD_HALF_X = FIELD_LENGTH / 2;
const FIELD_HALF_Z = FIELD_WIDTH / 2;

const DEFAULT_FORMATION: Formation = '4-3-3';

interface TeamData {
  name: string;
  formation: Formation | string;
  players: PlayerData[];
  color: string;
}

function getDefaultPositions(formation: Formation | string, isHome: boolean): FormationPosition[] {
  const normalizedFormation = (formation as Formation) || DEFAULT_FORMATION;
  const positions = isHome 
    ? getFormationPositions(normalizedFormation)
    : getOpponentFormationPositions(normalizedFormation);
  return positions;
}

function positionsToRecord(positions: FormationPosition[]): Record<string, PlayerPosition> {
  const record: Record<string, PlayerPosition> = {};
  positions.forEach((pos) => {
    record[pos.id] = { x: pos.position.x, z: pos.position.z };
  });
  return record;
}

function addNoiseToPosition(pos: PlayerPosition, noiseRange: number = 1): PlayerPosition {
  return {
    x: pos.x + (Math.random() - 0.5) * noiseRange,
    z: pos.z + (Math.random() - 0.5) * noiseRange,
  };
}

function clampPosition(pos: PlayerPosition): PlayerPosition {
  return {
    x: Math.max(-FIELD_HALF_X + 2, Math.min(FIELD_HALF_X - 2, pos.x)),
    z: Math.max(-FIELD_HALF_Z + 1, Math.min(FIELD_HALF_Z - 1, pos.z)),
  };
}

function getActionTypeFromEvent(event: MatchEvent): ActionType {
  const eventType = event.type as string;
  switch (eventType) {
    case 'goal':
      return 'goal';
    case 'shot':
      return 'shot';
    case 'miss':
      return 'miss';
    case 'save':
      return 'save';
    case 'foul':
      return 'foul';
    case 'corner':
      return 'corner';
    case 'card':
      return 'foul';
    case 'pressure':
      return 'pressure';
    case 'buildup':
      return 'buildup';
    case 'kickoff':
      return 'kickoff';
    case 'whistle':
      return event.minute === 45 ? 'buildup' : 'pressure';
    case 'halftime':
      return 'buildup';
    default:
      return 'buildup';
  }
}

function getBallPositionForAction(actionType: ActionType, team: 'home' | 'away', event: MatchEvent): { position: PlayerPosition; target: PlayerPosition | undefined; height: number } {
  const isHome = team === 'home';
  const goalX = isHome ? FIELD_HALF_X : -FIELD_HALF_X;
  const defendX = isHome ? -FIELD_HALF_X : FIELD_HALF_X;
  
  switch (actionType) {
    case 'kickoff':
      return {
        position: { x: 0, z: 0 },
        target: { x: 5, z: 0 },
        height: 0.35,
      };
      
    case 'goal':
      return {
        position: { x: goalX - 2, z: 0 },
        target: undefined,
        height: 1.5,
      };
      
    case 'shot':
      return {
        position: { x: goalX - 10 + Math.random() * 5, z: (Math.random() - 0.5) * 20 },
        target: { x: goalX - 1, z: (Math.random() - 0.5) * 8 },
        height: 0.8,
      };
      
    case 'miss':
      return {
        position: { x: goalX - 8, z: (Math.random() - 0.5) * 15 },
        target: { x: goalX - 3, z: (Math.random() - 0.5) * 25 },
        height: 2.0,
      };
      
    case 'save':
      return {
        position: { x: goalX - 3, z: (Math.random() - 0.5) * 4 },
        target: { x: defendX + 20, z: (Math.random() - 0.5) * 30 },
        height: 1.0,
      };
      
    case 'pass':
    case 'dribble':
      return {
        position: { x: (Math.random() - 0.5) * 30, z: (Math.random() - 0.5) * 20 },
        target: { x: (Math.random() - 0.5) * 30, z: (Math.random() - 0.5) * 20 },
        height: 0.4,
      };
      
    case 'corner':
      return {
        position: { x: isHome ? FIELD_HALF_X - 2 : -FIELD_HALF_X + 2, z: isHome ? FIELD_HALF_Z - 2 : -FIELD_HALF_Z + 2 },
        target: { x: goalX - 5, z: 0 },
        height: 1.5,
      };
      
    case 'freekick':
      return {
        position: { x: defendX + 25, z: (Math.random() - 0.5) * 30 },
        target: { x: goalX - 3, z: (Math.random() - 0.5) * 10 },
        height: 1.2,
      };
      
    case 'tackle':
      return {
        position: { x: (Math.random() - 0.5) * 40, z: (Math.random() - 0.5) * 25 },
        target: { x: (Math.random() - 0.5) * 40, z: (Math.random() - 0.5) * 25 },
        height: 0.3,
      };
      
    case 'pressure':
    case 'buildup':
      return {
        position: { x: (Math.random() - 0.5) * 20, z: (Math.random() - 0.5) * 15 },
        target: { x: (Math.random() - 0.5) * 25, z: (Math.random() - 0.5) * 18 },
        height: 0.35,
      };
      
    case 'celebration':
      return {
        position: { x: goalX - 3, z: 0 },
        target: undefined,
        height: 0.5,
      };
      
    default:
      return {
        position: { x: 0, z: 0 },
        target: undefined,
        height: 0.35,
      };
  }
}

function getAnimationForAction(actionType: ActionType): string {
  switch (actionType) {
    case 'goal':
      return 'celebrate';
    case 'shot':
      return 'shoot';
    case 'pass':
      return 'pass';
    case 'dribble':
      return 'dribble';
    case 'tackle':
      return 'tackle';
    case 'save':
      return 'save';
    case 'foul':
      return 'foul';
    case 'celebration':
      return 'celebrate';
    default:
      return 'run';
  }
}

function getDurationForAction(actionType: ActionType): number {
  switch (actionType) {
    case 'goal':
      return 4000;
    case 'shot':
      return 2000;
    case 'pass':
      return 1500;
    case 'dribble':
      return 2000;
    case 'save':
      return 1500;
    case 'foul':
      return 2000;
    case 'celebration':
      return 3000;
    case 'corner':
      return 2500;
    case 'freekick':
      return 2500;
    default:
      return 1500;
  }
}

export function generateMatchScript(
  matchId: string,
  events: MatchEvent[],
  homeTeam: TeamData,
  awayTeam: TeamData
): MatchScript {
  const actions: GameAction[] = [];
  
  const homeFormation = (homeTeam.formation as Formation) || DEFAULT_FORMATION;
  const awayFormation = (awayTeam.formation as Formation) || DEFAULT_FORMATION;
  
  const homeBasePositions = getFormationPositions(homeFormation);
  const awayBasePositions = getOpponentFormationPositions(awayFormation);
  
  let currentHomePositions = positionsToRecord(homeBasePositions);
  let currentAwayPositions = positionsToRecord(awayBasePositions);
  
  events.forEach((event, eventIndex) => {
    const actionType = getActionTypeFromEvent(event);
    const ballInfo = getBallPositionForAction(actionType, event.team, event);
    
    const homePlayerIds = Object.keys(currentHomePositions);
    const awayPlayerIds = Object.keys(currentAwayPositions);
    const playerId = event.team === 'home' 
      ? homePlayerIds[Math.floor(Math.random() * homePlayerIds.length)] || 'st'
      : awayPlayerIds[Math.floor(Math.random() * awayPlayerIds.length)] || 'st';
    const playerPosition = event.team === 'home' 
      ? currentHomePositions[playerId] || { x: 0, z: 0 }
      : currentAwayPositions[playerId] || { x: 0, z: 0 };
    
    const targetPlayerId = event.assistPlayer 
      ? (event.team === 'home'
          ? homePlayerIds[Math.floor(Math.random() * homePlayerIds.length)]
          : awayPlayerIds[Math.floor(Math.random() * awayPlayerIds.length)])
      : undefined;
    const targetPlayerPosition = targetPlayerId 
      ? (event.team === 'home' 
          ? currentHomePositions[targetPlayerId] 
          : currentAwayPositions[targetPlayerId])
      : undefined;
    
    const noiseRange = actionType === 'buildup' || actionType === 'pressure' ? 3 : 1;
    const homePositionsWithMovement: Record<string, PlayerPosition> = {};
    const awayPositionsWithMovement: Record<string, PlayerPosition> = {};
    
    Object.entries(currentHomePositions).forEach(([id, pos]) => {
      const isBallCarrier = id === playerId && event.team === 'home';
      const targetPos = isBallCarrier && ballInfo.target 
        ? ballInfo.target 
        : addNoiseToPosition(pos, noiseRange);
      homePositionsWithMovement[id] = clampPosition(targetPos);
    });
    
    Object.entries(currentAwayPositions).forEach(([id, pos]) => {
      const isBallCarrier = id === playerId && event.team === 'away';
      const targetPos = isBallCarrier && ballInfo.target 
        ? ballInfo.target 
        : addNoiseToPosition(pos, noiseRange);
      awayPositionsWithMovement[id] = clampPosition(targetPos);
    });
    
    if (ballInfo.target) {
      if (event.team === 'home') {
        Object.keys(homePositionsWithMovement).forEach(id => {
          if (id !== playerId) {
            const forwardOffset = id === 'st' || id === 'lw' || id === 'rw' || id === 'st1' || id === 'st2' ? 3 : 0;
            homePositionsWithMovement[id] = clampPosition({
              x: homePositionsWithMovement[id].x + forwardOffset,
              z: homePositionsWithMovement[id].z,
            });
          }
        });
      } else {
        Object.keys(awayPositionsWithMovement).forEach(id => {
          if (id !== playerId) {
            const forwardOffset = id === 'st' || id === 'lw' || id === 'rw' || id === 'st1' || id === 'st2' ? 3 : 0;
            awayPositionsWithMovement[id] = clampPosition({
              x: awayPositionsWithMovement[id].x + forwardOffset,
              z: awayPositionsWithMovement[id].z,
            });
          }
        });
      }
    }
    
    const action: GameAction = {
      id: `action-${eventIndex}`,
      minute: event.minute,
      actionType,
      team: event.team,
      ballPosition: ballInfo.position,
      ballTargetPosition: ballInfo.target,
      ballHeight: ballInfo.height,
      playerId,
      playerName: event.player?.name,
      playerPosition,
      targetPlayerId,
      targetPlayerPosition,
      homePlayerPositions: homePositionsWithMovement,
      awayPlayerPositions: awayPositionsWithMovement,
      animation: getAnimationForAction(actionType),
      duration: getDurationForAction(actionType),
      commentaryId: event.id,
    };
    
    actions.push(action);
    
    currentHomePositions = homePositionsWithMovement;
    currentAwayPositions = awayPositionsWithMovement;
  });
  
  return {
    matchId,
    actions,
    totalActions: actions.length,
  };
}

export function getActionForMinute(script: MatchScript, minute: number): GameAction | null {
  const actions = script.actions.filter(a => a.minute === minute);
  if (actions.length === 0) return null;
  return actions[actions.length - 1];
}

export function getActionsUpToMinute(script: MatchScript, minute: number): GameAction[] {
  return script.actions.filter(a => a.minute <= minute);
}

// Enhanced Match Script Generation for VR Mode
// Generates 5400 movement events (1 per game second) based on commentary events

import { MovementEvent, MovementType, EnhancedMatchScript, Squad } from '@/lib/types';
import { GAME_TIMING } from './constants';

/**
 * Generates 5400 movement events (1 per game second) based on commentary events
 * Respects game mechanics: 70% stats-based, 30% random
 */
export function generateMovementEvents(
  commentaryEvents: MatchEvent[],
  homeSquad: Squad,
  awaySquad: Squad,
  finalScore: { home: number; away: number }
): MovementEvent[] {
  const movements: MovementEvent[] = [];
  
  // Sort commentary events by minute
  const sortedEvents = [...commentaryEvents].sort((a, b) => a.minute - b.minute);
  
  // Process each game second (0-5399)
  for (let gameSecond = 0; gameSecond < GAME_TIMING.GAME_SECONDS_PER_MATCH; gameSecond++) {
    const gameMinute = Math.floor(gameSecond / 60);
    
    // Find relevant commentary event(s) for this period
    const currentEvent = sortedEvents.find(e => e.minute === gameMinute);
    const previousEvent = sortedEvents.filter(e => e.minute < gameMinute).pop();
    const nextEvent = sortedEvents.find(e => e.minute > gameMinute);
    
    // Determine which team has ball
    const teamWithBall = determineTeamWithBall(
      gameSecond,
      currentEvent,
      previousEvent,
      homeSquad,
      awaySquad
    );
    
    // Generate movement for this second
    const movement = generateSecondMovement(
      gameSecond,
      teamWithBall,
      currentEvent,
      previousEvent,
      nextEvent,
      homeSquad,
      awaySquad,
      movements[gameSecond - 1]
    );
    
    movements.push(movement);
  }
  
  return movements;
}

/**
 * Determines ball possession for a given second
 * Uses commentary events as anchors, interpolates between them
 */
function determineTeamWithBall(
  gameSecond: number,
  currentEvent: MatchEvent | undefined,
  previousEvent: MatchEvent | undefined,
  homeSquad: Squad,
  awaySquad: Squad
): 'home' | 'away' {
  // If there's a major event this second, use its team
  if (currentEvent && ['goal', 'shot', 'save', 'miss', 'pressure'].includes(currentEvent.type)) {
    return currentEvent.team;
  }
  
  // Otherwise, base on previous event with some randomness
  if (previousEvent) {
    const previousTeam = previousEvent.team;
    const secondsSincePrevious = gameSecond - (previousEvent.minute * 60);
    
    // Calculate possession change probability (30% random component)
    // Stronger teams retain possession longer (70% deterministic)
    const homePower = calculateTeamPowerSimple(homeSquad);
    const awayPower = calculateTeamPowerSimple(awaySquad);
    const totalPower = homePower + awayPower;
    
    const homeRetentionProb = totalPower > 0 ? homePower / totalPower : 0.5;
    
    // Possession change probability increases over time since last event
    const baseChangeProb = 0.02;
    const timeMultiplier = Math.min(secondsSincePrevious / 60, 3);
    const changeProbability = baseChangeProb * timeMultiplier;
    
    if (Math.random() < changeProbability) {
      return Math.random() < homeRetentionProb ? 'home' : 'away';
    }
    
    return previousTeam;
  }
  
  return 'home';
}

function calculateTeamPowerSimple(squad: Squad): number {
  if (!squad.players || squad.players.length === 0) return 50;
  
  const avgAttribute = squad.players.reduce((sum, p) => sum + (p.pac + p.sho + p.pas + p.dri + p.def + p.phy) / 6, 0) / squad.players.length;
  const moraleFactor = (squad.morale || 70) / 100;
  const fitnessFactor = (squad.fitness || 70) / 100;
  
  return avgAttribute * moraleFactor * fitnessFactor;
}

/**
 * Generates movement event for a single game second
 */
function generateSecondMovement(
  gameSecond: number,
  teamWithBall: 'home' | 'away',
  currentEvent: MatchEvent | undefined,
  previousEvent: MatchEvent | undefined,
  nextEvent: MatchEvent | undefined,
  homeSquad: Squad,
  awaySquad: Squad,
  previousMovement: MovementEvent | undefined
): MovementEvent {
  const gameMinute = Math.floor(gameSecond / 60);
  const attackingSquad = teamWithBall === 'home' ? homeSquad : awaySquad;
  
  // If there's a major event happening this second, create dramatic movement
  if (currentEvent && gameSecond % 60 === 0) {
    return generateEventDrivenMovement(gameSecond, currentEvent, attackingSquad, teamWithBall);
  }
  
  // Otherwise, interpolate toward next event or maintain flow
  if (nextEvent) {
    return interpolateTowardEvent(
      gameSecond,
      teamWithBall,
      nextEvent,
      attackingSquad,
      previousMovement
    );
  }
  
  // Default: Maintain possession with dribbling
  return generateDefaultMovement(gameSecond, teamWithBall, attackingSquad, previousMovement);
}

/**
 * Creates movement for major events (goal, shot, save, etc.)
 */
function generateEventDrivenMovement(
  gameSecond: number,
  event: MatchEvent,
  squad: Squad,
  teamWithBall: 'home' | 'away'
): MovementEvent {
  const player = selectRandomPlayerFromSquad(squad);
  const direction = teamWithBall === 'home' ? 1 : -1;
  
  switch (event.type) {
    case 'goal':
    case 'pressure':
    case 'buildup':
      return {
        gameSecond,
        type: 'shot_flight',
        teamWithBall,
        playerWithBall: player?.id || 'player-0',
        ballPosition: { x: 35 * direction, z: (Math.random() - 0.5) * 10 },
        ballHeight: 1.2,
        intensity: 0.9,
        commentaryEventId: event.id,
      };
    
    case 'miss':
      return {
        gameSecond,
        type: 'shot_flight',
        teamWithBall,
        playerWithBall: player?.id || 'player-0',
        ballPosition: { x: 42 * direction, z: (Math.random() - 0.5) * 25 },
        ballHeight: 2.5,
        intensity: 0.9,
        commentaryEventId: event.id,
      };
    
    case 'pressure':
      return {
        gameSecond,
        type: 'dribble',
        teamWithBall,
        playerWithBall: player?.id || 'player-0',
        ballPosition: { x: 20 * direction, z: (Math.random() - 0.5) * 15 },
        ballHeight: 0.3,
        intensity: 0.7,
        commentaryEventId: event.id,
      };
    
    case 'buildup':
      return {
        gameSecond,
        type: 'pass',
        teamWithBall,
        playerWithBall: player?.id || 'player-0',
        ballPosition: { x: 10 * direction, z: (Math.random() - 0.5) * 20 },
        ballHeight: 0.3,
        intensity: 0.5,
        commentaryEventId: event.id,
      };
    
    default:
      return generateDefaultMovement(gameSecond, teamWithBall, squad, undefined);
  }
}

/**
 * Interpolates movement toward an upcoming event
 */
function interpolateTowardEvent(
  gameSecond: number,
  teamWithBall: 'home' | 'away',
  nextEvent: MatchEvent,
  squad: Squad,
  previousMovement: MovementEvent | undefined
): MovementEvent {
  const secondsUntilEvent = (nextEvent.minute * 60) - gameSecond;
  const progress = 1 - (secondsUntilEvent / 300);
  
  const direction = teamWithBall === 'home' ? 1 : -1;
  const player = selectRandomPlayerFromSquad(squad);
  
  const startX = previousMovement?.ballPosition.x || 0;
  const targetX = nextEvent.type === 'goal' || nextEvent.type === 'pressure' ? 30 * direction : 15 * direction;
  const currentX = startX + (targetX - startX) * Math.max(0, Math.min(1, progress));
  
  const movementType: MovementType = progress > 0.8 ? 'shot_windup' : 
                                    progress > 0.5 ? 'dribble' : 'pass';
  
  return {
    gameSecond,
    type: movementType,
    teamWithBall,
    playerWithBall: player?.id || 'player-0',
    ballPosition: {
      x: currentX,
      z: (Math.random() - 0.5) * 18
    },
    ballHeight: movementType === 'pass' ? 0.5 : 0.3,
    intensity: 0.3 + progress * 0.4,
  };
}

/**
 * Generates default possession movement (dribbling, passing)
 */
function generateDefaultMovement(
  gameSecond: number,
  teamWithBall: 'home' | 'away',
  squad: Squad,
  previousMovement: MovementEvent | undefined
): MovementEvent {
  const player = selectRandomPlayerFromSquad(squad);
  const direction = teamWithBall === 'home' ? 1 : -1;
  
  const rand = Math.random();
  const type: MovementType = rand < 0.6 ? 'dribble' : rand < 0.9 ? 'pass' : 'position';
  
  const baseX = previousMovement?.ballPosition.x || 0;
  const xMovement = (Math.random() - 0.3) * 2 * direction;
  const zMovement = (Math.random() - 0.5) * 3;
  
  return {
    gameSecond,
    type,
    teamWithBall,
    playerWithBall: player?.id || 'player-0',
    ballPosition: {
      x: Math.max(-38, Math.min(38, baseX + xMovement)),
      z: Math.max(-20, Math.min(20, zMovement))
    },
    ballHeight: type === 'pass' ? 0.5 : 0.3,
    intensity: 0.3,
  };
}

function selectRandomPlayerFromSquad(squad: Squad): { id: string } | undefined {
  if (!squad.players || squad.players.length === 0) return undefined;
  const idx = Math.floor(Math.random() * squad.players.length);
  return { id: squad.players[idx]?.id || `player-${idx}` };
}

/**
 * Generate complete enhanced match script with both commentary and movement events
 */
export function generateEnhancedMatchScript(
  matchId: string,
  commentaryEvents: MatchEvent[],
  homeTeamInfo: { id: string; name: string; formation: string },
  awayTeamInfo: { id: string; name: string; formation: string },
  homeSquad: Squad,
  awaySquad: Squad,
  finalScore: { home: number; away: number }
): EnhancedMatchScript {
  const movements = generateMovementEvents(commentaryEvents, homeSquad, awaySquad, finalScore);
  
  // Determine winner
  let winner: 'home' | 'away' | 'draw' = 'draw';
  if (finalScore.home > finalScore.away) winner = 'home';
  else if (finalScore.away > finalScore.home) winner = 'away';
  
  return {
    matchId,
    homeTeam: homeTeamInfo,
    awayTeam: awayTeamInfo,
    commentary: commentaryEvents,
    movements,
    finalScore,
    winner,
    generatedAt: Date.now(),
  };
}
