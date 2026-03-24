const CACHE_NAME = 'loanpro-v1'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - network-first strategy for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API requests, auth, and external URLs
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // For navigation requests, show cached login/home
          if (request.mode === 'navigate') {
            return caches.match('/login')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

// Push notification support
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'LoanPro', body: 'Nova notificação' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
    })
  )
})
