// ─── Saved weeks ──────────────────────────────────────────────────
// A saved week is a named, independent copy of a week's meals (the saved_weeks
// table). Filling a week copies it into planned_meals; from then on that week
// is an ordinary week, and changing it leaves the saved copy alone. The saved
// copy itself can be renamed and edited in Settings › Saved weeks.
//
// Each meal is stored by weekday name, not by its place in the week, so Tuesday's
// dinner stays on Tuesday whatever "Week starts on" is set to.
//
// Everything here is pure, so it can be tested without a database.
import { ALL_SECTION_IDS, dayMeals } from './mealSections.js'

export const SAVED_WEEK_NAME_MAX = 60

// What you see is what you save: meals in a section that's turned off are left out.
export function snapshotWeek(plan, days, sectionIds) {
  return days.flatMap(day => dayMeals(plan[day], sectionIds).map(m => ({
    day,
    section:          m.section,
    recipeId:         m.recipeId ?? null,
    freezerItemId:    m.freezerItemId ?? null,
    name:             m.name,
    prep:             m.prep ?? 0,
    active:           m.active ?? 0,
    portion:          m.portion,
    base:             m.base ?? null,
    advancePrepHours: m.advancePrepHours ?? null,
    advancePrepNote:  m.advancePrepNote ?? null,
  })))
}

// Every meal in a week as insertWeekMeals takes them, in the place each one was,
// sections that are turned off included. Keeps a cleared week so Undo can put it
// back as it was. `id` stays on each row, for matching it to a swipe-deck pick.
export function weekMealRows(plan, days, dayEntryMap) {
  return days.flatMap(day => ALL_SECTION_IDS.flatMap(section =>
    (plan[day]?.[section] || []).map((m, position) => ({ ...m, section, position, dayEntryId: dayEntryMap[day] }))
  ))
}

// "Week of 12 Oct". `week` comes from dateHelpers.weekBounds.
export const defaultWeekName = week =>
  `Week of ${week.start.toLocaleDateString('en-GB', { day:'numeric', month:'short' })}`

// The saved meals grouped by day, in the order of `days`, skipping empty days.
export function mealsByDay(saved, days) {
  return days
    .map(day => ({ day, meals: (saved.meals || []).filter(m => m.day === day) }))
    .filter(d => d.meals.length > 0)
}

// Recipe ids a saved week refers to, to check they still exist before filling.
export const savedRecipeIds = saved => [...new Set((saved.meals || []).map(m => m.recipeId).filter(Boolean))]

/**
 * Works out what filling a week from a saved week would do. Nothing is written.
 *
 * `mode` is 'add' (keep the week's meals) or 'replace' (swap the meals you can
 * see; meals in a section that's turned off are kept, as they are everywhere else).
 *
 * @param saved  a saved_weeks row
 * @param ctx.plan, ctx.days, ctx.sectionIds  the week being filled
 * @param ctx.recipes  the loaded recipes, for current times and portions
 * @param ctx.freezerItems  the loaded freezer items
 * @param ctx.existingRecipeIds  Set of recipe ids that still exist. A check of its
 *   own because `recipes` leaves some out, so a missing one may not be deleted.
 * @param ctx.defPort  default portions, for a meal saved without any
 * @returns {{ meals: object[], replacedIds: string[], releasedFreezerIds: number[],
 *             takenFreezerIds: number[], skipped: string[], hiddenCount: number }}
 */
export function buildFill(saved, { plan, days, sectionIds, mode = 'add', recipes = [], freezerItems = [], existingRecipeIds = new Set(), defPort = 4 }) {
  const replacing = mode === 'replace'
  const current = days.flatMap(day => dayMeals(plan[day], sectionIds))
  const replacedIds = replacing ? current.map(m => m.id) : []
  const releasedFreezerIds = replacing ? [...new Set(current.map(m => m.freezerItemId).filter(Boolean))] : []

  const usable = (saved.meals || []).filter(m => days.includes(m.day))
  const skipped = [], meals = [], taken = new Set()
  // Next free position in each section, counted on from the meals that stay.
  const nextPosition = {}
  const positionFor = (day, section) => {
    const key = `${day}:${section}`
    if (nextPosition[key] === undefined) {
      const kept = plan[day]?.[section] || []
      // Replacing only clears visible sections, so a hidden one keeps its count.
      nextPosition[key] = replacing && sectionIds.includes(section) ? 0 : kept.length
    }
    return nextPosition[key]++
  }

  for (const m of usable) {
    // A freezer meal needs something in the freezer. A replace puts the week's
    // own freezer meals back first, so they count as available here.
    if (m.freezerItemId) {
      const item = freezerItems.find(x => x.id === m.freezerItemId)
      const free = item && (item.in_stock || releasedFreezerIds.includes(item.id)) && !taken.has(item.id)
      if (!free) { skipped.push(m.name); continue }
      taken.add(item.id)
    }

    const live = m.recipeId ? recipes.find(r => r.id === m.recipeId) : null
    const recipeId = m.recipeId && existingRecipeIds.has(m.recipeId) ? m.recipeId : null
    meals.push({
      day: m.day,
      section: m.section,
      recipeId,
      freezerItemId: m.freezerItemId ?? null,
      name: live?.name ?? m.name,
      prep: live?.prep ?? m.prep ?? 0,
      active: live?.active ?? m.active ?? 0,
      portion: m.portion ?? defPort,
      base: live?.base ?? m.base ?? m.portion ?? defPort,
      advancePrepHours: live?.advancePrepHours ?? m.advancePrepHours ?? null,
      advancePrepNote: live?.advancePrepNote ?? m.advancePrepNote ?? null,
      position: positionFor(m.day, m.section),
    })
  }

  return {
    meals,
    replacedIds,
    releasedFreezerIds,
    takenFreezerIds: [...taken],
    skipped,
    hiddenCount: meals.filter(m => !sectionIds.includes(m.section)).length,
  }
}

// ─── Names ────────────────────────────────────────────────────────
// Names are compared ignoring case and repeated spaces, so "Busy  week" and
// "busy week" count as the same saved week.
const nameKey = name => (name || '').trim().replace(/\s+/g, ' ').toLowerCase()

// The saved week already called `name`, or null. `exceptId` leaves one row out,
// so a saved week being renamed doesn't clash with itself.
export const findSavedByName = (all, name, exceptId = null) =>
  (all || []).find(s => s.id !== exceptId && nameKey(s.name) === nameKey(name)) || null

// `name`, or `name (2)`, `(3)`… if that's taken, kept within the length limit.
// An existing " (n)" is dropped first, so copying "Busy week (2)" gives
// "Busy week (3)" rather than "Busy week (2) (2)".
export function uniqueSavedName(name, all, exceptId = null) {
  const base = (name || '').trim().replace(/\s+\(\d+\)$/, '') || 'Saved week'
  if (!findSavedByName(all, base, exceptId)) return base.slice(0, SAVED_WEEK_NAME_MAX)
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`
    const candidate = base.slice(0, SAVED_WEEK_NAME_MAX - suffix.length) + suffix
    if (!findSavedByName(all, candidate, exceptId)) return candidate
  }
}

// Checks a name typed for a saved week. `error` stops it being saved at all;
// `clash` is the other saved week that already has it.
export function checkSavedName(raw, all, exceptId = null) {
  const name = (raw || '').trim().replace(/\s+/g, ' ')
  if (!name) return { name, error: 'Give it a name.', clash: null }
  if (name.length > SAVED_WEEK_NAME_MAX) return { name, error: `Keep it under ${SAVED_WEEK_NAME_MAX} characters.`, clash: null }
  return { name, error: null, clash: findSavedByName(all, name, exceptId) }
}

// "6 meals · 5 days", or "No meals yet".
export function savedWeekSummary(saved) {
  const meals = saved.meals || []
  const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
  if (!meals.length) return 'No meals yet'
  return `${count(meals.length, 'meal')} · ${count(new Set(meals.map(m => m.day)).size, 'day')}`
}

// A few of the week's main meals, in day order, for the saved weeks list.
// Falls back to any meal when there are no mains or dinners.
export function savedWeekPreview(saved, days, max = 3) {
  const inOrder = days.flatMap(day => (saved.meals || []).filter(m => m.day === day))
  const mains = inOrder.filter(m => m.section === 'main' || m.section === 'dinner')
  const names = [...new Set((mains.length ? mains : inOrder).map(m => m.name))]
  return names.slice(0, max).join(', ') + (names.length > max ? '…' : '')
}

// ─── Editing a saved week's meals ─────────────────────────────────
// Saved meals carry an `id` of their own, so a row can be opened, dragged or
// taken out without depending on its place in the list. Rows saved before ids
// existed get one when they're read. The id never reaches planned_meals:
// buildFill builds each planned meal afresh.
const newMealId = () => (globalThis.crypto?.randomUUID?.() ?? `sm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)

export const withMealIds = (meals, makeId = newMealId) =>
  (meals || []).map(m => (m.id ? m : { ...m, id: makeId() }))

// One day's saved meals, in meal-section order, then the order they were added.
export function savedDayMeals(meals, day, sectionOrder = ALL_SECTION_IDS) {
  const rank = section => { const i = sectionOrder.indexOf(section); return i < 0 ? sectionOrder.length : i }
  return (meals || [])
    .map((meal, index) => ({ meal, index }))
    .filter(x => x.meal.day === day)
    .sort((a, b) => rank(a.meal.section) - rank(b.meal.section) || a.index - b.index)
    .map(x => x.meal)
}

export const removeSavedMeal = (meals, id) => meals.filter(m => m.id !== id)

// Moves a meal to another day. It goes to the end of its section there.
export function moveSavedMeal(meals, id, day) {
  const meal = meals.find(m => m.id === id)
  if (!meal || meal.day === day) return meals
  return [...meals.filter(m => m.id !== id), { ...meal, day }]
}

export function setSavedMealPortion(meals, id, portion, min = 1) {
  const value = Math.max(min, Math.round(portion))
  return meals.map(m => (m.id === id ? { ...m, portion: value } : m))
}

// Adds recipes to one day and section, the way the planner's picker would.
export function addSavedMeals(meals, { day, section, recipes, defPort = 4 }, makeId = newMealId) {
  return [...meals, ...recipes.map(r => ({
    id:               makeId(),
    day,
    section,
    recipeId:         r.id,
    freezerItemId:    null,
    name:             r.name,
    prep:             r.prep ?? 0,
    active:           r.active ?? 0,
    portion:          Math.max(r.min ?? 1, defPort),
    base:             r.base ?? null,
    advancePrepHours: r.advancePrepHours ?? null,
    advancePrepNote:  r.advancePrepNote ?? null,
  }))]
}

// The line shown after a fill, or null when there's nothing to point out.
export function fillNotice({ skipped, hiddenCount }) {
  const parts = []
  if (skipped.length) parts.push(`Not in the freezer, so left out: ${skipped.join(', ')}.`)
  if (hiddenCount) parts.push(`${hiddenCount} meal${hiddenCount === 1 ? ' is' : 's are'} in a meal section that's turned off, so ${hiddenCount === 1 ? "it won't" : "they won't"} show until you turn it back on in Settings.`)
  return parts.length ? parts.join(' ') : null
}
