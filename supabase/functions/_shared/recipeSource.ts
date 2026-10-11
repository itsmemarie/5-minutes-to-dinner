// ─── Recipe sources → form fields ─────────────────────────────────
// Pure parsing, no network, unit-tested from vitest.
//
// Step 1 of the recipe workflow is a 1:1 transcription. Most recipe sites
// already publish that transcription as schema.org Recipe JSON-LD, so a URL is
// read from the page data first — no AI call, no tokens. Only pages without it
// (and photos, and pasted text) go to the model, which returns the same
// Transcript shape. Both then pass through transcriptToFields, which only
// reformats — numbering, "- " bullets, "15 mins" → 15 — and never adds content.

export interface Transcript {
  name?: string | null
  servings?: string | number | null
  prep_time?: string | null
  cook_time?: string | null
  total_time?: string | null
  ingredients?: string[] | null
  steps?: string[] | null
  notes?: string | null
}

// ── Text helpers ──────────────────────────────────────────────────
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m
  })
}

const stripTags = (s: string) => s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
export const cleanText = (s: unknown) => decodeEntities(stripTags(String(s ?? ''))).replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()

// ── Numbers ───────────────────────────────────────────────────────
// "PT1H10M", "1 hr 10 mins", "45 minutes", "1.5 hours" → minutes. Null when the
// text has no recognisable duration, so a vague "overnight" stays unset.
export function parseDurationMinutes(input: unknown): number | null {
  if (input == null) return null
  const s = String(input).trim()
  if (!s) return null
  const iso = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i)
  if (iso && (iso[1] || iso[2] || iso[3] || iso[4])) {
    const mins = (Number(iso[1] || 0) * 1440) + (Number(iso[2] || 0) * 60) + Number(iso[3] || 0) + Number(iso[4] || 0) / 60
    return Math.round(mins)
  }
  let total = 0, found = false
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/gi)) { total += Number(m[1]) * 60; found = true }
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|m)\b/gi)) { total += Number(m[1]); found = true }
  return found ? Math.round(total) : null
}

// "Serves 4-6", "4 portions", 4, ["4", "4 servings"] → 4.
export function parseServings(input: unknown): number | null {
  if (input == null) return null
  if (Array.isArray(input)) {
    for (const x of input) { const n = parseServings(x); if (n) return n }
    return null
  }
  if (typeof input === 'number') return input > 0 ? Math.round(input) : null
  const m = String(input).match(/\d+/)
  const n = m ? Number(m[0]) : NaN
  return n > 0 && n < 100 ? n : null
}

// ── Formatting into the app's text conventions ────────────────────
// Ingredients: "[Section]" headings and "- item" lines (recipeParsing.js).
export function toIngredientText(lines: unknown): string {
  if (!Array.isArray(lines)) return ''
  return lines
    .map(l => cleanText(l))
    .filter(Boolean)
    .map(l => {
      if (/^\[.+\]$/.test(l)) return l
      if (/^(for the|to serve|for serving)\b.*:$/i.test(l) || /^[A-Z][^.]{0,40}:$/.test(l)) return `[${l.replace(/:$/, '')}]`
      return `- ${l.replace(/^[-•*▢□]\s*/, '')}`
    })
    .join('\n')
}

// Method: "1. Step" lines — the format parseSteps reads first.
export function toStepsText(steps: unknown): string {
  if (!Array.isArray(steps)) return ''
  return steps
    .map(s => cleanText(s).replace(/^(step\s*)?\d+\s*[.):-]\s*/i, '').replace(/\n+/g, ' '))
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n')
}

// Transcript → NewRecipeForm field names. Keys are only present when the source
// had something, so the form can tell "from the source" apart from "unset".
export function transcriptToFields(t: Transcript): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  const name = cleanText(t.name)
  if (name) out.name = name
  const servings = parseServings(t.servings)
  if (servings) out.portion_size = servings
  const prep = parseDurationMinutes(t.prep_time)
  if (prep != null) out.prep_time_minutes = prep
  const cook = parseDurationMinutes(t.cook_time)
  if (cook != null) out.cook_time_minutes = cook
  const ingredients = toIngredientText(t.ingredients)
  if (ingredients) out.ingredients = ingredients
  const steps = toStepsText(t.steps)
  if (steps) out.instructions_standard = steps
  const notes = cleanText(t.notes)
  if (notes) out.chef_notes = notes
  return out
}

// ── schema.org Recipe JSON-LD ─────────────────────────────────────
const isRecipeType = (t: unknown) => t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))

function findRecipeNode(node: unknown, depth = 0): Record<string, unknown> | null {
  if (!node || depth > 6) return null
  if (Array.isArray(node)) {
    for (const x of node) { const r = findRecipeNode(x, depth + 1); if (r) return r }
    return null
  }
  if (typeof node !== 'object') return null
  const obj = node as Record<string, unknown>
  if (isRecipeType(obj['@type'])) return obj
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) {
    const r = findRecipeNode(obj[key], depth + 1)
    if (r) return r
  }
  return null
}

function flattenInstructions(x: unknown): string[] {
  if (!x) return []
  if (typeof x === 'string') return cleanText(x).split('\n').map(s => s.trim()).filter(Boolean)
  if (Array.isArray(x)) return x.flatMap(flattenInstructions)
  if (typeof x === 'object') {
    const o = x as Record<string, unknown>
    if (o.itemListElement) return flattenInstructions(o.itemListElement)
    if (o.text) return [cleanText(o.text)].filter(Boolean)
    if (o.name) return [cleanText(o.name)].filter(Boolean)
  }
  return []
}

export function findJsonLdRecipe(html: string): Transcript | null {
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(re)) {
    let data: unknown
    try { data = JSON.parse(m[1].trim()) } catch {
      // Some CMSs emit raw control characters inside strings.
      try { data = JSON.parse(m[1].trim().replace(/[\u0000-\u001f]+/g, ' ')) } catch { continue }
    }
    const node = findRecipeNode(data)
    if (!node) continue
    const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : Array.isArray(node.ingredients) ? node.ingredients : [])
      .map(cleanText).filter(Boolean)
    const steps = flattenInstructions(node.recipeInstructions)
    // A Recipe node without both halves isn't a transcription — let the AI read the page.
    if (!ingredients.length || !steps.length) continue
    return {
      name: cleanText(node.name) || null,
      servings: (node.recipeYield as string | number | null) ?? null,
      prep_time: (node.prepTime as string) ?? null,
      cook_time: (node.cookTime as string) ?? null,
      total_time: (node.totalTime as string) ?? null,
      ingredients,
      steps,
      notes: null,
    }
  }
  return null
}

// ── Page text for the AI fallback ─────────────────────────────────
// Sending the whole page is the biggest token cost on this path, so: drop
// chrome and scripts, jump to a recipe-card plugin block when there is one, and
// otherwise start a little before the first "Ingredients" heading.
const RECIPE_CARD_RE = /<(?:div|section|article)[^>]+(?:class|id)\s*=\s*["'][^"']*(?:wprm-recipe-container|wprm-recipe|tasty-recipes|mv-create-card|recipe-card|easyrecipe|recipe-container|recipe-body)[^"']*["'][^>]*>/i
export const PAGE_TEXT_LIMIT = 9000

export function pageTextForAi(html: string, limit = PAGE_TEXT_LIMIT): string {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
  const card = h.search(RECIPE_CARD_RE)
  if (card !== -1) h = h.slice(card, card + 60000)
  const text = cleanText(h).replace(/\n{2,}/g, '\n')
  if (text.length <= limit) return text
  const at = card === -1 ? text.search(/\bingredients\b/i) : -1
  const start = at > 1500 ? at - 1500 : 0
  return text.slice(start, start + limit)
}
