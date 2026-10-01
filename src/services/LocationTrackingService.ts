/**
 * Location Tracking & Device Metadata Service
 * Supports Web & APK (Capacitor/Android WebView) with Geolocation API & safe IP-based fallback.
 */

import { logger } from '../utils/logger';
import { PermissionService } from './PermissionService';

export interface LocationData {
  city?: string;
  country?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  isPrecise: boolean;
  locationType: 'precise_gps' | 'approximate_network' | 'ip_approximate' | 'timezone_approximate' | 'unavailable';
  ip?: string;
  displayLocation: string;
  timestamp: number;
}

export interface DeviceMetadata {
  platform: string;
  userAgent: string;
  isMobile: boolean;
  isApp: boolean;
}

export class LocationTrackingService {
  private static cachedLocation: LocationData | null = null;
  private static lastFetchTime = 0;
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

  /**
   * Detect client platform and device metadata
   */
  public static getDeviceMetadata(): DeviceMetadata {
    if (typeof window === 'undefined' || !navigator) {
      return { platform: 'Unknown', userAgent: '', isMobile: false, isApp: false };
    }

    const ua = navigator.userAgent || '';
    const isApp = Boolean((window as any).Capacitor?.isNativePlatform?.() || ua.includes('Capacitor') || ua.includes('wv'));
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    let platform = 'Web';
    if (isApp) {
      platform = 'Aeirmist Android APK';
    } else if (/Android/i.test(ua)) {
      platform = 'Android Web';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      platform = 'iOS Web';
    } else if (/Windows/i.test(ua)) {
      platform = 'Windows PC';
    } else if (/Macintosh|Mac OS/i.test(ua)) {
      platform = 'macOS';
    } else if (/Linux/i.test(ua)) {
      platform = 'Linux';
    }

    return {
      platform,
      userAgent: ua.slice(0, 150),
      isMobile,
      isApp
    };
  }

  /**
   * Request location permission and capture current location coordinates.
   * Accurately distinguishes precise GPS from approximate IP locations.
   */
  public static async captureCurrentLocation(): Promise<LocationData> {
    const now = Date.now();
    if (this.cachedLocation && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cachedLocation;
    }

    // 1. Attempt High-Accuracy GPS via PermissionService
    try {
      const gpsResult = await PermissionService.getPreciseLocation({ timeoutMs: 6000, highAccuracy: true });
      if (gpsResult && gpsResult.isPrecise && typeof gpsResult.latitude === 'number' && typeof gpsResult.longitude === 'number') {
        const loc: LocationData = {
          latitude: gpsResult.latitude,
          longitude: gpsResult.longitude,
          accuracy: gpsResult.accuracy,
          isPrecise: true,
          locationType: 'precise_gps',
          displayLocation: gpsResult.displayLocation || `Lat ${gpsResult.latitude}, Lng ${gpsResult.longitude}`,
          timestamp: now
        };
        this.cachedLocation = loc;
        this.lastFetchTime = now;
        return loc;
      }
    } catch (e) {
      logger.warn('[LocationTrackingService] GPS capture bypassed:', e);
    }

    // 2. Fallback: Fast IP-Based Geolocation (explicitly marked as approximate IP)
    try {
      const response = await fetch('https://ipapi.co/json/', { method: 'GET', signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const data = await response.json();
        const city = data.city || '';
        const region = data.region || '';
        const country = data.country_name || data.country || '';
        
        let display = [city, country].filter(Boolean).join(', ');
        if (!display) display = 'Aeirmist Node';

        const loc: LocationData = {
          city,
          region,
          country,
          latitude: data.latitude,
          longitude: data.longitude,
          isPrecise: false,
          locationType: 'ip_approximate',
          ip: data.ip,
          displayLocation: display,
          timestamp: now
        };

        this.cachedLocation = loc;
        this.lastFetchTime = now;
        return loc;
      }
    } catch {
      // IP lookup failed or offline
    }

    // 3. Fallback: Timezone-based heuristic
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const display = timeZone ? timeZone.replace(/_/g, ' ') : 'Online Node';
      const loc: LocationData = {
        displayLocation: display,
        isPrecise: false,
        locationType: 'timezone_approximate',
        timestamp: now
      };
      this.cachedLocation = loc;
      this.lastFetchTime = now;
      return loc;
    } catch {
      return {
        displayLocation: 'Active Node',
        isPrecise: false,
        locationType: 'unavailable',
        timestamp: now
      };
    }
  }
}
