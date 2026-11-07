// ─── TikTok and Instagram posts ───────────────────────────────────
// Neither site serves a recipe page to a server, and what they do serve depends
// on who asks. Checked live in Nov 2026:
//   TikTok     A normal client gets a JSON blob with the caption and the cover
//              pictures, and no meta tags. Facebook's crawler gets meta tags but
//              no caption, and its picture is a share card with a play button
//              over the dish, so that's a last resort. oEmbed has neither now.
//   Instagram  Meta tags carry the caption and a small picture (360x640 for a
//              reel). /media/?size=l redirects to the same one at 720x1280.
// A login wall, a profile or a dead link still answers 200 with a picture of its
// own (the site's logo, someone's avatar), so only a post's own page counts.
import { findPageImageUrls, metaContent } from './recipeSource.ts'
import { APP_UA } from './remoteImage.ts'

export type Social = 'tiktok' | 'instagram'
export interface SocialPost { caption: string | null; imageUrls: string[] }
// `postUrl` is the post's own address, which a short link only reveals by redirect.
export interface Reel extends SocialPost { author: string | null; postUrl: string | null }

const BOT_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
const MAX_IMAGE_URLS = 6

export function socialKind(u: URL): Social | null {
  const h = u.hostname.toLowerCase()
  if (h === 'tiktok.com' || h.endsWith('.tiktok.com')) return 'tiktok'
  if (h === 'instagram.com' || h.endsWith('.instagram.com') || h === 'instagr.am') return 'instagram'
  return null
}

const instagramCode = (u: URL) => u.pathname.match(/\/(?:p|reels?|tv)\/([\w-]+)/)?.[1] ?? null
export const isPost = (u: URL, kind: Social) => (kind === 'tiktok' ? /\/(?:video|photo)\/\d+/.test(u.pathname) : !!instagramCode(u))

// ── Reading a post's page ─────────────────────────────────────────
interface TikTokImage { imageURL?: { urlList?: unknown } }
interface TikTokItem {
  desc?: unknown
  author?: { uniqueId?: unknown }
  video?: { cover?: unknown; originCover?: unknown }
  imagePost?: { images?: TikTokImage[]; cover?: TikTokImage }
}

function tiktokItem(html: string): TikTokItem | null {
  const blob = html.match(/<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]
  if (!blob) return null
  try {
    const scope = JSON.parse(blob)?.__DEFAULT_SCOPE__ ?? {}
    for (const section of Object.values(scope) as { itemInfo?: { itemStruct?: TikTokItem } }[]) {
      if (section?.itemInfo?.itemStruct) return section.itemInfo.itemStruct
    }
  } catch { /* not the shape we know: the crawler's page is the fallback */ }
  return null
}

const strings = (x: unknown): string[] => (Array.isArray(x) ? x : [x]).filter((s): s is string => typeof s === 'string' && !!s)

// A photo post's first slide, then the cover the creator picked. dynamicCover is
// left out: it's the animated one.
const tiktokImages = (item: TikTokItem | null) => [
  ...strings(item?.imagePost?.images?.[0]?.imageURL?.urlList),
  ...strings(item?.imagePost?.cover?.imageURL?.urlList),
  ...strings(item?.video?.cover),
  ...strings(item?.video?.originCover),
]

// Instagram's og:description can read '123 likes, 4 comments - user on May 1, 2026: "caption"'.
const stripInstagramPrefix = (s: string) => {
  const m = s.match(/^[\s\S]*?\bon [A-Z][a-z]+ \d{1,2}, \d{4}:\s*"?([\s\S]*?)"?\.?$/)
  return m ? m[1] : s
}

export function parsePostPage(html: string, kind: Social, pageUrl: string): SocialPost {
  const metaImages = findPageImageUrls(html, pageUrl)
  if (kind === 'instagram') {
    const raw = metaContent(html, 'og:description') ?? metaContent(html, 'description') ?? metaContent(html, 'og:title')
    return { caption: raw ? stripInstagramPrefix(raw) : null, imageUrls: metaImages }
  }
  const item = tiktokItem(html)
  const desc = typeof item?.desc === 'string' ? item.desc.trim() : ''
  return {
    caption: desc || metaContent(html, 'og:description') || metaContent(html, 'description'),
    imageUrls: [...tiktokImages(item), ...metaImages],
  }
}

// The creator's handle. TikTok has it in the post's data and its address; Instagram
// only in the line above the caption: '12 likes - someone on May 1, 2026: "…"'.
export function postAuthor(html: string, kind: Social, postUrl: URL): string | null {
  if (kind === 'instagram') {
    return metaContent(html, 'og:description')?.match(/ - ([\w.]+) on [A-Z][a-z]+ \d{1,2}, \d{4}:/)?.[1] ?? null
  }
  const id = tiktokItem(html)?.author?.uniqueId
  return (typeof id === 'string' && id) || postUrl.pathname.match(/\/@([\w.-]+)/)?.[1] || null
}

// ── Fetching ──────────────────────────────────────────────────────
async function getText(url: string, headers: Record<string, string> = {}): Promise<{ text: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    return { text: (await res.text()).slice(0, 3_000_000), finalUrl: res.url || url }
  } catch {
    return null
  }
}

// Meta's official route, for when an app token is configured.
async function instagramOembedCaption(link: URL, token: string): Promise<string | null> {
  const o = await getText(`https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(link.href)}&access_token=${encodeURIComponent(token)}`)
  try {
    const title = JSON.parse(o?.text ?? '')?.title
    return typeof title === 'string' && title.trim() ? title.trim() : null
  } catch {
    return null
  }
}

// An older oEmbed route that still names the creator when the page doesn't. It isn't
// documented, so it's only a fallback, and losing it just means no handle on the card.
async function instagramOembedAuthor(post: URL): Promise<string | null> {
  const o = await getText(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(post.href)}`, { 'User-Agent': APP_UA })
  try {
    const name = JSON.parse(o?.text ?? '')?.author_name
    return typeof name === 'string' && name ? name : null
  } catch {
    return null
  }
}

// The caption and the post's pictures, best first. Either can come back empty.
// Short links (vm.tiktok.com, instagram.com/share/…) resolve by redirect, so
// what decides if this is a post is where the fetch ended up.
export async function readSocialPost(link: URL, kind: Social, instagramToken?: string): Promise<SocialPost> {
  const { caption, imageUrls } = await readReel(link, kind, instagramToken)
  return { caption, imageUrls }
}

// The same read, plus who posted it and where the post really lives.
export async function readReel(link: URL, kind: Social, instagramToken?: string): Promise<Reel> {
  const post: Reel = { caption: null, imageUrls: [], author: null, postUrl: null }
  let postUrl = isPost(link, kind) ? link : null

  for (const ua of [APP_UA, BOT_UA]) {
    const page = await getText(link.href, { 'User-Agent': ua, 'Accept-Language': 'en' })
    if (!page) continue
    const at = new URL(page.finalUrl)
    if (!isPost(at, kind)) continue
    postUrl = at
    const found = parsePostPage(page.text, kind, at.href)
    // Longest wins: a wall shown at the post's own address has a short line of its own.
    if ((found.caption?.length ?? 0) > (post.caption?.length ?? 0)) post.caption = found.caption
    post.imageUrls.push(...found.imageUrls.filter(u => !post.imageUrls.includes(u)))
    post.author ??= postAuthor(page.text, kind, at)
    if (post.caption && post.imageUrls.length) break
  }

  if (kind === 'instagram') {
    const code = postUrl && instagramCode(postUrl)
    if (code) post.imageUrls.unshift(`https://www.instagram.com/p/${code}/media/?size=l`)
    if (!post.caption && instagramToken) post.caption = await instagramOembedCaption(link, instagramToken)
  }
  post.imageUrls = post.imageUrls.slice(0, MAX_IMAGE_URLS)
  post.postUrl = postUrl?.href ?? null
  return post
}

// Separate from readReel so importing a recipe never spends the extra request.
export async function readReelAuthor(post: Reel, kind: Social): Promise<string | null> {
  if (post.author) return post.author
  if (kind === 'instagram' && post.postUrl) return await instagramOembedAuthor(new URL(post.postUrl))
  return post.postUrl?.match(/\/@([\w.-]+)/)?.[1] ?? null
}
