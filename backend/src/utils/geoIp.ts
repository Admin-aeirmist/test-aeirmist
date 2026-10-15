import { Request } from 'express';

export interface GeoLocation {
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  formatted: string;
}

// In-memory cache for IP geolocations (IP -> GeoLocation)
const geoCache = new Map<string, GeoLocation>();

export async function resolveIpLocation(ip?: string | null): Promise<GeoLocation | null> {
  if (!ip) return null;
  const cleanIp = ip.split(',')[0].trim().replace(/^::ffff:/, '');
  
  // Skip local/loopback/private IPs
  if (
    cleanIp === '::1' ||
    cleanIp === '127.0.0.1' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('172.16.')
  ) {
    return null;
  }

  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp)!;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,message,country,city,regionName,lat,lon`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.country) {
        const city = data.city || data.regionName || '';
        const country = data.country || '';
        const formatted = city ? `${city}, ${country}` : country;
        const result: GeoLocation = {
          city,
          country,
          latitude: data.lat,
          longitude: data.lon,
          formatted,
        };
        geoCache.set(cleanIp, result);
        return result;
      }
    }
  } catch (err) {
    // Timeout or network error
  }

  return null;
}

export async function detectLocation(
  req: Request,
  clientLocation?: string | null,
  lat?: number | string | null,
  lon?: number | string | null
): Promise<{ location: string; latitude?: string; longitude?: string }> {
  // 1. If client provided valid GPS reverse geocoded location string (not empty or raw coords)
  if (
    clientLocation && 
    clientLocation.trim() && 
    !clientLocation.includes('NaN') && 
    !/^[0-9.,\s-]+$/.test(clientLocation.trim()) &&
    clientLocation.toLowerCase() !== 'unknown'
  ) {
    return {
      location: clientLocation.trim(),
      latitude: lat != null ? String(lat) : undefined,
      longitude: lon != null ? String(lon) : undefined,
    };
  }

  // 2. If client provided raw coordinates, reverse-geocode using BigDataCloud
  if (lat && lon && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const data = await res.json();
        const city = data.city || data.locality || data.principalSubdivision || '';
        const country = data.countryName || '';
        if (city && country) {
          return {
            location: `${city}, ${country}`,
            latitude: String(lat),
            longitude: String(lon),
          };
        }
      }
    } catch {}
  }

  // 3. Check Cloudflare Edge Headers
  const cfCity = req.headers['cf-ipcity'] as string;
  const cfCountry = req.headers['cf-ipcountry'] as string;
  if (cfCity || cfCountry) {
    const formatted = cfCity && cfCountry ? `${cfCity}, ${cfCountry}` : (cfCity || cfCountry);
    const cfLat = req.headers['cf-iplatitude'] as string;
    const cfLon = req.headers['cf-iplongitude'] as string;
    return {
      location: formatted,
      latitude: cfLat || undefined,
      longitude: cfLon || undefined,
    };
  }

  // 4. IP Geolocation Lookup
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress;
  const ipGeo = await resolveIpLocation(clientIp);
  if (ipGeo && ipGeo.formatted) {
    return {
      location: ipGeo.formatted,
      latitude: ipGeo.latitude != null ? String(ipGeo.latitude) : undefined,
      longitude: ipGeo.longitude != null ? String(ipGeo.longitude) : undefined,
    };
  }

  return {
    location: clientLocation && clientLocation.trim() ? clientLocation.trim() : 'Location unavailable',
    latitude: lat != null ? String(lat) : undefined,
    longitude: lon != null ? String(lon) : undefined,
  };
}
