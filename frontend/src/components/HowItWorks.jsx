import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const MECHANICS = [
  {
    title: "Telemetry Ingestion",
    desc: "KAIROS binds to every edge node, relentlessly pulling millions of data points per second into a singular, volatile state map.",
    stats: [
      { label: 'INGEST_RATE', val: '8.4M req/s' },
      { label: 'LATENCY', val: '0.4ms' }
    ]
  },
  {
    title: "Heuristic Processing",
    desc: "Raw noise is instantly fractured and analyzed. Predictive AI models detect cascading failures milliseconds before they breach.",
    stats: [
      { label: 'MODELS_ACTIVE', val: '14' },
      { label: 'PREDICTION_ACC', val: '99.8%' }
    ]
  },
  {
    title: "Autonomous Orchestration",
    desc: "Zero human intervention. KAIROS executes auto-scaling, self-healing, and load distribution at the hardware level.",
    stats: [
      { label: 'NODES_SCALED', val: '+4,024' },
      { label: 'DOWNTIME_PREV', val: '14 incidents' }
    ]
  }
];

export default function HowItWorks() {
  const containerRef = useRef(null);
  
  // Laser References
  const laserRef = useRef(null);
  const trailFastRef = useRef(null);
  const trailSlowRef = useRef(null);
  
  const panelRef = useRef(null);
  
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // Main Scroll/Pin tracking
  useEffect(() => {
    let ctx = gsap.context(() => {
      
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "+=300%", // 3 full screens of scrolling while pinned
        pin: true,
        onUpdate: (self) => {
          const p = self.progress;
          
          // 1. Update the CSS variable for the typography optical scan mask
          if (containerRef.current) {
            containerRef.current.style.setProperty('--laser-y', p);
          }
          
          // 2. Move the main laser instantly using GPU-accelerated transform 'y' instead of layout-thrashing 'top'
          // We use vh because the container's height is exactly 60vh
          const yPos = `${p * 60}vh`;
          gsap.set(laserRef.current, { y: yPos });
          
          // 3. Move the heat trails with delayed tweens to create motion blur
          gsap.to(trailFastRef.current, { y: yPos, duration: 0.15, ease: "power2.out" });
          gsap.to(trailSlowRef.current, { y: yPos, duration: 0.4, ease: "power3.out" });
          
          // 4. Determine Active Index
          let newIndex = 0;
          if (p > 0.33 && p <= 0.66) newIndex = 1;
          if (p > 0.66) newIndex = 2;
          
          if (newIndex !== activeIndexRef.current) {
            activeIndexRef.current = newIndex;
            setActiveIndex(newIndex);
          }
        }
      });
      
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Panel data transition effect
  useEffect(() => {
    gsap.fromTo(panelRef.current, 
      { opacity: 0, y: 15 }, 
      { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }
    );
  }, [activeIndex]);

  return (
    <section ref={containerRef} style={{
      width: '100%',
      height: '100vh',
      position: 'relative',
      zIndex: 10,
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      '--laser-y': 0 // Initial variable state
    }}>
      <div style={{ maxWidth: '1400px', width: '100%', display: 'flex', gap: '4rem', padding: '0 4rem', alignItems: 'stretch', height: '60vh' }}>
        
        {/* ══════════════════════════════════════════════════════════════
            LEFT COLUMN (OPTICAL SCANNING TYPOGRAPHY)
            ══════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, position: 'relative' }}>
          
          {/* HOLLOW LAYER (Base Text) */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {MECHANICS.map((mech, idx) => {
              const isActive = activeIndex === idx;
              return (
                <div key={`hollow-${idx}`} style={{ 
                  display: 'flex', alignItems: 'center', height: '33.33%',
                  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isActive ? 'translateX(30px)' : 'translateX(0px)',
                  opacity: 0.8
                }}>
                  <h2 className="geist-heading" style={{ 
                    fontSize: 'clamp(3rem, 4.5vw, 4.5rem)', margin: 0, lineHeight: 1, textTransform: 'uppercase',
                    color: 'transparent',
                    WebkitTextStroke: '1px rgba(255,255,255,0.15)'
                  }}>
                    {mech.title}
                  </h2>
                </div>
              );
            })}
          </div>

          {/* SOLID LAYER (Glowing Overlays Masked by the Laser) */}
          <div style={{ 
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            pointerEvents: 'none',
            // GPU-accelerated Clip Path (much cheaper than mask-image)
            clipPath: 'polygon(0 0, 100% 0, 100% calc(var(--laser-y) * 100%), 0 calc(var(--laser-y) * 100%))',
            WebkitClipPath: 'polygon(0 0, 100% 0, 100% calc(var(--laser-y) * 100%), 0 calc(var(--laser-y) * 100%))'
          }}>
            {MECHANICS.map((mech, idx) => {
              const isActive = activeIndex === idx;
              return (
                <div key={`solid-${idx}`} style={{ 
                  display: 'flex', alignItems: 'center', height: '33.33%',
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isActive ? 'translateX(30px)' : 'translateX(0px)',
                  opacity: isActive ? 1 : 0 // Solid text is only visible when active
                }}>
                  <h2 className="geist-heading" style={{ 
                    fontSize: 'clamp(3rem, 4.5vw, 4.5rem)', margin: 0, lineHeight: 1, textTransform: 'uppercase',
                    color: '#fff',
                    textShadow: '0 0 40px rgba(198,121,168,1)'
                  }}>
                    {mech.title}
                  </h2>
                </div>
              );
            })}
          </div>

          {/* LASERS & MOTION TRAILS */}
          
          {/* Slow Heat Trail */}
          <div ref={trailSlowRef} style={{
            position: 'absolute', left: '-2rem', right: '10%', height: '80px',
            background: 'linear-gradient(to bottom, transparent, rgba(198,121,168,0.15) 50%, transparent)',
            zIndex: 3, top: '-40px', pointerEvents: 'none', willChange: 'transform'
          }} />
          
          {/* Fast Motion Blur Trail */}
          <div ref={trailFastRef} style={{
            position: 'absolute', left: '-2rem', right: '10%', height: '40px',
            background: 'linear-gradient(to bottom, transparent, rgba(198,121,168,0.4) 50%, transparent)',
            zIndex: 4, top: '-20px', pointerEvents: 'none', willChange: 'transform'
          }} />

          {/* Main Solid Laser Core */}
          <div ref={laserRef} style={{
            position: 'absolute', left: '-2rem', right: '10%', height: '2px',
            background: '#fff',
            boxShadow: '0 0 10px 2px rgba(198,121,168,1)',
            zIndex: 5, top: '-1px', pointerEvents: 'none', willChange: 'transform'
          }} />

        </div>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT COLUMN (THE GLASS PANEL)
            ══════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '100%',
            background: 'rgba(5, 5, 5, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 40px 100px rgba(0,0,0,0.8), inset 0 0 40px rgba(198,121,168,0.05)',
            padding: '4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem'
          }}>
            <div className="geist-micro" style={{ color: '#00ff41', letterSpacing: '0.2em' }}>
              /// STATUS_ACTIVE
            </div>
            
            <div ref={panelRef}>
              <p style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, margin: 0 }}>
                {MECHANICS[activeIndex].desc}
              </p>

              {/* Technical Stats */}
              <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
                {MECHANICS[activeIndex].stats.map((stat, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="geist-micro" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</div>
                    <div className="geist-heading" style={{ fontSize: '2rem', color: '#C679A8' }}>{stat.val}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
