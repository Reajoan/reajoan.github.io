// Service Worker for MD. Reajoan Portfolio (Enhanced for PWA)

const CACHE_NAME = '26-7-2025';
const OFFLINE_URL = '/offline.html'; // Optional fallback page

// Core assets to cache for offline functionality
const urlsToCache = [
  // HTML
  '/',
  '/index.html',

  // Manifest and icons
  '/manifest.json',
  // Note: Data URIs for icons are generally fine to cache via addAll,
  // but if you encounter issues, consider serving them as separate files.
  'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 192 192\'><rect width=\'192\' height=\'192\' rx=\'38\' fill=\'%2310b981\'/><text x=\'96\' y=\'125\' font-family=\'Arial\' font-size=\'68\' font-weight=\'bold\' text-anchor=\'middle\' fill=\'white\'>MR</text></svg>',

  // Profile image
  'https://avatars.githubusercontent.com/u/29954535?v=4',

  // Google Fonts (Inter)
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZg.ttf',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZs.ttf'
];

// ===== INSTALL EVENT =====
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
    .then((cache) => {
      console.log('[Service Worker] Caching core assets');
      return cache.addAll(urlsToCache)
        .then(() => {
          console.log('[Service Worker] All assets cached');
        })
        .catch((error) => {
          console.error('[Service Worker] Cache addAll error:', error);
        });
    })
  );
});

// ===== ACTIVATE EVENT =====
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

// ===== FETCH EVENT =====
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  // 🐛 FIX: Prevent caching of unsupported schemes like 'chrome-extension://'
  // Service Workers cannot intercept or cache requests from 'chrome-extension://' schemes due to security restrictions.
  if (requestUrl.protocol === 'chrome-extension:') {
    console.warn('[Service Worker] Skipping caching for unsupported scheme (chrome-extension):', event.request.url);
    // Do not call event.respondWith for these requests, let the browser handle them naturally.
    return;
  }

  // Network-first for API calls, cache-first for assets
  if (requestUrl.pathname.includes('/api/')) {
    event.respondWith(networkFirstStrategy(event));
  } else {
    event.respondWith(cacheFirstStrategy(event));
  }
});

// ===== STRATEGIES =====
function cacheFirstStrategy(event) {
  return caches.match(event.request)
    .then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
          // Check if valid response (e.g., status 2xx).
          // Do not cache opaque responses or those that are not OK.
          // Opaque responses are cross-origin requests where the server doesn't send CORS headers,
          // making them unreadable by JavaScript and uncacheable by Service Workers.
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            console.warn(`[Service Worker] Not caching "${event.request.url}" due to status ${networkResponse ? networkResponse.status : 'N/A'} or type "${networkResponse ? networkResponse.type : 'N/A'}".`);
            return networkResponse; // Return the network response as is, without caching.
          }

          // Clone and cache the response
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache)
                .catch((cachePutError) => {
                  console.error('[Service Worker] Failed to put response in cache:', cachePutError, 'for URL:', event.request.url);
                });
            })
            .catch((openCacheError) => {
              console.error('[Service Worker] Failed to open cache for put operation:', openCacheError);
            });

          return networkResponse;
        })
        .catch((fetchError) => {
          console.error('[Service Worker] Fetch failed for:', event.request.url, fetchError);
          // If both cache and network fail, show offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL) ||
              new Response('<h1>You are offline</h1><p>Please check your connection.</p>', {
                headers: {
                  'Content-Type': 'text/html'
                }
              });
          }
          return new Response('Offline - Content not available', {
            status: 503
          });
        });
    });
}

function networkFirstStrategy(event) {
  return fetch(event.request)
    .then((networkResponse) => {
      // Check if valid response. Similar to cacheFirstStrategy, avoid caching opaque or non-OK responses.
      if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
        console.warn(`[Service Worker] Not caching API "${event.request.url}" due to status ${networkResponse ? networkResponse.status : 'N/A'} or type "${networkResponse ? networkResponse.type : 'N/A'}".`);
        return networkResponse; // Return the network response as is, without caching.
      }

      // Update cache with fresh API response
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME)
        .then((cache) => {
          cache.put(event.request, responseToCache)
            .catch((cachePutError) => {
              console.error('[Service Worker] Failed to put API response in cache (networkFirst):', cachePutError, 'for URL:', event.request.url);
            });
        })
        .catch((openCacheError) => {
          console.error('[Service Worker] Failed to open cache for API put operation:', openCacheError);
        });

      return networkResponse;
    })
    .catch((fetchError) => {
      console.error('[Service Worker] Network fetch failed in networkFirstStrategy for:', event.request.url, fetchError);
      // Fall back to cache if network fails
      return caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log(`[Service Worker] Serving API from cache (fallback): ${event.request.url}`);
            return cachedResponse;
          }
          // If no cached response either, return an appropriate error response
          return new Response('API data unavailable offline', {
            status: 503
          });
        });
    });
}

// ===== BACKGROUND SYNC (OPTIONAL) =====
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[Service Worker] Background sync triggered');
    // Implement your background sync logic here, e.g., sending queued data.
  }
});
