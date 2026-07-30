import React from 'react';

export default function Demo() {
  return (
    <section style={{
      width: '100%',
      padding: '8rem 2rem',
      background: '#020202',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 20
    }}>
      <div style={{ maxWidth: '1000px', width: '100%' }}>

        <div style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 80px rgba(0,0,0,0.8)'
        }}>
          {/* Terminal Header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            gap: '0.5rem',
            background: '#050505'
          }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }} />
          </div>
          {/* Terminal Body */}
          <div className="geist-micro" style={{ padding: '2rem', color: '#00ff41', lineHeight: 2, fontSize: '0.9rem' }}>
            <p>&gt; KAIROS_KERNEL_INIT</p>
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>[sys] Handshake accepted. Allocating resources...</p>
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>[sys] Connected to 1,024 external nodes.</p>
            <br />
            <p>&gt; AWAITING_TELEMETRY</p>
            <p style={{ color: '#C679A8' }}>[alert] Traffic spike detected on cluster_omega.</p>
            <br />
            <p>&gt; EXECUTE_AUTO_SCALE --force</p>
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>[sys] Scaling cluster_omega by 400%...</p>
            <p style={{ color: '#27c93f' }}>[success] Equilibrium achieved in 12ms.</p>
            <br />
            <p>&gt; <span style={{ display: 'inline-block', width: '10px', height: '1em', background: '#00ff41', animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }} /></p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </section>
  );
}
