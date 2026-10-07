/**
 * Aeirmist Unified Permission Service
 * Complete multi-platform (Android Capacitor Native + Modern Web) permission manager.
 * 
 * Rules:
 * 1. Zero automatic prompts on mount or first launch (Phase 2).
 * 2. Orderly login permission sequence: location -> accurate GPS -> notifications (Phase 3).
 * 3. High-accuracy GPS with distinction between precise GPS vs unavailable (never fake or silently substitute IP) (Phase 4).
 * 4. Separate, isolated notifications (never triggers camera or microphone) (Phase 5).
 * 5. Isolated microphone requests with usable audio track verification (Phase 6).
 * 6. Isolated camera requests without bundling microphone unless recording video (Phase 7).
 * 7. In-flight promise memoization to prevent duplicate prompts and rapid click races.
 */

import { NativeSettings, openAppPermissionSettings as nativeOpenSettings } from '../utils/nativeSettings';
import { logger } from '../utils/logger';

export type PermissionKind = 'location' | 'notifications' | 'microphone' | 'camera';
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface PreciseLocationResult {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
  isPrecise: boolean;
  locationType: 'precise_gps' | 'approximate_network' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';
  displayLocation?: string;
}

export interface MediaPermissionResult {
  granted: boolean;
  stream?: MediaStream;
  error?: string;
}

class PermissionServiceClass {
  // In-flight mutexes to prevent concurrent overlapping prompts
  private inFlightRequests: Map<string, Promise<any>> = new Map();
  private hasPromptedNotificationsInSession = false;

  private isNative(): boolean {
    return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
  }

  // -------------------------------------------------------------
  // 1. Permission State Queries (Non-Intrusive, Zero UI Prompts)
  // -------------------------------------------------------------

  public async checkPermission(kind: PermissionKind): Promise<PermissionState> {
    if (typeof window === 'undefined') return 'unavailable';

    const isNat = this.isNative();

    try {
      if (kind === 'notifications') {
        if (isNat) {
          const res = await NativeSettings.checkNotificationPermission();
          return res.granted ? 'granted' : 'prompt';
        }
        if ('Notification' in window) {
          if (Notification.permission === 'granted') return 'granted';
          if (Notification.permission === 'denied') return 'denied';
          return 'prompt';
        }
        return 'unavailable';
      }

      if (kind === 'location') {
        if (isNat) {
          const res = await NativeSettings.checkLocationPermission();
          return res.granted ? 'granted' : 'prompt';
        }
        if ('permissions' in navigator && navigator.permissions?.query) {
          try {
            const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            if (status.state === 'granted') return 'granted';
            if (status.state === 'denied') return 'denied';
            return 'prompt';
          } catch {
            // Some browsers fail permissions.query for geolocation
          }
        }
        return 'geolocation' in navigator ? 'prompt' : 'unavailable';
      }

      if (kind === 'microphone') {
        if (isNat) {
          const res = await NativeSettings.checkCallPermissions({ type: 'audio' });
          return res.microphone ? 'granted' : 'prompt';
        }
        if ('permissions' in navigator && navigator.permissions?.query) {
          try {
            const status = await navigator.permissions.query({ name: 'microphone' as any });
            if (status.state === 'granted') return 'granted';
            if (status.state === 'denied') return 'denied';
            return 'prompt';
          } catch {}
        }
        return navigator.mediaDevices?.getUserMedia ? 'prompt' : 'unavailable';
      }

      if (kind === 'camera') {
        if (isNat) {
          const res = await NativeSettings.checkCallPermissions({ type: 'video' });
          return res.camera ? 'granted' : 'prompt';
        }
        if ('permissions' in navigator && navigator.permissions?.query) {
          try {
            const status = await navigator.permissions.query({ name: 'camera' as any });
            if (status.state === 'granted') return 'granted';
            if (status.state === 'denied') return 'denied';
            return 'prompt';
          } catch {}
        }
        return navigator.mediaDevices?.getUserMedia ? 'prompt' : 'unavailable';
      }
    } catch (e) {
      logger.warn(`[PermissionService] checkPermission(${kind}) error:`, e);
    }

    return 'prompt';
  }

  // -------------------------------------------------------------
  // 2. Location Permission & High-Accuracy GPS Retrieval
  // -------------------------------------------------------------

  /**
   * Explicitly requests Location permission on Android Native or prepares Web Geolocation.
   */
  public async requestLocationPermission(): Promise<boolean> {
    const key = 'request_location';
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    const promise = (async () => {
      try {
        const current = await this.checkPermission('location');
        if (current === 'granted') return true;

        if (this.isNative()) {
          const res = await NativeSettings.requestLocationPermission();
          return !!res.granted;
        }

        // On Web, requesting permission happens via calling getCurrentPosition
        return true;
      } catch (err) {
        logger.warn('[PermissionService] requestLocationPermission error:', err);
        return false;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  /**
   * Captures precise current location with high-accuracy GPS hardware where supported.
   * If GPS is disabled, denied, or unavailable:
   * - Does NOT fabricate fake coordinates.
   * - Does NOT silently substitute approximate IP coordinates as real GPS.
   * - Returns structured status without blocking login.
   */
  public async getPreciseLocation(options: {
    timeoutMs?: number;
    highAccuracy?: boolean;
    maximumAgeMs?: number;
  } = {}): Promise<PreciseLocationResult> {
    const key = 'get_location';
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    const {
      timeoutMs = 8000,
      highAccuracy = true,
      maximumAgeMs = 0
    } = options;

    const promise = (async (): Promise<PreciseLocationResult> => {
      const now = Date.now();

      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        return {
          timestamp: now,
          isPrecise: false,
          locationType: 'unsupported'
        };
      }

      // Step 1: Ensure permission is requested first on native Android
      if (this.isNative()) {
        try {
          const locPerm = await this.requestLocationPermission();
          if (!locPerm) {
            return {
              timestamp: now,
              isPrecise: false,
              locationType: 'denied'
            };
          }
        } catch (e) {
          logger.warn('[PermissionService] Native location permission error:', e);
        }
      }

      // Step 2: Try High-Accuracy GPS
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          let hasFinished = false;
          const timer = setTimeout(() => {
            if (!hasFinished) {
              hasFinished = true;
              reject(new Error('LOCATION_TIMEOUT'));
            }
          }, timeoutMs);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!hasFinished) {
                hasFinished = true;
                clearTimeout(timer);
                resolve(pos);
              }
            },
            (err) => {
              if (!hasFinished) {
                hasFinished = true;
                clearTimeout(timer);
                reject(err);
              }
            },
            {
              enableHighAccuracy: highAccuracy,
              timeout: timeoutMs,
              maximumAge: maximumAgeMs
            }
          );
        });

        const lat = Number(position.coords.latitude.toFixed(5));
        const lng = Number(position.coords.longitude.toFixed(5));
        const accuracy = position.coords.accuracy ? Math.round(position.coords.accuracy) : undefined;

        return {
          latitude: lat,
          longitude: lng,
          accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp || now,
          isPrecise: true,
          locationType: 'precise_gps',
          displayLocation: `${lat}, ${lng}`
        };
      } catch (err: any) {
        logger.info('[PermissionService] High accuracy GPS unavailable, trying standard fix:', err?.message || err);

        // Fast fallback to low-power network location if high-accuracy GPS timed out
        if (err?.message === 'LOCATION_TIMEOUT' || err?.code === 3) {
          try {
            const fallbackPos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 4000,
                maximumAge: 60000
              });
            });

            const lat = Number(fallbackPos.coords.latitude.toFixed(5));
            const lng = Number(fallbackPos.coords.longitude.toFixed(5));
            return {
              latitude: lat,
              longitude: lng,
              accuracy: fallbackPos.coords.accuracy ? Math.round(fallbackPos.coords.accuracy) : undefined,
              timestamp: fallbackPos.timestamp || now,
              isPrecise: false,
              locationType: 'approximate_network',
              displayLocation: `${lat}, ${lng}`
            };
          } catch (e2: any) {
            if (e2?.code === 1) {
              return { timestamp: now, isPrecise: false, locationType: 'denied' };
            }
            return { timestamp: now, isPrecise: false, locationType: 'timeout' };
          }
        }

        if (err?.code === 1) {
          return { timestamp: now, isPrecise: false, locationType: 'denied' };
        }

        return { timestamp: now, isPrecise: false, locationType: 'unavailable' };
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  // -------------------------------------------------------------
  // 3. Notification Permission
  // -------------------------------------------------------------

  /**
   * Requests device notification permission cleanly.
   * Never requests camera or microphone!
   */
  public async requestNotificationPermission(): Promise<boolean> {
    const key = 'request_notification';
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    const promise = (async (): Promise<boolean> => {
      try {
        const current = await this.checkPermission('notifications');
        if (current === 'granted') return true;

        if (this.isNative()) {
          const res = await NativeSettings.requestNotificationPermission();
          return !!res?.granted;
        }

        if ('Notification' in window) {
          const res = await Notification.requestPermission();
          return res === 'granted';
        }

        return false;
      } catch (err) {
        logger.warn('[PermissionService] requestNotificationPermission error:', err);
        return false;
      } finally {
        this.hasPromptedNotificationsInSession = true;
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  // -------------------------------------------------------------
  // 4. Microphone Permission (Voice Note & Audio Call)
  // -------------------------------------------------------------

  /**
   * Requests Microphone permission and acquires an audio stream.
   * Never requests camera!
   */
  public async requestMicrophoneStream(options: MediaTrackConstraints = {}): Promise<MediaPermissionResult> {
    const key = 'request_microphone';
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    const promise = (async (): Promise<MediaPermissionResult> => {
      try {
        // Native Android APK: Trigger native RECORD_AUDIO permission dialog first
        if (this.isNative()) {
          try {
            await NativeSettings.requestCallPermissions({ type: 'audio' });
          } catch (e) {
            logger.warn('[PermissionService] Native audio permission bridge warning:', e);
          }
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          return { granted: false, error: 'Audio capture is not supported on this device.' };
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...options
          },
          video: false // Strictly isolated from camera
        });

        // Verify usable audio track exists
        const audioTracks = stream.getAudioTracks();
        if (!audioTracks || audioTracks.length === 0 || audioTracks[0].readyState !== 'live') {
          stream.getTracks().forEach(t => t.stop());
          return { granted: false, error: 'Microphone stream was acquired but has no live audio track.' };
        }

        return { granted: true, stream };
      } catch (err: any) {
        logger.warn('[PermissionService] requestMicrophoneStream denied or failed:', err);
        return {
          granted: false,
          error: err?.name === 'NotAllowedError'
            ? 'Microphone permission denied. Please allow microphone access.'
            : (err?.message || 'Failed to acquire microphone.')
        };
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  // -------------------------------------------------------------
  // 5. Camera Permission (Video Call & Story Studio)
  // -------------------------------------------------------------

  /**
   * Requests Camera permission and acquires a video stream.
   * Audio is FALSE by default unless withAudio: true is explicitly requested!
   */
  public async requestCameraStream(options: {
    withAudio?: boolean;
    facingMode?: 'user' | 'environment';
    videoConstraints?: MediaTrackConstraints;
  } = {}): Promise<MediaPermissionResult> {
    const key = `request_camera_${options.facingMode || 'user'}_${!!options.withAudio}`;
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    const promise = (async (): Promise<MediaPermissionResult> => {
      const { withAudio = false, facingMode = 'user', videoConstraints = {} } = options;

      try {
        // Native Android APK: Trigger native permission dialog for video
        if (this.isNative()) {
          try {
            await NativeSettings.requestCallPermissions({ type: withAudio ? 'video' : 'video' });
          } catch (e) {
            logger.warn('[PermissionService] Native video permission bridge warning:', e);
          }
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          return { granted: false, error: 'Camera is not supported on this device.' };
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            ...videoConstraints
          },
          audio: withAudio ? { echoCancellation: true, noiseSuppression: true } : false
        });

        // Verify usable video track exists
        const videoTracks = stream.getVideoTracks();
        if (!videoTracks || videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
          stream.getTracks().forEach(t => t.stop());
          return { granted: false, error: 'Camera stream was acquired but has no live video track.' };
        }

        return { granted: true, stream };
      } catch (err: any) {
        logger.warn('[PermissionService] requestCameraStream denied or failed:', err);
        return {
          granted: false,
          error: err?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access.'
            : (err?.message || 'Failed to acquire camera.')
        };
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  // -------------------------------------------------------------
  // 6. Complete Phase 3 Login Permission Sequence
  // -------------------------------------------------------------

  /**
   * Orchestrates the Phase 3 Login Permission Flow:
   * 1. Check & request Location permission (non-intrusive if already granted).
   * 2. Obtain accurate current location (never blocks indefinitely).
   * 3. Check & request Notification permission.
   * 4. Returns location data & notification status to resume auth.
   * 
   * Fully non-blocking: Denial of any permission never halts login!
   */
  public async executeLoginPermissionFlow(options: {
    addToast?: (toast: { title: string; message: string; type: 'success' | 'warning' | 'info' }) => void;
  } = {}): Promise<{
    location: PreciseLocationResult | null;
    notificationGranted: boolean;
  }> {
    const key = 'login_permission_flow';
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key)!;
    }

    const promise = (async () => {
      let locationResult: PreciseLocationResult | null = null;
      let notificationGranted = false;

      try {
        // Step 1 & 2: Location
        try {
          const locState = await this.checkPermission('location');
          if (locState !== 'granted') {
            await this.requestLocationPermission();
          }
          // Capture accurate current location with sensible timeout
          locationResult = await this.getPreciseLocation({ timeoutMs: 7000, highAccuracy: true });
        } catch (locErr) {
          logger.warn('[PermissionService] Location step in login flow error:', locErr);
          locationResult = {
            timestamp: Date.now(),
            isPrecise: false,
            locationType: 'unavailable'
          };
        }

        // Step 3 & 4: Notifications
        try {
          const notifState = await this.checkPermission('notifications');
          if (notifState === 'granted') {
            notificationGranted = true;
          } else {
            notificationGranted = await this.requestNotificationPermission();
            if (!notificationGranted && options.addToast) {
              options.addToast({
                title: 'Notifications Optional',
                message: 'You can enable device notifications anytime from settings to receive message alerts.',
                type: 'info'
              });
            }
          }
        } catch (notifErr) {
          logger.warn('[PermissionService] Notification step in login flow error:', notifErr);
        }

        return {
          location: locationResult,
          notificationGranted
        };
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, promise);
    return promise;
  }

  // -------------------------------------------------------------
  // 7. System Settings Navigation
  // -------------------------------------------------------------

  public async openSettings(): Promise<void> {
    if (this.isNative()) {
      await nativeOpenSettings();
    } else if (typeof window !== 'undefined') {
      alert('Please manage site permissions in your browser address bar (lock/settings icon).');
    }
  }
}

export const PermissionService = new PermissionServiceClass();
