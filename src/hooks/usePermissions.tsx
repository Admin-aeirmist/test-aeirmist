import { useState, useCallback, useEffect } from 'react';
import { logger } from '@/src/utils/logger';

export type PermissionType = 
  | 'camera' 
  | 'microphone' 
  | 'photos' 
  | 'notifications' 
  | 'location' 
  | 'contacts' 
  | 'bluetooth';

export interface PermissionState {
  status: 'prompt' | 'granted' | 'denied' | 'unavailable' | 'checking';
  lastRequested?: number;
  error?: string;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<Record<PermissionType, PermissionState>>({
    camera: { status: 'prompt' },
    microphone: { status: 'prompt' },
    photos: { status: 'prompt' },
    notifications: { status: 'prompt' },
    location: { status: 'prompt' },
    contacts: { status: 'prompt' },
    bluetooth: { status: 'prompt' },
  });

  const checkPermissionStatus = useCallback(async (type: PermissionType) => {
    if (typeof window === 'undefined') return;
    
    try {
      if (type === 'notifications') {
        if ('Notification' in window) {
          const status = Notification.permission === 'default' ? 'prompt' : 
                        Notification.permission === 'granted' ? 'granted' : 'denied';
          setPermissions(prev => ({ ...prev, notifications: { status } }));
        }
        return;
      }

      if (navigator.permissions && navigator.permissions.query) {
        const nameMap: any = {
          camera: 'camera',
          microphone: 'microphone',
          location: 'geolocation',
          photos: 'notifications',
          contacts: 'contacts',
          bluetooth: 'bluetooth'
        };

        const permissionName = nameMap[type];
        if (!permissionName) return;

        try {
          const result = await navigator.permissions.query({ name: permissionName });
          const statusMap: any = {
            granted: 'granted',
            denied: 'denied',
            prompt: 'prompt'
          };
          setPermissions(prev => ({ 
            ...prev, 
            [type]: { status: statusMap[result.state] || 'prompt' } 
          }));

          result.onchange = () => {
            setPermissions(prev => ({ 
              ...prev, 
              [type]: { status: statusMap[result.state] || 'prompt' } 
            }));
          };
        } catch (e) {
          // Some permissions might not be queryable in all browsers
        }
      }
    } catch (err) {
      logger.warn(`Status check failed for ${type}`, err);
    }
  }, []);

  const requestPermission = useCallback(async (type: PermissionType): Promise<boolean> => {
    // If already granted, return true immediately
    if (permissions[type]?.status === 'granted') {
      return true;
    }

    setPermissions(prev => ({ ...prev, [type]: { ...prev[type], status: 'checking' } }));
    logger.info(`[Permissions] Requesting ${type}...`);
    
    // Proactively invoke native Android OS permissions dialog if on Android APK for the specific resource
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      try {
        const plugins = (window as any).Capacitor.Plugins;
        if (plugins?.NativeSettings?.requestCallPermissions) {
          if (type === 'microphone') {
            await plugins.NativeSettings.requestCallPermissions({ type: 'audio' });
          } else if (type === 'camera') {
            await plugins.NativeSettings.requestCallPermissions({ type: 'video' });
          }
        }
      } catch (e) {
        logger.warn("Native permission check in usePermissions ignored", e);
      }
    }

    try {
      if (type === 'camera') {
        let stream: MediaStream | null = null;
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: 'user' },
              audio: true 
            });
          }
        } catch (e) {
          try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            }
          } catch (e2) {
            // Fallback to video only if audio is unavailable
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
              stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
          }
        }

        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setPermissions(prev => ({ 
            ...prev, 
            camera: { status: 'granted', lastRequested: Date.now() },
            microphone: { status: 'granted', lastRequested: Date.now() }
          }));
          return true;
        } else {
          throw new Error('Could not open camera device stream.');
        }
      }

      if (type === 'microphone') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microphone access is not supported on this device.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setPermissions(prev => ({ ...prev, microphone: { status: 'granted', lastRequested: Date.now() } }));
        return true;
      }

      if (type === 'notifications') {
        if (!('Notification' in window)) {
          setPermissions(prev => ({ ...prev, notifications: { status: 'unavailable' } }));
          return false;
        }
        const result = await Notification.requestPermission();
        const status = result === 'granted' ? 'granted' : 'denied';
        setPermissions(prev => ({ ...prev, notifications: { status, lastRequested: Date.now() } }));
        return result === 'granted';
      }

      if (type === 'location') {
        return new Promise((resolve) => {
          if (!('geolocation' in navigator)) {
            setPermissions(prev => ({ ...prev, location: { status: 'unavailable' } }));
            resolve(false);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            () => {
              setPermissions(prev => ({ ...prev, location: { status: 'granted', lastRequested: Date.now() } }));
              resolve(true);
            },
            (err) => {
              const status = err.code === 1 ? 'denied' : 'unavailable';
              setPermissions(prev => ({ ...prev, location: { status, error: err.message, lastRequested: Date.now() } }));
              resolve(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
        });
      }

      if (type === 'photos') {
        setPermissions(prev => ({ ...prev, photos: { status: 'granted', lastRequested: Date.now() } }));
        return true;
      }

      if (type === 'contacts') {
        if ('contacts' in navigator && 'ContactsManager' in window) {
           setPermissions(prev => ({ ...prev, contacts: { status: 'granted', lastRequested: Date.now() } }));
           return true;
        }
        setPermissions(prev => ({ ...prev, contacts: { status: 'unavailable' } }));
        return false;
      }

      if (type === 'bluetooth') {
        if ('bluetooth' in navigator) {
          setPermissions(prev => ({ ...prev, bluetooth: { status: 'granted', lastRequested: Date.now() } }));
          return true;
        }
        setPermissions(prev => ({ ...prev, bluetooth: { status: 'unavailable' } }));
        return false;
      }

      return false;
    } catch (err: any) {
      logger.error(`[Permissions] Failure for ${type}:`, err);
      
      let status: 'denied' | 'unavailable' = 'denied';
      let customErrorMessage = err.message || `Failed to access ${type}`;

      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.name === 'NotSupportedError') {
        status = 'unavailable';
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        customErrorMessage = `System access denied for ${type}. Please enable it in device site settings.`;
      }
      
      setPermissions(prev => ({ 
        ...prev, 
        [type]: { status, error: customErrorMessage, lastRequested: Date.now() } 
      }));
      return false;
    }
  }, [permissions]);

  useEffect(() => {
    const permissionsToCheck: PermissionType[] = ['camera', 'microphone', 'notifications', 'location'];
    permissionsToCheck.forEach(checkPermissionStatus);
  }, [checkPermissionStatus]);

  return { permissions, requestPermission, checkPermissionStatus };
};
