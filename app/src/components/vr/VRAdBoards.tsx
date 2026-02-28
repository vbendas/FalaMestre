// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

import { useEffect, useState } from 'react';

const ADVERTISEMENTS = [
  {
    id: 1,
    primary: 'SOCIOS.COM',
    color: '#FFD700'
  },
  {
    id: 2,
    primary: 'CRYPTOBET',
    color: '#00FF88'
  },
  {
    id: 3,
    primary: 'FALAMESTRE',
    color: '#FF6B35'
  },
  {
    id: 4,
    primary: 'METASTADIUM',
    color: '#9B59B6'
  },
  {
    id: 5,
    primary: 'NFT LEGENDS',
    color: '#3498DB'
  },
  {
    id: 6,
    primary: 'GLOBAL SPORTS',
    color: '#E74C3C'
  },
  {
    id: 7,
    primary: 'SPORTTECH PRO',
    color: '#1ABC9C'
  },
  {
    id: 8,
    primary: 'FB ACADEMY',
    color: '#F39C12'
  }
];

const BOARD_CONFIGS = [
  { position: '-45 0.5 -20', rotation: '0 90 0', width: 17.5 },
  { position: '-45 0.5 0', rotation: '0 90 0', width: 17.5 },
  { position: '-45 0.5 20', rotation: '0 90 0', width: 17.5 },
  { position: '45 0.5 -20', rotation: '0 -90 0', width: 17.5 },
  { position: '45 0.5 0', rotation: '0 -90 0', width: 17.5 },
  { position: '45 0.5 20', rotation: '0 -90 0', width: 17.5 },
  { position: '-25 0.5 28', rotation: '0 180 0', width: 25 },
  { position: '0 0.5 28', rotation: '0 180 0', width: 25 },
  { position: '25 0.5 28', rotation: '0 180 0', width: 25 },
  { position: '-25 0.5 -28', rotation: '0 0 0', width: 25 },
  { position: '0 0.5 -28', rotation: '0 0 0', width: 25 },
  { position: '25 0.5 -28', rotation: '0 0 0', width: 25 }
];

export function VRAdBoards() {
  const [isClient, setIsClient] = useState(false);
  
  // Random starting ads with index-based offset
  const [adIndices, setAdIndices] = useState(() => 
    BOARD_CONFIGS.map((_, i) => {
      const offset = (i * 0.15) % 1;
      return Math.floor(((Math.random() + offset) * 8) % 8);
    })
  );
  
  useEffect(() => {
    setIsClient(true);
    
    const interval = setInterval(() => {
      setAdIndices(prev => prev.map(idx => (idx + 1) % 8));
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  if (!isClient) {
    return null;
  }
  
  return (
    <a-entity id="advertisement-boards">
      {BOARD_CONFIGS.map((config, boardIdx) => {
        const adIndex = adIndices[boardIdx];
        const currentAd = ADVERTISEMENTS[adIndex];
        
        return (
          <a-entity 
            key={`board-${boardIdx}`}
            position={config.position}
            rotation={config.rotation}
          >
            {/* Main colored board with explicit opacity - 1m height */}
            <a-box
              width={config.width}
              height={1.0}
              depth={0.2}
              color={currentAd.color}
              material="shader: flat; opacity: 1; transparent: false; depthTest: true; depthWrite: true; side: double"
            />
            
            {/* Front text - smaller size */}
            <a-text
              value={currentAd.primary}
              position={`0 0.5 ${0.1 + 0.01}`}
              align="center"
              width={config.width * 1.5}
              color="#FFFFFF"
              shader="msdf"
              font="https://raw.githubusercontent.com/etiennepinchon/aframe-fonts/master/fonts/roboto/Roboto-Bold.json"
            />
            
            {/* Back text - smaller size */}
            <a-text
              value={currentAd.primary}
              position={`0 0.5 ${-0.1 - 0.01}`}
              align="center"
              width={config.width * 1.5}
              color="#FFFFFF"
              rotation="0 180 0"
              shader="msdf"
              font="https://raw.githubusercontent.com/etiennepinchon/aframe-fonts/master/fonts/roboto/Roboto-Bold.json"
            />
          </a-entity>
        );
      })}
    </a-entity>
  );
}

export { ADVERTISEMENTS };
