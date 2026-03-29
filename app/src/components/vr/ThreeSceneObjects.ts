import * as THREE from 'three';

const FIELD_LENGTH = 80;
const FIELD_WIDTH = 45;
const FIELD_HALF_X = FIELD_LENGTH / 2;
const FIELD_HALF_Z = FIELD_WIDTH / 2;

export function createField(): THREE.Group {
  const fieldGroup = new THREE.Group();

  const basePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_LENGTH + 4, FIELD_WIDTH + 4),
    new THREE.MeshBasicMaterial({ color: 0x2d5a27, side: THREE.DoubleSide })
  );
  basePlane.rotation.x = -Math.PI / 2;
  basePlane.position.y = 0;
  fieldGroup.add(basePlane);

  for (let i = 0; i < 16; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(5, FIELD_WIDTH - 2),
       new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x3d6a37 : 0x2d5a27, side: THREE.DoubleSide })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-FIELD_HALF_X + 2.5 + i * 5, 0.001, 0);
    fieldGroup.add(stripe);
  }

  const overlay = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_LENGTH - 1, FIELD_WIDTH - 1),
     new THREE.MeshBasicMaterial({
       color: 0x4a8c4a,
       transparent: true,
       opacity: 0.15,
       side: THREE.DoubleSide,
     })
  );
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.002;
  fieldGroup.add(overlay);

  return fieldGroup;
}

export function createFieldLines(): THREE.Group {
  const linesGroup = new THREE.Group();
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const centerCircle = new THREE.Mesh(
    new THREE.RingGeometry(9.1, 9.5, 64),
    lineMaterial
  );
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.y = 0.003;
  linesGroup.add(centerCircle);

  const centerSpot = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 16),
    lineMaterial
  );
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.y = 0.003;
  linesGroup.add(centerSpot);

  const halfwayLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.01, FIELD_WIDTH),
    lineMaterial
  );
  halfwayLine.position.set(0, 0.003, 0);
  linesGroup.add(halfwayLine);

  const touchlineWidth = new THREE.BoxGeometry(0.15, 0.01, FIELD_WIDTH + 4);
  const leftTouchline = new THREE.Mesh(touchlineWidth, lineMaterial);
  leftTouchline.position.set(-FIELD_HALF_X, 0.003, 0);
  linesGroup.add(leftTouchline);

  const rightTouchline = new THREE.Mesh(touchlineWidth, lineMaterial);
  rightTouchline.position.set(FIELD_HALF_X, 0.003, 0);
  linesGroup.add(rightTouchline);

  const touchlineDepth = new THREE.BoxGeometry(FIELD_LENGTH + 4, 0.01, 0.15);
  const topTouchline = new THREE.Mesh(touchlineDepth, lineMaterial);
  topTouchline.position.set(0, 0.003, -FIELD_HALF_Z);
  linesGroup.add(topTouchline);

  const bottomTouchline = new THREE.Mesh(touchlineDepth, lineMaterial);
  bottomTouchline.position.set(0, 0.003, FIELD_HALF_Z);
  linesGroup.add(bottomTouchline);

  const goalLineLength = 7.32;
  const goalLineWidth = 0.15;

  const leftGoalLine = new THREE.Mesh(
    new THREE.BoxGeometry(goalLineWidth, 0.01, goalLineLength),
    lineMaterial
  );
  leftGoalLine.position.set(-FIELD_HALF_X, 0.003, 0);
  linesGroup.add(leftGoalLine);

  const rightGoalLine = new THREE.Mesh(
    new THREE.BoxGeometry(goalLineWidth, 0.01, goalLineLength),
    lineMaterial
  );
  rightGoalLine.position.set(FIELD_HALF_X, 0.003, 0);
  linesGroup.add(rightGoalLine);

  return linesGroup;
}

export function createGoal(side: 'home' | 'away'): THREE.Group {
  const goalGroup = new THREE.Group();
  const x = side === 'home' ? -FIELD_HALF_X : FIELD_HALF_X;
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.6,
    roughness: 0.4,
  });

  const backPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 2.4, 7.32),
    postMaterial
  );
  backPost.position.set(x, 1.2, 0);
  goalGroup.add(backPost);

  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.1, 7.32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.4 })
  );
  crossbar.position.set(x, 2.45, 0);
  goalGroup.add(crossbar);

  const sidePostGeom = new THREE.BoxGeometry(0.15, 2.4, 0.15);
  const leftPost = new THREE.Mesh(sidePostGeom, postMaterial);
  leftPost.position.set(x, 1.2, 3.66);
  goalGroup.add(leftPost);

  const rightPost = new THREE.Mesh(sidePostGeom, postMaterial);
  rightPost.position.set(x, 1.2, -3.66);
  goalGroup.add(rightPost);

  const netMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(7.32, 2.44),
    netMaterial
  );
  net.position.set(x + (side === 'home' ? -0.5 : 0.5), 1.2, 0);
  net.rotation.y = side === 'home' ? Math.PI / 2 : -Math.PI / 2;
  goalGroup.add(net);

  return goalGroup;
}

export function createCornerFlags(): THREE.Group {
  const flagsGroup = new THREE.Group();
  const flagPositions = [
    { x: -FIELD_HALF_X, z: FIELD_HALF_Z },
    { x: -FIELD_HALF_X, z: -FIELD_HALF_Z },
    { x: FIELD_HALF_X, z: FIELD_HALF_Z },
    { x: FIELD_HALF_X, z: -FIELD_HALF_Z },
  ];

  flagPositions.forEach((pos) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    post.position.set(pos.x, 0.6, pos.z);
    flagsGroup.add(post);

    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff0000, side: THREE.DoubleSide })
    );
    flag.position.set(pos.x + 0.2, 1.1, pos.z);
    flagsGroup.add(flag);
  });

  return flagsGroup;
}

export function createSky(): THREE.Mesh {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x1a2a4a,
      side: THREE.BackSide,
    })
  );
  return sky;
}

export function createLights(): THREE.Object3D[] {
  const lights: THREE.Object3D[] = [];

  const ambient = new THREE.AmbientLight(0x8899aa, 0.5);
  lights.push(ambient);

  const floodlightPositions = [
    { x: -35, y: 20, z: -20 },
    { x: 35, y: 20, z: -20 },
    { x: -35, y: 20, z: 20 },
    { x: 35, y: 20, z: 20 },
  ];

  floodlightPositions.forEach((pos) => {
    const floodlight = new THREE.PointLight(0xffeecc, 0.8, 80);
    floodlight.position.set(pos.x, pos.y, pos.z);
    lights.push(floodlight);
  });

  const directional = new THREE.DirectionalLight(0xffffff, 0.3);
  directional.position.set(0, 50, 0);
  directional.castShadow = true;
  directional.shadow.mapSize.width = 512;
  directional.shadow.mapSize.height = 512;
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 150;
  directional.shadow.camera.left = -50;
  directional.shadow.camera.right = 50;
  directional.shadow.camera.top = 50;
  directional.shadow.camera.bottom = -50;
  lights.push(directional);

  return lights;
}

function createNumberTexture(number: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 64, 64);
  
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(number.toString(), 32, 32);
  
  return new THREE.CanvasTexture(canvas);
}

export function createPlayerMesh(
  color: string,
  number: number,
  playerId: string
): THREE.Group {
  const group = new THREE.Group();
  group.name = playerId;
  group.userData.isPlayer = true;

  const bodyGeom = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8);
   const bodyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = 0.6;
  group.add(body);

  const headGeom = new THREE.SphereGeometry(0.3, 8, 8);
   const headMat = new THREE.MeshBasicMaterial({ color: 0xe8b89d, side: THREE.DoubleSide });
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.y = 1.4;
  group.add(head);

  const shadowGeom = new THREE.CircleGeometry(0.6, 16);
   const shadowMat = new THREE.MeshBasicMaterial({
     color: 0x000000,
     transparent: true,
     opacity: 0.4,
     side: THREE.DoubleSide,
   });
  const shadow = new THREE.Mesh(shadowGeom, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  group.add(shadow);

  const numberTexture = createNumberTexture(number);
  const numberMat = new THREE.SpriteMaterial({ map: numberTexture });
  const numberSprite = new THREE.Sprite(numberMat);
  numberSprite.scale.set(0.8, 0.8, 1);
  numberSprite.position.set(0, 1.0, 0.51);
  numberSprite.userData.isNumberSprite = true;
  group.add(numberSprite);

  return group;
}

export function createBall(): THREE.Group {
  const ballGroup = new THREE.Group();
  ballGroup.name = 'ball';

  const mainSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.5,
    })
  );
  ballGroup.add(mainSphere);

  const patchPositions = [
    { x: 0.2, y: 0.15, z: 0.1 },
    { x: -0.15, y: 0.2, z: 0.15 },
    { x: -0.1, y: -0.15, z: 0.2 },
    { x: 0.15, y: -0.18, z: -0.1 },
    { x: -0.2, y: -0.1, z: -0.15 },
    { x: 0.1, y: 0.25, z: -0.15 },
    { x: 0, y: 0.28, z: 0 },
  ];

  const patchMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  patchPositions.forEach((pos) => {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), patchMat);
    patch.position.set(pos.x, pos.y, pos.z);
    ballGroup.add(patch);
  });

  const highlightGeom = new THREE.CircleGeometry(0.25, 16);
   const highlightMat = new THREE.MeshBasicMaterial({
     color: 0xffffff,
     transparent: true,
     opacity: 0.9,
     side: THREE.DoubleSide,
   });
  const highlight = new THREE.Mesh(highlightGeom, highlightMat);
  highlight.position.set(0, 0.36, 0);
  highlight.rotation.x = -Math.PI / 2;
  ballGroup.add(highlight);

  const shadowGeom = new THREE.CircleGeometry(0.5, 16);
   const shadowMat = new THREE.MeshBasicMaterial({
     color: 0x000000,
     transparent: true,
     opacity: 0.2,
     side: THREE.DoubleSide,
   });
  const ballShadow = new THREE.Mesh(shadowGeom, shadowMat);
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.position.y = 0.006;
  ballGroup.add(ballShadow);

  return ballGroup;
}

export interface CrowdConfig {
  homeColor: string;
  awayColor: string;
}

export function createCrowd(config: CrowdConfig): THREE.Group {
  const crowdGroup = new THREE.Group();
  crowdGroup.name = 'crowd';

  const standConfigs = [
    { x: 0, z: -28, rows: 8, cols: 30, rotation: 0, team: 'home' },
    { x: 0, z: 28, rows: 8, cols: 30, rotation: Math.PI, team: 'away' },
    { x: -48, z: 0, rows: 8, cols: 15, rotation: Math.PI / 2, team: 'home' },
    { x: 48, z: 0, rows: 8, cols: 15, rotation: -Math.PI / 2, team: 'away' },
  ];

  const bodyGeom = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 6);
  const headGeom = new THREE.SphereGeometry(0.25, 6, 6);

  standConfigs.forEach((stand, standIndex) => {
    const color = stand.team === 'home' ? config.homeColor : config.awayColor;
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide });
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0x8b6914, side: THREE.DoubleSide });

    for (let row = 0; row < stand.rows; row++) {
      for (let col = 0; col < stand.cols; col++) {
        const group = new THREE.Group();

        const body = new THREE.Mesh(bodyGeom, material);
        body.position.y = 0.5;
        group.add(body);

        const head = new THREE.Mesh(headGeom, headMaterial);
        head.position.y = 1.2;
        group.add(head);

        const offsetX = (col - stand.cols / 2) * 1.2;
        const offsetZ = (row - stand.rows / 2) * 1.2;

        group.position.set(
          stand.x + offsetX * Math.cos(stand.rotation) - offsetZ * Math.sin(stand.rotation),
          0,
          stand.z + offsetX * Math.sin(stand.rotation) + offsetZ * Math.cos(stand.rotation)
        );

        group.rotation.y = stand.rotation;
        crowdGroup.add(group);
      }
    }
  });

  return crowdGroup;
}

export interface AdBoardConfig {
  texts: string[];
}

export function createAdBoards(config: AdBoardConfig): THREE.Group {
  const boardsGroup = new THREE.Group();
  boardsGroup.name = 'adBoards';

  const FIELD_HX = 40;   // half-length (X axis)
  const FIELD_HZ = 22.5;  // half-width  (Z axis)
  const OFFSET = 1.0;     // distance outside field line
  const BOARD_H = 1.5;
  const BOARD_Y = BOARD_H / 2 + 0.05; // sit on the ground
  const GAP = 0.4;

  // Sideline boards (long sides, along X): 3 per side
  const sideW = (FIELD_HX * 2 - 2 * GAP) / 3; // ≈26.4
  const sideCenters = [-(sideW + GAP), 0, sideW + GAP];

  // Goal-line boards (short sides, along Z): 2 per side
  const goalW = (FIELD_HZ * 2 - GAP) / 2; // ≈22.3
  const goalCenters = [-(goalW + GAP) / 2, (goalW + GAP) / 2];

  const boardPositions: { x: number; z: number; rotation: number; w: number }[] = [
    // BOTTOM sideline (Z = -23.5), faces +Z
    ...sideCenters.map((cx) => ({ x: cx, z: -(FIELD_HZ + OFFSET), rotation: 0, w: sideW })),
    // TOP sideline (Z = +23.5), faces -Z
    ...sideCenters.map((cx) => ({ x: cx, z: FIELD_HZ + OFFSET, rotation: Math.PI, w: sideW })),
    // LEFT goal line (X = -41), faces +X
    ...goalCenters.map((cz) => ({ x: -(FIELD_HX + OFFSET), z: cz, rotation: Math.PI / 2, w: goalW })),
    // RIGHT goal line (X = +41), faces -X
    ...goalCenters.map((cz) => ({ x: FIELD_HX + OFFSET, z: cz, rotation: -Math.PI / 2, w: goalW })),
  ];

  const materials: THREE.MeshBasicMaterial[] = [];
  const textures: THREE.CanvasTexture[] = [];

  boardPositions.forEach((pos, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 512, 96);

    // Colored accent bar
    const colors = ['#FF6B35', '#1A6BCC', '#007B5E', '#E4002B', '#1D1D1D',
                     '#F56B00', '#CC0000', '#00A651', '#5C0632', '#FFD700'];
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(4, 4, 504, 88);

    const text = config.texts[index % config.texts.length];
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 48);

    const texture = new THREE.CanvasTexture(canvas);
    textures.push(texture);

    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    materials.push(material);

    const boardGeom = new THREE.BoxGeometry(pos.w, BOARD_H, 0.15);
    const board = new THREE.Mesh(boardGeom, material);
    board.position.set(pos.x, BOARD_Y, pos.z);
    board.rotation.y = pos.rotation;
    boardsGroup.add(board);
  });

  (boardsGroup as THREE.Group & { adMaterials: typeof materials; adTextures: typeof textures }).adMaterials = materials;
  (boardsGroup as THREE.Group & { adMaterials: typeof materials; adTextures: typeof textures }).adTextures = textures;

  return boardsGroup;
}

export function updateAdBoardText(
  boardsGroup: THREE.Group,
  texts: string[],
  index: number
): void {
  const board = boardsGroup.children[index] as THREE.Mesh;
  const mesh = board as THREE.Mesh & { material: THREE.MeshBasicMaterial & { map: THREE.CanvasTexture } };
  
  if (mesh.material && mesh.material.map) {
    const canvas = mesh.material.map.image;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texts[index % texts.length], canvas.width / 2, canvas.height / 2);

    mesh.material.map.needsUpdate = true;
  }
}

export const FIELD_HALF_X_CONST = 40;
export const FIELD_HALF_Z_CONST = 22.5;
