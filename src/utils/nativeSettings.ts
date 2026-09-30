import { registerPlugin } from '@capacitor/core';
import { logger } from './logger';

interface NativeSettingsPlugin {
  openNotificationSettings(): Promise<void>;
  requestNotificationPermission(): Promise<void>;
  requestAllPermissions(): Promise<{ requestedCount?: number; success: boolean }>;
  checkCallPermissions(options: { type: 'audio' | 'video' }): Promise<{ granted: boolean; microphone: boolean; camera: boolean; type: string }>;
  requestCallPermissions(options: { type: 'audio' | 'video' }): Promise<{ alreadyGranted: boolean; requestedCount: number; type: string; success: boolean }>;
  setAudioMode(options: { mode: 'communication' | 'normal'; speaker?: boolean }): Promise<void>;
  saveMediaToDevice(options: { url: string; filename?: string }): Promise<{ success: boolean; filename?: string; message?: string }>;
}

export const NativeSettings = registerPlugin<NativeSettingsPlugin>('NativeSettings');

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
 * Directly opens the device notification settings on mobile/phone,
 * or triggers native browser Notification.requestPermission() on desktop.
 */
export const handleNotificationPermissionFlow = async (
  addToast?: (toast: { title: string; message: string; type: 'success' | 'warning' | 'info' }) => void
): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const isPhone = isMobileDevice();

  // 1. Phone / Mobile Environment
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
 * Requests all core permissions simultaneously (Camera, Microphone, Location, Storage/Media, Notifications).
 * On Android Capacitor APK: Triggers native OS permission request dialog batch.
 * On Web: Sequentially requests Notification, Media (camera/mic), and Geolocation.
 */
export const requestAllCorePermissions = async (
  addToast?: (toast: { title: string; message: string; type: 'success' | 'warning' | 'info' }) => void
): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

  // 1. Native Android / iOS APK shell: Trigger native batch permissions dialog
  if (isNative) {
    try {
      const res = await NativeSettings.requestAllPermissions();
      addToast?.({
        title: 'Permissions Requested',
        message: 'Please grant Camera, Mic, Location, Storage & Notification access when prompted.',
        type: 'info'
      });
      return res.success;
    } catch (nativeErr) {
      logger.warn('[NativeSettings] requestAllPermissions fallback:', nativeErr);
    }
  }

  // 2. Web Browser Fallback: Prompt user sequentially
  let allGranted = true;

  // A. Notifications
  if ('Notification' in window) {
    try {
      const notifStatus = await Notification.requestPermission();
      if (notifStatus !== 'granted') allGranted = false;
    } catch (e) {
      logger.warn('[Permissions] Web notification request failed:', e);
    }
  }

  // B. Camera & Microphone
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (e) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getTracks().forEach(track => track.stop());
      } catch (audioErr) {
        logger.warn('[Permissions] Web audio/video request denied:', audioErr);
        allGranted = false;
      }
    }
  }

  // C. Geolocation
  if ('geolocation' in navigator) {
    try {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          () => { allGranted = false; resolve(); },
          { timeout: 8000 }
        );
      });
    } catch (e) {
      logger.warn('[Permissions] Web location request failed:', e);
    }
  }

  if (allGranted) {
    addToast?.({
      title: 'Access Granted',
      message: 'Camera, Microphone, Location, and Notifications enabled successfully.',
      type: 'success'
    });
  } else {
    addToast?.({
      title: 'Permissions Updated',
      message: 'Some permissions may be pending. You can enable them anytime from device settings.',
      type: 'info'
    });
  }

  return allGranted;
};
