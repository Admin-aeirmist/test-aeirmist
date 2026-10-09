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

  // If request contains an extension like .jpg, .png, .webp, .svg, return clean image content
  const path = url.pathname.toLowerCase();

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
