import { useState, useCallback, useEffect } from 'react';
import { logger } from '@/src/utils/logger';
import { PermissionService } from '@/src/services/PermissionService';

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
      if (type === 'notifications' || type === 'location' || type === 'microphone' || type === 'camera') {
        const state = await PermissionService.checkPermission(type);
        setPermissions(prev => ({ ...prev, [type]: { status: state } }));
        return;
      }

      if (navigator.permissions && navigator.permissions.query) {
        const nameMap: any = {
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
        } catch {
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

    try {
      if (type === 'camera') {
        // Strictly request video-only (isolated from microphone!)
        const res = await PermissionService.requestCameraStream({ withAudio: false, facingMode: 'user' });
        if (res.granted && res.stream) {
          res.stream.getTracks().forEach(t => t.stop());
          setPermissions(prev => ({ 
            ...prev, 
            camera: { status: 'granted', lastRequested: Date.now() } 
          }));
          return true;
        } else {
          setPermissions(prev => ({ 
            ...prev, 
            camera: { status: 'denied', error: res.error, lastRequested: Date.now() } 
          }));
          return false;
        }
      }

      if (type === 'microphone') {
        // Strictly request audio-only (isolated from camera!)
        const res = await PermissionService.requestMicrophoneStream();
        if (res.granted && res.stream) {
          res.stream.getTracks().forEach(t => t.stop());
          setPermissions(prev => ({ 
            ...prev, 
            microphone: { status: 'granted', lastRequested: Date.now() } 
          }));
          return true;
        } else {
          setPermissions(prev => ({ 
            ...prev, 
            microphone: { status: 'denied', error: res.error, lastRequested: Date.now() } 
          }));
          return false;
        }
      }

      if (type === 'notifications') {
        const granted = await PermissionService.requestNotificationPermission();
        setPermissions(prev => ({ 
          ...prev, 
          notifications: { status: granted ? 'granted' : 'denied', lastRequested: Date.now() } 
        }));
        return granted;
      }

      if (type === 'location') {
        const loc = await PermissionService.getPreciseLocation({ timeoutMs: 8000, highAccuracy: true });
        const granted = loc.isPrecise || loc.locationType === 'approximate_network';
        const status = granted ? 'granted' : (loc.locationType === 'denied' ? 'denied' : 'unavailable');
        setPermissions(prev => ({ 
          ...prev, 
          location: { status, lastRequested: Date.now() } 
        }));
        return granted;
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
    // Non-intrusive status check on mount (does not prompt!)
    const permissionsToCheck: PermissionType[] = ['camera', 'microphone', 'notifications', 'location'];
    permissionsToCheck.forEach(checkPermissionStatus);
  }, [checkPermissionStatus]);

  return { permissions, requestPermission, checkPermissionStatus };
};
