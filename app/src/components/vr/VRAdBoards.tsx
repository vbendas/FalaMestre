// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

import { useEffect, useState } from 'react';

// 10 unique ads — one per board, no repeats
const ADVERTISEMENTS = [
  { id: 1, primary: 'FALAMESTRE!', tagline: 'A Revolução do Futebol', color: '#FF6B35' },
  { id: 2, primary: 'SOCIOS.COM', tagline: 'Torcida Global', color: '#1A6BCC' },
  { id: 3, primary: 'BET365', tagline: 'Aposte Agora', color: '#007B5E' },
  { id: 4, primary: 'PUMA', tagline: 'Forever Faster', color: '#E4002B' },
  { id: 5, primary: 'ADIDAS', tagline: 'Impossible Is Nothing', color: '#1D1D1D' },
  { id: 6, primary: 'NIKE', tagline: 'Just Do It', color: '#F56B00' },
  { id: 7, primary: 'MASTERCARD', tagline: 'Priceless', color: '#CC0000' },
  { id: 8, primary: 'HEINEKEN', tagline: 'Open Your World', color: '#00A651' },
  { id: 9, primary: 'QATAR AIRWAYS', tagline: 'Going Places Together', color: '#5C0632' },
  { id: 10, primary: 'LAY\'S', tagline: 'Sabor da Vitória', color: '#FFD700' },
];

const FIELD_LENGTH = 80;
const FIELD_WIDTH = 45;
const FIELD_HALF_X = FIELD_LENGTH / 2; // 40
const FIELD_HALF_Z = FIELD_WIDTH / 2;  // 22.5
const BOARD_OFFSET = 0.8; // just outside the field lines
const BOARD_HEIGHT = 1.5;
const BOARD_GAP = 0.4; // small gap between adjacent boards

// --- Sideline boards (long sides, along X axis) ---
// 3 boards per side, total coverage = field length (80)
// Each board width = (80 - 2 * gap) / 3 ≈ 26.4
const SIDE_BOARD_W = (FIELD_LENGTH - 2 * BOARD_GAP) / 3;
// Centers: -26.8, 0, +26.8
const SIDE_CENTERS = [
  -(SIDE_BOARD_W + BOARD_GAP),
  0,
  (SIDE_BOARD_W + BOARD_GAP),
];

// --- Goal-line boards (short sides, along Z axis) ---
// 2 boards per side, total coverage = field width (45)
// Each board width = (45 - 1 * gap) / 2 ≈ 22.3
const GOAL_BOARD_W = (FIELD_WIDTH - BOARD_GAP) / 2;
// Centers: -11.35, +11.35
const GOAL_CENTERS = [
  -(GOAL_BOARD_W + BOARD_GAP) / 2,
  (GOAL_BOARD_W + BOARD_GAP) / 2,
];

const BOARD_CONFIGS = [
  // BOTTOM SIDELINE — 3 boards at Z = -(22.5 + offset), facing inward (+Z)
  ...SIDE_CENTERS.map((cx, i) => ({
    position: `${cx} ${BOARD_HEIGHT / 2} ${-(FIELD_HALF_Z + BOARD_OFFSET)}`,
    rotation: '0 0 0',
    width: SIDE_BOARD_W,
    label: `bottom-${i}`,
    adIdx: i,
  })),

  // TOP SIDELINE — 3 boards at Z = +(22.5 + offset), facing inward (-Z)
  ...SIDE_CENTERS.map((cx, i) => ({
    position: `${cx} ${BOARD_HEIGHT / 2} ${FIELD_HALF_Z + BOARD_OFFSET}`,
    rotation: '0 180 0',
    width: SIDE_BOARD_W,
    label: `top-${i}`,
    adIdx: 3 + i,
  })),

  // LEFT GOAL LINE — 2 boards at X = -(40 + offset), facing inward (+X)
  ...GOAL_CENTERS.map((cz, i) => ({
    position: `${-(FIELD_HALF_X + BOARD_OFFSET)} ${BOARD_HEIGHT / 2} ${cz}`,
    rotation: '0 90 0',
    width: GOAL_BOARD_W,
    label: `left-${i}`,
    adIdx: 6 + i,
  })),

  // RIGHT GOAL LINE — 2 boards at X = +(40 + offset), facing inward (-X)
  ...GOAL_CENTERS.map((cz, i) => ({
    position: `${FIELD_HALF_X + BOARD_OFFSET} ${BOARD_HEIGHT / 2} ${cz}`,
    rotation: '0 -90 0',
    width: GOAL_BOARD_W,
    label: `right-${i}`,
    adIdx: 8 + i,
  })),
];

export function VRAdBoards() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <a-entity id="advertisement-boards">
      {BOARD_CONFIGS.map((config, boardIdx) => {
        const currentAd = ADVERTISEMENTS[config.adIdx % ADVERTISEMENTS.length];

        return (
          <a-entity
            key={`board-${boardIdx}`}
            data-ad-board={true}
            data-board-label={config.label}
            position={config.position}
            rotation={config.rotation}
          >
            {/* Board frame */}
            <a-box
              width={config.width}
              height={BOARD_HEIGHT}
              depth={0.15}
              color="#1a1a2e"
              material="shader: flat; opacity: 1; transparent: false; depthTest: true; depthWrite: true"
            />

            {/* ---- FRONT face (faces field) ---- */}
            <a-box
              position="0 0 0.08"
              width={config.width - 0.2}
              height={BOARD_HEIGHT - 0.1}
              depth={0.02}
              color={currentAd.color}
              material="shader: flat; opacity: 0.9"
            />
            <a-text
              value={currentAd.primary}
              position="0 0.15 0.1"
              align="center"
              width={config.width * 1.2}
              color="#FFFFFF"
              shader="msdf"
              font="https://raw.githubusercontent.com/etiennepinchon/aframe-fonts/master/fonts/roboto/Roboto-Bold.json"
            />
            <a-text
              value={currentAd.tagline}
              position="0 -0.25 0.1"
              align="center"
              width={config.width * 0.8}
              color="#CCCCCC"
              shader="msdf"
              font="https://raw.githubusercontent.com/etiennepinchon/aframe-fonts/master/fonts/roboto/Roboto-Regular.json"
            />

            {/* ---- BACK face (faces stands / outside) ---- */}
            <a-box
              position="0 0 -0.08"
              width={config.width - 0.2}
              height={BOARD_HEIGHT - 0.1}
              depth={0.02}
              color={currentAd.color}
              material="shader: flat; opacity: 0.9"
            />
            <a-text
              value={currentAd.primary}
              position="0 0.15 -0.1"
              rotation="0 180 0"
              align="center"
              width={config.width * 1.2}
              color="#FFFFFF"
              shader="msdf"
              font="https://raw.githubusercontent.com/etiennepinchon/aframe-fonts/master/fonts/roboto/Roboto-Bold.json"
            />
            <a-text
              value={currentAd.tagline}
              position="0 -0.25 -0.1"
              rotation="0 180 0"
              align="center"
              width={config.width * 0.8}
              color="#CCCCCC"
              shader="msdf"
              font="https://raw.githubusercontent.com/etiennepinchon/aframe-fonts/master/fonts/roboto/Roboto-Regular.json"
            />

            {/* Side pillars */}
            <a-box
              position={`${-config.width / 2 + 0.1} 0 0`}
              width={0.1}
              height={BOARD_HEIGHT}
              depth={0.15}
              color="#333355"
              material="shader: flat"
            />
            <a-box
              position={`${config.width / 2 - 0.1} 0 0`}
              width={0.1}
              height={BOARD_HEIGHT}
              depth={0.15}
              color="#333355"
              material="shader: flat"
            />
          </a-entity>
        );
      })}
    </a-entity>
  );
}

export { ADVERTISEMENTS };
