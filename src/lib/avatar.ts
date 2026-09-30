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

export function getAvatarUrl(photoURL?: string | null, seed?: string, isLight?: boolean): string {
  const fallback = getBlankDp(isLight);
  if (!photoURL || typeof photoURL !== 'string') {
    return fallback;
  }
  
  const trimmed = photoURL.trim();
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
  
  return trimmed;
}


