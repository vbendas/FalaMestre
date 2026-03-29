import { useRef, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

export interface MouseLookState {
  isLocked: boolean;
  applyToCamera: (camera: THREE.PerspectiveCamera) => void;
  lock: () => void;
  unlock: () => void;
}

export function useMouseLook(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): MouseLookState {
  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);

  const yawRef = useRef(0);
  const pitchRef = useRef(THREE.MathUtils.degToRad(-18));

  const mouseSensitivity = 0.002;
  const touchSensitivity = 0.008;
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    yawRef.current -= event.movementX * mouseSensitivity;
    pitchRef.current -= event.movementY * mouseSensitivity;

    pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, THREE.MathUtils.degToRad(-40), THREE.MathUtils.degToRad(40));
  }, []);

  const handlePointerLockChange = useCallback(() => {
    const isCurrentlyLocked = document.pointerLockElement === canvasRef.current;
    isLockedRef.current = isCurrentlyLocked;
    setIsLocked(isCurrentlyLocked);

    if (!isCurrentlyLocked) {
      document.removeEventListener('mousemove', handleMouseMove);
    }
  }, [canvasRef, handleMouseMove]);

  const lock = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
  }, [canvasRef]);

  const unlock = useCallback(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (event.touches.length === 1) {
      touchStartRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length === 1 && touchStartRef.current) {
      const deltaX = event.touches[0].clientX - touchStartRef.current.x;
      const deltaY = event.touches[0].clientY - touchStartRef.current.y;

      yawRef.current -= deltaX * touchSensitivity;
      pitchRef.current -= deltaY * touchSensitivity;

      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current,
        THREE.MathUtils.degToRad(-40),
        THREE.MathUtils.degToRad(40)
      );

      touchStartRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  const applyToCamera = useCallback(
    (camera: THREE.PerspectiveCamera) => {
      camera.rotation.order = 'YXZ';
      camera.rotation.x = pitchRef.current;
      camera.rotation.y = yawRef.current;
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    document.addEventListener('pointerlockchange', handlePointerLockChange);

    const handleCanvasClick = () => {
      if (!isLocked) {
        lock();
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick);
    }

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      if (canvas) {
        canvas.removeEventListener('click', handleCanvasClick);
      }
    };
  }, [canvasRef, handlePointerLockChange, handleMouseMove, lock, isLocked]);

  useEffect(() => {
    if (isLocked) {
      document.addEventListener('mousemove', handleMouseMove);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isLocked, handleMouseMove]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canvasRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isLocked,
    applyToCamera,
    lock,
    unlock,
  };
}
