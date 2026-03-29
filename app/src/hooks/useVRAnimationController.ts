import { useState, useEffect, useRef, useCallback } from 'react';
import { MatchScript, GameAction, PlayerPosition } from '@/lib/types';

interface AnimationControllerState {
  currentAction: GameAction | null;
  previousAction: GameAction | null;
  progress: number;
  homePositions: Record<string, PlayerPosition>;
  awayPositions: Record<string, PlayerPosition>;
  ballPosition: PlayerPosition;
  ballHeight: number;
}

interface UseVRAnimationControllerProps {
  matchScript: MatchScript | undefined;
  currentMinute: number;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function lerpPosition(from: PlayerPosition, to: PlayerPosition, t: number): PlayerPosition {
  return {
    x: lerp(from.x, to.x, t),
    z: lerp(from.z, to.z, t),
  };
}

function getDefaultPositions(): Record<string, PlayerPosition> {
  const positions: Record<string, PlayerPosition> = {};
  for (let i = 0; i < 11; i++) {
    positions[`player-${i}`] = { x: 0, z: 0 };
  }
  return positions;
}

export function useVRAnimationController({
  matchScript,
  currentMinute,
}: UseVRAnimationControllerProps): AnimationControllerState {
  const [state, setState] = useState<AnimationControllerState>({
    currentAction: null,
    previousAction: null,
    progress: 0,
    homePositions: getDefaultPositions(),
    awayPositions: getDefaultPositions(),
    ballPosition: { x: 0, z: 0 },
    ballHeight: 0.35,
  });
  
  const animationStartTimeRef = useRef<number>(0);
  const lastMinuteRef = useRef<number>(0);
  
  useEffect(() => {
    if (!matchScript || !matchScript.actions || matchScript.actions.length === 0) {
      return;
    }
    
    if (currentMinute === lastMinuteRef.current) {
      return;
    }
    lastMinuteRef.current = currentMinute;
    
    const actionsInMinute = matchScript.actions.filter(a => a.minute === currentMinute);
    if (actionsInMinute.length === 0) {
      return;
    }
    
    const newAction = actionsInMinute[actionsInMinute.length - 1];
    const previousAction = state.currentAction;
    
    animationStartTimeRef.current = Date.now();
    
    setState(prev => ({
      ...prev,
      previousAction: previousAction,
      currentAction: newAction,
      progress: 0,
      homePositions: newAction.homePlayerPositions,
      awayPositions: newAction.awayPlayerPositions,
      ballPosition: newAction.ballPosition,
      ballHeight: newAction.ballHeight,
    }));
  }, [matchScript, currentMinute]);
  
  useEffect(() => {
    if (!state.currentAction) {
      return;
    }
    
    const updateProgress = () => {
      const elapsed = Date.now() - animationStartTimeRef.current;
      const duration = state.currentAction?.duration || 1500;
      const newProgress = Math.min(elapsed / duration, 1);
      
      if (newProgress >= 1) {
        return;
      }
      
      setState(prev => {
        if (!prev.currentAction) return prev;
        
        const targetPositions = prev.currentAction.homePlayerPositions;
        const targetAwayPositions = prev.currentAction.awayPlayerPositions;
        const targetBall = prev.currentAction.ballPosition;
        
        return {
          ...prev,
          progress: newProgress,
          homePositions: targetPositions,
          awayPositions: targetAwayPositions,
          ballPosition: targetBall,
          ballHeight: prev.currentAction.ballHeight,
        };
      });
    };
    
    const intervalId = setInterval(updateProgress, 16);
    
    return () => clearInterval(intervalId);
  }, [state.currentAction]);
  
  const getHomePositions = useCallback((): Record<string, PlayerPosition> => {
    if (!state.currentAction) {
      return matchScript?.actions[0]?.homePlayerPositions || getDefaultPositions();
    }
    
    const positions: Record<string, PlayerPosition> = {};
    const source = state.previousAction?.homePlayerPositions || state.currentAction.homePlayerPositions;
    const target = state.currentAction.homePlayerPositions;
    
    Object.keys(target).forEach(key => {
      const from = source?.[key] || { x: 0, z: 0 };
      const to = target[key];
      positions[key] = lerpPosition(from, to, state.progress);
    });
    
    return positions;
  }, [state, matchScript]);
  
  const getAwayPositions = useCallback((): Record<string, PlayerPosition> => {
    if (!state.currentAction) {
      return matchScript?.actions[0]?.awayPlayerPositions || getDefaultPositions();
    }
    
    const positions: Record<string, PlayerPosition> = {};
    const source = state.previousAction?.awayPlayerPositions || state.currentAction.awayPlayerPositions;
    const target = state.currentAction.awayPlayerPositions;
    
    Object.keys(target).forEach(key => {
      const from = source?.[key] || { x: 0, z: 0 };
      const to = target[key];
      positions[key] = lerpPosition(from, to, state.progress);
    });
    
    return positions;
  }, [state, matchScript]);
  
  const getBallPosition = useCallback((): PlayerPosition => {
    if (!state.currentAction) {
      return { x: 0, z: 0 };
    }
    
    if (!state.previousAction || state.progress === 0) {
      return state.currentAction.ballPosition;
    }
    
    const from = state.previousAction.ballPosition;
    const to = state.currentAction.ballPosition;
    
    return lerpPosition(from, to, state.progress);
  }, [state]);
  
  const getBallHeight = useCallback((): number => {
    if (!state.currentAction) {
      return 0.35;
    }
    
    if (!state.previousAction || state.progress === 0) {
      return state.currentAction.ballHeight;
    }
    
    return lerp(state.previousAction.ballHeight, state.currentAction.ballHeight, state.progress);
  }, [state]);
  
  return {
    ...state,
    homePositions: getHomePositions(),
    awayPositions: getAwayPositions(),
    ballPosition: getBallPosition(),
    ballHeight: getBallHeight(),
  };
}
