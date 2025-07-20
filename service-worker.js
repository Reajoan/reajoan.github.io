// A unique name for your cache. Update this version number (e.g., v1.1 to v1.2)
// whenever you make changes to index.html or other assets listed below.
const CACHE_NAME = '20-7-2025v2'; 

// List of all URLs that your single page needs to function offline.
// - '/': Covers the root URL when accessed directly.
// - '/index.html': The specific HTML file.
// - 'https://avatars.githubusercontent.com/u/29954535?v=4': Your profile image URL.
// Add any other external images, video, or audio files your page explicitly links to if you want them cached.
const urlsToCache = [
  '/', 
  '/index.html',
  'https://avatars.githubusercontent.com/u/29954535?v=4', // Ensure this URL is correct
  // Note: Google Fonts URLs are typically handled with a more advanced runtime caching strategy
  // if full offline font support is critical, but this basic setup covers your main page.
  // For basic offline, fonts might not load, but the site structure will be there.
];

// 1. Install Event: Triggered when the service worker is installed for the first time.
// This is where you typically cache your 'app shell' (core UI and static assets).
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil( // Ensures the service worker doesn't install until the caching is complete
    caches.open(CACHE_NAME) // Opens the named cache
      .then((cache) => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll(urlsToCache); // Adds all specified URLs to the cache
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache during install', error);
      })
  );
});

// 2. Activate Event: Triggered when the service worker takes control of the page.
// This is used to clean up old caches, ensuring users always get the latest version.
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => { // Gets all cache names
      return Promise.all( // Waits for all old caches to be deleted
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) { // If a cache name doesn't match the current one
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName); // Delete the old cache
          }
        })
      );
    })
  );
  // This line ensures the service worker takes control of the page immediately after activation.
  event.waitUntil(self.clients.claim()); 
});

// 3. Fetch Event: Intercepts network requests made by the page.
// This defines how your PWA responds to network requests (e.g., serve from cache first, then network).
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests and requests from your own origin for basic caching.
  // This avoids issues with third-party tracking pixels, ads, etc.
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    // For cross-origin resources (like Google Fonts) not explicitly in urlsToCache,
    // they will be fetched normally from the network if online.
    return; 
  }

  event.respondWith( // Responds to the fetch request
    caches.match(event.request) // Tries to find the request in the cache
      .then((response) => {
        // If a match is found in the cache, return it
        if (response) {
          return response;
        }

        // If not found in cache, fetch from the network
        const fetchRequest = event.request.clone(); // Clone the request because it's a stream

        return fetch(fetchRequest)
          .then((networkResponse) => {
            // Check if we received a valid response from the network
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse; // Return invalid responses as is
            }

            // If valid, clone the response to store it in cache and return to browser
            const responseToCache = networkResponse.clone(); 

            caches.open(CACHE_NAME) // Open the current cache
              .then((cache) => {
                cache.put(event.request, responseToCache); // Store the network response in cache
              });

            return networkResponse; // Return the network response to the page
          })
          .catch((error) => {
            // This catch block handles network failures (e.g., user is offline)
            console.error('Service Worker: Fetch failed. Network likely offline or resource not cached.', error);
            // If network fails and the resource isn't in cache, you might serve a custom offline page here
            // if (event.request.mode === 'navigate') { 
            //   return caches.match('/offline.html'); // Assuming you have an offline.html
            // }
            // For other resource types (images, etc.), you might just return an empty/error response.
            // For a basic portfolio, falling back to cached content is the primary goal.
            return new Response('Network error or content not in cache.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
          });
      })
  );
});
