// ─── Saved weeks ──────────────────────────────────────────────────
// A saved week is a named, independent copy of a week's meals (the saved_weeks
// table). Filling a week copies it into planned_meals; from then on that week
// is an ordinary week, and changing it leaves the saved copy alone.
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

// The line shown after a fill, or null when there's nothing to point out.
export function fillNotice({ skipped, hiddenCount }) {
  const parts = []
  if (skipped.length) parts.push(`Not in the freezer, so left out: ${skipped.join(', ')}.`)
  if (hiddenCount) parts.push(`${hiddenCount} meal${hiddenCount === 1 ? ' is' : 's are'} in a meal section that's turned off, so ${hiddenCount === 1 ? "it won't" : "they won't"} show until you turn it back on in Settings.`)
  return parts.length ? parts.join(' ') : null
}
