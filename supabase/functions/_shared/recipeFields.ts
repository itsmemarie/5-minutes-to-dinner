// ─── Recipe fields for steps 2 (complete) and 3 (review) ──────────
// Pure: field catalogue, prompt serialisation and output sanitising. The field
// names are NewRecipeForm's (and the recipes table's) column names.

export const MEAL_TYPES = ['main', 'breakfast', 'side', 'dessert', 'entree']
export const DIETS = ['omni', 'veg', 'vegan']

type Kind = 'string' | 'integer' | 'number' | 'meal_type' | 'diet'
interface FieldDef { kind: Kind; guide: string }

// What step 2 may fill. Ingredients are deliberately absent: with no ingredient
// list there is no recipe to complete, and "Describe → Generate" covers that.
export const COMPLETABLE: Record<string, FieldDef> = {
  name:                   { kind: 'string',    guide: 'a specific, descriptive recipe name' },
  meal_type_id:           { kind: 'meal_type', guide: 'one of: main, breakfast, side, dessert, entree' },
  diet:                   { kind: 'diet',      guide: 'omni, veg or vegan, judged from the ingredients' },
  prep_time_minutes:      { kind: 'integer',   guide: 'hands-on prep, in minutes' },
  cook_time_minutes:      { kind: 'integer',   guide: 'cooking time, in minutes' },
  advance_prep_hours:     { kind: 'number',    guide: 'hours of unattended lead time before cooking (marinating, soaking, proving, thawing); 0 if none' },
  advance_prep_note:      { kind: 'string',    guide: 'short note for that lead time, e.g. "Marinate chicken 4h"; "" if none' },
  portion_size:           { kind: 'integer',   guide: 'portions the amounts make' },
  min_portions:           { kind: 'integer',   guide: 'smallest sensible batch, in portions' },
  instructions_standard:  { kind: 'string',    guide: 'method for these ingredients, one step per line: "1. Step name: what to do (amounts, time, heat)"' },
  instructions_thermomix: { kind: 'string',    guide: 'Thermomix TM6 method, one step per line: "1. Step name: what to do (time / temp / speed)"' },
  fridge_storage:         { kind: 'string',    guide: 'how long it keeps in the fridge, e.g. "3-4 days"' },
  freezer_storage:        { kind: 'string',    guide: 'how to freeze and for how long, or "Not recommended"' },
  chef_notes:             { kind: 'string',    guide: '2-3 short practical tips for a home cook' },
  husband_variations:     { kind: 'string',    guide: 'a higher-protein variation, towards chicken if possible' },
  toddler_variations:     { kind: 'string',    guide: 'changes for ages 1-3: less salt, safe sizes and textures' },
  side_recommendation:    { kind: 'string',    guide: 'up to 3 sides, comma-separated, no explanations' },
}

// What step 3 may change (via find/replace on the field's text).
export const REVIEWABLE = [
  'name', 'ingredients', 'instructions_standard', 'instructions_thermomix', 'chef_notes',
  'fridge_storage', 'freezer_storage', 'toddler_variations', 'husband_variations',
  'side_recommendation', 'advance_prep_note', 'prep_time_minutes', 'cook_time_minutes', 'portion_size',
]

// Order the recipe is shown to the model in — most important first.
const PROMPT_ORDER = [
  'name', 'meal_type_id', 'diet', 'portion_size', 'min_portions', 'prep_time_minutes', 'cook_time_minutes',
  'advance_prep_hours', 'advance_prep_note', 'ingredients', 'instructions_standard', 'instructions_thermomix',
  'fridge_storage', 'freezer_storage', 'chef_notes', 'husband_variations', 'toddler_variations', 'side_recommendation',
]

const present = (v: unknown) => v != null && String(v).trim() !== ''

// Tagged blocks keep field boundaries unambiguous, which step 3 relies on to
// quote text back exactly. Empty fields are left out to save tokens.
export function recipeForPrompt(recipe: Record<string, unknown>): string {
  return PROMPT_ORDER
    .filter(k => present(recipe?.[k]))
    .map(k => `<${k}>\n${String(recipe[k]).trim().slice(0, 6000)}\n</${k}>`)
    .join('\n')
}

export interface HouseholdContext {
  equipment?: string[]
  region?: string
  units?: string
  measurements?: string
  children?: string[]          // ages, e.g. "2 yrs 3 mo"
}

export function householdLines(ctx: HouseholdContext = {}): string {
  const lines = []
  if (ctx.region) lines.push(`Region: ${ctx.region} (use local ingredient names).`)
  if (ctx.units || ctx.measurements) lines.push(`Units: ${ctx.units ?? 'metric'}, ${ctx.measurements === 'cups' ? 'cups' : 'grams & ml'}.`)
  lines.push(`Kitchen equipment: ${ctx.equipment?.length ? ctx.equipment.join(', ') : 'not specified — assume a basic hob and oven'}.`)
  if (ctx.children?.length) lines.push(`Young children eat this too, aged: ${ctx.children.join(', ')}.`)
  return lines.join('\n')
}

export const hasThermomix = (ctx: HouseholdContext = {}) =>
  (ctx.equipment ?? []).some(e => /thermomix/i.test(e))

// ── Step 2 ────────────────────────────────────────────────────────
export function completableRequest(missing: unknown, recipe: Record<string, unknown>, ctx: HouseholdContext): string[] {
  if (!Array.isArray(missing)) return []
  return [...new Set(missing)].filter((k): k is string =>
    typeof k === 'string' && Object.hasOwn(COMPLETABLE, k) &&
    !present(recipe?.[k]) &&
    // A method needs ingredients to be written from; a Thermomix method needs a Thermomix.
    (k !== 'instructions_standard' || present(recipe?.ingredients)) &&
    (k !== 'instructions_thermomix' || hasThermomix(ctx)),
  )
}

const jsonType = (kind: Kind) =>
  kind === 'integer' ? { type: 'integer' }
  : kind === 'number' ? { type: 'number' }
  : kind === 'meal_type' ? { type: 'string', enum: MEAL_TYPES }
  : kind === 'diet' ? { type: 'string', enum: DIETS }
  : { type: 'string' }

export function completionSchema(fields: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: fields,
    properties: Object.fromEntries(fields.map(f => [f, jsonType(COMPLETABLE[f].kind)])),
  }
}

// Keeps only requested keys with values of the right type. Anything the model
// added beyond the request is dropped, so step 2 can't overwrite the source.
export function sanitiseCompletion(raw: unknown, fields: string[]): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  for (const f of fields) {
    const v = r[f]
    const kind = COMPLETABLE[f].kind
    if (kind === 'integer' || kind === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.]/g, ''))
      if (Number.isFinite(n) && n >= 0 && n < 10000 && String(v ?? '').trim() !== '') out[f] = kind === 'integer' ? Math.round(n) : n
    } else if (kind === 'meal_type') {
      if (MEAL_TYPES.includes(String(v))) out[f] = String(v)
    } else if (kind === 'diet') {
      if (DIETS.includes(String(v))) out[f] = String(v)
    } else if (typeof v === 'string' && (v.trim() || f === 'advance_prep_note')) {
      out[f] = v.trim()
    }
  }
  return out
}

// ── Step 3 ────────────────────────────────────────────────────────
export const reviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions', 'warnings'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['field', 'title', 'why', 'find', 'replace'],
        properties: {
          field: { type: 'string', enum: REVIEWABLE },
          title: { type: 'string' },
          why: { type: 'string' },
          find: { type: 'string' },
          replace: { type: 'string' },
        },
      },
    },
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['constraint', 'issue', 'workaround'],
        properties: { constraint: { type: 'string' }, issue: { type: 'string' }, workaround: { type: 'string' } },
      },
    },
  },
}

export interface Suggestion { id: string; field: string; title: string; why: string; find: string; replace: string }
export interface Warning { constraint: string; issue: string; workaround: string }

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function sanitiseReview(raw: unknown, recipe: Record<string, unknown>): { suggestions: Suggestion[]; warnings: Warning[] } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const suggestions = (Array.isArray(r.suggestions) ? r.suggestions : [])
    .map((s: Record<string, unknown>) => ({
      field: str(s?.field, 60), title: str(s?.title, 140), why: str(s?.why, 400),
      // find keeps its whitespace: it has to match the field text exactly.
      find: typeof s?.find === 'string' ? s.find.slice(0, 2000) : '', replace: str(s?.replace, 4000),
    }))
    .filter(s => REVIEWABLE.includes(s.field) && s.title && (s.replace || s.find))
    // A quote that isn't in the field can never apply — drop it rather than show a dead button.
    .filter(s => !s.find.trim() || String(recipe?.[s.field] ?? '').includes(s.find))
    .slice(0, 6)
    .map((s, i) => ({ id: `s${i + 1}`, ...s }))
  const warnings = (Array.isArray(r.warnings) ? r.warnings : [])
    .map((w: Record<string, unknown>) => ({ constraint: str(w?.constraint, 80), issue: str(w?.issue, 400), workaround: str(w?.workaround, 400) }))
    .filter(w => w.issue)
    .slice(0, 4)
  return { suggestions, warnings }
}
