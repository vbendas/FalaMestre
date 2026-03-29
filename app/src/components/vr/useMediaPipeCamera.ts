import { useRef, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

export interface MediaPipeCameraState {
  isLoading: boolean;
  isActive: boolean;
  error: string | null;
  hasFaceDetected: boolean;
  applyToCamera: (camera: THREE.PerspectiveCamera) => void;
  start: () => Promise<void>;
  stop: () => void;
}

interface FaceMeshInstance {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: FaceMeshResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close: () => void;
}

interface FaceMeshResults {
  multiFaceLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
}

export function useMediaPipeCamera(
  videoRef: React.RefObject<HTMLVideoElement | null>
): MediaPipeCameraState {
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFaceDetected, setHasFaceDetected] = useState(false);

  const faceMeshRef = useRef<FaceMeshInstance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const isActiveRef = useRef(false); // Use ref to avoid stale closure in applyToCamera

  const targetYawRef = useRef(0);
  const targetPitchRef = useRef(0);
  const currentYawRef = useRef(0);
  const currentPitchRef = useRef(0);

  const stop = useCallback(() => {
    if (faceMeshRef.current) {
      faceMeshRef.current.close();
      faceMeshRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    isActiveRef.current = false;
    setIsActive(false);
    setHasFaceDetected(false);
  }, [videoRef]);

  const start = useCallback(async () => {
    if (typeof window === 'undefined') return;

    setIsLoading(true);
    setError(null);

    console.log('[MediaPipe] start() called, videoRef.current:', !!videoRef.current);

    try {
      console.log('[MediaPipe] Starting...');
      const FaceMesh = (await import('@mediapipe/face_mesh')).FaceMesh;
      console.log('[MediaPipe] FaceMesh loaded');

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => `/mediapipe/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.3,
      } as Record<string, unknown>);

      faceMesh.onResults((results: FaceMeshResults) => {
        console.log('[MediaPipe] onResults called, landmarks:', results.multiFaceLandmarks?.length);
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          console.log('[MediaPipe] Face detected! Landmarks count:', results.multiFaceLandmarks[0].length);
          const landmarks = results.multiFaceLandmarks[0];

          const leftEye = landmarks[33];
          const rightEye = landmarks[263];
          const noseTip = landmarks[4];

          const eyeCenterX = (leftEye.x + rightEye.x) / 2;
          const eyeCenterY = (leftEye.y + rightEye.y) / 2;

          const yawOffset = (eyeCenterX - noseTip.x) * 3.0;
          const pitchOffset = (eyeCenterY - noseTip.y) * 2.5;

          const noseYaw = (noseTip.x - 0.5) * 2.5;
          const nosePitch = (noseTip.y - 0.5) * -2.0;

          const blendedYaw = (noseYaw + yawOffset) / 2;
          const blendedPitch = (nosePitch + pitchOffset) / 2;

          targetYawRef.current = THREE.MathUtils.degToRad(
            THREE.MathUtils.clamp(blendedYaw * 80, -80, 80)
          );
          targetPitchRef.current = THREE.MathUtils.degToRad(
            THREE.MathUtils.clamp(blendedPitch * 50, -50, 50)
          );

          setHasFaceDetected(true);
        } else {
          setHasFaceDetected(false);
          console.log('[MediaPipe] No face detected in frame');
        }
      });

      faceMeshRef.current = faceMesh as unknown as FaceMeshInstance;

      // Set isActive immediately when we start the process
      // The rAF loop will handle waiting for video to be ready
      isActiveRef.current = true;
      setIsActive(true);
      console.log('[MediaPipe] Marked as active, waiting for video stream...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user',
        },
      });

      if (videoRef.current) {
        console.log('[MediaPipe] Setting video srcObject');
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const processFrame = async () => {
          if (faceMeshRef.current && videoRef.current && videoRef.current.readyState >= 2) {
            await faceMeshRef.current.send({ image: videoRef.current });
          }
          animationFrameRef.current = requestAnimationFrame(processFrame);
        };
        animationFrameRef.current = requestAnimationFrame(processFrame);

        console.log('[MediaPipe] Camera started successfully, rAF loop running');
      } else {
        console.log('[MediaPipe] WARNING: videoRef.current is null but continuing anyway');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('NotAllowedError')) {
        setError('Acesso à câmera negado. Use o mouse para olhar ao redor.');
      } else if (errorMessage.includes('NotFoundError')) {
        setError('Nenhuma câmera encontrada.');
      } else {
        setError(`Erro ao iniciar câmera: ${errorMessage}`);
      }
      isActiveRef.current = false;
      setIsActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [videoRef]);

  const applyToCamera = useCallback((camera: THREE.PerspectiveCamera) => {
    if (!isActiveRef.current) return;

    const targetYaw = targetYawRef.current;
    const targetPitch = targetPitchRef.current;

    const smoothing = 0.4;
    currentYawRef.current = THREE.MathUtils.lerp(
      currentYawRef.current,
      targetYaw,
      smoothing
    );
    currentPitchRef.current = THREE.MathUtils.lerp(
      currentPitchRef.current,
      targetPitch,
      smoothing
    );

    camera.rotation.order = 'YXZ';
    camera.rotation.x = currentPitchRef.current;
    camera.rotation.y = currentYawRef.current;
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isLoading,
    isActive,
    error,
    hasFaceDetected,
    applyToCamera,
    start,
    stop,
  };
}
