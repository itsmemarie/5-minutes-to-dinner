// ─── User preferences (Settings screen) ───────────────────────────
// Every setting other than the default portion count and the weight-goal
// profile lives here: one plain object, normalised once on load so the rest of
// the app can trust its shape, and persisted column-by-column on the
// app_settings singleton (see supabase.js › savePreferences).
import { normaliseMealSections } from './mealSections.js'
import { WEEK_START_OPTIONS } from './dateHelpers.js'

export const DEFAULT_PREFERENCES = {
  suggestFromHistory: true,
  weekStartsOn: 'mon',          // WEEK_START_OPTIONS id
  mealSections: null,           // normalised below; null means "use defaults"
  country: 'GB',                // ISO-3166 alpha-2, see COUNTRIES
  recipeUnits: 'metric',        // 'metric' | 'imperial'
  measurements: 'weight',       // 'weight' (grams & ml) | 'cups'
  toddlerModeEnabled: false,    // master switch for every piece of toddler content
  children: [],                 // [{ id, name, dob }]
  selectedChildId: null,        // the child activities and safety notes follow
  toddlerActivities: true,
  toddlerVariations: true,
  toddlerPortion: false,
}

// ── Catalogues ────────────────────────────────────────────────────
// Only the UK is specified by the design; the others are the English-speaking
// markets plus the two the recipe base already leans on. Each entry names the
// region the AI functions are told to shop and cook in.
export const COUNTRIES = [
  { code:'GB', name:'United Kingdom' },
  { code:'IE', name:'Ireland' },
  { code:'DE', name:'Germany' },
  { code:'FR', name:'France' },
  { code:'NL', name:'Netherlands' },
  { code:'ES', name:'Spain' },
  { code:'IT', name:'Italy' },
  { code:'US', name:'United States' },
  { code:'CA', name:'Canada' },
  { code:'AU', name:'Australia' },
  { code:'NZ', name:'New Zealand' },
  { code:'ZA', name:'South Africa' },
]
export const countryName = code => COUNTRIES.find(c => c.code === code)?.name || 'United Kingdom'

export const RECIPE_UNIT_OPTIONS  = [{ value:'metric', label:'METRIC' }, { value:'imperial', label:'IMPERIAL' }]
export const MEASUREMENT_OPTIONS  = [{ value:'weight', label:'GRAMS & ML' }, { value:'cups', label:'CUPS' }]

// ── Normalisation ─────────────────────────────────────────────────
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback)
const isIsoDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime())

export function normaliseChildren(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  raw.forEach((c, i) => {
    if (!c || typeof c !== 'object' || !isIsoDate(c.dob)) return
    const id = typeof c.id === 'string' && c.id ? c.id : `child-${i + 1}`
    if (seen.has(id)) return
    seen.add(id)
    out.push({ id, name: (typeof c.name === 'string' && c.name.trim()) || `Child ${out.length + 1}`, dob: c.dob })
  })
  return out
}

// Takes the raw app_settings row (or a partial object, or nothing) and returns
// a complete preferences object. Safe to call on every load and after every
// patch; unknown keys are dropped, bad values fall back to the default.
export function normalisePreferences(raw = {}) {
  const r = raw || {}
  const children = normaliseChildren(r.children)
  const selectedChildId = children.some(c => c.id === r.selectedChildId)
    ? r.selectedChildId
    : (children[0]?.id ?? null)
  return {
    suggestFromHistory: r.suggestFromHistory ?? DEFAULT_PREFERENCES.suggestFromHistory,
    weekStartsOn: oneOf(r.weekStartsOn, WEEK_START_OPTIONS.map(o => o.id), DEFAULT_PREFERENCES.weekStartsOn),
    mealSections: normaliseMealSections(r.mealSections),
    country: COUNTRIES.some(c => c.code === r.country) ? r.country : DEFAULT_PREFERENCES.country,
    recipeUnits: oneOf(r.recipeUnits, ['metric','imperial'], DEFAULT_PREFERENCES.recipeUnits),
    measurements: oneOf(r.measurements, ['weight','cups'], DEFAULT_PREFERENCES.measurements),
    toddlerModeEnabled: !!(r.toddlerModeEnabled ?? DEFAULT_PREFERENCES.toddlerModeEnabled),
    children,
    selectedChildId,
    toddlerActivities: r.toddlerActivities ?? DEFAULT_PREFERENCES.toddlerActivities,
    toddlerVariations: r.toddlerVariations ?? DEFAULT_PREFERENCES.toddlerVariations,
    toddlerPortion: r.toddlerPortion ?? DEFAULT_PREFERENCES.toddlerPortion,
  }
}

// ── Legacy migration ──────────────────────────────────────────────
// Before this settings rebuild there was a single app_settings.toddler_dob.
// The first load that finds a DOB but no children turns it into one selected
// child and switches toddler content on (it was always on before there was a
// switch). Returns the patch to persist, or null when nothing needs doing.
export function migrateLegacyToddlerDob(prefs, legacyDob) {
  if (prefs.children.length || !isIsoDate(legacyDob)) return null
  const child = newChild({ name: 'Child 1', dob: legacyDob })
  return { children: [child], selectedChildId: child.id, toddlerModeEnabled: true }
}

// ── Children helpers ──────────────────────────────────────────────
export const newChild = ({ name, dob }) => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `child-${Date.now()}`,
  name: name?.trim() || 'Child',
  dob,
})

export const selectedChild = prefs =>
  prefs.children.find(c => c.id === prefs.selectedChildId) || prefs.children[0] || null

// The DOB the toddler features key off. Null when toddler content is switched
// off or no child is set, which is what hides those features everywhere.
export const activeToddlerDob = prefs =>
  prefs.toddlerModeEnabled ? (selectedChild(prefs)?.dob ?? null) : null
