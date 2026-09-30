import React, { useEffect, useState } from 'react';
import { useAeirmist } from '../../context/AeirmistContext';

interface AeirmistLogoProps {
  className?: string;
  glow?: boolean;
  glowStrength?: 'weak' | 'normal' | 'strong';
  variant?: 'compact' | 'full' | 'text-only';
  colorClass?: string;
}

const getCustomLogoUrl = (appBranding: any, isLight: boolean): string => {
  if (appBranding) {
    const url = isLight 
      ? (appBranding.lightLogoUrl || appBranding.darkLogoUrl)
      : (appBranding.darkLogoUrl || appBranding.lightLogoUrl);
    if (url && typeof url === 'string' && url.trim() !== '') return url;
  }
  if (typeof window !== 'undefined') {
    try {
      const direct = localStorage.getItem('aeirmist_custom_logo');
      if (direct && direct.trim() !== '') return direct;

      const cachedStr = localStorage.getItem('aeirmist_app_branding');
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        const cachedUrl = isLight 
          ? (cached.lightLogoUrl || cached.darkLogoUrl)
          : (cached.darkLogoUrl || cached.lightLogoUrl);
        if (cachedUrl && typeof cachedUrl === 'string' && cachedUrl.trim() !== '') return cachedUrl;
      }
    } catch (e) {}
  }
  return '/custom_uploaded_logo.png';
};

export const AeirmistSymbol: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
  const [isLight, setIsLight] = useState(false);

  let appBranding: any = null;
  try {
    const context = useAeirmist();
    appBranding = context?.appBranding;
  } catch (e) {}

  useEffect(() => {
    const checkTheme = () => {
      const lightActive = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
      setIsLight(lightActive);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    if (typeof document !== 'undefined') {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
    return () => observer.disconnect();
  }, []);

  const logoSrc = getCustomLogoUrl(appBranding, isLight);

  return (
    <img 
      src={logoSrc} 
      alt="Aeirmist App Logo" 
      className={`object-contain shrink-0 rounded-xl ${className || 'w-auto h-8'}`}
      style={style}
    />
  );
};

export const AeirmistLogo: React.FC<AeirmistLogoProps> = ({
  className = "w-auto h-[40px]",
  glow = true,
  glowStrength = 'normal',
  variant = 'full',
  colorClass = ""
}) => {
  const [isLight, setIsLight] = useState(false);

  let appBranding: any = null;
  try {
    const context = useAeirmist();
    appBranding = context?.appBranding;
  } catch (e) {}

  useEffect(() => {
    const checkTheme = () => {
      const lightActive = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
      setIsLight(lightActive);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    if (typeof document !== 'undefined') {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
    return () => observer.disconnect();
  }, []);

  const logoSrc = getCustomLogoUrl(appBranding, isLight);

  const glowStyles = glow 
    ? glowStrength === 'strong'
      ? { filter: 'drop-shadow(0 0 15px rgba(0, 191, 255, 0.8))' }
      : glowStrength === 'weak'
        ? { filter: 'drop-shadow(0 0 5px rgba(0, 191, 255, 0.3))' }
        : { filter: 'drop-shadow(0 0 10px rgba(0, 191, 255, 0.5))' }
    : undefined;

  const textGlowStyles = glow 
    ? glowStrength === 'strong'
      ? { textShadow: '0 0 8px rgba(0, 242, 255, 0.6)' }
      : glowStrength === 'weak'
        ? { textShadow: '0 0 3px rgba(0, 242, 255, 0.3)' }
        : { textShadow: '0 0 5px rgba(0, 242, 255, 0.45)' }
    : undefined;

  const AeirmistText = (style?: React.CSSProperties) => (
    <span
      className={`font-display tracking-[0.25em] font-black text-base sm:text-lg uppercase whitespace-nowrap antialiased text-[#ccebff] ${colorClass}`}
      style={{ ...style, ...textGlowStyles }}
    >
      ΛEIRMIST
    </span>
  );

  if (variant === 'text-only') {
    return (
      <div className={`${className} flex items-center justify-center`}>
        {AeirmistText()}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`shrink-0 flex items-center justify-center ${className}`}>
        <img 
          src={logoSrc} 
          alt="Main App Logo" 
          className="max-h-full max-w-full object-contain shrink-0 rounded-2xl transition-transform duration-300 hover:scale-105 drop-shadow-[0_0_15px_rgba(0,242,255,0.4)]"
          style={glowStyles}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="shrink-0 flex items-center justify-center h-full">
        <img 
          src={logoSrc} 
          alt="Main App Logo" 
          className="max-h-full max-w-full object-contain shrink-0 rounded-2xl transition-transform duration-300 hover:scale-105 drop-shadow-[0_0_15px_rgba(0,242,255,0.4)]"
          style={glowStyles}
        />
      </div>
      <div className="flex items-center">
        {AeirmistText()}
      </div>
    </div>
  );
};
