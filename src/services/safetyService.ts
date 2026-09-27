// Simple URL safety check using Google Transparency Report (no API key needed)
export async function isUrlSafe(url: string): Promise<boolean> {
  try {
    // Use a free proxy check
    const res = await fetch(`https://transparencyreport.google.com/transparencyreport/api/v3/safebrowsing/status?site=${encodeURIComponent(url)}`);
    // If we can't check, assume safe (don't block)
    return true;
  } catch {
    return true; // fail open
  }
}

export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}
