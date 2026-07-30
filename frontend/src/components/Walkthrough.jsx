import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Custom Scramble Text Component for the Decryption Glitch
function ScrambleText({ text, active }) {
  const [display, setDisplay] = useState(text.replace(/./g, '_'));
  
  useEffect(() => {
    if (!active) {
      setDisplay(text.replace(/./g, '_'));
      return;
    }
    
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(text.split('').map((letter, index) => {
        if(index < iteration) return text[index];
        if (letter === ' ') return ' ';
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(''));
      
      if(iteration >= text.length){
        clearInterval(interval);
      }
      iteration += 1; // Speed of decryption
    }, 20); // ms per frame
    
    return () => clearInterval(interval);
  }, [active, text]);
  
  return <span>{display}</span>;
}

const SPECS = [
  { label: 'ORCHESTRATION PIPELINE', value: 'ZERO-LATENCY ROUTING', top: '60%', side: 'left', branchX: '30%' },
  { label: 'TELEMETRY INGESTION', value: 'SYSTEM LEVEL INTEGRATION', top: '45%', side: 'right', branchX: '30%' },
  { label: 'HEURISTIC ALGORITHM', value: 'DYNAMIC LOAD BALANCING', top: '30%', side: 'left', branchX: '20%' },
  { label: 'KERNEL ARCHITECTURE', value: 'AUTONOMOUS STATE MACHINE', top: '15%', side: 'right', branchX: '20%' },
];

const TREE_DATA = [
  // Branch 1: Left
  { h: { top: '80%', right: '50%', width: '20%', height: '2px', origin: 'right' },
    v: { left: '30%', bottom: '20%', width: '2px', height: '20%', origin: 'bottom' } },
  // Branch 2: Right
  { h: { top: '65%', left: '50%', width: '20%', height: '2px', origin: 'left' },
    v: { right: '30%', bottom: '35%', width: '2px', height: '20%', origin: 'bottom' } },
  // Branch 3: Left
  { h: { top: '50%', right: '50%', width: '30%', height: '2px', origin: 'right' },
    v: { left: '20%', bottom: '50%', width: '2px', height: '20%', origin: 'bottom' } },
  // Branch 4: Right
  { h: { top: '35%', left: '50%', width: '30%', height: '2px', origin: 'left' },
    v: { right: '20%', bottom: '65%', width: '2px', height: '20%', origin: 'bottom' } },
];

export default function Walkthrough() {
  const containerRef = useRef(null);
  const trunkRef = useRef(null);
  const branchHRefs = useRef([]);
  const branchVRefs = useRef([]);
  
  const [activeNodes, setActiveNodes] = useState([false, false, false, false]);

  useEffect(() => {
    let ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: '+=300%', // 3 screens of scrolling
        pin: true,
        onUpdate: (self) => {
          const p = self.progress;
          
          // Trunk grows from bottom up (p: 0 to 0.8)
          gsap.set(trunkRef.current, { scaleY: Math.min(Math.max(p / 0.8, 0), 1) });
          
          // Branch 1
          gsap.set(branchHRefs.current[0], { scaleX: Math.min(Math.max((p - 0.2) / 0.1, 0), 1) });
          gsap.set(branchVRefs.current[0], { scaleY: Math.min(Math.max((p - 0.3) / 0.1, 0), 1) });
          
          // Branch 2
          gsap.set(branchHRefs.current[1], { scaleX: Math.min(Math.max((p - 0.35) / 0.1, 0), 1) });
          gsap.set(branchVRefs.current[1], { scaleY: Math.min(Math.max((p - 0.45) / 0.1, 0), 1) });
          
          // Branch 3
          gsap.set(branchHRefs.current[2], { scaleX: Math.min(Math.max((p - 0.5) / 0.1, 0), 1) });
          gsap.set(branchVRefs.current[2], { scaleY: Math.min(Math.max((p - 0.6) / 0.1, 0), 1) });
          
          // Branch 4
          gsap.set(branchHRefs.current[3], { scaleX: Math.min(Math.max((p - 0.65) / 0.1, 0), 1) });
          gsap.set(branchVRefs.current[3], { scaleY: Math.min(Math.max((p - 0.75) / 0.1, 0), 1) });
          
          // Trigger nodes precisely when their vertical branch completes
          setActiveNodes([
            p > 0.4,
            p > 0.55,
            p > 0.7,
            p > 0.85
          ]);
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} style={{
      width: '100%',
      height: '100vh',
      background: '#020202',
      position: 'relative',
      zIndex: 30,
      overflow: 'hidden'
    }}>
      {/* ══════════════════════════════════════════════════════════════
          CYBER-YGGDRASIL TRUNK
          ══════════════════════════════════════════════════════════════ */}
      <div ref={trunkRef} style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        width: '4px',
        height: '100%',
        background: '#C679A8',
        boxShadow: '0 0 30px 5px rgba(198,121,168,0.8)',
        transformOrigin: 'bottom',
        transform: 'scaleY(0)',
        willChange: 'transform',
        zIndex: 2
      }} />

      {/* ══════════════════════════════════════════════════════════════
          CYBER-YGGDRASIL BRANCHES
          ══════════════════════════════════════════════════════════════ */}
      {TREE_DATA.map((branch, idx) => (
        <React.Fragment key={`branch-${idx}`}>
          {/* Horizontal Segment */}
          <div ref={el => branchHRefs.current[idx] = el} style={{
            position: 'absolute',
            top: branch.h.top,
            left: branch.h.left,
            right: branch.h.right,
            width: branch.h.width,
            height: branch.h.height,
            background: '#C679A8',
            boxShadow: '0 0 20px rgba(198,121,168,0.8)',
            transformOrigin: branch.h.origin,
            transform: 'scaleX(0)',
            willChange: 'transform',
            zIndex: 1
          }} />
          {/* Vertical Segment */}
          <div ref={el => branchVRefs.current[idx] = el} style={{
            position: 'absolute',
            bottom: branch.v.bottom,
            left: branch.v.left,
            right: branch.v.right,
            width: branch.v.width,
            height: branch.v.height,
            background: '#C679A8',
            boxShadow: '0 0 20px rgba(198,121,168,0.8)',
            transformOrigin: branch.v.origin,
            transform: 'scaleY(0)',
            willChange: 'transform',
            zIndex: 1
          }} />
        </React.Fragment>
      ))}

      {/* ══════════════════════════════════════════════════════════════
          THE CAPTURED NODES (SPECS)
          ══════════════════════════════════════════════════════════════ */}
      {SPECS.map((spec, idx) => {
        const isActive = activeNodes[idx];
        const isLeft = spec.side === 'left';
        
        return (
          <div key={`spec-${idx}`} style={{ 
            position: 'absolute', 
            top: spec.top, 
            [isLeft ? 'right' : 'left']: `calc(100% - ${spec.branchX} + 1.5rem)`,
            transform: 'translateY(-50%)',
            textAlign: isLeft ? 'right' : 'left',
            zIndex: 10,
            opacity: isActive ? 1 : 0.2,
            filter: isActive ? 'blur(0px)' : 'blur(10px)',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
             <div className="geist-micro" style={{ color: '#C679A8', letterSpacing: '0.2em' }}>
               /// <ScrambleText text={spec.label} active={isActive} />
             </div>
             <div className="geist-heading" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', color: '#fff', lineHeight: 1.1, textShadow: isActive ? '0 0 20px rgba(255,255,255,0.4)' : 'none' }}>
               <ScrambleText text={spec.value} active={isActive} />
             </div>
          </div>
        );
      })}
    </section>
  );
}
