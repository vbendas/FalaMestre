// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

import { useEffect, useRef } from 'react';

interface VRMatchFieldProps {
  homeColor: string;
  awayColor: string;
}

const FIELD_LENGTH = 105;
const FIELD_WIDTH = 68;
const PENALTY_BOX_LENGTH = 16.5;
const PENALTY_BOX_WIDTH = 40.32;
const GOAL_WIDTH = 7.32;
const CENTER_CIRCLE_RADIUS = 9.15;

export function VRMatchField({ homeColor, awayColor }: VRMatchFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = document.querySelector('a-scene');
    if (!scene) return;
  }, []);

  return (
    <a-entity id="soccer-field" position="0 0 0">
      <a-plane
        id="field-surface"
        position={`0 0.01 0`}
        width={FIELD_LENGTH}
        height={FIELD_WIDTH}
        rotation="-90 0 0"
        color="#2d8a2d"
        material="roughness: 1; metalness: 0"
      />
      
      <a-plane
        id="field-lines"
        position={`0 0.02 0`}
        width={FIELD_LENGTH}
        height={FIELD_WIDTH}
        rotation="-90 0 0"
        color="#ffffff"
        opacity={0.9}
        material="transparent: true; opacity: 0.9"
      />

      <a-entity id="field-markings">
        <a-plane
          position={`0 0.03 0`}
          width={FIELD_LENGTH - 2}
          height={FIELD_WIDTH - 2}
          rotation="-90 0 0"
          color="#2d8a2d"
          material="roughness: 1"
        />

        <a-box
          position={`0 0.02 ${FIELD_WIDTH / 2}`}
          width={FIELD_LENGTH}
          height={0.05}
          depth={2}
          color="#ffffff"
        />

        <a-box
          position={`0 0.02 -${FIELD_WIDTH / 2}`}
          width={FIELD_LENGTH}
          height={0.05}
          depth={2}
          color="#ffffff"
        />

        <a-box
          position={`${FIELD_LENGTH / 2} 0.02 0`}
          width={2}
          height={0.05}
          depth={FIELD_WIDTH}
          color="#ffffff"
        />

        <a-box
          position={`-${FIELD_LENGTH / 2} 0.02 0`}
          width={2}
          height={0.05}
          depth={FIELD_WIDTH}
          color="#ffffff"
        />

        <a-cylinder
          position="0 0.03 0"
          rotation="-90 0 0"
          radius={CENTER_CIRCLE_RADIUS}
          height={0.05}
          color="#ffffff"
          material="transparent: true; opacity: 0.8"
        />

        <a-circle
          position="0 0.03 0"
          rotation="-90 0 0"
          radius={1}
          color="#ffffff"
        />

        <a-box
          position={`${FIELD_LENGTH / 2 - PENALTY_BOX_LENGTH} 0.03 ${PENALTY_BOX_WIDTH / 2}`}
          width={0.3}
          height={0.05}
          depth={PENALTY_BOX_WIDTH}
          color="#ffffff"
        />
        <a-box
          position={`${FIELD_LENGTH / 2 - PENALTY_BOX_LENGTH} 0.03 -${PENALTY_BOX_WIDTH / 2}`}
          width={0.3}
          height={0.05}
          depth={PENALTY_BOX_WIDTH}
          color="#ffffff"
        />
        <a-box
          position={`${FIELD_LENGTH / 2 - PENALTY_BOX_LENGTH / 2} 0.03 ${PENALTY_BOX_WIDTH / 2}`}
          width={PENALTY_BOX_LENGTH}
          height={0.05}
          depth={0.3}
          color="#ffffff"
        />

        <a-box
          position={`-${FIELD_LENGTH / 2 + PENALTY_BOX_LENGTH} 0.03 ${PENALTY_BOX_WIDTH / 2}`}
          width={0.3}
          height={0.05}
          depth={PENALTY_BOX_WIDTH}
          color="#ffffff"
        />
        <a-box
          position={`-${FIELD_LENGTH / 2 + PENALTY_BOX_LENGTH} 0.03 -${PENALTY_BOX_WIDTH / 2}`}
          width={0.3}
          height={0.05}
          depth={PENALTY_BOX_WIDTH}
          color="#ffffff"
        />
        <a-box
          position={`-${FIELD_LENGTH / 2 + PENALTY_BOX_LENGTH / 2} 0.03 ${PENALTY_BOX_WIDTH / 2}`}
          width={PENALTY_BOX_LENGTH}
          height={0.05}
          depth={0.3}
          color="#ffffff"
        />

        <a-circle
          position={`${FIELD_LENGTH / 2 - 11} 0.03 0`}
          rotation="-90 0 0"
          radius={9.15}
          color="#ffffff"
          material="transparent: true; opacity: 0.8"
        />
        <a-circle
          position={`${FIELD_LENGTH / 2 - 11} 0.03 0`}
          rotation="-90 0 0"
          radius={1}
          color="#ffffff"
        />

        <a-circle
          position={`-${FIELD_LENGTH / 2 + 11} 0.03 0`}
          rotation="-90 0 0"
          radius={9.15}
          color="#ffffff"
          material="transparent: true; opacity: 0.8"
        />
        <a-circle
          position={`-${FIELD_LENGTH / 2 + 11} 0.03 0`}
          rotation="-90 0 0"
          radius={1}
          color="#ffffff"
        />
      </a-entity>

      <a-entity id="goals">
        <a-box
          position={`${FIELD_LENGTH / 2 + 1} 1.2 0`}
          width={2}
          height={2.44}
          depth={GOAL_WIDTH + 0.5}
          color="#888888"
          material="metalness: 0.8; roughness: 0.3"
        />
        <a-box
          position={`${FIELD_LENGTH / 2 + 1} 1.2 0`}
          width={0.2}
          height={2.44}
          depth={0.2}
          color="#ffffff"
        />
        <a-box
          position={`${FIELD_LENGTH / 2 + 1} 0.1 ${GOAL_WIDTH / 2}`}
          width={0.2}
          height={0.2}
          depth={GOAL_WIDTH + 0.5}
          color="#ffffff"
        />
        <a-box
          position={`${FIELD_LENGTH / 2 + 1} 0.1 -${GOAL_WIDTH / 2}`}
          width={0.2}
          height={0.2}
          depth={GOAL_WIDTH + 0.5}
          color="#ffffff"
        />

        <a-box
          position={`-${FIELD_LENGTH / 2 - 1} 1.2 0`}
          width={2}
          height={2.44}
          depth={GOAL_WIDTH + 0.5}
          color="#888888"
          material="metalness: 0.8; roughness: 0.3"
        />
        <a-box
          position={`-${FIELD_LENGTH / 2 - 1} 1.2 0`}
          width={0.2}
          height={2.44}
          depth={0.2}
          color="#ffffff"
        />
        <a-box
          position={`-${FIELD_LENGTH / 2 - 1} 0.1 ${GOAL_WIDTH / 2}`}
          width={0.2}
          height={0.2}
          depth={GOAL_WIDTH + 0.5}
          color="#ffffff"
        />
        <a-box
          position={`-${FIELD_LENGTH / 2 - 1} 0.1 -${GOAL_WIDTH / 2}`}
          width={0.2}
          height={0.2}
          depth={GOAL_WIDTH + 0.5}
          color="#ffffff"
        />
      </a-entity>

      <a-entity id="team-benches" position={`0 0 -${FIELD_WIDTH / 2 + 5}`}>
        <a-box
          position={`${FIELD_LENGTH / 4} 0.3 0`}
          width={10}
          height={0.5}
          depth={2}
          color={homeColor}
          material="opacity: 0.8"
        />
        <a-box
          position={`-${FIELD_LENGTH / 4} 0.3 0`}
          width={10}
          height={0.5}
          depth={2}
          color={awayColor}
          material="opacity: 0.8"
        />
      </a-entity>
    </a-entity>
  );
}
