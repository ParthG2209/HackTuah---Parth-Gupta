import * as React from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

// A single icon component with its own motion logic
const Icon = ({
  mouseX,
  mouseY,
  iconData,
  index,
}) => {
  const ref = React.useRef(null);

  // Motion values for the icon's position, with spring physics for smooth movement
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  React.useEffect(() => {
    const handleMouseMove = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const distance = Math.sqrt(
          Math.pow(mouseX.current - (rect.left + rect.width / 2), 2) +
            Math.pow(mouseY.current - (rect.top + rect.height / 2), 2)
        );

        // If the cursor is close enough, repel the icon
        if (distance < 150) {
          const angle = Math.atan2(
            mouseY.current - (rect.top + rect.height / 2),
            mouseX.current - (rect.left + rect.width / 2)
          );
          // The closer the cursor, the stronger the repulsion
          const force = (1 - distance / 150) * 50;
          x.set(-Math.cos(angle) * force);
          y.set(-Math.sin(angle) * force);
        } else {
          // Return to original position when cursor is away
          x.set(0);
          y.set(0);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [x, y, mouseX, mouseY]);

  return (
    <motion.div
      ref={ref}
      key={iconData.id}
      style={{
        position: 'absolute',
        zIndex: 0,
        x: springX,
        y: springY,
        ...(iconData.position || {})
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: index * 0.08,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={iconData.className || ''}
    >
      {/* Inner wrapper for the continuous floating animation */}
      <motion.div
        className="floating-icon-card"
        animate={{
          y: [0, -8, 0, 8, 0],
          x: [0, 6, 0, -6, 0],
          rotate: [0, 5, 0, -5, 0],
        }}
        transition={{
          duration: 5 + Math.random() * 5,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        }}
      >
        {typeof iconData.icon === 'string' ? (
          <img src={iconData.icon} alt="tech icon" className="floating-icon-img" />
        ) : typeof iconData.icon === 'function' || typeof iconData.icon === 'object' ? (
          <iconData.icon className="floating-icon-svg" style={{ color: iconData.color || '#fff' }} />
        ) : null}
      </motion.div>
    </motion.div>
  );
};

const FloatingIconsHero = React.forwardRef(({ className, title, subtitle, ctaText, ctaHref, icons, children, ...props }, ref) => {
  // Refs to track the raw mouse position
  const mouseX = React.useRef(0);
  const mouseY = React.useRef(0);

  const handleMouseMove = (event) => {
    mouseX.current = event.clientX;
    mouseY.current = event.clientY;
  };

  return (
    <section
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`floating-hero-section ${className || ''}`}
      {...props}
    >
      {/* Container for the background floating icons */}
      <div className="floating-hero-bg">
        <div className="floating-hero-bg-inner">
          {icons.map((iconData, index) => (
            <Icon
              key={iconData.id}
              mouseX={mouseX}
              mouseY={mouseY}
              iconData={iconData}
              index={index}
            />
          ))}
        </div>
      </div>

      {/* Container for the foreground content */}
      <div className="floating-hero-fg">
        <div className="floating-hero-fg-inner">
          {children ? children : (
            <div style={{ textAlign: 'center', padding: '0 16px' }}>
              {title && (
                <h1 style={{
                  fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
                  fontWeight: 700,
                  letterSpacing: '-0.025em',
                  background: 'linear-gradient(to bottom, #ffffff, rgba(255,255,255,0.7))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  margin: 0
                }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p style={{
                  marginTop: '24px',
                  maxWidth: '36rem',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  fontSize: '1.125rem',
                  color: '#9ca3af'
                }}>
                  {subtitle}
                </p>
              )}
              {ctaText && ctaHref && (
                <div style={{ marginTop: '40px' }}>
                  <a
                    href={ctaHref}
                    style={{
                      display: 'inline-block',
                      padding: '16px 32px',
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                      color: '#ffffff',
                      textDecoration: 'none',
                      boxShadow: '0 10px 25px rgba(168, 85, 247, 0.35)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                  >
                    {ctaText}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

FloatingIconsHero.displayName = 'FloatingIconsHero';

export { FloatingIconsHero };
