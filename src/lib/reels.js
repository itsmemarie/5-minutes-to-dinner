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

// What it takes to play a reel in the app, or null when the link doesn't say which
// post it is. That's a short link (vm.tiktok.com/…), which reel-thumbnail swaps for
// the post's own address the first time it runs. `checkUrl` is a tokenless oEmbed
// call that tells a live post from a dead one before anything is mounted.
export function reelEmbed(url) {
  const platform = reelPlatform(url)
  if (!platform) return null
  const path = new URL(url).pathname
  if (platform === 'instagram') {
    const code = path.match(/\/(?:p|reels?|tv)\/([\w-]+)/)?.[1]
    if (!code) return null
    const post = `https://www.instagram.com/p/${code}/`
    return { platform, src: `${post}embed/`, checkUrl: `https://graph.facebook.com/instagram_oembed?url=${encodeURIComponent(post)}&omitscript=true` }
  }
  const id = path.match(/\/(?:video|photo)\/(\d+)/)?.[1]
  return id ? { platform, src: `https://www.tiktok.com/player/v1/${id}?autoplay=1` } : null
}

// Instagram answers oEmbed with a 400, code 24, for a deleted or private post. Any
// other failure says nothing about the post, so the embed still gets its chance.
export const isDeadInstagramPost = (status, body) => status === 400 && body?.error?.code === 24

// TikTok's oEmbed answers 200 even for a video that doesn't exist, so its player is
// the only one who knows. These codes mean the video won't play for anyone. The
// player's other two, 3001 (playback) and 3002 (autoplay blocked), can be passing,
// and it stays up with its own controls.
const DEAD_TIKTOK_CODES = [1001, 2001]
export const isDeadTikTokMessage = data =>
  data?.['x-tiktok-player'] === true && data.type === 'onPlayerError' && DEAD_TIKTOK_CODES.includes(data.value?.errorCode)
