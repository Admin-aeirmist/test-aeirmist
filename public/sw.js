const CACHE_NAME = 'aeirmist-static-v102';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  try {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(PRECACHE_ASSETS))
        .then(() => self.skipWaiting())
    );
  } catch (error) {
    console.error('Service Worker: error during install:', error);
  }
});

self.addEventListener('activate', (event) => {
  try {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => self.clients.claim())
    );
  } catch (error) {
    console.error('Service Worker: error during activate:', error);
  }
});

self.addEventListener('fetch', (event) => {
  try {
    const url = new URL(event.request.url);
    
    // Strict network-only check for non-same-origin or Firebase API calls
    const isFirebase = 
      url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebaseinstallations.googleapis.com') ||
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.hostname.includes('firebasestorage.googleapis.com');
      
    const isSameOrigin = url.origin === self.location.origin;

    // Do NOT cache non-GET requests or Firebase requests or non-same-origin requests
    if (event.request.method !== 'GET' || isFirebase || !isSameOrigin) {
      return; // Fallback to browser standard fetch
    }

    // Cache-first strategy ONLY for static assets (JS/CSS/images/fonts) under /assets/
    if (url.pathname.startsWith('/assets/')) {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          }).catch(() => {
            // Silence fetch errors
          });
        })
      );
    } else {
      // For other same-origin requests (like index.html, manifest.json, logos etc.)
      // do network-first or cached-fallback
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            return caches.match(event.request);
          })
      );
    }
  } catch (error) {
    console.error('Service Worker: error during fetch:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

