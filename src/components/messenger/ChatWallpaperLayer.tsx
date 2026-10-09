import React, { useMemo } from 'react';
import { motion } from 'motion/react';

export interface ChatWallpaperConfig {
  wallpaperURL?: string;
  blurLevel?: number; // 0 to 20 px
  brightness?: number; // 0.1 to 1 (brightness or dim opacity)
  overlayColor?: string; // hex or rgba
  neonIntensity?: number; // scale factor
  bubbleStyle?: string; // 'solid' | 'outline' | 'glass' | 'none'
  effectType?: string; // 'none' | 'cyber-grid' | 'liquid-neon' | 'matrix-rain' | 'neon-glow'
  themeId?: string; // Messenger-style theme identifier
  bubbleGradient?: string; // Custom outgoing bubble gradient (e.g. Ocean Blue, Sunset, etc.)
  cropPosition?: { x: number; y: number; zoom: number }; // x/y are 0-100 (percent position), zoom is 1.0-2.5
  parallaxEnabled?: boolean;
}

interface ChatWallpaperLayerProps {
  chatThemeSettings?: ChatWallpaperConfig;
  globalThemeSettings?: ChatWallpaperConfig;
}

export const ChatWallpaperLayer: React.FC<ChatWallpaperLayerProps> = React.memo(({
  chatThemeSettings,
  globalThemeSettings
}) => {
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isLight, setIsLight] = React.useState(() => {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('light');
  });

  React.useEffect(() => {
    const checkTheme = () => {
      setIsLight(document.documentElement.classList.contains('light'));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Merge or resolve which configuration to use (per-chat taking precedence over global)
  const config = useMemo(() => {
    const isChatConfigured = chatThemeSettings && (
      chatThemeSettings.wallpaperURL || 
      chatThemeSettings.effectType !== undefined ||
      chatThemeSettings.overlayColor ||
      chatThemeSettings.themeId
    );
    const resolved = isChatConfigured ? chatThemeSettings : globalThemeSettings;
    
    const defaultOverlay = isLight ? 'rgba(255, 255, 255, 0.1)' : '#000000';
    const effectiveOverlay = (resolved?.overlayColor && resolved.overlayColor !== '#000000')
      ? resolved.overlayColor
      : defaultOverlay;

    return {
      wallpaperURL: resolved?.wallpaperURL || '',
      blurLevel: resolved?.blurLevel !== undefined ? resolved.blurLevel : 0,
      brightness: resolved?.brightness !== undefined ? resolved.brightness : (isLight ? 0.95 : 0.65),
      overlayColor: effectiveOverlay,
      neonIntensity: resolved?.neonIntensity !== undefined ? resolved.neonIntensity : 0.8,
      effectType: resolved?.effectType || 'none',
      bubbleStyle: resolved?.bubbleStyle || 'glass',
      cropPosition: resolved?.cropPosition || { x: 50, y: 50, zoom: 1 },
      parallaxEnabled: resolved?.parallaxEnabled || false,
    };
  }, [chatThemeSettings, globalThemeSettings, isLight]);

  React.useEffect(() => {
    if (!config.parallaxEnabled) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 16;
      const y = (e.clientY / window.innerHeight - 0.5) * 16;
      setOffset({ x: Math.max(-8, Math.min(8, x)), y: Math.max(-8, Math.min(8, y)) });
    };

    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      // beta: -180 to 180 (front to back), gamma: -90 to 90 (left to right)
      // Map to -8..8 range
      const x = (e.gamma / 45) * 8;
      const y = (e.beta / 45) * 8;
      setOffset({ x: Math.max(-8, Math.min(8, x)), y: Math.max(-8, Math.min(8, y)) });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('deviceorientation', handleDeviceOrientation);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    };
  }, [config.parallaxEnabled]);

  const backgroundStyle = useMemo(() => {
    const isGradient = config.wallpaperURL.startsWith('linear-gradient') || config.wallpaperURL.startsWith('radial-gradient');
    const isImage = Boolean(config.wallpaperURL && !isGradient);

    // In light mode, maintain vibrant photo clarity so it is recognizable and aesthetic
    const effectiveOpacity = isLight 
      ? (isImage ? 1 : Math.max(0.75, config.brightness))
      : config.brightness;

    const style: React.CSSProperties = {
      filter: `blur(${config.blurLevel}px)${isLight && isImage && config.brightness < 0.85 ? ` brightness(${0.8 + config.brightness * 0.2})` : ''}`,
      opacity: effectiveOpacity,
      transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
    };

    if (isGradient) {
      style.background = config.wallpaperURL;
    } else if (config.wallpaperURL) {
      style.backgroundImage = `url(${config.wallpaperURL})`;
      style.backgroundPosition = `${config.cropPosition.x}% ${config.cropPosition.y}%`;
      style.backgroundSize = config.cropPosition.zoom === 1 ? 'cover' : `${config.cropPosition.zoom * 100}%`;
      style.backgroundRepeat = 'no-repeat';
    } else {
      // Default fallback background if none configured
      style.background = isLight
        ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)'
        : 'linear-gradient(135deg, rgba(14, 12, 17, 1) 0%, rgba(20, 10, 32, 1) 50%, rgba(8, 14, 20, 1) 100%)';
    }

    return style;
  }, [config.wallpaperURL, config.blurLevel, config.brightness, config.cropPosition, offset, isLight]);

  // Effect overlays render
  const renderEffect = () => {
    switch (config.effectType) {
      case 'cyber-grid':
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" style={{ zIndex: 1 }}>
            {/* Perspective Animated Cyberpunk Grid */}
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(to right, rgba(0, 242, 255, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 242, 255, 0.15) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                transform: 'perspective(500px) rotateX(60deg) translateY(-20%)',
                transformOrigin: 'top center',
                height: '150%',
                animation: 'cyberGridScroll 20s linear infinite'
              }}
            />
            {/* Scanning Laser Line */}
            <motion.div 
              animate={{ translateY: ['0%', '100%'] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-aeirmist-cyan/45 to-transparent shadow-[0_0_15px_#00f2ff]"
            />
          </div>
        );

      case 'liquid-neon':
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30" style={{ zIndex: 1 }}>
            {/* Animating fluid lava-lamp style blobs */}
            <motion.div 
              animate={{ 
                x: [0, 80, -40, 0],
                y: [0, -90, 60, 0],
                scale: [1, 1.25, 0.85, 1]
              }}
              transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-1/4 -left-1/4 w-[80%] h-[80%] rounded-full bg-aeirmist-cyan/35 blur-[120px]"
            />
            <motion.div 
              animate={{ 
                x: [0, -100, 50, 0],
                y: [0, 80, -70, 0],
                scale: [1, 0.9, 1.2, 1]
              }}
              transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-1/4 -right-1/4 w-[80%] h-[80%] rounded-full bg-aeirmist-magenta/30 blur-[120px]"
            />
            <motion.div 
              animate={{ 
                opacity: [0.1, 0.3, 0.1]
              }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-1/3 left-1/3 w-[40%] h-[40%] rounded-full bg-aeirmist-lime/20 blur-[100px]"
            />
          </div>
        );

      case 'matrix-rain':
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-15" style={{ zIndex: 1 }}>
            {/* High-speed sliding code drop lines */}
            <div className="absolute inset-x-0 top-0 h-full flex justify-between px-2 text-aeirmist-lime font-mono text-[7px] leading-none select-none">
              {Array.from({ length: 15 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: -500 }}
                  animate={{ y: '100vh' }}
                  transition={{
                    duration: 4 + Math.random() * 8,
                    repeat: Infinity,
                    ease: 'linear',
                    delay: Math.random() * 5
                  }}
                  className="writing-mode-vertical"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  {Array.from({ length: 25 }).map(() => String.fromCharCode(33 + Math.floor(Math.random() * 93))).join('')}
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'neon-glow':
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
            {/* Subtle glow aligned around borders */}
            <div 
              className="absolute inset-0 border border-aeirmist-cyan/20 ring-4 ring-aeirmist-magenta/5 rounded-[24px]"
              style={{
                boxShadow: `inset 0 0 40px rgba(0, 242, 255, ${0.1 * config.neonIntensity}), 0 0 30px rgba(255, 0, 234, ${0.05 * config.neonIntensity})`
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div 
      id="chat-wallpaper-system-layer" 
      data-wallpaper-layer="true"
      className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none z-0" 
    >
      {/* Background Underlay Color */}
      <div 
        className={`absolute inset-0 transition-colors duration-500 ${
          config.wallpaperURL 
            ? 'bg-transparent' 
            : (isLight ? 'bg-slate-100' : 'bg-aeirmist-bg')
        }`} 
      />

      {/* Main Wallpaper Image / Gradient */}
      <div 
        className="absolute inset-0 transition-all duration-700 pointer-events-none" 
        style={backgroundStyle} 
      />

      {/* Customizable Colored Overlay Tint */}
      <div 
        className="absolute inset-0 transition-opacity duration-500 pointer-events-none" 
        style={{
          backgroundColor: config.overlayColor,
          opacity: isLight 
            ? (config.brightness < 0.85 ? Math.max(0, (0.85 - config.brightness) * 0.35) : 0)
            : Math.max(0, 1 - config.brightness),
        }} 
      />

      {/* Animated Futuristic Effect */}
      {renderEffect()}

      {/* Inject Cyber Grid Scroll Keyframes once */}
      <style>{`
        @keyframes cyberGridScroll {
          0% {
            background-position: 0px 0px;
          }
          100% {
            background-position: 0px 800px;
          }
        }
      `}</style>
    </div>
  );
});

ChatWallpaperLayer.displayName = 'ChatWallpaperLayer';
