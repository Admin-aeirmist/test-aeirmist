/**
 * Cloudflare Pages Middleware for Aeirmist
 * - Enforces canonical domain (redirects www to apex domain)
 * - Prevents indexing of *.pages.dev staging deployments via X-Robots-Tag
 * - Dynamically rewrites <link rel="canonical"> and <meta property="og:url">
 *   to match the requested URL path, resolving Google Search Console
 *   "Alternate page with proper canonical tag" issues.
 */

interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next } = context;
  const url = new URL(request.url);

  // 1. Pass API and media routes through immediately without HTML processing
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
    return await next();
  }

  // 2. Redirect www.aeirmist.com to apex aeirmist.com with 301 Permanent Redirect
  if (url.hostname === 'www.aeirmist.com') {
    url.hostname = 'aeirmist.com';
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }

  // 3. Check if running on Cloudflare Pages default domain (*.pages.dev)
  const isPagesDev = url.hostname.endsWith('.pages.dev');

  // Execute downstream handlers (static assets, SPA fallback)
  const response = await next();

  // If accessed via pages.dev preview domain, tell search engines NOT to index it
  if (isPagesDev) {
    const devHeaders = new Headers(response.headers);
    devHeaders.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: devHeaders,
    });
  }

  // 4. For HTML pages on aeirmist.com, dynamically rewrite the canonical URL & og:url
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    // Normalize path: clean multiple slashes, remove trailing slash for subpaths
    let cleanPath = url.pathname.replace(/\/+/g, '/');
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }
    
    // Canonical URL is always on apex https://aeirmist.com without tracking query parameters
    const canonicalUrl = `https://aeirmist.com${cleanPath}`;

    // Private routes that search engines shouldn't index
    const isPrivate = /^\/(settings|messages|inbox|chat|notifications|vault|admin|dashboard|create-post|new-post)/i.test(cleanPath);

    return new HTMLRewriter()
      .on('link[rel="canonical"]', {
        element(el) {
          el.setAttribute('href', canonicalUrl);
        }
      })
      .on('meta[property="og:url"]', {
        element(el) {
          el.setAttribute('content', canonicalUrl);
        }
      })
      .on('meta[name="robots"]', {
        element(el) {
          if (isPrivate) {
            el.setAttribute('content', 'noindex, nofollow');
          }
        }
      })
      .transform(response);
  }

  return response;
};
