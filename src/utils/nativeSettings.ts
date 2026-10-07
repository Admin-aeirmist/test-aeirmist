import { registerPlugin } from '@capacitor/core';
import { logger } from './logger';

interface NativeSettingsPlugin {
  openNotificationSettings(): Promise<void>;
  openAppPermissionSettings(): Promise<void>;
  requestNotificationPermission(): Promise<{ granted: boolean; requested?: boolean; alreadyGranted?: boolean }>;
  checkNotificationPermission(): Promise<{ granted: boolean }>;
  checkLocationPermission(): Promise<{ granted: boolean; fine?: boolean; coarse?: boolean }>;
  requestLocationPermission(): Promise<{ granted: boolean; fine?: boolean; coarse?: boolean; alreadyGranted?: boolean; requested?: boolean }>;
  showDeviceNotification(options: {
    title: string;
    body: string;
    id?: number;
    avatarUrl?: string;
    targetUrl?: string;
    type?: string;
  }): Promise<{ success: boolean; id?: number }>;
  checkCallPermissions(options: { type: 'audio' | 'video' }): Promise<{ granted: boolean; microphone: boolean; camera: boolean; type: string }>;
  requestCallPermissions(options: { type: 'audio' | 'video' }): Promise<{ alreadyGranted: boolean; requestedCount?: number; type: string; success: boolean; granted?: boolean; microphone?: boolean; camera?: boolean }>;
  getSystemInsets(): Promise<{ top: number; bottom: number }>;
  setAudioMode(options: { mode: 'communication' | 'normal'; speaker?: boolean }): Promise<void>;
  saveMediaToDevice(options: { url: string; filename?: string }): Promise<{ success: boolean; filename?: string; message?: string }>;
  checkOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<void>;
  enableSystemChatHead(options: { heads: string }): Promise<void>;
  disableSystemChatHead(): Promise<void>;
  updateSystemChatHead(options: { name?: string; avatarUrl?: string; unread?: number }): Promise<void>;
}

export const NativeSettings = registerPlugin<NativeSettingsPlugin>('NativeSettings');

const isNativeAndroid = () =>
  typeof window !== 'undefined' &&
  !!(window as any).Capacitor?.isNativePlatform?.() &&
  (window as any).Capacitor?.getPlatform?.() === 'android';

/** System-wide chat head (draws over other apps). All calls are safe no-ops on web/iOS. */
export const SystemChatHead = {
  isSupported: isNativeAndroid,
  async hasPermission(): Promise<boolean> {
    if (!isNativeAndroid()) return false;
    try { return (await NativeSettings.checkOverlayPermission()).granted; } catch { return false; }
  },
  async requestPermission(): Promise<void> {
    if (!isNativeAndroid()) return;
    try { await NativeSettings.requestOverlayPermission(); } catch {}
  },
  async enable(opts: { heads: string }): Promise<boolean> {
    if (!isNativeAndroid()) return false;
    try { await NativeSettings.enableSystemChatHead(opts); return true; } catch { return false; }
  },
  async disable(): Promise<void> {
    if (!isNativeAndroid()) return;
    try { await NativeSettings.disableSystemChatHead(); } catch {}
  },
  async update(opts: { name?: string; avatarUrl?: string; unread?: number }): Promise<void> {
    if (!isNativeAndroid()) return;
    try { await NativeSettings.updateSystemChatHead(opts); } catch {}
  },
};

export interface SystemNotificationOptions {
  title: string;
  body: string;
  avatarUrl?: string;
  targetUrl?: string;
  type?: string;
  tag?: string;
  id?: number;
}

/**
 * Dispatches a system/device notification across all platforms:
 * - Native Android/iOS: Posts directly to Android NotificationManager with sound & heads-up banner.
 * - Desktop/Web: Uses Web Notification API and Service Worker.
 */
export const showSystemNotification = async (options: SystemNotificationOptions): Promise<void> => {
  if (typeof window === 'undefined') return;

  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

  // 1. Android / iOS Native Capacitor App
  if (isNative) {
    try {
      await NativeSettings.showDeviceNotification({
        title: options.title,
        body: options.body,
        avatarUrl: options.avatarUrl,
        targetUrl: options.targetUrl,
        type: options.type,
        id: options.id,
      });
      return;
    } catch (e) {
      logger.warn('[NativeSettings] showDeviceNotification native failed:', e);
    }
  }

  // 2. Desktop & Mobile Browser Web Notification Fallback
  if ('Notification' in window && Notification.permission === 'granted') {
    const notifOptions: NotificationOptions & { renotify?: boolean } = {
      body: options.body,
      icon: options.avatarUrl || '/icons/icon-192x192.png',
      badge: options.avatarUrl || '/icons/icon-192x192.png',
      tag: options.tag || String(Date.now()),
      renotify: true,
      data: {
        url: options.targetUrl || '/'
      }
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(options.title, notifOptions);
      }).catch(() => {
        try {
          new Notification(options.title, notifOptions);
        } catch (e) {
          logger.warn('[NativeSettings] Browser SW showNotification fallback failed:', e);
        }
      });
    } else {
      try {
        new Notification(options.title, notifOptions);
      } catch (e) {
        logger.warn('[NativeSettings] Direct browser Notification failed:', e);
      }
    }
  }
};

/**
 * Checks whether the current runtime is a mobile/phone environment.
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isCapacitorNative = !!(window as any).Capacitor?.isNativePlatform?.();
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTouchScreen = window.innerWidth <= 768 || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
  return isCapacitorNative || isMobileUA || !!isTouchScreen;
};

/**
 * Directly requests native device notification permission, or opens device settings on mobile,
 * or triggers browser Notification.requestPermission() on desktop.
 */
export const handleNotificationPermissionFlow = async (
  addToast?: (toast: { title: string; message: string; type: 'success' | 'warning' | 'info' }) => void
): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  const isPhone = isMobileDevice();

  // 1. Native Mobile APK (Capacitor)
  if (isNative) {
    try {
      const res = await NativeSettings.requestNotificationPermission();
      if (res?.granted) {
        addToast?.({
          title: 'Notifications Allowed',
          message: 'Real-time device notifications are now active on your phone.',
          type: 'success'
        });
        return true;
      }
      // If user had previously permanently denied, open settings
      await NativeSettings.openNotificationSettings();
      addToast?.({
        title: 'Device Settings',
        message: 'Please allow notifications for Aeirmist in your phone settings.',
        type: 'info'
      });
      return true;
    } catch (nativeErr) {
      logger.warn('[NativeSettings] Native notification permission failed:', nativeErr);
    }
  }

  // 2. Phone Browser Environment
  if (isPhone) {
    try {
      // Try native Capacitor plugin first if inside native Android/iOS shell
      if ((window as any).Capacitor?.isNativePlatform?.()) {
        try {
          await NativeSettings.openNotificationSettings();
          addToast?.({
            title: 'Device Settings',
            message: 'Opening notification settings. Please allow notifications for Aeirmist.',
            type: 'info'
          });
          return true;
        } catch (nativeErr) {
          logger.warn('[NativeSettings] Native plugin call failed, using intent fallback:', nativeErr);
        }
      }

      // Android browser intent fallback
      if (/Android/i.test(navigator.userAgent)) {
        addToast?.({
          title: 'Device Settings',
          message: 'Opening app notification settings...',
          type: 'info'
        });
        window.location.href = 'intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=com.aeirmist.social;end';
        return true;
      }

      // iOS fallback
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        addToast?.({
          title: 'Device Settings',
          message: 'Opening settings. Please allow notifications for Aeirmist.',
          type: 'info'
        });
        window.location.href = 'app-settings:';
        return true;
      }
    } catch (err) {
      logger.error('[NativeSettings] Failed to open mobile settings:', err);
    }

    if ('Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        if (res === 'granted') {
          addToast?.({
            title: 'Notifications Allowed',
            message: 'Push notifications are now enabled on your device.',
            type: 'success'
          });
          return true;
        }
      } catch (e) {}
    }

    addToast?.({
      title: 'Enable Notifications',
      message: 'Please enable notifications in your phone Settings -> Apps -> Aeirmist.',
      type: 'info'
    });
    return false;
  }

  // 2. Desktop Browser Environment
  if ('Notification' in window) {
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        addToast?.({
          title: 'Notifications Enabled',
          message: 'Real-time push notifications are now active.',
          type: 'success'
        });
        return true;
      } else if (result === 'denied') {
        addToast?.({
          title: 'Permission Blocked',
          message: 'Notifications are blocked in your browser. Click the site settings/lock icon in your address bar to allow.',
          type: 'warning'
        });
        return false;
      } else {
        return false;
      }
    } catch (err) {
      logger.error('[NativeSettings] Desktop requestPermission failed:', err);
    }
  } else {
    addToast?.({
      title: 'Unsupported',
      message: 'Your desktop browser does not support Web Notifications.',
      type: 'warning'
    });
  }

  return false;
};

/**
 * Opens native App details / permission settings page.
 */
export const openAppPermissionSettings = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      await NativeSettings.openAppPermissionSettings();
      return;
    } catch (e) {
      logger.warn('[NativeSettings] openAppPermissionSettings failed:', e);
    }
  }
};

/**
 * Checks location permission on Android native or Web.
 */
export const checkLocationPermission = async (): Promise<{ granted: boolean; fine?: boolean; coarse?: boolean }> => {
  if (typeof window === 'undefined') return { granted: false };
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      return await NativeSettings.checkLocationPermission();
    } catch (e) {
      logger.warn('[NativeSettings] checkLocationPermission native call failed:', e);
    }
  }
  if ('permissions' in navigator && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return { granted: status.state === 'granted' };
    } catch (e) {
      logger.warn('[NativeSettings] checkLocationPermission query failed:', e);
    }
  }
  return { granted: false };
};

/**
 * Requests location permission on Android native.
 */
export const requestLocationPermission = async (): Promise<{ granted: boolean; fine?: boolean; coarse?: boolean }> => {
  if (typeof window === 'undefined') return { granted: false };
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      return await NativeSettings.requestLocationPermission();
    } catch (e) {
      logger.warn('[NativeSettings] requestLocationPermission native call failed:', e);
    }
  }
  return { granted: false };
};

/**
 * Checks notification permission on Android native or Web.
 */
export const checkNotificationPermission = async (): Promise<{ granted: boolean }> => {
  if (typeof window === 'undefined') return { granted: false };
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      return await NativeSettings.checkNotificationPermission();
    } catch (e) {
      logger.warn('[NativeSettings] checkNotificationPermission native call failed:', e);
    }
  }
  if ('Notification' in window) {
    return { granted: Notification.permission === 'granted' };
  }
  return { granted: false };
};

/**
 * Requests notification permission on Android native or Web.
 */
export const requestNotificationPermission = async (): Promise<{ granted: boolean }> => {
  if (typeof window === 'undefined') return { granted: false };
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      const res = await NativeSettings.requestNotificationPermission();
      return { granted: !!res?.granted };
    } catch (e) {
      logger.warn('[NativeSettings] requestNotificationPermission native call failed:', e);
    }
  }
  if ('Notification' in window) {
    try {
      const res = await Notification.requestPermission();
      return { granted: res === 'granted' };
    } catch (e) {
      logger.warn('[NativeSettings] requestNotificationPermission browser call failed:', e);
    }
  }
  return { granted: false };
};
