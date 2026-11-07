// ─── reel-thumbnail ───────────────────────────────────────────────
// Keeps our own copy of a reel's still, and notes who posted it. Our own copy
// because TikTok's picture addresses expire. The pictures come from the post's page
// (_shared/socialPost.ts), not oEmbed: as of Nov 2026, neither site's oEmbed returns
// a thumbnail_url or an author_name.
//
// POST { recipe_id }  does one recipe; the app calls this when a link is saved and
//                     when a reel with no still comes up in the deck.
// POST { all: true }  does up to BATCH_SIZE reels with no still, for after links
//                     are filled in by something other than the app.
//
// Deploy with JWT checks on, like the other image functions. The link always comes
// from the recipe's row, never the request, so callers can't point this at anything.
import { serviceClient } from '../_shared/auth.ts'
import { json, jsonError, preflight } from '../_shared/http.ts'
import { fetchRemoteImage } from '../_shared/remoteImage.ts'
import { type Social, isPost, readReel, readReelAuthor, socialKind } from '../_shared/socialPost.ts'

const BUCKET = 'recipe-images'
const BATCH_SIZE = 20

interface ReelRow { id: string; source_url: string | null }

async function firstPicture(urls: string[]) {
  for (const url of urls) {
    const picture = await fetchRemoteImage(url).catch(() => null)
    if (picture) return picture
  }
  return null
}

const toBytes = (base64: string) => Uint8Array.from(atob(base64), c => c.charCodeAt(0))

async function refresh({ id, source_url }: ReelRow) {
  let link: URL
  try { link = new URL(source_url ?? '') } catch { return { recipe_id: id, error: 'no_link' } }
  const kind: Social | null = socialKind(link)
  if (!kind) return { recipe_id: id, error: 'not_a_reel' }

  const post = await readReel(link, kind, Deno.env.get('INSTAGRAM_OEMBED_TOKEN')?.trim())
  const picture = await firstPicture(post.imageUrls)
  if (!picture) return { recipe_id: id, error: 'no_picture' }
  const author = await readReelAuthor(post, kind)

  const supabase = serviceClient()
  // A short link can't be embedded, so it gives way to the post's own address. This
  // goes first because the database clears the still whenever a link changes.
  const canonical = !isPost(link, kind) && post.postUrl ? post.postUrl : link.href
  if (canonical !== link.href) {
    const { error } = await supabase.from('recipes').update({ source_url: canonical }).eq('id', id)
    if (error) throw new Error(`link: ${error.message}`)
  }

  const path = `reels/${id}.jpg`
  const { error: uploadError } = await supabase.storage.from(BUCKET)
    .upload(path, toBytes(picture.base64), { contentType: picture.mediaType, upsert: true, cacheControl: '300' })
  if (uploadError) throw new Error(`upload: ${uploadError.message}`)

  const { error } = await supabase.from('recipes').update({ video_thumb_path: path, source_author: author }).eq('id', id)
  if (error) throw new Error(`save: ${error.message}`)
  return { recipe_id: id, path, author, source_url: canonical }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return jsonError('POST only', 'method_not_allowed', 405)

  try {
    const body = await req.json().catch(() => ({}))
    const supabase = serviceClient()

    if (body?.all === true) {
      const { data, error } = await supabase.from('recipes').select('id, source_url')
        .not('source_platform', 'is', null).is('video_thumb_path', null).limit(BATCH_SIZE)
      if (error) throw error
      const results = []
      for (const row of data ?? []) results.push(await refresh(row).catch(e => ({ recipe_id: row.id, error: String(e.message ?? e) })))
      return json({ ok: true, results })
    }

    if (typeof body?.recipe_id !== 'string' || !body.recipe_id) return jsonError('recipe_id is required', 'bad_request', 400)
    const { data, error } = await supabase.from('recipes').select('id, source_url').eq('id', body.recipe_id).maybeSingle()
    if (error) throw error
    if (!data) return jsonError('No such recipe', 'not_found', 404)
    return json(await refresh(data))
  } catch (e) {
    console.error('reel-thumbnail failed', e)
    return jsonError("Couldn't get that reel's picture", 'reel_thumbnail_failed')
  }
})
