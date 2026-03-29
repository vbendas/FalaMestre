'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useThreeScene } from './useThreeScene';
import { useDeviceOrientation } from './useDeviceOrientation';
import { useMediaPipeCamera } from './useMediaPipeCamera';
import { useMouseLook } from './useMouseLook';
import { useBroadcastCamera } from './useBroadcastCamera';
import {
  createField,
  createFieldLines,
  createGoal,
  createCornerFlags,
  createSky,
  createLights,
  createPlayerMesh,
  createBall,
  createCrowd,
  createAdBoards,
  FIELD_HALF_X_CONST,
  FIELD_HALF_Z_CONST,
} from './ThreeSceneObjects';
import { createStadiumSeatGeometry } from './StadiumSeatGeometry';
import {
  createBallPhysicsState,
  createPlayerPhysicsState,
  updateBallPhysics,
  updatePlayerPhysics,
  triggerKick,
  PHYSICS,
} from './ThreePhysicsLoop';
import { MatchEvent, MatchScript } from '@/lib/types';
import { Formation, getFormationPositions, getOpponentFormationPositions, getDynamicPlayerPositions, FormationPosition } from './formations';
import { useVRAnimationController } from '@/hooks/useVRAnimationController';
import { VRHud } from './VRHud';
import { MediaPipeOptInModal } from './MediaPipeOptInModal';

interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
}

interface ThreeMatchViewProps {
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
  matchScript?: MatchScript;
  onExitVR: () => void;
}

type CameraMode = 'seat' | 'broadcast';
type TrackingMode = 'gyro' | 'face' | 'mouse' | 'headset';

export default function ThreeMatchView({
  homeTeam,
  awayTeam,
  currentMinute,
  homeScore,
  awayScore,
  events,
  currentEvent,
  matchScript,
  onExitVR,
}: ThreeMatchViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isMobile =
    typeof navigator !== 'undefined' &&
    (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0);

  const [cameraMode, setCameraMode] = useState<CameraMode>('seat');
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('mouse');
  const trackingModeRef = useRef<TrackingMode>('mouse');
  const [showMediaPipeModal, setShowMediaPipeModal] = useState(!isMobile);
  const [isGyroCalibrated, setIsGyroCalibrated] = useState(false);
  const [showCalibrateButton, setShowCalibrateButton] = useState(isMobile);
  const [commentaryText, setCommentaryText] = useState('');
  const [isGoalCelebration, setIsGoalCelebration] = useState(false);

  const sceneContext = useThreeScene(canvasRef, { isMobile });

  const deviceOrientation = useDeviceOrientation();
  const mediaPipe = useMediaPipeCamera(videoRef);
  const mouseLook = useMouseLook(canvasRef);
  const broadcastCamera = useBroadcastCamera();

  const animationState = useVRAnimationController({
    matchScript,
    currentMinute,
  });
  const animationStateRef = useRef(animationState);

  useEffect(() => {
    animationStateRef.current = animationState;
  }, [animationState]);

  const homePlayerRefs = useRef<Map<string, THREE.Group>>(new Map());
  const awayPlayerRefs = useRef<Map<string, THREE.Group>>(new Map());
  const ballRef = useRef<THREE.Group | null>(null);
  const adBoardsRef = useRef<THREE.Group | null>(null);

  const ballPhysicsRef = useRef(createBallPhysicsState());
  const homePlayersPhysicsRef = useRef<Map<string, ReturnType<typeof createPlayerPhysicsState>>>(new Map());
  const awayPlayersPhysicsRef = useRef<Map<string, ReturnType<typeof createPlayerPhysicsState>>>(new Map());

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastKickedEventIdRef = useRef<string | null>(null);

  const currentMinuteRef = useRef(0);
  const homeHasBallRef = useRef(true);
  const currentActiveEventRef = useRef<MatchEvent | null>(null);
  const cameraModeRef = useRef<CameraMode>('seat');
  const mediaPipeActiveRef = useRef(false);
  const gyroCalibratedRef = useRef(false);
  const elapsedTimeRef = useRef(0);
  const homeFormationRef = useRef<FormationPosition[]>([]);
  const awayFormationRef = useRef<FormationPosition[]>([]);
  const sceneInitializedRef = useRef(false);

  const homeColor = homeTeam.color || '#DC2626';
  const awayColor = awayTeam.color || '#2563EB';

    const initializeScene = useCallback(() => {
        if (!sceneContext) return;
        if (sceneInitializedRef.current) return;
        sceneInitializedRef.current = true;

        const { scene, camera: sceneCamera } = sceneContext;

        // Cleanup any previously added objects so re-runs don't duplicate them
        homePlayerRefs.current.forEach((mesh) => {
            scene.remove(mesh);
            mesh.traverse((child) => {
                const m = child as THREE.Mesh;
                if (m.geometry) m.geometry.dispose();
                if (m.material) {
                    if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
                    else m.material.dispose();
                }
            });
        });
        homePlayerRefs.current.clear();
        homePlayersPhysicsRef.current.clear();

        awayPlayerRefs.current.forEach((mesh) => {
            scene.remove(mesh);
            mesh.traverse((child) => {
                const m = child as THREE.Mesh;
                if (m.geometry) m.geometry.dispose();
                if (m.material) {
                    if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
                    else m.material.dispose();
                }
            });
        });
        awayPlayerRefs.current.clear();
        awayPlayersPhysicsRef.current.clear();

        if (ballRef.current) {
            scene.remove(ballRef.current);
            ballRef.current = null;
        }

        // Remove all scene children except the camera to clear field/goals/crowd/etc.
        scene.children.filter(c => c !== sceneCamera).forEach(c => scene.remove(c));

        const sky = createSky();
        scene.add(sky);

        const lights = createLights();
        lights.forEach((light) => scene.add(light));

        const field = createField();
        scene.add(field);

        const fieldLines = createFieldLines();
        scene.add(fieldLines);

        const homeGoal = createGoal('home');
        scene.add(homeGoal);

        const awayGoal = createGoal('away');
        scene.add(awayGoal);

        const cornerFlags = createCornerFlags();
        scene.add(cornerFlags);

        const crowd = createCrowd({ homeColor, awayColor });
        scene.add(crowd);

        const adTexts = [
            'FalaMestre!',
            'Socios.com',
            'Chiliz',
            'Vasco',
            'Flamengo',
            'Palmeiras',
            'Corinthians',
            'Santos',
            'São Paulo',
            'Brasil',
        ];
        const adBoards = createAdBoards({ texts: adTexts });
        scene.add(adBoards);
        adBoardsRef.current = adBoards;

        // Create stadium seat fixed to camera for immersive effect
        const stadiumSeat = createStadiumSeatGeometry();
        // Add stadium seat to camera so it stays fixed in view (like a HUD element)
        sceneCamera.add(stadiumSeat);
        // Position it appropriately in front of the camera
        // The original geometry was positioned at (0, 11, 32) in world space
        // When attached to camera, we need much smaller values
        stadiumSeat.position.set(0, -0.5, -0.5); // Adjusted for camera space

        // Use formation positions so IDs match the match script
        const homeFormPos = getFormationPositions(homeTeam.formation);
        homeFormationRef.current = homeFormPos;
        homeFormPos.forEach((formPos, idx) => {
            const player = homeTeam.players[idx];
            const mesh = createPlayerMesh(homeColor, player?.number || (idx + 1), formPos.id);
            mesh.position.set(formPos.position.x, 0, formPos.position.z);
            scene.add(mesh);
            homePlayerRefs.current.set(formPos.id, mesh);

            homePlayersPhysicsRef.current.set(
                formPos.id,
                createPlayerPhysicsState(formPos.position.x, formPos.position.z, 0)
            );
        });

        const awayFormPos = getOpponentFormationPositions(awayTeam.formation);
        awayFormationRef.current = awayFormPos;
        awayFormPos.forEach((formPos, idx) => {
            const player = awayTeam.players[idx];
            const mesh = createPlayerMesh(awayColor, player?.number || (idx + 1), formPos.id);
            mesh.position.set(formPos.position.x, 0, formPos.position.z);
            scene.add(mesh);
            awayPlayerRefs.current.set(formPos.id, mesh);

            awayPlayersPhysicsRef.current.set(
                formPos.id,
                createPlayerPhysicsState(formPos.position.x, formPos.position.z, 180)
            );
        });

        const ball = createBall();
        ball.position.set(0, PHYSICS.GROUND_HEIGHT, 0);
        scene.add(ball);
        ballRef.current = ball;
    }, [sceneContext, homeTeam.players, awayTeam.players, homeColor, awayColor]);

  useEffect(() => {
    initializeScene();
  }, [initializeScene]);

  useEffect(() => {
    currentMinuteRef.current = currentMinute;
  }, [currentMinute]);

  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);
  useEffect(() => { mediaPipeActiveRef.current = mediaPipe.isActive; }, [mediaPipe.isActive]);
  useEffect(() => { gyroCalibratedRef.current = isGyroCalibrated; }, [isGyroCalibrated]);

  useEffect(() => {
    const recentEvents = events.filter(
      (e) => e.minute === currentMinute || (currentMinute > 0 && e.minute === currentMinute - 1)
    );
    if (recentEvents.length > 0) {
      const latestEvent = recentEvents[recentEvents.length - 1];
      currentActiveEventRef.current = latestEvent;
      homeHasBallRef.current = latestEvent.team === 'home';

      if (latestEvent.commentary) {
        setCommentaryText(latestEvent.commentary);
        setTimeout(() => setCommentaryText(''), 6000);
      }
      
      if (latestEvent.type === 'goal') {
        setIsGoalCelebration(true);
        setTimeout(() => setIsGoalCelebration(false), 4000);
      }
    }
  }, [events, currentMinute]);

  const getBallTarget = useCallback((event: MatchEvent | null, homeHasBall: boolean) => {
    if (!event) {
      return { x: 0, z: 0, height: PHYSICS.GROUND_HEIGHT };
    }

    const isHomeTeam = homeHasBall;
    const eventIdHash = event.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);

    let targetX = 0;
    let targetZ = 0;
    let targetHeight: number = PHYSICS.GROUND_HEIGHT;

    switch (event.type) {
      case 'goal':
        targetX = isHomeTeam ? FIELD_HALF_X_CONST - 3 : -FIELD_HALF_X_CONST + 3;
        targetZ = 0;
        targetHeight = 1.2;
        break;
      case 'save':
        targetX = isHomeTeam ? FIELD_HALF_X_CONST - 5 : -FIELD_HALF_X_CONST + 5;
        targetZ = THREE.MathUtils.clamp(((eventIdHash % 20) - 10) * 0.5, -FIELD_HALF_Z_CONST + 2, FIELD_HALF_Z_CONST - 2);
        targetHeight = 1.2;
        break;
      case 'miss':
        targetX = isHomeTeam ? FIELD_HALF_X_CONST - 2 : -FIELD_HALF_X_CONST + 2;
        targetZ = THREE.MathUtils.clamp(((eventIdHash % 44) - 22) * 0.5, -FIELD_HALF_Z_CONST + 2, FIELD_HALF_Z_CONST - 2);
        targetHeight = 2.0;
        break;
      case 'pressure':
        targetX = isHomeTeam ? 20 : -20;
        targetZ = THREE.MathUtils.clamp(((eventIdHash % 20) - 10) * 0.5, -FIELD_HALF_Z_CONST + 2, FIELD_HALF_Z_CONST - 2);
        targetHeight = 0.4;
        break;
      case 'buildup':
        targetX = isHomeTeam ? 10 : -10;
        targetZ = THREE.MathUtils.clamp(((eventIdHash % 15) - 7.5) * 0.5, -FIELD_HALF_Z_CONST + 2, FIELD_HALF_Z_CONST - 2);
        targetHeight = 0.35;
        break;
      default:
        targetX = isHomeTeam ? 15 : -15;
        targetZ = THREE.MathUtils.clamp(((eventIdHash % 20) - 10) * 0.5, -FIELD_HALF_Z_CONST + 2, FIELD_HALF_Z_CONST - 2);
    }

    targetX = THREE.MathUtils.clamp(targetX, -FIELD_HALF_X_CONST + 2, FIELD_HALF_X_CONST - 2);
    targetZ = THREE.MathUtils.clamp(targetZ, -FIELD_HALF_Z_CONST + 2, FIELD_HALF_Z_CONST - 2);

    return { x: targetX, z: targetZ, height: targetHeight };
  }, []);

  useEffect(() => {
    if (!sceneContext || !ballRef.current) return;

    const { camera, renderer, scene } = sceneContext;

    const animate = (time: number) => {
      const delta = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;
      elapsedTimeRef.current += delta;

      const currentEvent = currentActiveEventRef.current;
      const homeHasBall = homeHasBallRef.current;

      const defaultBallTarget = getBallTarget(currentEvent, homeHasBall);
      let ballTargetX = defaultBallTarget.x;
      let ballTargetZ = defaultBallTarget.z;
      let ballTargetHeight = defaultBallTarget.height;
      
      const animBall = animationStateRef.current.ballPosition;
      const animBallHeight = animationStateRef.current.ballHeight;
      if (animationStateRef.current.currentAction) {
        ballTargetX = animBall.x;
        ballTargetZ = animBall.z;
        ballTargetHeight = animBallHeight;
      }
      
      ballPhysicsRef.current.targetPosition.set(ballTargetX, ballTargetHeight, ballTargetZ);
      ballPhysicsRef.current.targetHeight = ballTargetHeight;

      let kickSpeed = 0;
      if (currentEvent && currentEvent.id !== lastKickedEventIdRef.current) {
        lastKickedEventIdRef.current = currentEvent.id;
        switch (currentEvent.type) {
          case 'goal':
            kickSpeed = PHYSICS.BALL_SHOT_SPEED;
            break;
          case 'miss':
            kickSpeed = PHYSICS.BALL_SHOT_SPEED * 0.8;
            break;
          case 'save':
          case 'corner':
            kickSpeed = PHYSICS.BALL_PASS_SPEED * 0.9;
            break;
          default:
            kickSpeed = PHYSICS.BALL_PASS_SPEED;
            break;
        }
      }

      const newBallPhysics = updateBallPhysics(ballPhysicsRef.current, delta, kickSpeed);
      ballPhysicsRef.current = newBallPhysics;

      if (ballRef.current) {
        ballRef.current.position.set(
          newBallPhysics.position.x,
          newBallPhysics.height,
          newBallPhysics.position.z
        );
        ballRef.current.rotation.set(
          (newBallPhysics.rotation.x * Math.PI) / 180,
          (newBallPhysics.rotation.y * Math.PI) / 180,
          0
        );
      }

      // Compute dynamic formation positions for continuous movement
      const ballPos = { x: ballPhysicsRef.current.position.x, z: ballPhysicsRef.current.position.z };
      const dynamicHomePos = getDynamicPlayerPositions(
        homeFormationRef.current, currentMinuteRef.current, homeHasBall,
        currentEvent, elapsedTimeRef.current, ballPos
      );
      const dynamicAwayPos = getDynamicPlayerPositions(
        awayFormationRef.current, currentMinuteRef.current, !homeHasBall,
        currentEvent, elapsedTimeRef.current, ballPos
      );
      const dynHomeMap: Record<string, { x: number; z: number; role: string }> = {};
      dynamicHomePos.forEach(p => { dynHomeMap[p.id] = { x: p.position.x, z: p.position.z, role: p.role }; });
      const dynAwayMap: Record<string, { x: number; z: number; role: string }> = {};
      dynamicAwayPos.forEach(p => { dynAwayMap[p.id] = { x: p.position.x, z: p.position.z, role: p.role }; });

      homePlayerRefs.current.forEach((mesh, formId) => {
        const physicsState = homePlayersPhysicsRef.current.get(formId);
        if (!physicsState) return;

        // Dynamic formation as base, animation controller as override
        const dynPos = dynHomeMap[formId];
        let targetX = dynPos?.x ?? mesh.position.x;
        let targetZ = dynPos?.z ?? mesh.position.z;
        const role = dynPos?.role || 'MID';

        const animPos = animationStateRef.current.homePositions[formId];
        if (animPos && animationStateRef.current.currentAction) {
          targetX = animPos.x;
          targetZ = animPos.z;
        }

        physicsState.targetPosition.set(
          THREE.MathUtils.clamp(targetX, -FIELD_HALF_X_CONST, FIELD_HALF_X_CONST),
          0,
          THREE.MathUtils.clamp(targetZ, -FIELD_HALF_Z_CONST, FIELD_HALF_Z_CONST)
        );
        const newState = updatePlayerPhysics(mesh, targetX, targetZ, role, physicsState, delta);
        homePlayersPhysicsRef.current.set(formId, newState);
      });

      awayPlayerRefs.current.forEach((mesh, formId) => {
        const physicsState = awayPlayersPhysicsRef.current.get(formId);
        if (!physicsState) return;

        const dynPos = dynAwayMap[formId];
        let targetX = dynPos?.x ?? mesh.position.x;
        let targetZ = dynPos?.z ?? mesh.position.z;
        const role = dynPos?.role || 'MID';

        const animPos = animationStateRef.current.awayPositions[formId];
        if (animPos && animationStateRef.current.currentAction) {
          targetX = animPos.x;
          targetZ = animPos.z;
        }

        physicsState.targetPosition.set(
          THREE.MathUtils.clamp(targetX, -FIELD_HALF_X_CONST, FIELD_HALF_X_CONST),
          0,
          THREE.MathUtils.clamp(targetZ, -FIELD_HALF_Z_CONST, FIELD_HALF_Z_CONST)
        );
        const newState = updatePlayerPhysics(mesh, targetX, targetZ, role, physicsState, delta);
        awayPlayersPhysicsRef.current.set(formId, newState);
      });

      if (cameraModeRef.current === 'broadcast' && ballRef.current) {
        broadcastCamera.update(camera, ballRef.current.position, delta);
      }

      let newTrackingMode: TrackingMode = 'mouse';
      if (isMobile && gyroCalibratedRef.current) {
        deviceOrientation.applyToCamera(camera);
        newTrackingMode = 'gyro';
      } else if (!isMobile && mediaPipeActiveRef.current) {
        mediaPipe.applyToCamera(camera);
        newTrackingMode = 'face';
      } else {
        mouseLook.applyToCamera(camera);
        newTrackingMode = 'mouse';
      }

      if (newTrackingMode !== trackingModeRef.current) {
        trackingModeRef.current = newTrackingMode;
        setTrackingMode(newTrackingMode);
      }

      renderer.render(scene, camera);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    sceneContext,
  ]);

  const handleEnableMediaPipe = useCallback(async () => {
    setShowMediaPipeModal(false);
    await mediaPipe.start();
  }, [mediaPipe]);

  const handleSkipMediaPipe = useCallback(() => {
    setShowMediaPipeModal(false);
    setTrackingMode('mouse');
  }, []);

  const handleCalibrateGyro = useCallback(async () => {
    await deviceOrientation.calibrate();
    setIsGyroCalibrated(true);
    setShowCalibrateButton(false);
  }, [deviceOrientation]);

  const handleToggleCameraMode = useCallback(() => {
    setCameraMode((prev) => (prev === 'seat' ? 'broadcast' : 'seat'));
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'block',
          outline: 'none',
        }}
      />

      <video
        ref={videoRef}
        hidden
        playsInline
        muted
        style={{ display: 'none' }}
      />

      <VRHud
        homeTeam={homeTeam.name}
        awayTeam={awayTeam.name}
        homeScore={homeScore}
        awayScore={awayScore}
        currentMinute={currentMinute}
        currentEvent={commentaryText || currentEvent}
        cameraMode={cameraMode}
        trackingMode={trackingMode}
        onToggleCameraMode={handleToggleCameraMode}
        onExitVR={onExitVR}
        onCalibrate={showCalibrateButton && isMobile ? handleCalibrateGyro : undefined}
        isGoalCelebration={isGoalCelebration}
      />

      <MediaPipeOptInModal
        isOpen={showMediaPipeModal}
        isLoading={mediaPipe.isLoading}
        error={mediaPipe.error}
        onEnable={handleEnableMediaPipe}
        onSkip={handleSkipMediaPipe}
      />
    </>
  );
}
