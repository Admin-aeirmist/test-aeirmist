export interface ParsedDeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  model: string;
  browser: string;
  os: string;
  displayName: string;
}

export function parseUserAgent(userAgent?: string | null, clientDeviceHint?: string | null): ParsedDeviceInfo {
  const ua = userAgent || '';
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  let model = 'Personal Computer';
  let browser = 'Web Browser';
  let os = 'Unknown OS';

  // 1. Device Type Detection
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = 'mobile';
  } else {
    deviceType = 'desktop';
  }

  // 2. OS Detection
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 11 / 10';
  else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android\s+([0-9.]+)/i.test(ua)) {
    const match = ua.match(/Android\s+([0-9.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/iPhone OS\s+([0-9_]+)/i.test(ua)) {
    const match = ua.match(/iPhone OS\s+([0-9_]+)/i);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Mac OS X\s+([0-9_]+)/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // 3. Precise Model Detection (Meta-style: e.g. "Tecno LK7k", "Samsung SM-...", "iPhone")
  if (clientDeviceHint && clientDeviceHint.trim().length > 1 && !clientDeviceHint.toLowerCase().includes('browser session')) {
    model = clientDeviceHint.trim();
  } else if (/iPhone/i.test(ua)) {
    model = 'Apple iPhone';
  } else if (/iPad/i.test(ua)) {
    model = 'Apple iPad';
  } else if (/Macintosh/i.test(ua)) {
    model = 'MacBook / Mac';
  } else if (/Windows/i.test(ua)) {
    model = 'Windows PC';
  } else if (/Android/i.test(ua)) {
    // Extract Android phone model from "(Linux; Android ...; [MODEL] Build/...)"
    const androidModelMatch = ua.match(/\((?:Linux;\s*Android[^;]*;\s*)([^;)]+?)(?:\s+Build|\s*\))/i);
    if (androidModelMatch && androidModelMatch[1]) {
      const rawModel = androidModelMatch[1].trim();
      // Handle known brands
      if (/Tecno/i.test(rawModel) || /LK[0-9]/i.test(rawModel)) {
        model = rawModel.includes('Tecno') ? rawModel : `Tecno ${rawModel}`;
      } else if (/SM-[A-Z0-9]+/i.test(rawModel)) {
        model = `Samsung Galaxy (${rawModel})`;
      } else if (/Redmi|POCO|Xiaomi/i.test(rawModel)) {
        model = rawModel;
      } else if (/Pixel/i.test(rawModel)) {
        model = `Google ${rawModel}`;
      } else {
        model = rawModel;
      }
    } else {
      model = 'Android Device';
    }
  }

  // 4. Browser / App Client Detection
  if (/AeirmistApp|Capacitor/i.test(ua)) {
    browser = 'Aeirmist App';
  } else if (/Edg\/([0-9.]+)/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome\/([0-9.]+)/i.test(ua) && !/Edg/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Safari\/([0-9.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/Opera|OPR\//i.test(ua)) {
    browser = 'Opera';
  }

  const displayName = `${model} · ${browser}`;

  return {
    deviceType,
    model,
    browser,
    os,
    displayName,
  };
}
