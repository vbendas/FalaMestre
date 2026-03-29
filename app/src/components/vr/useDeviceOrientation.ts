import { useRef, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

export interface DeviceOrientationState {
  isAvailable: boolean;
  isCalibrated: boolean;
  needsPermission: boolean;
  applyToCamera: (camera: THREE.PerspectiveCamera) => void;
  calibrate: () => Promise<void>;
}

export function useDeviceOrientation(): DeviceOrientationState {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);

  const alphaRef = useRef(0);
  const betaRef = useRef(0);
  const gammaRef = useRef(0);
  const neutralAlphaRef = useRef(0);
  const neutralBetaRef = useRef(0);
  const neutralGammaRef = useRef(0);

  const currentYawRef = useRef(0);
  const currentPitchRef = useRef(0);

  const hasReceivedDataRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isIOS13Plus =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission ===
        'function';

    setNeedsPermission(isIOS13Plus);

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
        hasReceivedDataRef.current = true;
        alphaRef.current = event.alpha;
        betaRef.current = event.beta;
        gammaRef.current = event.gamma;

        if (!isAvailable) {
          setIsAvailable(true);
        }
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    const timeout = setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setIsAvailable(false);
      }
    }, 1000);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      clearTimeout(timeout);
    };
  }, [isAvailable]);

  const calibrate = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const isIOS13Plus =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission ===
        'function';

    if (isIOS13Plus) {
      try {
        const permission = await (
          DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        if (permission !== 'granted') {
          console.warn('[DeviceOrientation] Permission denied');
          return;
        }
      } catch (error) {
        console.error('[DeviceOrientation] Permission error:', error);
        return;
      }
    }

    neutralAlphaRef.current = alphaRef.current;
    neutralBetaRef.current = betaRef.current;
    neutralGammaRef.current = gammaRef.current;

    setIsCalibrated(true);
  }, []);

  const applyToCamera = useCallback(
    (camera: THREE.PerspectiveCamera) => {
      if (!isCalibrated) return;

      let deltaAlpha = alphaRef.current - neutralAlphaRef.current;
      if (deltaAlpha > 180) deltaAlpha -= 360;
      if (deltaAlpha < -180) deltaAlpha += 360;
      
      const deltaBeta = betaRef.current - neutralBetaRef.current;

      const yaw = THREE.MathUtils.degToRad(
        THREE.MathUtils.clamp(deltaAlpha, -80, 80)
      );
      const pitch = THREE.MathUtils.degToRad(
        THREE.MathUtils.clamp(deltaBeta, -30, 30)
      );

      const smoothing = 0.3;
      currentYawRef.current = THREE.MathUtils.lerp(currentYawRef.current, yaw, smoothing);
      currentPitchRef.current = THREE.MathUtils.lerp(currentPitchRef.current, pitch, smoothing);

      camera.rotation.order = 'YXZ';
      camera.rotation.x = currentPitchRef.current;
      camera.rotation.y = currentYawRef.current;
    },
    [isCalibrated]
  );

  return {
    isAvailable,
    isCalibrated,
    needsPermission,
    applyToCamera,
    calibrate,
  };
}
