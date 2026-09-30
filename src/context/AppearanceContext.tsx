import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAeirmist } from './AeirmistContext';
import { logger } from '@/src/utils/logger';


export interface AppearanceSettingsConfig {
  themeMode: 'dark' | 'light' | 'system';
  accentColor: 'cyan' | 'blue' | 'purple' | 'emerald' | 'orange' | 'red';
  
  // Section 3: Global App Background
  globalBgType: 'none' | 'gradient' | 'solid' | 'custom';
  globalBgValue: string; // HEX, CSS gradient string, or compressed Base64 image/video URL
  globalBgDisplay: 'center' | 'fill' | 'fit' | 'stretch' | 'tile';
  globalBgOpacity: number; // 0 to 100
  globalBgBlur: number; // 0 to 30 (pixels)
  globalBgOverlay: number; // 0 to 80 (dark overlay %)
  globalBgMotion: boolean; // Parallax (desktop only)
  globalBgRotation: 'off' | 'daily' | 'weekly' | 'random';
  globalBgAnimated: boolean; // GIF/Video
  globalBgList: string[]; // List of wallpapers for rotation
  
  // Section 4: Layout Density
  density: 'comfortable' | 'compact' | 'spacious';
  
  // Section 5: Font Size
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  
  // Section 6: Card Style
  cornerStyle: 'rounded' | 'medium' | 'sharp';
  
  // Section 7: Motion
  enableAnimations: boolean;
  reduceMotion: boolean;
  smoothTransitions: boolean;
  hoverEffects: boolean;
  
  // Section 8: Glass Effect
  enableGlassEffect: boolean;
  cardBlur: number; // 0 to 30px
  backgroundTransparency: number; // 0 to 100 (inverse: high means higher opacity, low means more transparent)
  
  // Section 9: Feed Appearance
  mediaPreviewSize: 'small' | 'medium' | 'large';
  roundedMedia: boolean;
  autoplayVideos: 'always' | 'wifi' | 'never';
  
  // Section 10: Accessibility
  highContrast: boolean;
  largeButtons: boolean;
  improveReadability: boolean;
  colorBlindFriendly: boolean;
  
  // Section 11: Language & Region
  language: string;
  timeFormat: '12h' | '24h';
  dateFormat: 'auto' | 'regional';
  
  // Section 12: Performance
  performanceMode: boolean;

  // New layout and interface parameters
  interfaceScale: number; // 80 to 120 (%)
  desktopSidebarMode: 'pinned' | 'hover';
  compactSidebar: boolean;
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettingsConfig = {
  themeMode: 'dark',
  accentColor: 'cyan',
  
  globalBgType: 'none',
  globalBgValue: '',
  globalBgDisplay: 'fill',
  globalBgOpacity: 100,
  globalBgBlur: 0,
  globalBgOverlay: 45,
  globalBgMotion: false,
  globalBgRotation: 'off',
  globalBgAnimated: true,
  globalBgList: [],
  
  density: 'comfortable',
  fontSize: 'medium',
  cornerStyle: 'rounded',
  
  enableAnimations: true,
  reduceMotion: false,
  smoothTransitions: true,
  hoverEffects: true,
  
  enableGlassEffect: true,
  cardBlur: 16,
  backgroundTransparency: 15, // 15% opacity
  
  mediaPreviewSize: 'medium',
  roundedMedia: true,
  autoplayVideos: 'always',
  
  highContrast: false,
  largeButtons: false,
  improveReadability: false,
  colorBlindFriendly: false,
  
  language: 'en',
  timeFormat: '12h',
  dateFormat: 'auto',
  
  performanceMode: false,
  interfaceScale: 100,
  desktopSidebarMode: 'hover',
  compactSidebar: false,
};

interface AppearanceContextType {
  settings: AppearanceSettingsConfig;
  updateAppearanceSettings: (newSettings: Partial<AppearanceSettingsConfig>) => Promise<void>;
  resetAppearanceSettings: () => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, updateProfile, addToast } = useAeirmist();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLocallyModifiedRef = useRef<boolean>(false);

  // Load from local storage immediately for layout-shift prevention
  const [settings, setSettings] = useState<AppearanceSettingsConfig>(() => {
    try {
      const cached = localStorage.getItem('aeirmist_appearance_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        const isUserPinned = localStorage.getItem('aeirmist_sidebar_user_pinned') === 'true';
        return {
          ...DEFAULT_APPEARANCE_SETTINGS,
          ...parsed,
          desktopSidebarMode: isUserPinned ? (parsed.desktopSidebarMode || 'hover') : 'hover',
        };
      }
    } catch (e) {
      logger.warn('Failed to parse cached appearance settings', e);
    }
    return DEFAULT_APPEARANCE_SETTINGS;
  });

  // Keep in sync with user profile on Firestore on initial load if not locally modified in session
  useEffect(() => {
    if (profile?.appearanceSettings) {
      if (!isLocallyModifiedRef.current) {
        const isUserPinned = localStorage.getItem('aeirmist_sidebar_user_pinned') === 'true';
        setSettings((prev) => ({
          ...prev,
          ...profile.appearanceSettings,
          desktopSidebarMode: isUserPinned ? (profile.appearanceSettings.desktopSidebarMode || 'hover') : 'hover',
        }));
      }
    }
  }, [profile?.appearanceSettings]);

  // Handle Daily/Weekly/Random Global Background Rotation if configured
  useEffect(() => {
    if (settings.globalBgRotation === 'off' || !settings.globalBgList || settings.globalBgList.length === 0) {
      return;
    }

    const rotateWallpaper = () => {
      const list = settings.globalBgList;
      if (list.length <= 1) return;

      if (settings.globalBgRotation === 'random') {
        const randomIndex = Math.floor(Math.random() * list.length);
        if (list[randomIndex] !== settings.globalBgValue) {
          updateAppearanceSettings({ globalBgValue: list[randomIndex] });
        }
      } else {
        // Daily or Weekly rotation: determine index based on timestamps
        const timeBucket = settings.globalBgRotation === 'daily' 
          ? Math.floor(Date.now() / (1000 * 60 * 60 * 24)) // days since epoch
          : Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7)); // weeks since epoch

        const index = timeBucket % list.length;
        if (list[index] !== settings.globalBgValue) {
          updateAppearanceSettings({ globalBgValue: list[index] });
        }
      }
    };

    rotateWallpaper();
    // Re-check periodically
    const interval = setInterval(rotateWallpaper, 1000 * 60 * 60); // every hour
    return () => clearInterval(interval);
  }, [settings.globalBgRotation, settings.globalBgList]);

  // Apply visual settings side-effects dynamically
  useEffect(() => {
    const root = document.documentElement;

    // 1. Theme Mode
    const handleThemeMode = () => {
      let isLight = false;
      if (settings.themeMode === 'light') {
        isLight = true;
      } else if (settings.themeMode === 'system') {
        isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      } else {
        isLight = false; // default to dark sanctuary experience
      }

      if (isLight) {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
      }
    };
    handleThemeMode();

    // System theme change listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemChange = () => {
      if (settings.themeMode === 'system') {
        handleThemeMode();
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    // 2. Accent Color Map
    const colorMap: Record<string, string> = {
      cyan: '#00f2ff',
      blue: '#3b82f6',
      purple: '#a855f7',
      emerald: '#10b981',
      orange: '#f97316',
      red: '#ef4444',
    };
    const hex = colorMap[settings.accentColor] || '#00f2ff';
    root.style.setProperty('--color-aeirmist-cyan', hex);
    root.style.setProperty('--color-aura-cyan', hex);
    root.style.setProperty('--accent-color', hex);
    root.style.setProperty('--color-accent', hex);

    // 3. Layout Density Class
    root.classList.remove('density-comfortable', 'density-compact', 'density-spacious');
    root.classList.add(`density-${settings.density}`);

    // 4. Font Size Scale Map
    const fontSizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px',
      xlarge: '20px',
    };
    root.style.fontSize = fontSizeMap[settings.fontSize] || '16px';

    // 5. Corner Style Class
    root.classList.remove('corner-rounded', 'corner-medium', 'corner-sharp');
    root.classList.add(`corner-${settings.cornerStyle}`);

    // 6. Motion & Animations (Performance Mode forces reduction)
    const isMotionReduced = settings.reduceMotion || !settings.enableAnimations || settings.performanceMode;
    if (isMotionReduced) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    const isHoverDisabled = !settings.hoverEffects || settings.performanceMode;
    if (isHoverDisabled) {
      root.classList.add('hover-effects-disabled');
    } else {
      root.classList.remove('hover-effects-disabled');
    }

    // 7. Glass Overrides (Performance Mode completely disables backdrop filters)
    const isGlassDisabled = !settings.enableGlassEffect || settings.performanceMode;
    if (isGlassDisabled) {
      root.classList.add('blur-disabled');
    } else {
      root.classList.remove('blur-disabled');
    }

    // 8. Accessibility Classes
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (settings.largeButtons) {
      root.classList.add('large-buttons-enabled');
    } else {
      root.classList.remove('large-buttons-enabled');
    }

    if (settings.improveReadability) {
      root.classList.add('improve-readability');
    } else {
      root.classList.remove('improve-readability');
    }

    if (settings.colorBlindFriendly) {
      root.classList.add('color-blind-friendly');
    } else {
      root.classList.remove('color-blind-friendly');
    }

    if (settings.globalBgType && settings.globalBgType !== 'none') {
      root.classList.add('has-global-bg');
    } else {
      root.classList.remove('has-global-bg');
    }

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [settings]);

  // Dynamic CSS Injector for Layout Density, Glass Shading, and Custom Corner Curves
  useEffect(() => {
    let styleTag = document.getElementById('aeirmist-appearance-overrides');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'aeirmist-appearance-overrides';
      document.head.appendChild(styleTag);
    }

    // Render transparent alpha values based on theme mode
    const isLight = rootIsLight();
    const colorMap: Record<string, string> = {
      cyan: '#00f2ff',
      blue: '#3b82f6',
      purple: '#a855f7',
      emerald: '#10b981',
      orange: '#f97316',
      red: '#ef4444',
    };
    const hex = colorMap[settings.accentColor] || '#00f2ff';
    const glassBgBase = isLight ? '255, 255, 255' : '15, 15, 25';
    const glassTransparencyVal = (settings.enableGlassEffect && !settings.performanceMode) 
      ? Math.max(0.04, Math.min(1, (settings.backgroundTransparency ?? 15) / 100)) 
      : 0.95; // solid backup
    const glassBlurVal = settings.enableGlassEffect && !settings.performanceMode ? (settings.cardBlur ?? 16) : 0;
    const darkOverlayOpacity = Math.max(0, Math.min(0.85, (settings.globalBgOverlay ?? 45) / 100));

    styleTag.innerHTML = `
      :root {
        --color-aeirmist-cyan: ${hex} !important;
        --color-aura-cyan: ${hex} !important;
        --accent-color: ${hex} !important;
        --glass-blur: ${glassBlurVal}px !important;
        --glass-bg: rgba(${glassBgBase}, ${glassTransparencyVal}) !important;
        --panel-opacity: ${glassTransparencyVal} !important;
        --global-dim-opacity: ${darkOverlayOpacity} !important;
        ${settings.compactSidebar ? '--sidebar-w: 72px !important; --sidebar-w-collapsed: 72px !important;' : ''}
      }

      body {
        zoom: ${(settings.interfaceScale || 100) / 100} !important;
      }

      /* Spacing overrides for layout density */
      .density-compact .p-4, 
      .density-compact .p-6, 
      .density-compact .p-8 {
        padding: 0.75rem !important;
      }
      .density-compact .py-4, 
      .density-compact .py-6, 
      .density-compact .py-8 {
        padding-top: 0.75rem !important;
        padding-bottom: 0.75rem !important;
      }
      .density-compact .px-4, 
      .density-compact .px-6, 
      .density-compact .px-8 {
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
      }
      .density-compact .space-y-4 > :not([hidden]) ~ :not([hidden]) {
        margin-top: 0.75rem !important;
      }
      .density-compact .space-y-6 > :not([hidden]) ~ :not([hidden]) {
        margin-top: 1rem !important;
      }

      .density-spacious .p-4, 
      .density-spacious .p-6, 
      .density-spacious .p-8 {
        padding: 1.75rem !important;
      }
      .density-spacious .py-4, 
      .density-spacious .py-6, 
      .density-spacious .py-8 {
        padding-top: 1.75rem !important;
        padding-bottom: 1.75rem !important;
      }
      .density-spacious .px-4, 
      .density-spacious .px-6, 
      .density-spacious .px-8 {
        padding-left: 1.75rem !important;
        padding-right: 1.75rem !important;
      }
      .density-spacious .space-y-4 > :not([hidden]) ~ :not([hidden]) {
        margin-top: 1.5rem !important;
      }
      .density-spacious .space-y-6 > :not([hidden]) ~ :not([hidden]) {
        margin-top: 2.25rem !important;
      }

      /* Corner Styles */
      .corner-sharp, .corner-sharp * {
        border-radius: 0px !important;
      }
      .corner-medium .glass-panel,
      .corner-medium .glass-card,
      .corner-medium .rounded-\\[2\\.5rem\\],
      .corner-medium .rounded-3xl,
      .corner-medium .rounded-2xl {
        border-radius: 12px !important;
      }
      .corner-medium button,
      .corner-medium input,
      .corner-medium select,
      .corner-medium .rounded-xl {
        border-radius: 8px !important;
      }

      /* Glass panel and messenger dynamic configuration */
      .messenger-sidebar-glass,
      .messenger-header-glass,
      .nav-sidebar-glass,
      .glass-panel, 
      .glass-card, 
      [class*="glass-"] {
        backdrop-filter: blur(var(--glass-blur)) !important;
        -webkit-backdrop-filter: blur(var(--glass-blur)) !important;
        background-color: var(--glass-bg) !important;
      }

      .aeirmist-dim-overlay {
        opacity: var(--global-dim-opacity) !important;
      }

      /* Motion Reduction overrides */
      .reduce-motion, .reduce-motion * {
        animation: none !important;
        transition: none !important;
        transition-duration: 0s !important;
        animation-duration: 0s !important;
      }
      .hover-effects-disabled *:hover {
        transform: none !important;
        box-shadow: none !important;
        scale: none !important;
      }

      /* Blur overrides */
      .blur-disabled, .blur-disabled * {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      /* Accessibility Styles */
      .high-contrast {
        --color-aeirmist-bg: #000000 !important;
      }
      .high-contrast .glass-panel,
      .high-contrast .glass-card {
        border: 2px solid #ffffff !important;
        background-color: #000000 !important;
      }
      .high-contrast text,
      .high-contrast span,
      .high-contrast p,
      .high-contrast h1,
      .high-contrast h2,
      .high-contrast h3,
      .high-contrast button {
        color: #ffffff !important;
        font-weight: 700 !important;
        text-shadow: none !important;
      }
      
      .large-buttons-enabled button,
      .large-buttons-enabled .btn {
        padding-top: 0.85rem !important;
        padding-bottom: 0.85rem !important;
        font-size: 1.1em !important;
        min-height: 48px !important;
      }
      
      .improve-readability p, 
      .improve-readability span, 
      .improve-readability text,
      .improve-readability div {
        font-weight: 500 !important;
        letter-spacing: 0.02em !important;
        line-height: 1.6 !important;
      }
    `;
  }, [settings]);

  const rootIsLight = (): boolean => {
    if (settings.themeMode === 'light') return true;
    if (settings.themeMode === 'system') {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    return false;
  };

  const updateAppearanceSettings = async (newSettings: Partial<AppearanceSettingsConfig>) => {
    isLocallyModifiedRef.current = true;
    
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('aeirmist_appearance_settings', JSON.stringify(updated));
      } catch (e) {
        logger.warn('Failed to save appearance settings to localStorage', e);
      }
      return updated;
    });

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (profile && updateProfile) {
        try {
          const cached = localStorage.getItem('aeirmist_appearance_settings');
          if (cached) {
            const parsed = JSON.parse(cached);
            const sanitized = { ...parsed };
            if (sanitized.globalBgValue?.startsWith('blob:')) {
              delete sanitized.globalBgValue;
            }
            if (Array.isArray(sanitized.globalBgList)) {
              sanitized.globalBgList = sanitized.globalBgList.filter((url: string) => !url.startsWith('blob:'));
            }
            await updateProfile({ appearanceSettings: sanitized }).catch((err: any) => {
              logger.warn('[AppearanceContext] Background save note:', err?.message || err);
            });
          }
        } catch (e: any) {
          logger.warn('[AppearanceContext] Debounced save error:', e);
        }
      }
    }, 1000);
  };

  const resetAppearanceSettings = async () => {
    isLocallyModifiedRef.current = true;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    setSettings(DEFAULT_APPEARANCE_SETTINGS);
    
    try {
      localStorage.setItem('aeirmist_appearance_settings', JSON.stringify(DEFAULT_APPEARANCE_SETTINGS));
      
      if (profile && updateProfile) {
        try {
          await updateProfile({ appearanceSettings: DEFAULT_APPEARANCE_SETTINGS });
        } catch (e) {
          logger.warn('Reset sync failed:', e);
        }
      }
    } catch (e) {
      logger.warn('Failed to reset appearance settings', e);
    }
  };

  return (
    <AppearanceContext.Provider value={{ settings, updateAppearanceSettings, resetAppearanceSettings }}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
};
