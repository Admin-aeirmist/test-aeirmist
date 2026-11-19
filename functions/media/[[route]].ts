/**
 * Aeirmist Universal Media Edge Responder
 * Serves media assets and transparent placeholders on Cloudflare Pages Edge
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Range",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "public, max-age=31536000, immutable"
};

// 1x1 transparent WebP pixel
const TRANSPARENT_WEBP_BASE64 = "UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoAAP7/2QAA";

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
};

export const onRequest = async (context: { request: Request; params: { route?: string[] } }) => {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 1. Forward request to authoritative media origin if on staging/preview (*.pages.dev)
  if (url.hostname.endsWith('.pages.dev')) {
    try {
      const originMediaUrl = `https://aeirmist.com${url.pathname}${url.search}`;
      const forwardHeaders = new Headers(request.headers);
      forwardHeaders.set('Host', 'aeirmist.com');
      const originRes = await fetch(originMediaUrl, {
        method: request.method,
        headers: forwardHeaders,
      });
      if (originRes.status === 200 || originRes.status === 206) {
        return originRes;
      }
    } catch {}
  }

  const path = url.pathname.toLowerCase();
  const isVideo = /\.(mp4|webm|mov|m4v|ogg|mkv)(\?.*)?$/i.test(path);
  if (isVideo) {
    return new Response(JSON.stringify({ error: 'Media stream unavailable' }), {
      status: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  if (path.endsWith(".svg")) {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#18181b"/></svg>`;
    return new Response(svgContent, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "image/svg+xml"
      }
    });
  }

  // Decode binary 1x1 WebP
  const binaryString = atob(TRANSPARENT_WEBP_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "image/webp"
    }
  });
};
