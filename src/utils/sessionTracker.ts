import { getAuth } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, updateDoc, serverTimestamp, query, where, getDocs, addDoc } from 'firebase/firestore';

export interface DeviceSessionInfo {
  sessionKey: string;
  deviceName: string;
  deviceType: 'Desktop' | 'Android' | 'iPhone' | 'Tablet';
  browser: string;
  os: string;
  location: string;
  ipAddress: string; // masked
  loginMethod: 'Google' | 'Email & Password';
  userAgent: string;
  firstLoginAt?: any;
  lastActiveAt?: any;
  revoked: boolean;
}

/**
 * Parses userAgent string to extract human-readable device details
 */
export function parseUserAgent(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): {
  deviceName: string;
  deviceType: 'Desktop' | 'Android' | 'iPhone' | 'Tablet';
  browser: string;
  os: string;
} {
  const lower = ua.toLowerCase();
  
  // Browser detection
  let browser = 'Browser';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome') && !lower.includes('chromium')) browser = 'Chrome';
  else if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('opera') || lower.includes('opr/')) browser = 'Opera';
  else if (lower.includes('brave')) browser = 'Brave';

  // OS and Device Type detection
  let os = 'Unknown OS';
  let deviceType: 'Desktop' | 'Android' | 'iPhone' | 'Tablet' = 'Desktop';
  let deviceName = 'Desktop Workstation';

  if (lower.includes('iphone')) {
    os = 'iOS';
    deviceType = 'iPhone';
    deviceName = 'iPhone';
  } else if (lower.includes('ipad')) {
    os = 'iOS';
    deviceType = 'Tablet';
    deviceName = 'iPad';
  } else if (lower.includes('android')) {
    os = 'Android';
    if (lower.includes('mobile')) {
      deviceType = 'Android';
      deviceName = 'Android Mobile';
    } else {
      deviceType = 'Tablet';
      deviceName = 'Android Tablet';
    }
  } else if (lower.includes('macintosh') || lower.includes('mac os x')) {
    os = 'macOS';
    deviceType = 'Desktop';
    deviceName = 'MacBook / Mac';
  } else if (lower.includes('windows')) {
    os = 'Windows';
    deviceType = 'Desktop';
    deviceName = 'Windows PC';
  } else if (lower.includes('linux')) {
    os = 'Linux';
    deviceType = 'Desktop';
    deviceName = 'Linux Workstation';
  }

  deviceName = `${deviceName} (${browser})`;

  return { deviceName, deviceType, browser, os };
}

/**
 * Generates or retrieves the unique persistent session key for this device
 */
export function getOrCreateSessionKey(): string {
  if (typeof window === 'undefined') return 'server_session';
  let sessionKey = localStorage.getItem('aeirmist_session_key');
  if (!sessionKey) {
    sessionKey = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('aeirmist_session_key', sessionKey);
  }
  return sessionKey;
}

/**
 * Mask IP address for privacy
 */
export function maskIpAddress(ip: string = '172.56.42.109'): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  return '192.168.***.***';
}

/**
 * Registers or updates the active user session in Firestore upon login/page load
 */
export async function trackUserSession(
  db: any,
  userId: string,
  loginMethod: 'Google' | 'Email & Password' = 'Email & Password'
): Promise<{ isNewDevice: boolean; sessionInfo: DeviceSessionInfo }> {
  if (!db || !userId) return { isNewDevice: false, sessionInfo: {} as any };

  const sessionKey = getOrCreateSessionKey();
  const uaInfo = parseUserAgent();
  const maskedIp = maskIpAddress();
  const location = 'San Francisco, US'; // Default approximate location

  const sessionRef = doc(db, 'login_sessions', `${userId}_${sessionKey}`);
  const sessionSnap = await getDoc(sessionRef);

  let isNewDevice = false;

  const sessionData: DeviceSessionInfo = {
    sessionKey,
    deviceName: uaInfo.deviceName,
    deviceType: uaInfo.deviceType,
    browser: uaInfo.browser,
    os: uaInfo.os,
    location,
    ipAddress: maskedIp,
    loginMethod,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    lastActiveAt: serverTimestamp(),
    revoked: false
  };

  if (!sessionSnap.exists()) {
    isNewDevice = true;
    // New device session
    await setDoc(sessionRef, {
      ...sessionData,
      userId,
      loginAt: serverTimestamp(),
      firstLoginAt: serverTimestamp()
    });

    // Also record in login history collection
    await addDoc(collection(db, 'login_history'), {
      userId,
      sessionKey,
      deviceName: uaInfo.deviceName,
      deviceType: uaInfo.deviceType,
      browser: uaInfo.browser,
      os: uaInfo.os,
      location,
      ipAddress: maskedIp,
      loginMethod,
      status: 'SUCCESS',
      timestamp: serverTimestamp()
    });

    // Log security activity
    await addDoc(collection(db, 'activities'), {
      userId,
      action: 'new_device_login',
      details: `Signed in from ${uaInfo.deviceName} (${uaInfo.os})`,
      timestamp: serverTimestamp()
    });

    // Create in-app notification for new device
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'security_new_device',
      title: 'New Login Detected',
      message: `New sign-in from ${uaInfo.deviceName} in ${location}.`,
      deviceName: uaInfo.deviceName,
      browser: uaInfo.browser,
      location,
      time: new Date().toISOString(),
      read: false,
      createdAt: serverTimestamp()
    });

  } else {
    // Existing session, check if revoked or update last active
    const existing = sessionSnap.data();
    if (existing.revoked) {
      // Session was previously revoked by user/admin
      // Prompt re-auth or reactivate if fresh login
      await updateDoc(sessionRef, {
        revoked: false,
        lastActiveAt: serverTimestamp()
      });
    } else {
      await updateDoc(sessionRef, {
        lastActiveAt: serverTimestamp()
      });
    }
  }

  return { isNewDevice, sessionInfo: sessionData };
}
