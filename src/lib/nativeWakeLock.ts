import { Capacitor } from '@capacitor/core';

export const setNativeScreenKeepOn = async (enabled: boolean): Promise<void> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const plugin = ((Capacitor as any).Plugins)?.NativeSettings;
      if (plugin?.setKeepScreenOn) {
        await plugin.setKeepScreenOn({ enabled });
        return;
      }
    }
    // Web WakeLock fallback if supported in modern browsers
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      if (enabled) {
        (navigator as any).wakeLock?.request?.('screen').catch(() => {});
      }
    }
  } catch {}
};
