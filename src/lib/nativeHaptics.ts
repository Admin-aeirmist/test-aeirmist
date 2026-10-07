import { Capacitor } from '@capacitor/core';

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'double_click' | 'tick';

export const triggerNativeHaptic = (type: HapticType = 'light'): void => {
  try {
    if (Capacitor.isNativePlatform()) {
      const plugin = ((Capacitor as any).Plugins)?.NativeSettings;
      if (plugin?.performHaptics) {
        plugin.performHaptics({ type }).catch(() => {});
        return;
      }
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'heavy') navigator.vibrate(35);
      else if (type === 'medium') navigator.vibrate(22);
      else if (type === 'success') navigator.vibrate([15, 60, 25]);
      else navigator.vibrate(12);
    }
  } catch {}
};
