import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Manifesto() {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "+=150%", // Shorter scroll distance so the scale happens faster
          scrub: 1,
          pin: true,
        }
      });

      // Extreme optimization: 
      // 1. Limit max scale to 12 to prevent the GPU texture from exceeding 8192px limits
      // 2. Fade out aggressively between scale 5 and 12
      tl.to(textRef.current, {
        scale: 12, 
        ease: "power2.in",
      }, 0)
      .to(textRef.current, {
        opacity: 0,
        ease: "power2.in",
      }, 0.5); // Starts fading out halfway through the scroll
      
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} style={{
      width: '100%',
      height: '100vh', // GSAP will pin this and add padding automatically
      position: 'relative',
      zIndex: 20, // Must be above the fluid canvas
      background: 'transparent'
    }}>
      {/* 
        The Magic Mask:
        Black background + White text + mix-blend-mode: multiply
        = The black stays pitch black, the white text becomes perfectly transparent
        punching a hole down to the fluid canvas behind it!
      */}
      <div style={{
        width: '100%',
        height: '100%',
        background: '#000000',
        color: '#ffffff',
        mixBlendMode: 'multiply',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        <div ref={textRef} style={{
          display: 'inline-flex', // inline-flex to keep the bounding box as tight as possible!
          flexDirection: 'column',
          alignItems: 'center',
          transformOrigin: 'center 75%', // Targeted exactly on the 'O'
          willChange: 'transform', // Hardware acceleration restored
          transform: 'translateZ(0)', // Force GPU layer
        }}>
          <div className="geist-micro" style={{ letterSpacing: '0.2em', marginBottom: '2rem' }}>
            /// DIRECTIVE_01
          </div>
          <h2 className="geist-heading" style={{ 
            fontSize: 'clamp(3rem, 7vw, 7rem)', 
            lineHeight: 1.0, 
            letterSpacing: '-0.04em', 
            margin: 0,
            textAlign: 'center',
            textTransform: 'uppercase'
          }}>
            Chaos is merely <br/>
            the absence of <br/>
            ORCHESTRATION.
          </h2>
        </div>
      </div>
    </section>
  );
}
