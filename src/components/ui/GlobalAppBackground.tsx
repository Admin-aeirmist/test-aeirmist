import React, { useEffect, useRef, useState } from 'react';
import { useAppearance } from '../../context/AppearanceContext';

export const GlobalAppBackground: React.FC = () => {
  const { settings } = useAppearance();
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLight, setIsLight] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('light');
  });

  useEffect(() => {
    setIsClient(true);
    const checkTheme = () => {
      setIsLight(document.documentElement.classList.contains('light'));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Performance-mode override calculations
  const performanceMode = settings.performanceMode;
  const isCustom = settings.globalBgType === 'custom' && settings.globalBgValue;
  const opacity = settings.globalBgOpacity / 100;
  const effectiveOpacity = isLight ? Math.max(0.85, opacity) : opacity;
  const blur = performanceMode ? 0 : settings.globalBgBlur;
  const darkOverlayOpacity = settings.globalBgOverlay / 100;
  const enableParallax = settings.globalBgMotion && !performanceMode;
  const showAnimated = settings.globalBgAnimated && !performanceMode;

  // Lightweight Parallax effect on mouse move (Desktop only, directly modifies element style to prevent React re-renders)
  useEffect(() => {
    if (!isClient || !enableParallax || !mediaRef.current) return;

    let rafId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      // Calculate relative pointer positions from -1 to 1
      const x = (e.clientX / innerWidth) * 2 - 1;
      const y = (e.clientY / innerHeight) * 2 - 1;

      // Parallax intensity (pixels)
      targetX = x * -24;
      targetY = y * -24;
    };

    const updateParallax = () => {
      // Smooth linear interpolation (lerp)
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      if (mediaRef.current) {
        // Maintain scaling to prevent edge leakage during motion
        mediaRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(1.08)`;
      }
      rafId = requestAnimationFrame(updateParallax);
    };

    window.addEventListener('mousemove', handleMouseMove);
    rafId = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [isClient, enableParallax, isCustom]);

  if (!isClient || settings.globalBgType === 'none') {
    return null;
  }

  // Detect if the custom background is a video source
  const isVideoSource = isCustom && (
    settings.globalBgValue.startsWith('data:video/') ||
    settings.globalBgValue.endsWith('.mp4') ||
    settings.globalBgValue.endsWith('.webm') ||
    settings.globalBgValue.endsWith('.mov')
  );

  // Background display options styling mapping
  const getDisplayStyles = (): React.CSSProperties => {
    switch (settings.globalBgDisplay) {
      case 'center':
        return {
          backgroundSize: 'auto',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        };
      case 'fit':
        return {
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        };
      case 'stretch':
        return {
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        };
      case 'tile':
        return {
          backgroundSize: 'auto',
          backgroundPosition: 'left top',
          backgroundRepeat: 'repeat',
        };
      case 'fill':
      default:
        return {
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        };
    }
  };

  const displayStyles = getDisplayStyles();

  // Scale offset to prevent blurry white edges when blur > 0
  const blurScale = blur > 0 ? `scale(${1 + blur / 100})` : 'scale(1)';

  return (
    <div 
      ref={containerRef}
      id="aeirmist-global-app-background"
      data-wallpaper-layer="true"
      className="fixed inset-0 pointer-events-none overflow-hidden select-none"
      style={{ zIndex: -20 }}
    >
      {/* 1. SOLID / GRADIENT underlay */}
      {settings.globalBgType === 'solid' && (
        <div 
          className="absolute inset-0 w-full h-full transition-colors duration-500" 
          style={{ backgroundColor: settings.globalBgValue }}
        />
      )}

      {settings.globalBgType === 'gradient' && (
        <div 
          className="absolute inset-0 w-full h-full transition-all duration-500" 
          style={{ background: settings.globalBgValue }}
        />
      )}

      {/* 2. CUSTOM FILE (Image / Video) Underlay */}
      {isCustom && (
        <div 
          ref={mediaRef}
          className="absolute inset-0 w-full h-full transition-all duration-500 origin-center"
          style={{
            opacity: effectiveOpacity,
            filter: blur > 0 ? `blur(${blur}px)` : undefined,
            transform: enableParallax ? 'scale(1.08)' : blurScale,
            willChange: 'transform, filter, opacity',
          }}
        >
          {isVideoSource && showAnimated ? (
            <video
              src={settings.globalBgValue}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: settings.globalBgDisplay === 'fit' ? 'contain' : (settings.globalBgDisplay === 'stretch' ? 'fill' : 'cover'),
                objectPosition: 'center',
              }}
            />
          ) : (
            <div 
              className="absolute inset-0 w-full h-full"
              style={{
                backgroundImage: `url(${settings.globalBgValue})`,
                ...displayStyles,
              }}
            />
          )}
        </div>
      )}

      {/* 3. ADAPTIVE READABILITY OVERLAY TINT */}
      {darkOverlayOpacity > 0 && (
        <div 
          className="absolute inset-0 w-full h-full global-bg-overlay transition-opacity duration-300 pointer-events-none"
          style={{ 
            backgroundColor: isLight ? '#ffffff' : '#000000',
            opacity: isLight ? Math.min(0.2, darkOverlayOpacity * 0.25) : darkOverlayOpacity 
          }}
        />
      )}
    </div>
  );
};
