// ─── New-recipe draft: fields and where each value came from ──────
// Pure. NewRecipeForm keeps a provenance map next to its fields so the three
// AI steps stay honest about what they did:
//   'source' — transcribed 1:1 from the link/photo/text (step 1)
//   'ai'     — added by "Fill in the gaps" (step 2) or "Generate"
//   'review' — changed by an approved expert-review suggestion (step 3)
// A field the user types in keeps its tag: the tag records where the value
// started, and the user can see they've edited it.

export const EMPTY_RECIPE = {
  name: '',
  meal_type_id: 'main',
  diet: 'omni',
  prep_time_minutes: '',
  cook_time_minutes: '',
  advance_prep_hours: '',
  advance_prep_note: '',
  portion_size: 4,
  min_portions: 1,
  try_out: true,
  order_out: false,
  fun_recipe: false,
  husband_approved: false,
  has_thermomix_version: false,
  weekdays: [],
  ingredients: '',
  instructions_standard: '',
  instructions_thermomix: '',
  fridge_storage: '',
  freezer_storage: '',
  chef_notes: '',
  husband_variations: '',
  toddler_variations: '',
  side_recommendation: '',
  source_url: '',
}

// The text/number fields AI steps may write. Toggles, default days and the
// link to the original are the user's call and never set by AI.
export const AI_FIELDS = [
  'name', 'meal_type_id', 'diet', 'prep_time_minutes', 'cook_time_minutes', 'advance_prep_hours',
  'advance_prep_note', 'portion_size', 'min_portions', 'ingredients', 'instructions_standard',
  'instructions_thermomix', 'fridge_storage', 'freezer_storage', 'chef_notes', 'husband_variations',
  'toddler_variations', 'side_recommendation',
]
const NUMERIC = new Set(['prep_time_minutes', 'cook_time_minutes', 'advance_prep_hours', 'portion_size', 'min_portions'])
// Fields that always hold a value: they only count as "known" once a source,
// the user or an AI step has actually set them.
const HAS_DEFAULT = new Set(['meal_type_id', 'diet', 'portion_size', 'min_portions'])
// The fields that hold wording: all a translation may change.
const TEXT_FIELDS = AI_FIELDS.filter(k => !NUMERIC.has(k) && !HAS_DEFAULT.has(k))

const hasValue = v => v != null && String(v).trim() !== ''

// Merge an AI result into the draft. Only AI_FIELDS with a value are taken;
// `onlyEmpty` keeps step 2 from overwriting anything already filled in.
export function mergeAiFields(fields, data, { onlyEmpty = false, prov = {}, touched = {} } = {}) {
  const next = { ...fields }
  const changed = []
  for (const k of AI_FIELDS) {
    if (!data || !hasValue(data[k])) continue
    if (onlyEmpty && !isUnset(k, fields, prov, touched)) continue
    next[k] = NUMERIC.has(k) ? Number(data[k]) : data[k]
    changed.push(k)
  }
  if (data?.has_thermomix_version === true || (changed.includes('instructions_thermomix') && hasValue(next.instructions_thermomix))) {
    next.has_thermomix_version = true
  }
  return { fields: next, changed }
}

export function isUnset(k, fields, prov, touched) {
  if (prov[k] || touched[k]) return false
  return HAS_DEFAULT.has(k) || !hasValue(fields[k])
}

// What step 2 is asked to fill: everything still unset.
export const missingFields = (fields, prov, touched) => AI_FIELDS.filter(k => isUnset(k, fields, prov, touched))

// The draft as the AI steps see it: known values only (defaults nobody has
// confirmed are left out so the model doesn't treat them as facts).
export function recipeForAi(fields, prov, touched) {
  const out = {}
  for (const k of AI_FIELDS) {
    if (!isUnset(k, fields, prov, touched) && hasValue(fields[k])) out[k] = fields[k]
  }
  return out
}

// The expert review sees everything that would be saved, defaults included.
export function recipeForReview(fields) {
  const out = {}
  for (const k of AI_FIELDS) if (hasValue(fields[k])) out[k] = fields[k]
  return out
}

// The wording of the draft, whoever wrote it: translating covers fill-ins and
// the user's own edits as well as the source.
export function recipeForTranslation(fields) {
  const out = {}
  for (const k of TEXT_FIELDS) if (hasValue(fields[k])) out[k] = fields[k]
  return out
}

// A translation takes seconds and the user can keep typing, so a field that
// changed after it was sent keeps the newer text and comes back in `kept`.
// Provenance is untouched: "Added by AI" stays true after translating.
export function applyTranslation(fields, sent, translated) {
  const next = { ...fields }
  const changed = []
  const kept = []
  for (const k of TEXT_FIELDS) {
    if (!translated || !hasValue(translated[k])) continue
    if (fields[k] !== sent[k]) { kept.push(k); continue }
    if (translated[k] === sent[k]) continue   // already in the target language
    next[k] = translated[k]
    changed.push(k)
  }
  return { fields: next, changed, kept }
}

// Norwegian has two written forms with their own codes; both count as 'no'.
const baseLanguage = code => (code === 'nb' || code === 'nn' ? 'no' : code)

// Is a recipe in `code` worth translating into `target`? An unknown language on
// either side means no: better to offer nothing than to offer it wrongly.
export const needsTranslating = (code, target) => !!code && !!target && baseLanguage(code) !== baseLanguage(target)

export const hasRecipeContent = f => hasValue(f.ingredients) || hasValue(f.instructions_standard)

export const FIELD_LABELS = {
  name: 'Recipe name', meal_type_id: 'Category', diet: 'Diet', prep_time_minutes: 'Prep time',
  cook_time_minutes: 'Cook time', advance_prep_hours: 'Advance prep', advance_prep_note: 'Advance prep note',
  portion_size: 'Base portions', min_portions: 'Min portions', ingredients: 'Ingredients',
  instructions_standard: 'Instructions', instructions_thermomix: 'Thermomix instructions',
  fridge_storage: 'Fridge storage', freezer_storage: 'Freezer storage', chef_notes: 'Chef notes',
  husband_variations: 'Husband variations', toddler_variations: 'Toddler variations',
  side_recommendation: 'Side recommendation',
}
