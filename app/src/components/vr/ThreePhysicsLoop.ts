import * as THREE from 'three';

export const PHYSICS = {
  GRAVITY: -9.8,
  BALL_MASS: 0.45,
  BALL_AIR_RESISTANCE: 0.05,
  BALL_GROUND_FRICTION: 0.8,
  BALL_BOUNCE_DAMPING: 0.6,
  PLAYER_MAX_SPEED: 7.0,
  PLAYER_ACCELERATION: 15.0,
  PLAYER_DECELERATION: 20.0,
  PLAYER_TURN_SPEED: Math.PI * 2,
  BALL_SHOT_SPEED: 25.0,
  BALL_PASS_SPEED: 15.0,
  GROUND_HEIGHT: 0.35,
  FIELD_BOUNDS_X: 40,
  FIELD_BOUNDS_Z: 22.5,
} as const;

export interface BallPhysicsState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  targetPosition: THREE.Vector3;
  height: number;
  verticalVelocity: number;
  rotation: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  isInAir: boolean;
  targetHeight: number;
}

export interface PlayerPhysicsState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  targetPosition: THREE.Vector3;
  facing: number;
  targetFacing: number;
  movementState: 'idle' | 'walking' | 'running' | 'celebrating';
}

export interface PhysicsState {
  ballVelocity: THREE.Vector3;
  ballAngularVelocity: THREE.Vector3;
  playerVelocities: Map<string, THREE.Vector3>;
  lastKickedEventId: string | null;
}

export function createBallPhysicsState(): BallPhysicsState {
  return {
    position: new THREE.Vector3(0, PHYSICS.GROUND_HEIGHT, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    acceleration: new THREE.Vector3(0, 0, 0),
    targetPosition: new THREE.Vector3(0, PHYSICS.GROUND_HEIGHT, 0),
    height: PHYSICS.GROUND_HEIGHT,
    verticalVelocity: 0,
    rotation: new THREE.Vector3(0, 0, 0),
    angularVelocity: new THREE.Vector3(0, 0, 0),
    isInAir: false,
    targetHeight: PHYSICS.GROUND_HEIGHT,
  };
}

export function createPlayerPhysicsState(
  initialX: number,
  initialZ: number,
  initialFacing: number
): PlayerPhysicsState {
  return {
    position: new THREE.Vector3(initialX, 0, initialZ),
    velocity: new THREE.Vector3(0, 0, 0),
    acceleration: new THREE.Vector3(0, 0, 0),
    targetPosition: new THREE.Vector3(initialX, 0, initialZ),
    facing: initialFacing,
    targetFacing: initialFacing,
    movementState: 'idle',
  };
}

export function createPhysicsState(): PhysicsState {
  return {
    ballVelocity: new THREE.Vector3(0, 0, 0),
    ballAngularVelocity: new THREE.Vector3(0, 0, 0),
    playerVelocities: new Map(),
    lastKickedEventId: null,
  };
}

export function updateBallPhysics(
  state: BallPhysicsState,
  delta: number,
  kickSpeed: number = 0
): BallPhysicsState {
  const dt = Math.min(delta, 0.05);

  const dx = state.targetPosition.x - state.position.x;
  const dz = state.targetPosition.z - state.position.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  let newKickSpeed = kickSpeed;

  if (kickSpeed > 0 && distance > 0.1) {
    const direction = new THREE.Vector3(dx / distance, 0, dz / distance);
    state.velocity.x = direction.x * kickSpeed;
    state.velocity.z = direction.z * kickSpeed;

    const launchAngle = 35 * (Math.PI / 180);
    state.verticalVelocity = kickSpeed * Math.sin(launchAngle);
    state.isInAir = true;

    const spinSpeed = kickSpeed * 0.5;
    state.angularVelocity.set(direction.z * spinSpeed, 0, -direction.x * spinSpeed);
  }

  // Seek toward target when no kick is active and ball is far away
  if (kickSpeed === 0 && distance > 1.0) {
    const seekSpeed = Math.min(distance * 1.5, 8.0);
    state.velocity.x = (dx / distance) * seekSpeed;
    state.velocity.z = (dz / distance) * seekSpeed;
    state.angularVelocity.set((dz / distance) * seekSpeed * 0.3, 0, -(dx / distance) * seekSpeed * 0.3);
  }

  if (state.isInAir || state.height > PHYSICS.GROUND_HEIGHT) {
    state.verticalVelocity += PHYSICS.GRAVITY * dt;
    state.height += state.verticalVelocity * dt;

    if (state.height <= PHYSICS.GROUND_HEIGHT) {
      state.height = PHYSICS.GROUND_HEIGHT;
      state.verticalVelocity = -state.verticalVelocity * PHYSICS.BALL_BOUNCE_DAMPING;

      if (Math.abs(state.verticalVelocity) < 0.5) {
        state.verticalVelocity = 0;
        state.isInAir = false;
      }
    }
  } else {
    state.height = PHYSICS.GROUND_HEIGHT;
  }

  state.position.x += state.velocity.x * dt;
  state.position.z += state.velocity.z * dt;
  state.position.y = state.height;

  state.position.x = THREE.MathUtils.clamp(
    state.position.x,
    -PHYSICS.FIELD_BOUNDS_X,
    PHYSICS.FIELD_BOUNDS_X
  );
  state.position.z = THREE.MathUtils.clamp(
    state.position.z,
    -PHYSICS.FIELD_BOUNDS_Z,
    PHYSICS.FIELD_BOUNDS_Z
  );

  const airResistance = 1 - PHYSICS.BALL_AIR_RESISTANCE * dt;
  state.velocity.x *= airResistance;
  state.velocity.z *= airResistance;

  if (!state.isInAir && state.height <= PHYSICS.GROUND_HEIGHT) {
    const friction = 1 - PHYSICS.BALL_GROUND_FRICTION * dt;
    state.velocity.x *= friction;
    state.velocity.z *= friction;
    state.angularVelocity.x *= friction;
    state.angularVelocity.z *= friction;
  }

  state.rotation.x = (state.rotation.x + (state.angularVelocity.x * dt * 180) / Math.PI) % 36000;
  state.rotation.y = (state.rotation.y + (state.angularVelocity.y * dt * 180) / Math.PI) % 36000;
  state.rotation.z = (state.rotation.z + (state.angularVelocity.z * dt * 180) / Math.PI) % 36000;

  if (distance < 2.0 && kickSpeed === 0) {
    const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.z ** 2);
    if (speed > 0.1) {
      const deceleration = PHYSICS.BALL_GROUND_FRICTION * 2;
      const newSpeed = Math.max(0, speed - deceleration * dt);
      const ratio = newSpeed / speed;
      state.velocity.x *= ratio;
      state.velocity.z *= ratio;
    } else if (distance < 0.5) {
      state.position.x = state.targetPosition.x;
      state.position.z = state.targetPosition.z;
      state.velocity.x = 0;
      state.velocity.z = 0;
    }
  }

  return state;
}

export function updatePlayerPhysics(
  mesh: THREE.Object3D,
  targetX: number,
  targetZ: number,
  role: string,
  state: PlayerPhysicsState,
  delta: number
): PlayerPhysicsState {
  const dt = Math.min(delta, 0.05);

  const dx = targetX - state.position.x;
  const dz = targetZ - state.position.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance < 0.3) {
    state.movementState = 'idle';
  } else if (distance < 3.0) {
    state.movementState = 'walking';
  } else {
    state.movementState = 'running';
  }

  if (distance > 0.5) {
    state.targetFacing = (Math.atan2(dx, dz) * 180) / Math.PI;
  }

  let facingDiff = state.targetFacing - state.facing;
  while (facingDiff > 180) facingDiff -= 360;
  while (facingDiff < -180) facingDiff += 360;

  const turnAmount = Math.min(Math.abs(facingDiff), (PHYSICS.PLAYER_TURN_SPEED * dt * 180) / Math.PI);
  state.facing += Math.sign(facingDiff) * turnAmount;

  let maxSpeed: number = PHYSICS.PLAYER_MAX_SPEED;
  let acceleration: number = PHYSICS.PLAYER_ACCELERATION;

  if (role === 'GK') {
    maxSpeed *= 0.6;
  } else if (role === 'DEF') {
    maxSpeed *= 0.8;
  } else if (role === 'FWD') {
    maxSpeed *= 1.1;
  }

  if (state.movementState === 'walking') {
    maxSpeed *= 0.5;
  } else if (state.movementState === 'idle') {
    maxSpeed = 0;
  }

  if (distance > 0.1) {
    const dirX = dx / distance;
    const dirZ = dz / distance;
    const targetSpeed = Math.min(distance * 2, maxSpeed);

    const desiredVelX = dirX * targetSpeed;
    const desiredVelZ = dirZ * targetSpeed;

    state.acceleration.x = (desiredVelX - state.velocity.x) * acceleration;
    state.acceleration.z = (desiredVelZ - state.velocity.z) * acceleration;
  } else {
    state.acceleration.x = -state.velocity.x * PHYSICS.PLAYER_DECELERATION;
    state.acceleration.z = -state.velocity.z * PHYSICS.PLAYER_DECELERATION;
  }

  state.velocity.x += state.acceleration.x * dt;
  state.velocity.z += state.acceleration.z * dt;

  const currentSpeed = Math.sqrt(state.velocity.x ** 2 + state.velocity.z ** 2);
  if (currentSpeed > maxSpeed) {
    const ratio = maxSpeed / currentSpeed;
    state.velocity.x *= ratio;
    state.velocity.z *= ratio;
  }

  state.position.x += state.velocity.x * dt;
  state.position.z += state.velocity.z * dt;

  state.position.x = THREE.MathUtils.clamp(
    state.position.x,
    -PHYSICS.FIELD_BOUNDS_X,
    PHYSICS.FIELD_BOUNDS_X
  );
  state.position.z = THREE.MathUtils.clamp(
    state.position.z,
    -PHYSICS.FIELD_BOUNDS_Z,
    PHYSICS.FIELD_BOUNDS_Z
  );

  mesh.position.set(state.position.x, 0, state.position.z);
  mesh.rotation.y = (state.facing * Math.PI) / 180;

  return state;
}

export function triggerKick(
  state: BallPhysicsState,
  targetX: number,
  targetZ: number,
  kickType: 'shot' | 'pass' | 'clearance'
): void {
  state.targetPosition.set(targetX, PHYSICS.GROUND_HEIGHT, targetZ);

  let kickSpeed: number = PHYSICS.BALL_PASS_SPEED;
  if (kickType === 'shot') {
    kickSpeed = PHYSICS.BALL_SHOT_SPEED;
  } else if (kickType === 'clearance') {
    kickSpeed = PHYSICS.BALL_SHOT_SPEED * 0.9;
  }

  const dx = targetX - state.position.x;
  const dz = targetZ - state.position.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  if (distance > 0.1) {
    const direction = new THREE.Vector3(dx / distance, 0, dz / distance);
    state.velocity.copy(direction.clone().multiplyScalar(kickSpeed));

    const launchAngle = 35 * (Math.PI / 180);
    state.verticalVelocity = kickSpeed * Math.sin(launchAngle);
    state.isInAir = true;

    const spinSpeed = kickSpeed * 0.5;
    state.angularVelocity.set(direction.z * spinSpeed, 0, -direction.x * spinSpeed);
  }
}
