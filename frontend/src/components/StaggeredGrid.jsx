import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getTechIconUrl } from '../utils/techIcons';
import { FaLinkedin, FaGithub } from 'react-icons/fa';

gsap.registerPlugin(ScrollTrigger);

export function StaggeredGrid({ 
  items = [], 
  centerText = "MY TECH STACK", 
  linkedinUrl = "",
  githubUrl = "",
  scroller 
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const gridFullRef = useRef(null);
  const textRef = useRef(null);

  const techList = items.length > 0 
    ? items 
    : ["Python", "JavaScript", "TypeScript", "React", "Next.js", "FastAPI", "Django", "PostgreSQL", "Supabase", "Docker", "Git", "PyTorch", "Tailwind", "C++"];

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !gridFullRef.current) return;

    const mainContent = document.querySelector('.main-content');
    const scrollerTarget = scroller || mainContent || window;

    const ctx = gsap.context(() => {
      // Header Text Wave Animation
      if (textRef.current) {
        const chars = textRef.current.querySelectorAll('.char');
        gsap.fromTo(chars,
          { yPercent: 150, autoAlpha: 0 },
          {
            yPercent: 0,
            autoAlpha: 1,
            ease: 'power3.out',
            stagger: {
              each: 0.04,
              from: 'center'
            },
            scrollTrigger: {
              trigger: textRef.current,
              scroller: scrollerTarget,
              start: 'top 95%',
              end: 'center center',
              scrub: 1,
            }
          }
        );
      }

      // 7-Column Pyramidal Staggered Animation
      const gridFullItems = gridFullRef.current.querySelectorAll('.grid__item');
      const numColumns = 7;
      const columns = Array.from({ length: numColumns }, () => []);

      gridFullItems.forEach((item) => {
        const colAttr = item.getAttribute('data-col');
        const columnIndex = colAttr !== null ? parseInt(colAttr, 10) : 0;
        if (columns[columnIndex]) {
          columns[columnIndex].push(item);
        }
      });

      columns.forEach((columnItems, columnIndex) => {
        if (!columnItems || columnItems.length === 0) return;

        // Peak wave displacement for center column
        const distanceFromCenter = Math.abs(columnIndex - 3);
        const pyramidBaseY = distanceFromCenter * 35;

        gsap.fromTo(columnItems,
          { 
            y: pyramidBaseY + 180, 
            autoAlpha: 0,
            scale: 0.85,
          },
          {
            y: pyramidBaseY,
            autoAlpha: 1,
            scale: 1,
            ease: 'power2.out',
            stagger: 0.08,
            scrollTrigger: {
              trigger: gridFullRef.current,
              scroller: scrollerTarget,
              start: 'top 85%',
              end: 'bottom 45%',
              scrub: 1.2,
            }
          }
        );
      });
    }, gridFullRef);

    const refreshTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 150);

    return () => {
      clearTimeout(refreshTimer);
      ctx.revert();
    };
  }, [isLoaded, items, scroller]);

  const splitText = (text) => {
    return text.split('').map((char, i) => (
      <span key={i} className="char" style={{ display: 'inline-block', willChange: 'transform, opacity' }}>
        {char === ' ' ? '\u00A0' : char}
      </span>
    ));
  };

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '32px',
      position: 'relative'
    }}>
      {/* Header Wave Text */}
      <div ref={textRef} style={{
        margin: 0,
        fontSize: '28px',
        fontWeight: '900',
        color: '#ffffff',
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        fontFamily: 'monospace',
        textShadow: '0 0 25px rgba(168, 85, 247, 0.6)',
        display: 'flex',
        overflow: 'hidden',
        lineHeight: 1
      }}>
        {splitText(centerText)}
      </div>

      {/* Full-Width 7-Column Pyramid Staggered Grid */}
      <div 
        ref={gridFullRef}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '20px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {techList.map((tech, idx) => {
          const colIdx = idx % 7;
          const iconUrl = getTechIconUrl(tech);

          return (
            <div
              key={`${tech}-${idx}`}
              data-col={colIdx}
              className="grid__item"
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '16px',
                boxSizing: 'border-box',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease',
                cursor: 'pointer',
                position: 'relative',
                zIndex: 10
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(168, 85, 247, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Prominent Large Tech Logo */}
              <img 
                src={iconUrl} 
                alt={tech}
                style={{ width: '48px', height: '48px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.25))' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.fallback-box')) {
                    const box = document.createElement('div');
                    box.className = 'fallback-box';
                    box.style.width = '48px';
                    box.style.height = '48px';
                    box.style.borderRadius = '12px';
                    box.style.background = 'rgba(168, 85, 247, 0.2)';
                    box.style.border = '1px solid rgba(168, 85, 247, 0.4)';
                    box.style.display = 'flex';
                    box.style.alignItems = 'center';
                    box.style.justifyContent = 'center';
                    box.style.fontSize = '14px';
                    box.style.fontWeight = 'bold';
                    box.style.color = '#c084fc';
                    box.style.fontFamily = 'monospace';
                    box.innerText = tech.slice(0, 2).toUpperCase();
                    parent.insertBefore(box, parent.firstChild);
                  }
                }}
              />

              {/* Technology Name Only (No 'BUILD WITH' text) */}
              <span style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#f3f4f6',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px',
                textAlign: 'center'
              }}>
                {tech}
              </span>
            </div>
          );
        })}

        {/* LinkedIn Tile as Part of Staggered Grid */}
        <div
          data-col={(techList.length) % 7}
          className="grid__item"
          style={{
            gridColumn: 'span 2',
            height: '100%',
            minHeight: '120px',
            backgroundColor: 'rgba(30, 58, 138, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 20px',
            boxSizing: 'border-box',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.03)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(59, 130, 246, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onClick={() => {
            if (linkedinUrl) {
              window.open(linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`, '_blank');
            }
          }}
        >
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            backgroundColor: 'rgba(59, 130, 246, 0.25)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#60a5fa'
          }}>
            <FaLinkedin size={26} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#60a5fa', fontFamily: 'monospace', textTransform: 'uppercase' }}>
              LINKEDIN
            </span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {linkedinUrl ? linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '') : 'Connect'}
            </span>
          </div>
        </div>

        {/* GitHub Tile as Part of Staggered Grid */}
        <div
          data-col={(techList.length + 2) % 7}
          className="grid__item"
          style={{
            gridColumn: 'span 2',
            height: '100%',
            minHeight: '120px',
            backgroundColor: 'rgba(88, 28, 135, 0.2)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 20px',
            boxSizing: 'border-box',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.03)';
            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(168, 85, 247, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onClick={() => {
            if (githubUrl) {
              window.open(githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`, '_blank');
            }
          }}
        >
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            backgroundColor: 'rgba(168, 85, 247, 0.25)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <FaGithub size={26} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#c084fc', fontFamily: 'monospace', textTransform: 'uppercase' }}>
              GITHUB
            </span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {githubUrl ? githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '') : 'Connect'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default StaggeredGrid;