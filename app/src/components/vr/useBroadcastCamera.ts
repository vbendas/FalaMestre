import { useRef, useCallback } from 'react';
import * as THREE from 'three';

export interface BroadcastCameraState {
  update: (camera: THREE.PerspectiveCamera, ballPosition: THREE.Vector3, deltaTime: number) => void;
  reset: () => void;
}

export function useBroadcastCamera(): BroadcastCameraState {
  const currentCameraPosRef = useRef(new THREE.Vector3(0, 14, 45));
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0));

  const reset = useCallback(() => {
    currentCameraPosRef.current.set(0, 14, 45);
    currentLookAtRef.current.set(0, 0, 0);
  }, []);

  const update = useCallback(
    (camera: THREE.PerspectiveCamera, ballPosition: THREE.Vector3, deltaTime: number) => {
      const targetX = THREE.MathUtils.clamp(ballPosition.x * 0.3, -35, 35);
      const targetZ = THREE.MathUtils.clamp(ballPosition.z + 30, 10, 50);

      const lerpFactor = 1 - Math.pow(0.02, deltaTime);

      currentCameraPosRef.current.x = THREE.MathUtils.lerp(
        currentCameraPosRef.current.x,
        targetX,
        lerpFactor
      );
      currentCameraPosRef.current.y = THREE.MathUtils.lerp(
        currentCameraPosRef.current.y,
        14,
        lerpFactor
      );
      currentCameraPosRef.current.z = THREE.MathUtils.lerp(
        currentCameraPosRef.current.z,
        targetZ,
        lerpFactor
      );

      const lookAtTarget = new THREE.Vector3(
        ballPosition.x * 0.5,
        0,
        ballPosition.z * 0.5
      );

      currentLookAtRef.current.lerp(lookAtTarget, lerpFactor);

      camera.position.copy(currentCameraPosRef.current);
      camera.lookAt(currentLookAtRef.current);
    },
    []
  );

  return {
    update,
    reset,
  };
}
