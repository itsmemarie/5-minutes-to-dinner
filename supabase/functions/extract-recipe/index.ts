// Recipe workflow, step 1 — Extract.
// A 1:1 transcription of the source: nothing added, corrected or guessed.
// Input: { url } | { text } | { images: [{ base64, mediaType }] }
// Output: NewRecipeForm fields present in the source, plus `origin`:
//   'page-data' — read from the page's schema.org Recipe data, no AI used
//   'ai'        — transcribed by the model
import { aiHandler, aiResponse, badInput, runAiStep, StepError } from '../_shared/router.ts'
import { type Transcript, findJsonLdRecipe, pageTextForAi, transcriptToFields } from '../_shared/recipeSource.ts'
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
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h)) {
    throw badInput("That address can't be read from here.")
  }
  return u
}

async function fetchPage(u: URL): Promise<string> {
  let res: Response
  try {
    res = await fetch(u, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 5MinutesToDinner/1.0; recipe import)', Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new StepError("Couldn't open that page. Check the link, or paste the recipe text instead.", 'fetch_failed', 400)
  }
  if (!res.ok) throw new StepError(`That page answered with an error (${res.status}). Try pasting the recipe text instead.`, 'fetch_failed', 400)
  return (await res.text()).slice(0, 3_000_000)
}

const done = (fields: Record<string, unknown>, origin: string) => {
  if (!fields.name && !fields.ingredients && !fields.instructions_standard) {
    throw new StepError("Couldn't find a recipe there. Try a clearer photo or crop, or paste the text.", 'nothing_found', 422)
  }
  return { ...fields, origin }
}

Deno.serve(aiHandler(async (req, body) => {
  const { url, text, images } = body

  let user: string
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
    const html = await fetchPage(checkUrl(url))
    // Structured page data is already a transcription — no AI needed.
    const fromPage = findJsonLdRecipe(html)
    if (fromPage) return json(done(transcriptToFields(fromPage), 'page-data'))
    const pageText = pageTextForAi(html)
    if (pageText.length < 80) throw new StepError("That page didn't have readable recipe text. Try pasting the recipe instead.", 'nothing_found', 422)
    user = `Transcribe the recipe on this web page:\n\n${pageText}`
  } else if (typeof text === 'string' && text.trim()) {
    user = `Transcribe this recipe:\n\n${text.trim().slice(0, MAX_TEXT)}`
  } else {
    throw badInput('Send a link, some text or a photo.')
  }

  const { data, meta } = await runAiStep(req, 'recipe_extract', { system: SYSTEM, user, images: imgs, schema: SCHEMA })
  return aiResponse(done(transcriptToFields((data ?? {}) as Transcript), 'ai'), meta)
}))
