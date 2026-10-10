/* Sagamente: no private responses or authenticated pages are stored offline. */
const STATIC_CACHE = 'sagamente-static-v1'
const ASSET_CACHE = 'sagamente-assets-v1'
const OFFLINE = '/offline.html'
self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll([
    OFFLINE, '/manifest.webmanifest', '/pwa/icon-180.png',
    '/pwa/icon-192.png', '/pwa/icon-512.png', '/pwa/maskable-512.png'
  ])))
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith('sagamente-') && name !== STATIC_CACHE && name !== ASSET_CACHE).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Always retrieve HTML from the network. Never store private account responses.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error()))
    return
  }
  const suffix = url.pathname.split('.').pop()?.toLowerCase()
  if (url.pathname.startsWith('/assets/') &&
      ['js', 'css', 'woff', 'woff2', 'ttf', 'svg', 'png', 'webp', 'avif'].includes(suffix) &&
      ['script', 'style', 'font', 'image'].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE)
      const stored = await cache.match(request)
      if (stored) return stored
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    })())
  }
})


// Notification data must never contain project/Drive secrets. All routes stay on this origin.
function safeDestination(path) {
  if (typeof path !== 'string') return '/app/notificacoes'
  return /^\/(?:app|admin)\/[a-zA-Z0-9/_-]*(?:\?[a-zA-Z0-9=&_-]*)?$/.test(path)
    ? path : '/app/notificacoes'
}
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {}
    try { payload = event.data?.json() || {} } catch { payload = {} }
    const title = typeof payload.title === 'string' ? payload.title.slice(0,100) : 'Sagamente'
    const body = typeof payload.body === 'string' ? payload.body.slice(0,180) : 'Você tem uma atualização.'
    const url = safeDestination(payload.url)
    const tag = typeof payload.tag === 'string' && /^sagamente-[a-z_-]+$/.test(payload.tag)
      ? payload.tag : 'sagamente-update'
    await self.registration.showNotification(title, {
      body,tag,icon:'/pwa/icon-192.png',badge:'/pwa/icon-192.png',data:{url},
      renotify:false
    })
  })())
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const url = safeDestination(event.notification.data?.url)
    const destination = new URL(url,self.location.origin).href
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true})
    for(const win of windows) {
      if(new URL(win.url).origin !== self.location.origin)continue
      if('focus' in win) {
        await win.focus()
        if('navigate' in win)await win.navigate(destination)
        return
      }
    }
    if(self.clients.openWindow)await self.clients.openWindow(destination)
  })())
})
