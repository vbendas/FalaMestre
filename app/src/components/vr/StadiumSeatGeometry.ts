import * as THREE from 'three';

export function createStadiumSeatGeometry(): THREE.Group {
  const seatGroup = new THREE.Group();
  seatGroup.name = 'stadiumSeatGeometry';

  const railingMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.6,
    roughness: 0.4,
  });

  const railing = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.15, 0.15),
    railingMat
  );
  railing.position.set(0, 11, 32);
  seatGroup.add(railing);

  const armrestGeom = new THREE.BoxGeometry(0.15, 0.3, 0.4);
  const leftArmrest = new THREE.Mesh(armrestGeom, railingMat);
  leftArmrest.position.set(-0.4, 10.8, 32.2);
  seatGroup.add(leftArmrest);

  const rightArmrest = new THREE.Mesh(armrestGeom, railingMat);
  rightArmrest.position.set(0.4, 10.8, 32.2);
  seatGroup.add(rightArmrest);

  const seatBackMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a5c,
    metalness: 0.2,
    roughness: 0.8,
  });

  const seatBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.6, 0.1),
    seatBackMat
  );
  seatBack.position.set(0, 10.5, 32.5);
  seatGroup.add(seatBack);

  const seatBaseMat = new THREE.MeshStandardMaterial({
    color: 0x2a4a6c,
    metalness: 0.2,
    roughness: 0.8,
  });

  const seatBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.2, 0.6),
    seatBaseMat
  );
  seatBase.position.set(0, 10.2, 32.3);
  seatGroup.add(seatBase);

  const cupHolderGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8);
  const cupHolderMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.5,
    roughness: 0.5,
  });

  const leftCupHolder = new THREE.Mesh(cupHolderGeom, cupHolderMat);
  leftCupHolder.position.set(-0.25, 10.35, 32.1);
  seatGroup.add(leftCupHolder);

  const rightCupHolder = new THREE.Mesh(cupHolderGeom, cupHolderMat);
  rightCupHolder.position.set(0.25, 10.35, 32.1);
  seatGroup.add(rightCupHolder);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.1,
    roughness: 0.9,
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 2),
    floorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 10.1, 32.5);
  seatGroup.add(floor);

  return seatGroup;
}
