// Service Worker for MD. Reajoan Portfolio (Enhanced for PWA)

const CACHE_NAME = '22-7-2025v2';
const OFFLINE_URL = '/offline.html'; // Optional fallback page

// Core assets to cache for offline functionality
const urlsToCache = [
  // HTML
  '/',
  '/index.html',
  
  // Manifest and icons
  '/manifest.json',
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
  // Skip non-GET requests and cross-origin requests (except those we want to cache)
  if (event.request.method !== 'GET') return;
  
  const requestUrl = new URL(event.request.url);
  
  // Network-first for API calls, cache-first for assets
  if (event.request.url.includes('/api/')) {
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
          // Check if valid response
          if (!networkResponse.ok) throw new Error('Network response not OK');
          
          // Clone and cache the response
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache));
          
          return networkResponse;
        })
        .catch(() => {
          // If both cache and network fail, show offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL) || 
              new Response('<h1>You are offline</h1><p>Please check your connection.</p>', {
                headers: { 'Content-Type': 'text/html' }
              });
          }
          return new Response('Offline - Content not available', { status: 503 });
        });
    });
}

function networkFirstStrategy(event) {
  return fetch(event.request)
    .then((networkResponse) => {
      // Update cache with fresh API response
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME)
        .then((cache) => cache.put(event.request, responseToCache));
      
      return networkResponse;
    })
    .catch(() => {
      // Fall back to cache if network fails
      return caches.match(event.request);
    });
}

// ===== BACKGROUND SYNC (OPTIONAL) =====
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[Service Worker] Background sync triggered');
    // Implement your background sync logic here
  }
});
