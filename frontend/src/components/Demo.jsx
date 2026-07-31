import React from 'react';

export default function Demo() {
  return (
    <section style={{
      width: '100%',
      padding: '6rem 2rem',
      background: '#020202',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 20
    }}>
      <style>{`
        @keyframes glowPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        .demo-card-glow {
          animation: glowPulse 3s ease-in-out infinite;
        }
      `}</style>

      <div style={{ maxWidth: '1400px', width: '100%', position: 'relative', padding: '40px' }}>

        {/* Outer glow wrapper — creates the full perimeter purple light */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '32px',
          background: 'transparent',
          boxShadow: '0 0 50px 20px rgba(139, 92, 246, 0.3), 0 0 100px 50px rgba(109, 40, 217, 0.15)',
          zIndex: 0,
          pointerEvents: 'none'
        }} className="demo-card-glow" />

        {/* Main video card */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '750px',
          background: '#030306',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '24px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 0 40px rgba(139, 92, 246, 0.08)'
        }}>
          {/* Blank — video will be placed here */}
        </div>

      </div>
    </section>
  );
}
