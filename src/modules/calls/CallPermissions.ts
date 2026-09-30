import { NativeSettings } from '@/src/utils/nativeSettings';
import { logger } from '@/src/utils/logger';

let inFlightPermissionPromise: Promise<boolean> | null = null;

export interface CallPermissionState {
  granted: boolean;
  microphone: boolean;
  camera: boolean;
}

/**
 * Checks current permission state without triggering any OS prompt or hardware access.
 */
export async function checkCallPermissionState(type: 'audio' | 'video'): Promise<CallPermissionState> {
  const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

  if (isNative) {
    try {
      const res = await NativeSettings.checkCallPermissions({ type });
      return {
        granted: res.granted,
        microphone: res.microphone,
        camera: res.camera
      };
    } catch (e) {
      logger.warn('[CallPermissions] Native checkCallPermissions failed, fallback to web query', e);
    }
  }

  // Web query via Permissions API (non-intrusive)
  let microphone = false;
  let camera = false;

  try {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const micStatus = await navigator.permissions.query({ name: 'microphone' as any });
        microphone = micStatus.state === 'granted';
      } catch {}

      if (type === 'video') {
        try {
          const camStatus = await navigator.permissions.query({ name: 'camera' as any });
          camera = camStatus.state === 'granted';
        } catch {}
      } else {
        // Audio call does not need camera
        camera = true;
      }
    }
  } catch {}

  const granted = type === 'video' ? (microphone && camera) : microphone;
  return { granted, microphone, camera };
}

/**
 * Idempotently ensures permissions for the specific call type are granted.
 * - AUDIO calls NEVER ask for camera permission.
 * - Already-granted permissions return true immediately with ZERO prompts.
 * - Rapid clicks / concurrent requests share the exact same promise.
 */
export async function ensureCallPermissions(type: 'audio' | 'video'): Promise<boolean> {
  if (inFlightPermissionPromise) {
    return inFlightPermissionPromise;
  }

  inFlightPermissionPromise = (async () => {
    try {
      // 1. Check if already granted
      const currentState = await checkCallPermissionState(type);
      if (currentState.granted) {
        logger.info(`[CallPermissions] Permissions for ${type} call already fully granted.`);
        return true;
      }

      // 2. If on native Android, request ONLY what's missing for this specific call type
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
      if (isNative) {
        try {
          const res = await NativeSettings.requestCallPermissions({ type });
          if (res.alreadyGranted) return true;
          // Re-verify after prompt
          const afterState = await checkCallPermissionState(type);
          return afterState.granted;
        } catch (e) {
          logger.warn('[CallPermissions] Native requestCallPermissions error:', e);
        }
      }

      // On Web, getUserMedia will prompt naturally during stream acquisition
      return true;
    } finally {
      inFlightPermissionPromise = null;
    }
  })();

  return inFlightPermissionPromise;
}
