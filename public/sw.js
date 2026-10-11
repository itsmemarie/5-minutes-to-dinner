// ─── Service worker: Web Share Target receiver ───────────────────
// Its only job is to catch the POST the share sheet sends to /share-target
// (see "share_target" in manifest.webmanifest), park the shared text and
// photos in Cache Storage, and redirect to /?share=<id>. The page then reads
// them back (src/lib/share/pwaShareInbox.js) and routes them through
// handleIncomingShare — the same entry point a native wrapper will use.
//
// Deliberately no offline caching of the app: every other request goes to the
// network untouched, so a new deploy is never served stale.
const SHARE_CACHE = 'share-inbox-v1'
const MAX_FILES = 6
const MAX_AGE_MS = 24 * 60 * 60 * 1000

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/share-target') {
    event.respondWith(receiveShare(event.request))
  }
})

const text = v => (typeof v === 'string' ? v.slice(0, 20000) : '')

async function receiveShare(request) {
  try {
    const form = await request.formData()
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    const cache = await caches.open(SHARE_CACHE)
    await pruneOld(cache)

    const files = []
    for (const f of form.getAll('media')) {
      if (!(f instanceof File) || !f.size || files.length >= MAX_FILES) continue
      const key = `/share-inbox/${id}/file-${files.length}`
      await cache.put(key, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream' } }))
      files.push({ key, name: f.name, type: f.type, size: f.size })
    }
    const meta = {
      id,
      title: text(form.get('title')),
      text: text(form.get('text')),
      url: text(form.get('url')),
      files,
      receivedAt: Date.now(),
    }
    await cache.put(`/share-inbox/${id}/meta.json`, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }))
    return Response.redirect(`/?share=${id}`, 303)
  } catch {
    return Response.redirect('/?share_error=1', 303)
  }
}

// Shares the app never opened (closed before it loaded) are dropped after a day.
async function pruneOld(cache) {
  for (const req of await cache.keys()) {
    if (!req.url.endsWith('/meta.json')) continue
    const res = await cache.match(req)
    const meta = res ? await res.json().catch(() => null) : null
    if (!meta || Date.now() - (meta.receivedAt || 0) > MAX_AGE_MS) {
      for (const f of meta?.files || []) await cache.delete(f.key)
      await cache.delete(req)
    }
  }
}
