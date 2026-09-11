// ─── Meal sections ────────────────────────────────────────────────
// The rows every planned day is split into. The catalogue is fixed (it is also
// the planned_meals.section check constraint); which sections are shown, and in
// what order, is a user setting stored as [{ id, enabled }] on app_settings.
//
// Everything that splits a day — planner, daily plan, recipe selection, the
// week copy-to-text — should read the user's list via the helpers below rather
// than hard-coding breakfast/main/side.

export const MEAL_SECTION_CATALOGUE = [
  // label      — what the user sees for the row
  // short      — compact label used in dense meal rows
  // mealType   — recipes.meal_type_id the picker defaults to for a new recipe
  // category   — recipe `cat` the picker filters to; null shows every recipe
  { id:'breakfast', label:'Breakfast',      short:'Breakfast', mealType:'breakfast', category:'Breakfast' },
  { id:'lunch',     label:'Lunch',          short:'Lunch',     mealType:'main',      category:'Mains' },
  { id:'main',      label:'Main meal',      short:'Main',      mealType:'main',      category:'Mains' },
  { id:'dinner',    label:'Dinner',         short:'Dinner',    mealType:'main',      category:'Mains' },
  { id:'side',      label:'Sides & snacks', short:'Side',      mealType:'side',      category:'Sides' },
  { id:'dessert',   label:'Dessert',        short:'Dessert',   mealType:'dessert',   category:'Desserts' },
  { id:'drinks',    label:'Drinks',         short:'Drinks',    mealType:'main',      category:null },
]

export const ALL_SECTION_IDS = MEAL_SECTION_CATALOGUE.map(s => s.id)

const BY_ID = Object.fromEntries(MEAL_SECTION_CATALOGUE.map(s => [s.id, s]))

// The three sections the app shipped with stay on; the rest are off until the
// user turns them on in Settings › Meal sections.
export const DEFAULT_MEAL_SECTIONS = [
  { id:'breakfast', enabled:true },
  { id:'main',      enabled:true },
  { id:'side',      enabled:true },
  { id:'lunch',     enabled:false },
  { id:'dinner',    enabled:false },
  { id:'dessert',   enabled:false },
  { id:'drinks',    enabled:false },
]

// Accepts whatever came back from the database (null, a stale list, unknown
// ids) and returns a full, ordered list covering every catalogue section.
// Unknown ids are dropped; sections missing from the saved list are appended
// in catalogue order, disabled, so adding a section to the catalogue never
// silently changes an existing user's planner.
export function normaliseMealSections(raw) {
  const seen = new Set()
  const out = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const id = typeof item === 'string' ? item : item?.id
      if (!BY_ID[id] || seen.has(id)) continue
      seen.add(id)
      out.push({ id, enabled: typeof item === 'object' ? !!item.enabled : true })
    }
  }
  // Nothing usable saved: the shipped defaults. Otherwise append what the saved
  // list lacks, switched off.
  if (!out.length) return DEFAULT_MEAL_SECTIONS.map(s => ({ ...s }))
  for (const s of DEFAULT_MEAL_SECTIONS) {
    if (!seen.has(s.id)) out.push({ id: s.id, enabled: false })
  }
  // Never let a saved list leave the planner with nothing to add meals to.
  if (!out.some(s => s.enabled)) out[0] = { ...out[0], enabled: true }
  return out
}

export const enabledSectionIds = sections => sections.filter(s => s.enabled).map(s => s.id)

export const sectionInfo   = id => BY_ID[id] || { id, label: id, short: id, mealType: 'main', category: null }
export const sectionLabel  = id => sectionInfo(id).label
export const sectionShort  = id => sectionInfo(id).short

// Meals for one day, in section order. `sectionIds` is the user's enabled list;
// meals sitting in a disabled section are retained in the plan but not shown.
export function dayMeals(dayPlan, sectionIds = ALL_SECTION_IDS) {
  if (!dayPlan) return []
  return sectionIds.flatMap(sec => dayPlan[sec] || [])
}

// One empty bucket per catalogue section, so a plan object can always be
// indexed by any valid section id — including ones the user has turned off.
export const emptyDay = () => Object.fromEntries(ALL_SECTION_IDS.map(id => [id, []]))
