// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

import React, { useEffect, useRef } from 'react';

interface VRPlayerIndicatorProps {
  position: { x: number; z: number };
  playerName: string;
  jerseyNumber: number;
  teamColor: string;
  isActive: boolean;
  entityRef?: React.RefObject<any>;
}

export function VRPlayerIndicator({
  position,
  playerName,
  jerseyNumber,
  teamColor,
  isActive,
  entityRef
}: VRPlayerIndicatorProps) {
  const internalRef = useRef<any>(null);
  const ref = entityRef || internalRef;
  
  // Update position directly via ref without React re-renders
  useEffect(() => {
    if (ref?.current) {
      ref.current.setAttribute('position', `${position.x} 0 ${position.z}`);
    }
  }, [position, ref]);
  
  if (!isActive) return null;
  
  const ringColor = '#FEDD00';
  
  return (
    <a-entity 
      ref={ref}
      data-indicator-entity={true}
      position={`${position.x} 0 ${position.z}`}
    >
      {/* Glowing Ring at Base */}
      <a-torus
        radius="0.8"
        radius-tubular="0.05"
        color={ringColor}
        material={`emissive: ${ringColor}; emissiveIntensity: 2; shader: flat; transparent: true; opacity: 0.9`}
        rotation="-90 0 0"
        position="0 0.1 0"
        animation="property: rotation; to: -90 360 0; dur: 8000; loop: true; easing: linear"
        animation__pulse="property: components.material.material.emissiveIntensity; from: 1.5; to: 3; dur: 500; dir: alternate; loop: true"
        animation__fadein="property: opacity; from: 0; to: 0.9; dur: 200; easing: easeInQuad"
      />
      
      {/* Secondary Ring (larger, dimmer) */}
      <a-torus
        radius="1.0"
        radius-tubular="0.03"
        color={ringColor}
        material={`emissive: ${ringColor}; emissiveIntensity: 1; shader: flat; transparent: true; opacity: 0.5`}
        rotation="-90 0 0"
        position="0 0.05 0"
        animation="property: rotation; to: -90 -360 0; dur: 12000; loop: true; easing: linear"
        animation__fadein="property: opacity; from: 0; to: 0.5; dur: 200; easing: easeInQuad"
      />
      
      {/* Floating Name Tag */}
      <a-entity position="0 2.5 0" billboard="enabled: true">
        {/* Background Panel */}
        <a-plane
          width="2.8"
          height="0.7"
          color="#000000"
          material="shader: flat; transparent: true; opacity: 0.8"
          animation__fadein="property: opacity; from: 0; to: 0.8; dur: 200; easing: easeInQuad"
        />
        
        {/* Team Color Accent Bar */}
        <a-plane
          width="2.8"
          height="0.1"
          color={teamColor}
          position="0 -0.3 0.01"
          material="shader: flat; transparent: true; opacity: 1"
          animation__fadein="property: opacity; from: 0; to: 1; dur: 200; easing: easeInQuad"
        />
        
        {/* Player Name */}
        <a-text
          value={playerName}
          align="center"
          width="6"
          color="#FFFFFF"
          position="0 0.1 0.02"
          shader="msdf"
          font="https://raw.githubusercontent.com/etiennepinchon/aframe-fonts/master/fonts/roboto/Roboto-Bold.json"
          animation__fadein="property: opacity; from: 0; to: 1; dur: 200; easing: easeInQuad"
        />
        
        {/* Jersey Number */}
        <a-text
          value={`#${jerseyNumber}`}
          align="center"
          width="4"
          color={ringColor}
          position="0 -0.15 0.02"
          shader="msdf"
          font="https://raw.githubusercontent.com/etiennepinchon/aframe-fonts/master/fonts/roboto/Roboto-Bold.json"
          animation__fadein="property: opacity; from: 0; to: 1; dur: 200; easing: easeInQuad"
        />
      </a-entity>
    </a-entity>
  );
}
