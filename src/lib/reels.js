// ─── Reel links ───────────────────────────────────────────────────
// Pure. source_url also holds ordinary recipe links, so anything that treats a
// recipe as having a reel goes through here. The database keeps
// recipes.source_platform in step using the same two patterns (see the
// recipes_sync_reel_fields trigger).
const INSTAGRAM = /^https?:\/\/([a-z0-9-]+\.)*(instagram\.com|instagr\.am)([/?#]|$)/i
const TIKTOK = /^https?:\/\/([a-z0-9-]+\.)*tiktok\.com([/?#]|$)/i

export function reelPlatform(url) {
  if (typeof url !== 'string') return null
  if (INSTAGRAM.test(url)) return 'instagram'
  if (TIKTOK.test(url)) return 'tiktok'
  return null
}
