// Recipe workflow, step 1 — Extract.
// A 1:1 transcription of the source: nothing added, corrected or guessed.
// Input: { url, photoOnly? } | { text } | { images: [{ base64, mediaType }] }
// With photoOnly the output is just { image } (null when there isn't one), and no
// AI runs: for a link added to a recipe rather than read into one.
// Output: NewRecipeForm fields present in the source, plus `origin`:
//   'page-data'  — read from the page's schema.org Recipe data, no AI used
//   'ai'         — transcribed by the model
//   'social'     — transcribed by the model from a TikTok / Instagram caption
//   'image-only' — a link with a photo but no readable recipe, like a post whose
//                  recipe is only in the video; only `image` is set
// and, for a link, `image: { base64, mediaType, from }` — the page's own photo.
import { aiHandler, aiResponse, badInput, runAiStep, StepError } from '../_shared/router.ts'
import { type Transcript, cleanText, findJsonLdRecipe, findPageImageUrls, pageTextForAi, transcriptToFields } from '../_shared/recipeSource.ts'
import { APP_UA, fetchRemoteImage, isPrivateHost } from '../_shared/remoteImage.ts'
import { type Social, readSocialPost, socialKind } from '../_shared/socialPost.ts'
import { json } from '../_shared/http.ts'

const SYSTEM = `You transcribe recipes into JSON exactly as they appear in the source.
Copy wording, amounts, units, spelling and order 1:1. Do not add, infer, correct, convert, translate or summarise anything, and do not fill gaps: use null when the source doesn't say. Ignore adverts, life stories, comments and navigation.
Keys:
name: the recipe title
servings: servings or yield as written
prep_time, cook_time, total_time: as written, e.g. "15 mins"
ingredients: array, one string per ingredient line; a sub-heading becomes "[Heading]"
steps: array, one string per method step, without its number
notes: tips, notes or storage text as one string`

const S = { anyOf: [{ type: 'string' }, { type: 'null' }] }
const LIST = { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] }
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'servings', 'prep_time', 'cook_time', 'total_time', 'ingredients', 'steps', 'notes'],
  properties: { name: S, servings: S, prep_time: S, cook_time: S, total_time: S, ingredients: LIST, steps: LIST, notes: S },
}

const MAX_IMAGES = 3
const MAX_IMAGE_B64 = 4_000_000   // ~3 MB per photo; the client sends ~100-250 KB
const MAX_TEXT = 12_000

// Only public http(s) pages — not this server's own network.
function checkUrl(raw: unknown): URL {
  let u: URL
  try { u = new URL(String(raw).trim()) } catch { throw badInput("That doesn't look like a web address.") }
  if (!/^https?:$/.test(u.protocol)) throw badInput('Only http and https links can be read.')
  if (isPrivateHost(u.hostname)) throw badInput("That address can't be read from here.")
  return u
}

async function fetchPage(u: URL): Promise<string> {
  let res: Response
  try {
    res = await fetch(u, {
      headers: { 'User-Agent': APP_UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new StepError("Couldn't open that page. Check the link, or paste the recipe text instead.", 'fetch_failed', 400)
  }
  if (!res.ok) throw new StepError(`That page answered with an error (${res.status}). Try pasting the recipe text instead.`, 'fetch_failed', 400)
  return (await res.text()).slice(0, 3_000_000)
}

interface SourceImage { base64: string; mediaType: string; from: string }

// The page's photo, fetched while the recipe is read. Never fails the import:
// no picture (or a slow one) just means no picture. `urls` are tried in order.
async function pageImage(urls: string[], from: string): Promise<SourceImage | null> {
  const signal = AbortSignal.timeout(10_000)
  for (const url of urls) {
    try {
      const img = await fetchRemoteImage(url, { signal })
      if (img) return { base64: img.base64, mediaType: img.mediaType, from }
    } catch {
      if (signal.aborted) break
    }
  }
  return null
}

const siteName = (u: URL) => u.hostname.replace(/^(www|m)\./, '')
const readPost = (page: URL, kind: Social) => readSocialPost(page, kind, Deno.env.get('INSTAGRAM_OEMBED_TOKEN')?.trim())

async function linkPhoto(page: URL, kind: Social | null): Promise<SourceImage | null> {
  if (kind) return pageImage((await readPost(page, kind)).imageUrls, `${kind}.com`)
  return pageImage(findPageImageUrls(await fetchPage(page), page.href).slice(0, 3), siteName(page))
}

const NOTHING_FOUND = "Couldn't find a recipe there. Try a clearer photo or crop, or paste the text."
const CAPTION_NOT_FOUND = "Couldn't read that post's caption. Paste the caption text, or add a screenshot of the recipe instead."
const NO_RECIPE_IN_CAPTION = "That post's caption doesn't include the recipe — it's probably only spoken or shown in the video. Paste the recipe text or add screenshots instead."

async function done(fields: Record<string, unknown>, origin: string, image: Promise<SourceImage | null> | null, notFound = NOTHING_FOUND) {
  const img = image ? await image : null
  const found = !!(fields.name || fields.ingredients || fields.instructions_standard)
  if (!found && img) return { origin: 'image-only', image: img }
  if (!found) throw new StepError(notFound, 'nothing_found', 422)
  return img ? { ...fields, origin, image: img } : { ...fields, origin }
}

// The photo is what matters most here, so nothing about the caption can lose it:
// no recipe in it, or the AI failing, still brings the picture across.
async function importSocialPost(req: Request, page: URL, kind: Social) {
  const post = await readPost(page, kind)
  const image = pageImage(post.imageUrls, `${kind}.com`)
  const caption = cleanText(post.caption)
  if (!caption) return json(await done({}, 'social', image, CAPTION_NOT_FOUND))
  // A caption with no list or quantities is a description, not a recipe.
  if (caption.length < 60 || !/\d|\n|ingredient/i.test(caption)) return json(await done({}, 'social', image, NO_RECIPE_IN_CAPTION))

  const user = `Transcribe the recipe in this ${kind === 'tiktok' ? 'TikTok' : 'Instagram'} post caption. Ignore hashtags, @mentions and calls to follow or like:\n\n${caption.slice(0, MAX_TEXT)}`
  let ai: Awaited<ReturnType<typeof runAiStep>>
  try {
    ai = await runAiStep(req, 'recipe_extract', { system: SYSTEM, user, schema: SCHEMA })
  } catch (e) {
    if (await image) return json(await done({}, 'social', image))
    throw e
  }
  const fields = transcriptToFields((ai.data ?? {}) as Transcript)
  const isRecipe = fields.ingredients || fields.instructions_standard
  return aiResponse(await done(isRecipe ? fields : {}, 'social', image, NO_RECIPE_IN_CAPTION), ai.meta)
}

Deno.serve(aiHandler(async (req, body) => {
  const { url, text, images, photoOnly } = body

  let user: string
  let image: Promise<SourceImage | null> | null = null
  let imgs: { base64: string; mediaType?: string }[] | undefined
  if (Array.isArray(images) && images.length) {
    if (images.length > MAX_IMAGES) throw badInput(`Up to ${MAX_IMAGES} photos at a time, please.`)
    imgs = images.map((i: { base64?: unknown; mediaType?: unknown }) => {
      if (typeof i?.base64 !== 'string' || !i.base64 || i.base64.length > MAX_IMAGE_B64) throw badInput('One of the photos is missing or too large.')
      return { base64: i.base64, mediaType: typeof i.mediaType === 'string' ? i.mediaType : 'image/jpeg' }
    })
    user = imgs.length > 1
      ? 'These photos are pages of one recipe, in order. Transcribe it.'
      : 'Transcribe the recipe in this photo.'
  } else if (url) {
    const page = checkUrl(url)
    const social = socialKind(page)
    if (photoOnly) return json({ image: await linkPhoto(page, social) })
    if (social) return await importSocialPost(req, page, social)
    const html = await fetchPage(page)
    image = pageImage(findPageImageUrls(html, page.href).slice(0, 3), siteName(page))
    // Structured page data is already a transcription — no AI needed.
    const fromPage = findJsonLdRecipe(html)
    if (fromPage) return json(await done(transcriptToFields(fromPage), 'page-data', image))
    const pageText = pageTextForAi(html)
    if (pageText.length < 80) {
      return json(await done({}, 'page-data', image, "That page didn't have readable recipe text. Try pasting the recipe instead."))
    }
    user = `Transcribe the recipe on this web page:\n\n${pageText}`
  } else if (typeof text === 'string' && text.trim()) {
    user = `Transcribe this recipe:\n\n${text.trim().slice(0, MAX_TEXT)}`
  } else {
    throw badInput('Send a link, some text or a photo.')
  }

  const { data, meta } = await runAiStep(req, 'recipe_extract', { system: SYSTEM, user, images: imgs, schema: SCHEMA })
  return aiResponse(await done(transcriptToFields((data ?? {}) as Transcript), 'ai', image), meta)
}))
