// ─── Rating a meal ────────────────────────────────────────────────
// What a rating means for its recipe, kept pure so every rule can be tested
// without a database. A recipe here is the shape supabase.js › fetchRecipes returns.
import { TODAY, toISO } from './dateHelpers.js'

export const ACTIVE = 'active'
export const SECOND_CHANCE = 'second_chance'
export const RETIRED = 'retired'

export const isRetired = r => r?.status === RETIRED

// The date of one day in a week, as YYYY-MM-DD. `week` comes from weekBounds.
export function mealDate(week, day) {
  const d = new Date(week.start)
  d.setDate(d.getDate() + week.days.indexOf(day))
  return toISO(d)
}

// Only recipes can be rated (not freezer items), and only once their day has come.
export function canRate(meal, day, days, today = TODAY) {
  const todayAt = days.indexOf(today)
  return !!meal.recipeId && todayAt >= 0 && days.indexOf(day) <= todayAt
}

// The first rule that matches wins. A second chance is only decided by a meal after
// the one that earned it, so re-rating that first meal goes through the usual rules.
export function ratingOutcome(recipe, rating, date) {
  const onSecondChance = recipe?.status === SECOND_CHANCE && !!recipe.secondChanceSince && date > recipe.secondChanceSince
  if (onSecondChance) return rating === 'loved' ? 'backInRotation' : 'retireAfterChance'
  if (isRetired(recipe)) return 'alreadyRetired'
  if (rating === 'bad') return 'retire'
  return rating === 'okay' ? 'reviewOkay' : 'loved'
}

// The recipe's place in the rotation, as it stands: what an Undo puts back.
export const rotationOf = r => ({
  status: r?.status ?? ACTIVE,
  fixNote: r?.fixNote ?? null,
  secondChanceSince: r?.secondChanceSince ?? null,
})
export const retiredPatch = { status: RETIRED, secondChanceSince: null }
export const activePatch = { status: ACTIVE, secondChanceSince: null }

// The review sheet's Save, as a rotation change. null leaves the recipe alone.
export function reviewPatch(recipe, { secondChance, fix }, today) {
  if (secondChance) return { status: SECOND_CHANCE, fixNote: fix.trim(), secondChanceSince: today }
  return recipe?.status === SECOND_CHANCE ? activePatch : null
}

// Picking the option that's already selected clears the child's answer.
export const nextAte = (current, picked) => (current === picked ? null : picked)

// A planned meal opened as a recipe can be rated once its day has come, in any week.
export const mealHasCome = (week, day, today = new Date()) => mealDate(week, day) <= toISO(today)

// ─── A recipe's own rating ────────────────────────────────────────
// The recipe screen shows what you last thought of a recipe, wherever you said it.
// `rows` are its meal_ratings, as supabase.js › fetchRecipeRatings returns them:
// { id, plannedMealId, rating, ate, comment, ratedAt }. The one row with no planned
// meal is the recipe's own, written from the recipe screen. It always holds the
// whole picture as it was shown, so when it's the newest row it wins outright,
// and a cleared answer stays cleared.
const time = r => Date.parse(r.ratedAt ?? '') || 0
export function recipeVerdict(rows = []) {
  const newest = [...rows].sort((a, b) => time(b) - time(a))
  const counts = field => r => r[field] != null || !r.plannedMealId
  const rated = newest.find(counts('rating'))
  return {
    rating: rated?.rating ?? null,
    comment: rated?.comment ?? null,
    ate: newest.find(counts('ate'))?.ate ?? null,
    own: rows.find(r => !r.plannedMealId) ?? null,
  }
}

// What the recipe's own row becomes after a change, keeping everything else shown.
export const ownRatingFields = (verdict, change) => ({
  rating: verdict.rating, ate: verdict.ate, comment: verdict.comment, ...change,
})

// `rows` with the recipe's own row put in, or replaced.
export const withOwnRow = (rows, row) => [...rows.filter(r => r.plannedMealId), row]
