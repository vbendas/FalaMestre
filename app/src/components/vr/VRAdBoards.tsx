// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

// Static test - 12 stretched boxes touching edge-to-edge
export function VRAdBoards() {
  return (
    <a-entity>
      {/* Left side - x=-45, width=17.5m, height=1.5m, facing inward (+90° Y) */}
      <a-box position="-45 0.75 -20" rotation="0 90 0" width={17.5} height={1.5} depth={0.3} color="#FF0000" />
      <a-box position="-45 0.75 0" rotation="0 90 0" width={17.5} height={1.5} depth={0.3} color="#00FF00" />
      <a-box position="-45 0.75 20" rotation="0 90 0" width={17.5} height={1.5} depth={0.3} color="#0000FF" />
      
      {/* Right side - x=45, width=17.5m, height=1.5m, facing inward (-90° Y) */}
      <a-box position="45 0.75 -20" rotation="0 -90 0" width={17.5} height={1.5} depth={0.3} color="#FFFF00" />
      <a-box position="45 0.75 0" rotation="0 -90 0" width={17.5} height={1.5} depth={0.3} color="#FF00FF" />
      <a-box position="45 0.75 20" rotation="0 -90 0" width={17.5} height={1.5} depth={0.3} color="#00FFFF" />
      
      {/* Top side - z=28, width=25m, height=1.5m, facing inward (180° Y) */}
      <a-box position="-25 0.75 28" rotation="0 180 0" width={25} height={1.5} depth={0.3} color="#FF8800" />
      <a-box position="0 0.75 28" rotation="0 180 0" width={25} height={1.5} depth={0.3} color="#88FF00" />
      <a-box position="25 0.75 28" rotation="0 180 0" width={25} height={1.5} depth={0.3} color="#0088FF" />
      
      {/* Bottom side - z=-28, width=25m, height=1.5m, facing inward (0° Y) */}
      <a-box position="-25 0.75 -28" rotation="0 0 0" width={25} height={1.5} depth={0.3} color="#FF0088" />
      <a-box position="0 0.75 -28" rotation="0 0 0" width={25} height={1.5} depth={0.3} color="#8800FF" />
      <a-box position="25 0.75 -28" rotation="0 0 0" width={25} height={1.5} depth={0.3} color="#00FF88" />
    </a-entity>
  );
}
