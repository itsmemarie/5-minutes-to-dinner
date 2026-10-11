// ─── PWA share target, page side ──────────────────────────────────
// public/sw.js receives the share sheet's POST, parks the text and files in
// Cache Storage and redirects to /?share=<id>. This reads the share back,
// deletes it, and hands it to handleIncomingShare — the same entry point a
// native wrapper will use.
import { handleIncomingShare } from './handleIncomingShare.js'

export const SHARE_CACHE = 'share-inbox-v1'
export const SHARE_PARAM = 'share'

// Resolves to the normalised share, or null when there is none. Throws when
// the service worker reported that it couldn't store the share.
export async function consumePwaShare() {
  const params = new URLSearchParams(window.location.search)
  const id = params.get(SHARE_PARAM)
  const failed = params.has('share_error')
  if (!id && !failed) return null

  // Drop the params straight away so a reload doesn't re-open the share.
  params.delete(SHARE_PARAM)
  params.delete('share_error')
  const rest = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`)
  if (failed) throw new Error("That share didn't come through. Try sharing again, or copy and paste it instead.")

  if (!('caches' in window) || !/^[a-z0-9]{6,40}$/i.test(id)) return null
  try {
    const cache = await caches.open(SHARE_CACHE)
    const metaKey = `/share-inbox/${id}/meta.json`
    const metaRes = await cache.match(metaKey)
    if (!metaRes) return null
    const meta = await metaRes.json()
    const files = []
    for (const f of meta.files || []) {
      const res = await cache.match(f.key)
      if (!res) continue
      const blob = await res.blob()
      files.push(new File([blob], f.name || 'shared-photo', { type: f.type || blob.type }))
      await cache.delete(f.key)
    }
    await cache.delete(metaKey)
    return handleIncomingShare({ title: meta.title, text: meta.text, url: meta.url, files, source: 'pwa' })
  } catch (e) {
    console.error('share inbox read failed', e)
    return null
  }
}
