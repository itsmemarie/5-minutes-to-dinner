// ─── Weight goal maths ───────────────────────────────────────────
// Pure module — BMR/TDEE, daily targets, unit conversion, and the goal-adherence score.
// Nothing else in the app calculates these. See the feature README, "The maths" and
// "The goal-adherence score", for the spec this implements.

export const ACTIVITY = {
  sedentary: { factor:1.2,   label:'Sedentary', explainer:'Little to no exercise, a desk-based day.' },
  light:     { factor:1.375, label:'Light',      explainer:'Light exercise 1–3 days a week.' },
  moderate:  { factor:1.55,  label:'Moderate',   explainer:'Moderate — on your feet most days, 3–5 sessions a week.' },
  very:      { factor:1.725, label:'Very',       explainer:'Hard exercise 6–7 days a week, or a physical job.' },
}

export const PACES = {
  steady:    { kgPerWeek:0.25, delta:275,  proteinPerKg:1.6, label:'Steady' },
  standard:  { kgPerWeek:0.5,  delta:550,  proteinPerKg:1.8, label:'Standard' },
  fast:      { kgPerWeek:0.75, delta:825,  proteinPerKg:2.0, label:'Fast' },
  very_fast: { kgPerWeek:1,    delta:1100, proteinPerKg:2.2, label:'Very fast' },
}

export const CALORIE_FLOOR = 1200
export const WHOLE_FOOD_TARGET_PCT = 70

// ── BMR / TDEE / daily targets ─────────────────────────────────────
export function bmr({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

// profile: {sex, weightKg, heightCm, age, goalWeightKg, activityLevel, pace, direction}
export function computeTargets(profile) {
  const { sex, weightKg, heightCm, age, goalWeightKg, activityLevel, pace, direction } = profile
  const activity = ACTIVITY[activityLevel] || ACTIVITY.moderate
  const paceCfg  = PACES[pace] || PACES.standard
  const b    = bmr({ sex, weightKg, heightCm, age })
  const tdee = b * activity.factor
  const rawCalories = direction === 'gain' ? tdee + paceCfg.delta : tdee - paceCfg.delta
  const floorHit = direction === 'lose' && rawCalories < CALORIE_FLOOR
  const calories = direction === 'lose' ? Math.max(CALORIE_FLOOR, Math.round(rawCalories)) : Math.round(rawCalories)
  const protein  = Math.round(paceCfg.proteinPerKg * weightKg)
  const fibre    = Math.round(14 * calories / 1000)
  // "Maintain" (goal weight === current weight) is an open case per the spec — weeks
  // collapses to 0 rather than crashing; a nicer "Holding at Xkg" treatment is future work.
  const weeks = Math.abs(weightKg - goalWeightKg) / paceCfg.kgPerWeek
  const etaDate = new Date()
  etaDate.setDate(etaDate.getDate() + Math.round(weeks * 7))
  return {
    bmr: Math.round(b), tdee: Math.round(tdee), calories,
    calorieBandLow: calories - 125, calorieBandHigh: calories + 125,
    protein, fibre, wholeFoodPct: WHOLE_FOOD_TARGET_PCT,
    etaDate, floorHit, paceCaution: paceCfg.kgPerWeek >= 1,
    proteinPerKg: paceCfg.proteinPerKg, paceKgPerWeek: paceCfg.kgPerWeek, isMaintain: weightKg === goalWeightKg,
  }
}

// ── Units ───────────────────────────────────────────────────────────
export const kgToLb = kg => Math.round(kg * 2.20462)
export const lbToKg = lb => lb / 2.20462
export const cmToFtIn = cm => { const t = Math.round(cm / 2.54); return `${Math.floor(t / 12)}' ${t % 12}"` }
export const ftInToCm = (ft, inch) => (ft * 12 + inch) * 2.54

export function formatWeightKg(kg, units) {
  return units === 'imperial' ? `${kgToLb(kg)} lb` : `${Number(kg).toFixed(1)} kg`
}
export function formatHeightCm(cm, units) {
  return units === 'imperial' ? cmToFtIn(cm) : `${Math.round(cm)} cm`
}
export function formatCalorieBand(low, high) {
  return `${Math.round(low).toLocaleString('en-GB')}–${Math.round(high).toLocaleString('en-GB')}`
}
export function etaLine(targets, profile) {
  if (targets.isMaintain) return `Holding at ${formatWeightKg(profile.weightKg, profile.units)}.`
  const dateStr = targets.etaDate.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
  const goalStr = formatWeightKg(profile.goalWeightKg, profile.units)
  return `At ${targets.paceKgPerWeek} kg a week you reach ${goalStr} around ${dateStr}.`
}

// ── Per-meal / per-day nutrition roll-ups ────────────────────────────
// nutritionByRecipe: { [recipeId]: {kcal, protein_g, fibre_g, is_estimated, whole_food_pct} }
// One portion per person per planned meal (regardless of the meal's own portion count) —
// recipe_nutrition_per_portion is already per single portion.
export function mealNutrition(recipeId, nutritionByRecipe) {
  const n = recipeId && nutritionByRecipe[recipeId]
  return n && n.kcal != null ? n : null
}

export function rowFigure(n) {
  if (!n) return null
  const p = n.is_estimated ? '~' : ''
  return `${p}${Math.round(n.kcal)} cal · ${p}${Math.round(n.protein_g)}g P`
}

export function dayNutritionTotals(dayMeals, nutritionByRecipe) {
  let calories = 0, protein = 0, fibre = 0, wholeKcal = 0, matchedKcal = 0, hasData = false, isEstimated = false
  dayMeals.forEach(m => {
    const n = mealNutrition(m.recipeId, nutritionByRecipe)
    if (!n) return
    hasData = true
    calories += n.kcal; protein += n.protein_g; fibre += n.fibre_g
    if (n.is_estimated) isEstimated = true
    if (n.whole_food_pct != null) { wholeKcal += n.kcal * n.whole_food_pct / 100; matchedKcal += n.kcal }
  })
  return { calories, protein, fibre, wholeFoodPct: matchedKcal ? (wholeKcal / matchedKcal * 100) : null, hasData, isEstimated }
}

export function dayRemainingLine(dayTotals, targets) {
  if (!dayTotals.hasData) {
    return `${targets.calories.toLocaleString('en-GB')} cal left · ${targets.protein}g protein to go · ${targets.fibre}g fibre to go`
  }
  const calLeft = targets.calories - dayTotals.calories
  if (calLeft < 0) return `${Math.round(-calLeft).toLocaleString('en-GB')} cal over`
  const proteinLeft = Math.max(0, Math.round(targets.protein - dayTotals.protein))
  const fibreLeft   = Math.max(0, Math.round(targets.fibre - dayTotals.fibre))
  return `${Math.round(calLeft).toLocaleString('en-GB')} cal left · ${proteinLeft}g protein to go · ${fibreLeft}g fibre to go`
}

// ── Goal-adherence score ─────────────────────────────────────────────
// Components (max points): calories 30, protein 25, fibre 20, whole-food share 15 → 90 raw.
// Weekly score = mean of planned days' raw scores (0–90) + up to 10 consistency points → 0–100.
const COMPONENT_MAX   = { calories:30, protein:25, fibre:20, wholeFood:15 }
const COMPONENT_LABEL = { calories:'Calories', protein:'Protein', fibre:'Fibre', wholeFood:'Whole-food share' }

function ratioPoints(actual, target, max) {
  if (!target) return 0
  return max * Math.min(actual / target, 1)
}
function caloriePoints(actualCalories, targetCalories) {
  if (!targetCalories) return 0
  const dev = (actualCalories - targetCalories) / targetCalories
  const penalised = dev > 0 ? dev * 1.5 : Math.abs(dev) // over-target costs 1.5×; under-target is 1:1
  return 30 * Math.max(0, 1 - penalised)
}

export function dailyScoreRaw(dayTotals, targets) {
  const calories  = caloriePoints(dayTotals.calories, targets.calories)
  const protein   = ratioPoints(dayTotals.protein, targets.protein, COMPONENT_MAX.protein)
  const fibre     = ratioPoints(dayTotals.fibre, targets.fibre, COMPONENT_MAX.fibre)
  const wholeFood = dayTotals.wholeFoodPct != null ? ratioPoints(dayTotals.wholeFoodPct, WHOLE_FOOD_TARGET_PCT, COMPONENT_MAX.wholeFood) : 0
  return { total: calories + protein + fibre + wholeFood, calories, protein, fibre, wholeFood }
}

export function weeklyScore(dailyRawScores) {
  if (!dailyRawScores.length) return null
  const totals = dailyRawScores.map(d => d.total)
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length
  let consistency = 10
  if (totals.length > 1) {
    const variance = totals.reduce((a, t) => a + (t - mean) ** 2, 0) / totals.length
    const spreadRatio = Math.min(Math.sqrt(variance) / 45, 1) // 45 = half the 0–90 raw range
    consistency = 10 * (1 - spreadRatio)
  }
  const score = Math.round(Math.min(100, mean + consistency))
  const keys = Object.keys(COMPONENT_MAX)
  const avgPct = Object.fromEntries(keys.map(k => [
    k, dailyRawScores.reduce((a, d) => a + d[k], 0) / dailyRawScores.length / COMPONENT_MAX[k],
  ]))
  const weakest = keys.reduce((a, b) => avgPct[a] <= avgPct[b] ? a : b)
  return { score, consistency: Math.round(consistency), weakest, weakestLabel: COMPONENT_LABEL[weakest] }
}

export function weakestComponentReason(weeklyScoreResult) {
  if (!weeklyScoreResult) return ''
  return `${weeklyScoreResult.weakestLabel} is the gap this week.`
}
