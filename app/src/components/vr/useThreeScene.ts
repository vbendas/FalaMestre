import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';

export interface ThreeSceneContext {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
}

export interface UseThreeSceneOptions {
  isMobile: boolean;
}

export function useThreeScene(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseThreeSceneOptions
): ThreeSceneContext | null {
  const [sceneContext, setSceneContext] = useState<ThreeSceneContext | null>(null);
  const contextRef = useRef<ThreeSceneContext | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const initScene = useCallback(() => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const { isMobile } = options;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      powerPreference: 'high-performance',
      alpha: false,
    });

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2a4a);

    const camera = new THREE.PerspectiveCamera(
      60,
      width / height,
      0.1,
      1000
    );

    camera.position.set(0, 12, 38);
    camera.rotation.x = THREE.MathUtils.degToRad(-18);
    camera.updateProjectionMatrix();

    const context: ThreeSceneContext = { renderer, camera, scene };
    contextRef.current = context;
    setSceneContext(context);

    return context;
  }, [canvasRef, options.isMobile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const context = initScene();
    if (!context) return;

    const { renderer, camera } = context;

    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });

    if (canvasRef.current) {
      resizeObserverRef.current.observe(canvasRef.current);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      renderer.dispose();
      setSceneContext(null);
    };
  }, [initScene, canvasRef]);

  return sceneContext;
}
