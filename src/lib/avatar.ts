export function isLightMode(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return (
      document.documentElement.classList.contains('light') ||
      document.body.classList.contains('light') ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('aeirmist_appearance_settings')?.includes('"themeMode":"light"')) === true
    );
  } catch {
    return false;
  }
}

// Dark Mode Blank Avatar (Obsidian Slate with Silver Silhouette)
export const BLANK_DP_DARK = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%230c0f17" /><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="%23a1a1aa" opacity="0.35"/></svg>`;

// Light Mode Blank Avatar (Clean Slate-200 with refined Slate-500 Silhouette)
export const BLANK_DP_LIGHT = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23e2e8f0" /><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="%2364748b" opacity="0.65"/></svg>`;

// Default constant pointing to adaptive SVG
export const BLANK_DP = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>.bg{fill:%230c0f17;} .fg{fill:%23a1a1aa;opacity:0.35;} @media(prefers-color-scheme:light){.bg{fill:%23e2e8f0;} .fg{fill:%2364748b;opacity:0.65;}}</style><rect class="bg" width="24" height="24"/><path class="fg" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

export function getBlankDp(isLight?: boolean): string {
  const light = isLight !== undefined ? isLight : isLightMode();
  return light ? BLANK_DP_LIGHT : BLANK_DP_DARK;
}

export function resolveAvatarSrc(keyOrUrl?: string | null): string | null {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  if (trimmed.startsWith('data:')) {
    if (trimmed.startsWith('data:image/jpeg;base64') && trimmed.length <= 512) {
      return null;
    }
    return trimmed.replace(/\s+/g, '');
  }
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed === 'ai:era_official' || trimmed.startsWith('ai:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/custom_') || trimmed.startsWith('/assets/')) {
    return trimmed;
  }
  if (trimmed.startsWith('/media/')) {
    if (trimmed.startsWith('/media/data:') || trimmed.startsWith('/media/http://') || trimmed.startsWith('/media/https://')) {
      return trimmed.slice(7);
    }
    return trimmed;
  }
  return `/media/${trimmed.replace(/^\/+/, '')}`;
}

export function getAvatarUrl(photoURL?: string | null, seed?: string, isLight?: boolean): string {
  const fallback = getBlankDp(isLight);
  if (!photoURL || typeof photoURL !== 'string') {
    return fallback;
  }
  
  let trimmed = photoURL.trim();
  if (trimmed.startsWith('/media/data:') || trimmed.startsWith('/media/http://') || trimmed.startsWith('/media/https://')) {
    trimmed = trimmed.slice(7);
  }
  if (trimmed === 'ai:era_official' || trimmed === '/media/ai:era_official' || trimmed.startsWith('ai:')) {
    return '/custom_uploaded_logo.png';
  }
  if (trimmed.startsWith('data:image/jpeg;base64') && trimmed.length <= 512) {
    return fallback;
  }
  if (
    !trimmed || 
    trimmed === 'null' || 
    trimmed === 'undefined' ||
    trimmed.includes('dicebear') || 
    trimmed.includes('unsplash.com') ||
    trimmed.includes('picsum.photos') ||
    trimmed.includes('multavatar') ||
    trimmed.includes('ui-avatars.com') ||
    trimmed.includes('gravatar.com') ||
    trimmed.includes('default_avatar') ||
    trimmed.includes('placeholder')
  ) {
    return fallback;
  }

  if (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('data:') &&
    !trimmed.startsWith('blob:') &&
    !trimmed.startsWith('/')
  ) {
    return resolveAvatarSrc(trimmed) || fallback;
  }
  
  return trimmed;
}

/**
 * Generates an authentic Aeirmist Cyber Group Display Picture (DP)
 * If an uploaded photoURL exists, resolves it.
 * Otherwise, generates a stylized vector squircle with group initial and neon cyan cyber glow.
 */
export function getGroupAvatarUrl(groupName?: string, photoURL?: string | null): string {
  if (photoURL && typeof photoURL === 'string') {
    const trimmed = photoURL.trim();
    if (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && !trimmed.includes('placeholder')) {
      const resolved = resolveAvatarSrc(trimmed);
      if (resolved) return getAvatarUrl(resolved, groupName);
      if (trimmed.startsWith('http') || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('/')) {
        return trimmed;
      }
    }
  }

  const initial = (groupName || 'G').trim().charAt(0).toUpperCase() || 'G';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <defs>
      <linearGradient id="cyberGroupBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0e1320"/>
        <stop offset="60%" stop-color="#080a12"/>
        <stop offset="100%" stop-color="#001824"/>
      </linearGradient>
      <linearGradient id="cyberCyanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#00f2ff"/>
        <stop offset="100%" stop-color="#3b82f6"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" rx="28" fill="url(#cyberGroupBg)"/>
    <rect x="2.5" y="2.5" width="95" height="95" rx="26" fill="none" stroke="url(#cyberCyanGlow)" stroke-width="2.5" stroke-opacity="0.45"/>
    <text x="50" y="56" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#00f2ff" text-anchor="middle" dominant-baseline="middle" letter-spacing="1">${initial}</text>
    <!-- Group multi-user indicator glyph badge in bottom corner -->
    <g transform="translate(68, 68)">
      <circle cx="12" cy="12" r="14" fill="#06080e" stroke="#00f2ff" stroke-width="2" stroke-opacity="0.8"/>
      <path d="M7 19c0-2.8 2.2-5 5-5s5 2.2 5 5" fill="none" stroke="#00f2ff" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="12" cy="10" r="2.8" fill="#00f2ff"/>
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}


