import React, { useEffect, useState } from 'react';
import { useAppearance } from '../../context/AppearanceContext';
import { observePerformanceProfile, PerformanceProfile } from '../../utils/performanceEngine';

export const AdaptiveEngine: React.FC = () => {
  const { settings } = useAppearance();
  const [networkStatus, setNetworkStatus] = useState<'fast' | 'slow' | 'offline'>('fast');
  const [batteryStatus, setBatteryStatus] = useState<{ charging: boolean; level: number; lowPowerMode: boolean }>({
    charging: true,
    level: 1,
    lowPowerMode: false,
  });

  useEffect(() => {
    // Adaptive device/network performance profile. This is intentionally lightweight:
    // it changes rendering policy, not application behavior or Firebase data flow.
    const stopPerformanceObserver = observePerformanceProfile((_profile: PerformanceProfile) => {
      // Dynamic rendering profile classes (device-lite, adaptive-reduced-motion, etc.)
      // are applied non-destructively to document.documentElement without overwriting user preferences.
    });

    // 1. Network Awareness Monitoring
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const updateNetwork = () => {
      if (!navigator.onLine) {
        setNetworkStatus('offline');
        return;
      }
      if (conn) {
        const isSlow = conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g';
        setNetworkStatus(isSlow ? 'slow' : 'fast');
      } else {
        setNetworkStatus('fast');
      }
    };

    updateNetwork();
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', updateNetwork);
    }

    // 2. Battery Awareness Monitoring
    let batteryObj: any = null;
    const handleBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          batteryObj = await (navigator as any).getBattery();
          const updateBat = () => {
            const charging = batteryObj.charging;
            const level = batteryObj.level;
            // If battery is low (< 20%) and not charging, activate battery saver mode
            const lowPowerMode = !charging && level <= 0.20;
            setBatteryStatus({ charging, level, lowPowerMode });

            // Apply system-low-power dynamically to document without altering saved user preferences
            document.documentElement.classList.toggle('system-low-power', lowPowerMode);
          };

          updateBat();
          batteryObj.addEventListener('chargingchange', updateBat);
          batteryObj.addEventListener('levelchange', updateBat);
        }
      } catch (e) {
        // Battery API not supported or blocked
      }
    };

    handleBattery();

    // 3. System Theme & Color Scheme Synchronization
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (settings.themeMode === 'system') {
        const root = document.documentElement;
        if (e.matches) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // 4. Large Display & Tablet orientation / resize listener classes on root html
    const handleResize = () => {
      const width = window.innerWidth;
      const root = document.documentElement;
      root.classList.remove('device-mobile', 'device-tablet', 'device-desktop', 'device-ultrawide');
      if (width < 768) {
        root.classList.add('device-mobile');
      } else if (width >= 768 && width < 1024) {
        root.classList.add('device-tablet');
      } else if (width >= 1024 && width < 1536) {
        root.classList.add('device-desktop');
      } else {
        root.classList.add('device-ultrawide');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      stopPerformanceObserver();
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', updateNetwork);
      }
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      window.removeEventListener('resize', handleResize);
      document.documentElement.classList.remove('system-low-power');
    };
  }, [settings.themeMode, settings.performanceMode]);

  return null;
};
