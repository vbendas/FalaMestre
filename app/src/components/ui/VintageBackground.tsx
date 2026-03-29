'use client';

/**
 * Vintage background effects layer — rendered once in layout.
 * Includes: animated gradient orbs, film grain, light sweep,
 * CRT scanlines, and vignette.
 */
export function VintageBackground() {
  return (
    <>
      <style jsx>{`
        @keyframes drift1 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          25% { transform: translate(10%, -15%) scale(1.1); }
          50% { transform: translate(-5%, 10%) scale(0.95); }
          75% { transform: translate(-15%, -5%) scale(1.05); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          25% { transform: translate(-12%, 10%) scale(1.08); }
          50% { transform: translate(8%, -8%) scale(0.92); }
          75% { transform: translate(5%, 15%) scale(1.12); }
        }
        @keyframes drift3 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33% { transform: translate(15%, 8%) scale(1.15); }
          66% { transform: translate(-10%, -12%) scale(0.9); }
        }
        @keyframes sweep {
          0% { transform: translateX(-100%) rotate(15deg); }
          100% { transform: translateX(200%) rotate(15deg); }
        }
        @keyframes flicker {
          0%, 100% { opacity: 0.12; }
          50% { opacity: 0.08; }
        }
        .orb-1 { animation: drift1 25s ease-in-out infinite; }
        .orb-2 { animation: drift2 30s ease-in-out infinite; }
        .orb-3 { animation: drift3 20s ease-in-out infinite; }
        .light-sweep { animation: sweep 8s ease-in-out infinite; }
        .scanline-flicker { animation: flicker 0.1s steps(2) infinite; }
      `}</style>

      {/* Base gradient: green tones */}
      <div
        className="fixed inset-0"
        style={{
          background: 'linear-gradient(135deg, #00802b 0%, #009739 30%, #006400 60%, #003d1f 100%)',
          zIndex: 0,
        }}
      />

      {/* Drifting color orbs */}
      <div
        className="fixed orb-1 pointer-events-none"
        style={{
          width: '80vw', height: '80vh',
          top: '-10%', left: '-10%',
          background: 'radial-gradient(ellipse, rgba(254, 221, 0, 0.25) 0%, transparent 55%)',
          filter: 'blur(60px)',
          zIndex: 0,
        }}
      />
      <div
        className="fixed orb-2 pointer-events-none"
        style={{
          width: '70vw', height: '70vh',
          bottom: '-15%', right: '-10%',
          background: 'radial-gradient(ellipse, rgba(0, 151, 57, 0.28) 0%, transparent 55%)',
          filter: 'blur(80px)',
          zIndex: 0,
        }}
      />
      <div
        className="fixed orb-3 pointer-events-none"
        style={{
          width: '50vw', height: '50vh',
          top: '30%', left: '40%',
          background: 'radial-gradient(ellipse, rgba(255, 255, 255, 0.06) 0%, transparent 50%)',
          filter: 'blur(50px)',
          zIndex: 0,
        }}
      />
      {/* White accent patches */}
      <div
        className="fixed orb-1 pointer-events-none"
        style={{
          width: '35vw', height: '25vh',
          top: '15%', left: '35%',
          background: 'radial-gradient(ellipse, rgba(255, 255, 255, 0.07) 0%, transparent 50%)',
          filter: 'blur(35px)',
          zIndex: 0,
        }}
      />
      <div
        className="fixed orb-2 pointer-events-none"
        style={{
          width: '30vw', height: '20vh',
          bottom: '20%', left: '10%',
          background: 'radial-gradient(ellipse, rgba(255, 255, 255, 0.04) 0%, transparent 50%)',
          filter: 'blur(30px)',
          zIndex: 0,
        }}
      />

      {/* SVG noise filter */}
      <svg className="fixed" width="0" height="0" aria-hidden="true">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          filter: 'contrast(150%) brightness(600%)',
          mixBlendMode: 'multiply',
          opacity: 0.12,
          zIndex: 1,
        }}
      >
        <div className="w-full h-full" style={{ filter: 'url(#grain)' }} />
      </div>

      {/* Light sweep */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 2 }}>
        <div
          className="light-sweep"
          style={{
            position: 'absolute',
            top: '-20%',
            left: 0,
            width: '30%',
            height: '140%',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.04), rgba(255,255,255,0.02), transparent)',
            filter: 'blur(30px)',
          }}
        />
      </div>

      {/* CRT Scanlines */}
      <div
        className="fixed inset-0 pointer-events-none scanline-flicker"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 2px,
            rgba(0,0,0,0.15) 2px,
            rgba(0,0,0,0.15) 4px
          )`,
          zIndex: 3,
        }}
      />

      {/* Vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)',
          zIndex: 4,
        }}
      />
    </>
  );
}
