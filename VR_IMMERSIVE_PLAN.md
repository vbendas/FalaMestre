# VR Immersive Stadium Mode — Build Plan
**Project:** FalaMestre!  
**Feature:** Immersive Stadium VR (Three.js migration + MediaPipe + Device Motion)  
**Build model:** Minimax M2.5  
**Last updated:** 2026-03-13  
**Status:** Ready for build

---

## Overview

Migrate the existing A-Frame VR match viewer to **pure Three.js** and add three camera input modes that create a genuine "sitting in the stadium" experience — no VR headset required. Mobile users get gyroscope tracking (Device Motion API), desktop users get webcam head tracking (MediaPipe Face Mesh), and all users get a toggle to switch to a Broadcast POV that follows the ball.

### Final user experience
- User clicks "VR Mode" during a match
- On **mobile**: scene renders from a stadium seat, tilting the phone pans the view
- On **desktop**: a polite opt-in modal asks for camera access; head movement rotates the view
- If camera is denied on desktop: falls back to mouse-drag look
- A HUD toggle button switches between **Stadium Seat** and **Broadcast POV** at any time
- Existing WebXR path (real VR headsets) is re-enabled and works as a third mode

### What is being replaced
- `app/src/components/vr/VRMatchView.tsx` — A-Frame scene (1,632 lines) → replaced by Three.js
- `app/src/types/aframe.d.ts` — A-Frame JSX type declarations → can be removed after migration
- Dependencies: `aframe`, `react-aframe`, `@types/aframe` → replaced by `three`, `@types/three`, `@mediapipe/face_mesh`, `@mediapipe/camera_utils`

### What is NOT being changed
- `app/src/hooks/useVRAnimationController.ts` — same hook interface, just feeds Three.js meshes
- `app/src/lib/matchScriptGenerator.ts` — untouched
- `app/src/lib/game-engine.ts` — untouched
- `app/src/components/vr/formations.ts` — untouched
- `app/src/components/game/MatchView.tsx` — only the import of `VRMatchView` changes to `ThreeMatchView`; all props remain identical
- All physics constants and logic — ported 1:1 to Three.js Vector3

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| 3D engine | Pure Three.js (no A-Frame wrapper) | Full control over camera, render loop, WebXR |
| Mobile head tracking | Device Orientation API (alpha/beta/gamma) | Zero permissions needed on Android; iOS needs one tap |
| Desktop head tracking | MediaPipe Face Mesh (478 landmarks) | Accurate yaw/pitch from nose + eye geometry |
| Desktop fallback | Mouse drag (PointerLock API) | Same feel as current A-Frame look-controls |
| Performance on mobile | `antialias: false` + `pixelRatio` capped at 1.5 + `InstancedMesh` for crowd | Consistent 60fps on mid-range phones |
| MediaPipe loading | Dynamic import behind opt-in modal | ~30MB bundle — must NOT affect initial page load |
| WebXR | `renderer.xr.enabled = true` + `VRButton` helper | Re-enables headset support (was disabled in A-Frame scene) |
| Stadium viewpoint | Camera at `(0, 12, 38)`, tilt `-18°` on X | Feels like upper-stand seated view, full pitch visible |
| Broadcast viewpoint | Camera lerps to `(ballX * 0.3, 14, ballZ + 30)` | Follows play, stays stable, cinematic |

---

## File Map (new files to create + files to modify)

### New files
```
app/src/components/vr/ThreeMatchView.tsx         ← main component (replaces VRMatchView)
app/src/components/vr/useThreeScene.ts           ← Three.js scene init hook (renderer, camera, scene)
app/src/components/vr/useDeviceOrientation.ts    ← Device Motion camera controller hook
app/src/components/vr/useMediaPipeCamera.ts      ← MediaPipe face tracking camera controller hook
app/src/components/vr/useMouseLook.ts            ← Mouse drag / PointerLock fallback hook
app/src/components/vr/useBroadcastCamera.ts      ← Ball-following broadcast POV hook
app/src/components/vr/ThreeSceneObjects.ts       ← Factory functions: field, players, ball, crowd, ads
app/src/components/vr/ThreePhysicsLoop.ts        ← Physics loop (ported from VRMatchView, Three.js Vector3)
app/src/components/vr/VRHud.tsx                  ← 2D overlay: score, minute, mode indicator, toggle button
app/src/components/vr/MediaPipeOptInModal.tsx    ← Camera permission request modal (desktop only)
app/src/components/vr/StadiumSeatGeometry.ts     ← Foreground seat/railing geometry for immersion
```

### Modified files
```
app/src/components/game/MatchView.tsx            ← swap VRMatchView import → ThreeMatchView
app/src/components/vr/index.ts                   ← add ThreeMatchView to barrel exports
app/package.json                                 ← add three, @types/three, @mediapipe/face_mesh, @mediapipe/camera_utils
                                                    remove aframe, react-aframe, @types/aframe
app/src/types/aframe.d.ts                        ← delete after migration verified
```

---

## Phase 1 — Dependencies & Project Setup

**No parallelism needed — must complete before all other phases.**

### Task 1.1 — Install Three.js dependencies
```bash
cd app
bun add three @types/three
bun add @mediapipe/face_mesh @mediapipe/camera_utils
```
- Verify `three` version is `^0.170.0` or later (needed for WebXR support)
- Verify TypeScript resolves `import * as THREE from 'three'` without errors

### Task 1.2 — Remove A-Frame dependencies
```bash
cd app
bun remove aframe react-aframe @types/aframe
```
- After removal, verify `app/package.json` no longer lists these packages
- `app/src/types/aframe.d.ts` can be kept until Phase 6 (will cause no harm while A-Frame is removed — TypeScript will simply ignore the declarations since nothing imports them)

### Task 1.3 — Add Three.js type path to tsconfig
In `app/tsconfig.json`, ensure `"moduleResolution": "bundler"` or `"node16"` resolves Three.js addon paths (e.g. `three/addons/webxr/VRButton.js`). Add path alias if needed:
```json
"paths": {
  "three/addons/*": ["./node_modules/three/examples/jsm/*"]
}
```

### Task 1.4 — Validate build still compiles
```bash
cd app && bun run build
```
Expected: build succeeds. If A-Frame removal causes any remaining import errors, fix them before proceeding.

---

## Phase 2 — Three.js Scene Foundation

**Subagents can work on Tasks 2.1, 2.2, and 2.3 in parallel once Phase 1 is complete.**

---

### Task 2.1 — Scene initialisation hook (`useThreeScene.ts`)
**File:** `app/src/components/vr/useThreeScene.ts`

Create a React hook that:
1. Accepts a `canvasRef: React.RefObject<HTMLCanvasElement>` and an `isMobile: boolean` flag
2. Creates a `THREE.WebGLRenderer` attached to the canvas:
   - `antialias: !isMobile`
   - `powerPreference: 'high-performance'`
   - `pixelRatio: Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)`
   - `renderer.xr.enabled = true` (re-enable WebXR)
3. Creates a `THREE.PerspectiveCamera(60, aspect, 0.1, 1000)`
4. Creates a `THREE.Scene`
5. Sets up a `ResizeObserver` to handle canvas resizing
6. Returns `{ renderer, camera, scene }` as stable refs (not state — never trigger re-render)
7. Cleans up renderer on unmount (`renderer.dispose()`)

---

### Task 2.2 — Scene objects factory (`ThreeSceneObjects.ts`)
**File:** `app/src/components/vr/ThreeSceneObjects.ts`

Export factory functions that return `THREE.Object3D` or `THREE.Group` instances. All geometry uses the same coordinate system as the existing A-Frame scene: field 80×45 units, origin at center.

#### 2.2.1 — `createField(): THREE.Group`
- Base plane: `PlaneGeometry(84, 49)`, dark green `#2d5a27`, `MeshLambertMaterial`
- 16 grass stripes: `PlaneGeometry(5, 43)` each, alternating `#3d6a37` / `#2d5a27`, at `y=0.001`
- Semi-transparent overlay: `PlaneGeometry(84, 49)`, white, 5% opacity
- All planes rotated `-Math.PI/2` on X (Three.js XZ ground plane)

#### 2.2.2 — `createFieldLines(): THREE.Group`
- Center circle: `RingGeometry(9.1, 9.5, 64)`, white `MeshBasicMaterial`
- Center spot: `CircleGeometry(0.5, 16)`, white
- Halfway line: `BoxGeometry(0.2, 0.01, 45)`, white
- Penalty boxes (both ends): 4× `BoxGeometry` outline lines
- Penalty arcs: `RingGeometry` partial (use `thetaStart` / `thetaLength`)
- Touchlines and goal lines: 4× thin `BoxGeometry`

#### 2.2.3 — `createGoal(side: 'home' | 'away'): THREE.Group`
- Side = `'home'` → `x = -40`; side = `'away'` → `x = +40`
- Posts: 2× `CylinderGeometry(0.1, 0.1, 2.44)`, white
- Crossbar: `CylinderGeometry(0.1, 0.1, 7.32)`, white, rotated 90° on Z
- Net: `PlaneGeometry(7.32, 2.44)`, white, 30% opacity, `side: THREE.DoubleSide`

#### 2.2.4 — `createCornerFlags(): THREE.Group`
- 4 flags at `(±40, 0, ±22.5)`
- Post: `CylinderGeometry(0.05, 0.05, 1.2)`, white
- Flag: small `PlaneGeometry(0.4, 0.3)` in team home color

#### 2.2.5 — `createSky(): THREE.Mesh`
- `SphereGeometry(500, 32, 32)`, night-stadium color `#1a2a4a`
- `MeshBasicMaterial`, `side: THREE.BackSide`

#### 2.2.6 — `createLights(): THREE.Object3D[]`
Port exactly from VRMatchView:
- `AmbientLight(0x8899aa, 0.5)`
- 4× `PointLight(0xffeecc, 0.8)` at `(±35, 20, ±20)` — stadium floodlights
- `DirectionalLight(0xffffff, 0.3)` at `(0, 50, 0)`

#### 2.2.7 — `createPlayerMesh(color: string, number: number): THREE.Group`
Port from `PlayerModel` in VRMatchView:
- Body: `CylinderGeometry(0.5, 0.5, 1.2, 8)`, `MeshLambertMaterial({ color })`
- Head: `SphereGeometry(0.3, 8, 8)`, same color
- Shadow disc: `CircleGeometry(0.6, 16)`, black 40% opacity, at `y=0.001` rotated flat
- Jersey number: use `THREE.Sprite` with a canvas texture rendering the number (replaces A-Frame `<a-text>`)
- Returns a `THREE.Group` with named children: `body`, `head`, `shadow`, `number`
- Group origin is at ground level (`y=0`) — body base is at y=0, center at y=0.6

#### 2.2.8 — `createBall(): THREE.Group`
Port from `Ball` in VRMatchView:
- Main sphere: `SphereGeometry(0.35, 16, 16)`, white
- 7 black patch spheres: `SphereGeometry(0.1, 8, 8)` scattered at surface positions (hardcode offsets)
- Shadow disc: `CircleGeometry(0.5, 16)`, black 20% opacity, flat on ground
- Returns `THREE.Group`

#### 2.2.9 — `createCrowd(homeColor: string, awayColor: string): THREE.InstancedMesh`
Port from `VRStadiumCrowd`. Use `InstancedMesh` for performance:
- 240 crowd members across 4 stands
- Each instance: cylinder body + sphere head (can bake into a single merged `BufferGeometry` per stand)
- Use `setColorAt` on the `InstancedMesh` to alternate home/away colors
- Return 4 `InstancedMesh` objects (one per stand) in a `THREE.Group`

#### 2.2.10 — `createAdBoards(): THREE.Group`
Port from `VRAdBoards`:
- 10 boards around perimeter
- Each board: `BoxGeometry(8, 1.5, 0.3)`, `MeshLambertMaterial` with canvas texture showing ad text
- Canvas texture updates every 5 seconds (use `setInterval` inside a `useEffect` in the parent component — NOT inside this factory function)
- Factory just creates the geometry and returns refs to the board materials so the parent can update textures

---

### Task 2.3 — Stadium seat foreground geometry (`StadiumSeatGeometry.ts`)
**File:** `app/src/components/vr/StadiumSeatGeometry.ts`

Creates the foreground elements that sell the "you are sitting in the stands" illusion:
- Railing: `BoxGeometry(6, 0.15, 0.15)`, grey, positioned in front of camera at `(0, 11, 32)` — partially occluding the bottom of the view
- Two armrests: `BoxGeometry(0.15, 0.3, 0.4)`, at `(-0.4, 10.8, 32.2)` and `(0.4, 10.8, 32.2)`
- Seat back (partial, bottom of frame): `BoxGeometry(0.8, 0.6, 0.1)` at `(0, 10.5, 32.5)`, stadium blue
- These objects are added to the scene but **fixed in camera space** (add them as children of the camera's parent group, not the world scene) so they always appear at the same screen position regardless of where the camera looks

---

## Phase 3 — Camera Controllers

**All four tasks (3.1, 3.2, 3.3, 3.4) can be developed in parallel. They are independent hooks with no shared state.**

---

### Task 3.1 — Device Orientation hook (`useDeviceOrientation.ts`)
**File:** `app/src/components/vr/useDeviceOrientation.ts`

```typescript
// Interface
export function useDeviceOrientation(): {
  isAvailable: boolean;
  isCalibrated: boolean;
  calibrate: () => void;
  applyToCamera: (camera: THREE.PerspectiveCamera) => void;
}
```

Implementation:
1. Listen to `window.addEventListener('deviceorientation', handler)`
2. On iOS 13+, check `typeof DeviceOrientationEvent.requestPermission === 'function'` — if so, `calibrate()` must call `DeviceOrientationEvent.requestPermission()` (must be called from a user gesture — wire `calibrate()` to a button tap in the HUD)
3. Store raw `alpha`, `beta`, `gamma` in refs (not state)
4. On calibration: store the current `alpha/beta/gamma` as the "neutral" offset
5. `applyToCamera(camera)`:
   - Compute delta from neutral: `deltaAlpha = alpha - neutralAlpha`, `deltaBeta = beta - neutralBeta`
   - Map to camera: yaw = `deltaAlpha * DEG2RAD`, pitch = `deltaBeta * DEG2RAD`
   - Clamp pitch to `[-30°, +30°]`, yaw to `[-70°, +70°]`
   - Apply as `camera.rotation.order = 'YXZ'`; set `camera.rotation.x = pitch`, `camera.rotation.y = yaw`
   - Use `THREE.MathUtils.lerp` with factor `0.15` for smoothing (prevents jitter)
6. `isAvailable`: set to `true` only if at least one `deviceorientation` event fires within 500ms of mount
7. Clean up event listener on unmount

---

### Task 3.2 — MediaPipe face tracking hook (`useMediaPipeCamera.ts`)
**File:** `app/src/components/vr/useMediaPipeCamera.ts`

```typescript
// Interface
export function useMediaPipeCamera(videoRef: React.RefObject<HTMLVideoElement>): {
  isLoading: boolean;
  isActive: boolean;
  error: string | null;
  applyToCamera: (camera: THREE.PerspectiveCamera) => void;
  start: () => Promise<void>;
  stop: () => void;
}
```

Implementation:
1. **Dynamic import** of MediaPipe (never in the module-level import — must be inside `start()`):
   ```typescript
   const { FaceMesh } = await import('@mediapipe/face_mesh');
   const { Camera } = await import('@mediapipe/camera_utils');
   ```
2. `start()`:
   - Request `getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })`
   - Set video stream on `videoRef.current`
   - Initialize `FaceMesh` with `{ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 }`
   - Set `onResults` callback (see below)
   - Initialize `Camera` helper pointing at the video element with `onFrame` calling `faceMesh.send({ image: videoEl })`
3. `onResults` callback:
   - Extract landmarks `[0]` (first face)
   - Key landmarks used:
     - Nose tip: `landmarks[4]` (index 4 in MediaPipe 478-point model)
     - Left eye outer: `landmarks[33]`
     - Right eye outer: `landmarks[263]`
     - Forehead: `landmarks[10]`
     - Chin: `landmarks[152]`
   - **Yaw (left/right):** `(noseTip.x - 0.5) * -2.0` → range `-1 to +1` → multiply by `60 * DEG2RAD`
   - **Pitch (up/down):** `(noseTip.y - 0.5) * -1.5` → range → multiply by `30 * DEG2RAD`
   - Store computed `targetYaw` and `targetPitch` in refs
4. `applyToCamera(camera)`:
   - `camera.rotation.order = 'YXZ'`
   - Lerp current rotation toward target: factor `0.12` (smooth but responsive)
   - Apply clamped values: pitch `[-25°, +25°]`, yaw `[-60°, +60°]`
5. `stop()`: stop all video tracks, dispose FaceMesh instance
6. Error handling: catch `getUserMedia` rejections (NotAllowedError, NotFoundError) and set `error` state with a user-friendly message

---

### Task 3.3 — Mouse look fallback hook (`useMouseLook.ts`)
**File:** `app/src/components/vr/useMouseLook.ts`

```typescript
export function useMouseLook(canvasRef: React.RefObject<HTMLCanvasElement>): {
  applyToCamera: (camera: THREE.PerspectiveCamera) => void;
}
```

Implementation:
1. On canvas click, request Pointer Lock: `canvas.requestPointerLock()`
2. On `mousemove` while locked: accumulate `movementX` and `movementY` into `yawRef` and `pitchRef`
   - Sensitivity: `0.002` rad per pixel
3. Clamp pitch to `[-40°, +40°]`, yaw unclamped (full 360° horizontal)
4. `applyToCamera(camera)`: apply stored yaw/pitch each frame
5. On `pointerlockchange`: update an `isLocked` ref; show cursor-lock instruction overlay when not locked
6. Clean up on unmount

---

### Task 3.4 — Broadcast camera hook (`useBroadcastCamera.ts`)
**File:** `app/src/components/vr/useBroadcastCamera.ts`

```typescript
export function useBroadcastCamera(): {
  update: (camera: THREE.PerspectiveCamera, ballPosition: THREE.Vector3, deltaTime: number) => void;
}
```

Implementation:
1. Maintains a `currentCameraPos: THREE.Vector3` ref initialized to `(0, 14, 45)`
2. `update(camera, ballPosition, deltaTime)`:
   - Compute target position: `(ballPosition.x * 0.3, 14, ballPosition.z + 30)`
   - Lerp `currentCameraPos` toward target: `lerpFactor = 1 - Math.pow(0.02, deltaTime)` (frame-rate independent lerp)
   - Clamp X to `[-35, +35]`, Z to `[10, 50]`
   - Set `camera.position.copy(currentCameraPos)`
   - `camera.lookAt(ballPosition.x * 0.5, 0, ballPosition.z * 0.5)` — look slightly toward ball
3. This hook does NOT manage head tracking input — the head tracking hooks still apply their delta rotation on top of the broadcast base position. This means in broadcast mode the user can still look slightly off the main ball direction.

---

## Phase 4 — Physics Loop (Three.js port)

**Depends on Phase 2 (scene objects) and can begin as soon as Task 2.7 (player mesh factory) is done.**

### Task 4.1 — Port physics loop to Three.js (`ThreePhysicsLoop.ts`)
**File:** `app/src/components/vr/ThreePhysicsLoop.ts`

This is a direct port of the `requestAnimationFrame` loop currently embedded in `VRMatchView.tsx` (lines 1118–1367). Replace all A-Frame `setAttribute` calls with Three.js `Object3D.position.set()` and `Object3D.rotation.set()`.

#### Physics constants (keep identical)
```typescript
export const PHYSICS = {
  GRAVITY: -9.8,
  BALL_BOUNCE_DAMPING: 0.6,
  BALL_AIR_RESISTANCE: 0.05,
  BALL_GROUND_FRICTION: 0.8,
  PLAYER_MAX_SPEED: 7.0,
  PLAYER_ACCELERATION: 15.0,
  PLAYER_TURN_SPEED: Math.PI * 2,  // 360 deg/s in radians
  BALL_SHOT_SPEED: 25.0,
  BALL_PASS_SPEED: 15.0,
  GROUND_HEIGHT: 0.35,
  FIELD_HALF_X: 38,
  FIELD_HALF_Z: 21,
} as const;
```

#### Exported interface
```typescript
export interface PhysicsState {
  ballVelocity: THREE.Vector3;
  ballAngularVelocity: THREE.Vector3;
  playerVelocities: Record<string, THREE.Vector3>;
  lastKickedEventId: string | null;
}

export function createPhysicsState(): PhysicsState;

export function updateBallPhysics(
  ballMesh: THREE.Object3D,
  state: PhysicsState,
  delta: number
): void;

export function updatePlayerPhysics(
  playerMesh: THREE.Object3D,
  targetPosition: THREE.Vector3,
  playerId: string,
  role: 'GK' | 'DEF' | 'MID' | 'FWD',
  state: PhysicsState,
  delta: number
): void;

export function triggerKick(
  ballMesh: THREE.Object3D,
  targetPosition: THREE.Vector3,
  kickType: 'shot' | 'pass' | 'clearance',
  state: PhysicsState
): void;

export function getDynamicPlayerPositions(
  formation: string,
  eventType: string,
  ballPosition: THREE.Vector3,
  isHomeTeam: boolean,
  time: number
): Record<string, THREE.Vector3>;
```

#### Key porting notes
- Replace `entity.getAttribute('position')` → `mesh.position.clone()`
- Replace `entity.setAttribute('position', {x,y,z})` → `mesh.position.set(x, y, z)`
- Replace `entity.setAttribute('rotation', {x,y,z})` → `mesh.rotation.set(x, y, z)`
- The billboard effect (player labels always facing camera) is achieved with `sprite.lookAt(camera.position)` called each frame for number sprites — Three.js `Sprite` objects do this automatically, so no custom component needed

---

## Phase 5 — Main Component (`ThreeMatchView.tsx`)

**Depends on Phases 2, 3, and 4 being complete.**

### Task 5.1 — Build `ThreeMatchView.tsx`
**File:** `app/src/components/vr/ThreeMatchView.tsx`

#### Props interface (identical to current `VRMatchView` props — critical for zero changes in MatchView.tsx)
```typescript
interface ThreeMatchViewProps {
  homeTeam: {
    name: string;
    color: string;
    formation: Formation;
    players: Array<{ id: string; name: string; number: number; position: string }>;
  };
  awayTeam: {
    name: string;
    color: string;
    formation: Formation;
    players: Array<{ id: string; name: string; number: number; position: string }>;
  };
  currentMinute: number;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  currentEvent?: string;
  matchScript?: MatchScript;
  onExitVR: () => void;
}
```

#### Component structure
```
ThreeMatchView
├── <canvas ref={canvasRef} />               ← Three.js renders here
├── <video ref={videoRef} hidden />           ← MediaPipe webcam feed (hidden)
├── <VRHud />                                 ← 2D overlay (score, minute, buttons)
├── <MediaPipeOptInModal />                   ← Desktop opt-in (renders null on mobile)
└── useEffect hooks:
    ├── useThreeScene(canvasRef, isMobile)    ← renderer, camera, scene
    ├── useDeviceOrientation()               ← mobile head tracking
    ├── useMediaPipeCamera(videoRef)          ← desktop head tracking
    ├── useMouseLook(canvasRef)               ← desktop fallback
    ├── useBroadcastCamera()                  ← broadcast POV logic
    └── useVRAnimationController(matchScript) ← existing hook (unchanged)
```

#### Render loop (inside main `useEffect`)
```typescript
const animate = (time: number) => {
  const delta = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  // 1. Update physics
  updateBallPhysics(ballMesh, physicsState, delta);
  homePlayers.forEach((mesh, id) => updatePlayerPhysics(mesh, ...));
  awayPlayers.forEach((mesh, id) => updatePlayerPhysics(mesh, ...));

  // 2. Apply camera input (only one mode active at a time)
  if (cameraMode === 'broadcast') {
    broadcastCamera.update(camera, ballMesh.position, delta);
  } else {
    // Always reset to stadium seat position first
    camera.position.set(0, 12, 38);
  }

  if (isMobile && deviceOrientation.isCalibrated) {
    deviceOrientation.applyToCamera(camera);
  } else if (isDesktop && mediaPipe.isActive) {
    mediaPipe.applyToCamera(camera);
  } else {
    mouseLook.applyToCamera(camera);
  }

  // 3. Update ad board canvas textures (every 5s)
  // 4. Update player number sprites to face camera
  // 5. Render
  renderer.render(scene, camera);

  animFrameRef.current = requestAnimationFrame(animate);
};
animFrameRef.current = requestAnimationFrame(animate);
```

#### Camera mode state
```typescript
const [cameraMode, setCameraMode] = useState<'seat' | 'broadcast'>('seat');
```
Toggled by the HUD button. Broadcast mode smoothly transitions via `useBroadcastCamera`.

#### Device detection
```typescript
const isMobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
```

#### iOS DeviceOrientation permission flow
- On mount, if `isMobile` and `typeof DeviceOrientationEvent.requestPermission === 'function'`, show a brief "Tap to enable gyroscope" overlay
- On tap, call `DeviceOrientationEvent.requestPermission()`, then call `deviceOrientation.calibrate()`
- Overlay disappears after permission granted

---

## Phase 6 — HUD and Modals

**Can be developed in parallel with Phase 5 (no dependency on ThreeMatchView internals).**

### Task 6.1 — VR HUD (`VRHud.tsx`)
**File:** `app/src/components/vr/VRHud.tsx`

A `position: absolute` React overlay on top of the Three.js canvas.

#### Props
```typescript
interface VRHudProps {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  currentMinute: number;
  currentEvent?: string;
  cameraMode: 'seat' | 'broadcast';
  trackingMode: 'gyro' | 'face' | 'mouse' | 'headset';
  onToggleCameraMode: () => void;
  onExitVR: () => void;
  onCalibrate?: () => void;       // shown only on mobile before calibration
}
```

#### Layout
```
┌─────────────────────────────────────────────────────────┐
│ [EXIT VR]                              [📍 Seat | 📺 Broadcast] │
│                                                         │
│              ← Three.js scene fills screen →            │
│                                                         │
│  ┌──────────────────────────────────────┐               │
│  │  HOME TEAM  3 – 1  AWAY TEAM  56'   │  (score bar)  │
│  └──────────────────────────────────────┘               │
│  [Gyro Active 📱]   "Gol dos Leões!"    (commentary)   │
└─────────────────────────────────────────────────────────┘
```

- **Score bar**: centered bottom, semi-transparent dark background, white text, `font-size: 14px`
- **Exit VR button**: top-left, same style as current (`×` or "Sair do VR")
- **Camera mode toggle**: top-right, two-segment button: "📍 Torcida" / "📺 Transmissão"
- **Tracking mode indicator**: bottom-left small badge: 
  - `📱 Giroscópio` (gyro)
  - `👁 Face Tracking` (mediapipe)
  - `🖱 Mouse` (mouse look)
  - `🥽 Headset` (WebXR)
- **Commentary ticker**: bottom center, latest `currentEvent` text, fades in/out with Framer Motion
- **Calibrate button**: bottom-right, only visible on mobile before gyro is calibrated: "Tap to calibrate gyroscope"
- All text in **Brazilian Portuguese**
- Use Tailwind for styling (consistent with rest of app)

### Task 6.2 — MediaPipe opt-in modal (`MediaPipeOptInModal.tsx`)
**File:** `app/src/components/vr/MediaPipeOptInModal.tsx`

A modal shown on desktop when VR mode is first entered.

#### Props
```typescript
interface MediaPipeOptInModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  onEnable: () => void;
  onSkip: () => void;
}
```

#### Content
- Title: "Quer uma experiência ainda mais imersiva?"
- Body: "Ative o rastreamento facial para mover a câmera com a cabeça, como se estivesse no estádio. Sua câmera não é gravada."
- [Ativar câmera] button → calls `onEnable()`
- [Usar mouse] button → calls `onSkip()`
- Loading state: spinner + "Carregando..."
- Error state: shows `error` text + retry button
- Skip is shown prominently (users should not feel forced)
- Webcam preview (small `<video>` element) shown once active so user can see tracking is working
- Small indicator dot (green pulsing) when face is detected

---

## Phase 7 — Integration & Wiring

**Depends on all previous phases.**

### Task 7.1 — Update `MatchView.tsx`
**File:** `app/src/components/game/MatchView.tsx`

Change one import and one JSX element:
```typescript
// Before
import VRMatchView from '@/components/vr/VRMatchView';
// ...
return <VRMatchView {...props} />;

// After
import ThreeMatchView from '@/components/vr/ThreeMatchView';
// ...
return <ThreeMatchView {...props} />;
```

All props passed to `ThreeMatchView` are identical to `VRMatchView` — no other changes needed.

### Task 7.2 — Update barrel exports (`index.ts`)
**File:** `app/src/components/vr/index.ts`

Add `ThreeMatchView` to exports. Keep `VRMatchView` export until it is deleted (Phase 8).

### Task 7.3 — Update `next.config.ts` if needed
A-Frame required specific webpack ignores. Verify those are no longer needed and clean up.

---

## Phase 8 — Cleanup

**Only after all tests pass.**

### Task 8.1 — Delete old A-Frame files
- Delete `app/src/components/vr/VRMatchView.tsx`
- Delete `app/src/types/aframe.d.ts`
- Remove `VRMatchView` from `app/src/components/vr/index.ts`
- Remove A-Frame-specific webpack config from `next.config.ts` if present

### Task 8.2 — Verify no remaining A-Frame references
```bash
grep -r "aframe\|a-scene\|a-entity\|a-camera\|a-plane\|a-sphere\|a-cylinder" app/src --include="*.tsx" --include="*.ts"
```
Expected: zero results.

---

## Phase 9 — Testing

**Depends on Phase 7 (integration complete).**

### Task 9.1 — Update Playwright VR tests
**File:** `app/tests/vr.spec.ts`

The existing 12 Playwright tests target A-Frame selectors (e.g. `a-entity`, `a-sphere`). All selectors must be updated to target the Three.js canvas and HUD elements.

#### Tests to update
| Old test | New assertion |
|---|---|
| A-Frame scene renders | `<canvas>` element is visible, has non-zero dimensions |
| 22 player bodies present | HUD renders; physics loop starts (proxy: `currentMinute` increments) |
| Ball visible | Canvas renders without GL errors (check console) |
| Smooth animation | Canvas `drawingBufferWidth > 0` and no framedrops (proxy test) |
| Ad boards present | HUD contains the POV toggle button |
| Ball carrier indicator | Commentary ticker text appears in HUD |
| Camera keyboard controls | Mouse move on canvas changes camera (test with synthetic events) |
| Zero console errors | No `console.error` calls during 5s of playback |

#### New tests to add
| Test | Assertion |
|---|---|
| VR HUD renders score | `.vr-score-bar` shows home and away team names |
| VR HUD exit button works | Click exit → `onExitVR` called → VR canvas unmounts |
| Camera mode toggle | Click "📺 Transmissão" → button shows active state |
| Mobile UA: gyro mode shown | Set mobile user agent → tracking badge shows "Giroscópio" |
| Desktop no camera: mouse mode | Mock `getUserMedia` rejection → tracking badge shows "Mouse" |
| MediaPipe opt-in modal shown | Desktop load → modal with "Ativar câmera" visible |
| Modal skip → mouse look | Click "Usar mouse" → modal closes → mouse tracking active |

### Task 9.2 — Run full test suite
```bash
cd app && bun run test        # Vitest unit tests
cd app && bun run test:e2e    # Playwright E2E
```

Expected: all tests pass. Fix any failures before considering the feature complete.

### Task 9.3 — Manual smoke test checklist
Run through this manually in a browser before marking done:

**Mobile (Chrome DevTools device emulation or real device):**
- [ ] VR mode opens, Three.js canvas renders pitch
- [ ] Stadium seat foreground railing visible
- [ ] Gyroscope calibration prompt appears
- [ ] After calibration, tilting emulated device pans view
- [ ] 22 players visible and moving
- [ ] Ball physics active
- [ ] Score and minute updating in HUD
- [ ] Camera mode toggle: Seat ↔ Broadcast
- [ ] Exit VR returns to 2D match view
- [ ] No JS console errors

**Desktop (Chrome):**
- [ ] VR mode opens, MediaPipe opt-in modal appears
- [ ] Clicking "Usar mouse" dismisses modal, enables mouse look
- [ ] PointerLock engages on canvas click
- [ ] Mouse movement pans camera
- [ ] Clicking "Ativar câmera" requests webcam permission
- [ ] After permission granted, MediaPipe loads and face tracking activates
- [ ] Webcam preview pip visible in corner
- [ ] Head movement rotates camera
- [ ] Camera mode toggle works
- [ ] Broadcast POV follows ball

**Headset (if available):**
- [ ] WebXR "Enter VR" button visible
- [ ] Scene renders in stereo when headset is connected

---

## Parallel Development Map

```
Phase 1 (serial — must finish first)
    └── All of Phase 2, 3 can start in parallel:
        ├── Subagent A: Task 2.1 (useThreeScene) + Task 2.2 (ThreeSceneObjects) + Task 2.3 (StadiumSeatGeometry)
        ├── Subagent B: Task 3.1 (useDeviceOrientation) + Task 3.3 (useMouseLook)
        ├── Subagent C: Task 3.2 (useMediaPipeCamera) + Task 6.2 (MediaPipeOptInModal)
        └── Subagent D: Task 3.4 (useBroadcastCamera) + Task 6.1 (VRHud)
    └── Phase 4 (Task 4.1 — ThreePhysicsLoop) can start as soon as Task 2.7 (createPlayerMesh) is done
    └── Phase 5 (ThreeMatchView) starts after Phases 2, 3, 4 complete
    └── Phase 6 can run in parallel with Phase 5
    └── Phase 7 (integration) after Phases 5 and 6
    └── Phase 8 (cleanup) after Phase 7
    └── Phase 9 (tests) after Phase 7
```

---

## Key Constraints for Build Agent

1. **Never trigger React re-renders inside the animation loop.** All per-frame updates use refs and direct Three.js API. State (`useState`) is only for: `cameraMode`, `trackingMode`, `isMediaPipeModalOpen`.

2. **MediaPipe must be dynamically imported.** Never import `@mediapipe/face_mesh` at the module level. Always use `await import(...)` inside an async function triggered by user action.

3. **Three.js canvas must be `position: absolute; width: 100%; height: 100%; top: 0; left: 0`** inside a `position: relative` wrapper div. The HUD sits on top with the same absolute positioning but `z-index: 10`.

4. **All player/ball position updates bypass React state** — use `mesh.position.set(x, y, z)` directly, same as the original A-Frame `setAttribute` pattern.

5. **Device detection must happen at runtime**, not build time. Use `typeof window !== 'undefined'` guards for SSR safety (Next.js).

6. **iOS permission for DeviceOrientation must be triggered by a user gesture** (button tap). Never call `DeviceOrientationEvent.requestPermission()` on page load — it will be silently rejected.

7. **`renderer.setAnimationLoop`** should be used instead of raw `requestAnimationFrame` when WebXR is enabled — this is required for WebXR to work correctly in Three.js.

8. **Cleanup on unmount is mandatory**: `renderer.dispose()`, stop all video tracks, remove all event listeners, cancel animation loop. Memory leaks in WebGL context will crash the tab after multiple match cycles.

9. **The `ThreeMatchView` props interface must be identical to `VRMatchView` props** — zero changes to `MatchView.tsx` beyond the import swap.

10. **All user-facing text in Brazilian Portuguese.** Refer to existing commentary/UI text in the codebase for tone and style.

---

## Dependencies Reference

### To add
```json
{
  "three": "^0.170.0",
  "@types/three": "^0.170.0",
  "@mediapipe/face_mesh": "^0.4.1633559619",
  "@mediapipe/camera_utils": "^0.3.1632415422"
}
```

### To remove
```json
{
  "aframe": "^1.7.1",
  "react-aframe": "^1.0.0",
  "@types/aframe": "^1.2.9"
}
```

---

## File Reference (existing files to read before building)

These files contain the source logic to be ported — the build agent must read them first:

| File | What to extract |
|---|---|
| `app/src/components/vr/VRMatchView.tsx` | Physics loop (lines 1118–1367), scene geometry, player/ball factories, camera setup |
| `app/src/components/vr/VRAdBoards.tsx` | Ad board positions and cycling logic |
| `app/src/components/vr/VRStadiumCrowd.tsx` | Crowd placement algorithm (port to InstancedMesh) |
| `app/src/hooks/useVRAnimationController.ts` | Keep as-is; just confirm the returned `homePositions`/`awayPositions` format |
| `app/src/lib/types.ts` | `MatchEvent`, `MatchScript`, `Formation` types |
| `app/src/components/game/MatchView.tsx` | Understand props passed to VR component and VR toggle logic |
| `app/tests/vr.spec.ts` | Existing test structure to update |

---

*End of VR Immersive Stadium Mode Build Plan*
