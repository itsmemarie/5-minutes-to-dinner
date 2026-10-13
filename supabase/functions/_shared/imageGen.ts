// ─── AI recipe photos: prompt + provider chain ────────────────────
// Pure (providers are injected), unit-tested from vitest. Neither Claude nor
// Groq can draw, so pictures have their own small chain instead of the text
// steps in aiCatalogue.ts:
//   1. Cloudflare Workers AI (FLUX.1 schnell) on the owner's account — free
//      daily allowance, everyone may use it
//   2. Google's image model — paid per image, so only on the owner's server
//      key for the signed-in owner, or on a user's own key
// Whichever secrets are set decide which steps exist (imageProviders.ts).
import { AiProviderError } from './aiErrors.ts'
import { StepError } from './aiChain.ts'

export interface GeneratedImage { base64: string; mediaType: string }
export interface ImageAttempt { provider: string; model: string; run: () => Promise<GeneratedImage> }

export const IMAGE_MESSAGES = {
  image_unavailable: "AI photos aren't set up yet. Upload a photo instead.",
  image_limited: "Today's free AI photos are used up. Try again tomorrow, or upload a photo.",
  image_refused: 'The AI declined to draw this one. Upload a photo instead.',
  image_failed: "The AI photo didn't come through. Try again, or upload a photo.",
}

// Each attempt is tried in turn; anything but a refusal moves on to the next.
// `detail` (the owner) gets the last provider's own words for debugging.
export async function runImageChain(attempts: ImageAttempt[], { detail = false } = {}) {
  if (!attempts.length) throw new StepError(IMAGE_MESSAGES.image_unavailable, 'image_unavailable', 503)
  let limited = false
  let last: unknown = null
  for (const a of attempts) {
    try {
      return { ...(await a.run()), provider: a.provider, model: a.model }
    } catch (e) {
      if (e instanceof AiProviderError && e.kind === 'refused') throw new StepError(IMAGE_MESSAGES.image_refused, 'image_refused', 422)
      if (e instanceof AiProviderError && e.kind === 'limit') limited = true
      console.error(`image ${a.provider} failed:`, e instanceof Error ? e.message : e)
      last = e
    }
  }
  const [code, status] = limited ? ['image_limited', 429] as const : ['image_failed', 502] as const
  const why = detail && last instanceof Error ? ` (${last.message})` : ''
  throw new StepError(IMAGE_MESSAGES[code] + why, code, status)
}

// The first picture in a provider reply: an Interactions content block
// ({ type: 'image', data, mime_type }) or a generateContent part ({ inlineData }).
export function findImageBlock(node: unknown, depth = 0): GeneratedImage | null {
  if (!node || typeof node !== 'object' || depth > 8) return null
  if (Array.isArray(node)) {
    for (const x of node) { const r = findImageBlock(x, depth + 1); if (r) return r }
    return null
  }
  const o = node as Record<string, unknown>
  if (o.type === 'image' && typeof o.data === 'string' && o.data) {
    return { base64: o.data, mediaType: typeof o.mime_type === 'string' ? o.mime_type : 'image/png' }
  }
  const inline = o.inlineData as Record<string, unknown> | undefined
  if (inline && typeof inline.data === 'string' && inline.data) {
    return { base64: inline.data, mediaType: typeof inline.mimeType === 'string' ? inline.mimeType : 'image/png' }
  }
  for (const v of Object.values(o)) { const r = findImageBlock(v, depth + 1); if (r) return r }
  return null
}

// ── Prompt ────────────────────────────────────────────────────────
// Built from the recipe, not by another model call: the name says what the
// dish is, and the main ingredients steer what's visible on the plate.
const MAX_INGREDIENTS = 8
const PANTRY = new Set(['salt', 'pepper', 'black pepper', 'salt and pepper', 'sea salt', 'water', 'oil', 'olive oil', 'vegetable oil', 'sunflower oil', 'cooking spray', 'ice'])
const UNITS = 'g|kg|mg|ml|l|cl|dl|litres?|liters?|tbsps?|tsps?|tablespoons?|teaspoons?|cups?|oz|lbs?|pounds?|pieces?|pcs|cloves?|tins?|cans?|jars?|handfuls?|bunch(?:es)?|pinch(?:es)?|dash(?:es)?|sprigs?|slices?|sticks?|packs?|packets?|knobs?|thumbs?|splash(?:es)?|drizzles?|x'
const LEADING_AMOUNT = new RegExp(`^(?:(?:about|approx\\.?|roughly|~)\\s*)?[\\d¼½¾⅓⅔⅛.,/\\-–\\s]+(?:(?:${UNITS})\\b\\.?\\s*)?(?:of\\s+)?`, 'i')
const LEADING_UNIT = new RegExp(`^(?:a\\s+)?(?:${UNITS})\\b\\.?\\s+(?:of\\s+)?`, 'i')

// "- 400g tinned tomatoes, drained" → "tinned tomatoes"; "— Chicken thighs (600g)" → "chicken thighs".
export function ingredientName(line: string): string {
  let s = line.trim().replace(/^[-–—•*▢□]\s*/, '')
  if (!s || /^\[.*\]$/.test(s) || /:$/.test(s)) return ''      // section headings
  s = s.replace(/\([^)]*\)/g, ' ').split(/[,;]/)[0].trim()
  // Amounts can stack: "1 x 400g tin chopped tomatoes".
  for (let i = 0; i < 3; i++) {
    const next = s.replace(LEADING_AMOUNT, '').replace(LEADING_UNIT, '')
    if (next === s) break
    s = next
  }
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function mainIngredients(ingredients: unknown, max = MAX_INGREDIENTS): string[] {
  if (typeof ingredients !== 'string') return []
  const out: string[] = []
  for (const line of ingredients.split('\n')) {
    const name = ingredientName(line)
    if (!name || name.length > 40 || PANTRY.has(name) || out.includes(name)) continue
    out.push(name)
    if (out.length >= max) break
  }
  return out
}

// Saved names can carry an id suffix ("Tomato Pasta | MP-TMTP").
export const dishName = (name: unknown) => String(name ?? '').split('|')[0].replace(/\s+/g, ' ').trim().slice(0, 120)

export function imagePrompt(name: unknown, ingredients: unknown): string {
  const dish = dishName(name)
  const items = mainIngredients(ingredients)
  const withItems = items.length ? `, made with ${items.join(', ')}` : ''
  return `A realistic, appetising food photograph of ${dish}, a home-cooked dish${withItems}. ` +
    'Plated and ready to eat on a simple kitchen table, soft natural daylight, three-quarter angle, shallow depth of field. ' +
    'No text, no labels, no logos, no hands, no people.'
}
