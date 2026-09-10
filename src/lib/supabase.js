import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(url, key)

// ─── Recipe images ─────────────────────────────────────────────────
// `recipes.image_path` holds a storage key relative to the bucket ("MP-VCBN.jpg"),
// not a URL. The bucket is public, so getPublicUrl is pure string building — no
// network, no auth. Call it once at fetch time rather than per render.
const RECIPE_IMAGE_BUCKET = 'recipe-images'

export function recipeImageUrl(path) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return supabase.storage.from(RECIPE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

// ─── Recipes ───────────────────────────────────────────────────────
export async function fetchRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      id, name, meal_type_id,
      weekdays,
      prep_time_minutes,
      cook_time_minutes,
      portion_size,
      min_portions,
      try_out,
      order_out,
      fun_recipe,
      husband_approved,
      advance_prep_hours,
      advance_prep_note,
      side_recommendation,
      image_path,
      image_credit,
      recipe_dietary_tags ( dietary_tag_id )
    `)
    .in('meal_type_id', ['breakfast', 'main', 'side', 'entree', 'dessert'])
    .order('name')

  if (error) throw error

  return data.filter(r => r.name && !r.name.startsWith('[') && !r.name.startsWith('Untitled')).map(r => {
    const tags = (r.recipe_dietary_tags || []).map(t => t.dietary_tag_id)
    return {
      id:         r.id,
      name:       r.name,
      cat:        r.meal_type_id === 'breakfast' ? 'Breakfast'
                : r.meal_type_id === 'side'      ? 'Sides'
                : r.meal_type_id === 'entree'    ? 'Starters'
                : r.meal_type_id === 'dessert'   ? 'Desserts'
                : 'Mains',
      prep:       r.prep_time_minutes  || 0,
      active:     r.cook_time_minutes  || 0,
      base:       r.portion_size       || 4,
      min:        r.min_portions       || 1,
      diet:       tags.includes('vegan')       ? 'vegan'
                : tags.includes('vegetarian')  ? 'veg'
                : 'omni',
      tryOut:     !!r.try_out,
      orderOut:   !!r.order_out,
      defaultDays: r.weekdays || [],
      fun:        !!r.fun_recipe,
      husband:    !!r.husband_approved,
      advancePrepHours: r.advance_prep_hours != null ? Number(r.advance_prep_hours) : null,
      advancePrepNote:  r.advance_prep_note || null,
      sideRecommendation: r.side_recommendation || null,
      imagePath:   r.image_path   || null,
      imageUrl:    recipeImageUrl(r.image_path),
      imageCredit: r.image_credit || null,
    }
  })
}

export async function createRecipe(fields) {
  const { diet, ...dbFields } = fields
  const id = 'mp-' + crypto.randomUUID()
  const { data, error } = await supabase
    .from('recipes')
    .insert({ id, ...dbFields })
    .select('id')
    .single()
  if (error) throw error
  if (diet === 'vegan' || diet === 'veg') {
    const tagId = diet === 'vegan' ? 'vegan' : 'vegetarian'
    await supabase.from('recipe_dietary_tags').insert({ recipe_id: data.id, dietary_tag_id: tagId })
  }
  return data.id
}

// ─── App settings ─────────────────────────────────────────────────
export async function fetchSettings() {
  const { data } = await supabase
    .from('app_settings')
    .select('default_portions, toddler_dob, recipe_view')
    .eq('id', 1)
    .single()
  return data
}

// All three writers below upsert rather than update: app_settings is a singleton
// keyed id=1, and an update against a missing row succeeds while changing
// nothing, so the setting would silently revert on the next reload. They also
// surface the error instead of discarding it — callers log it (there is no
// toast surface in this app), which at least makes a failed write visible.
export async function saveSettings(defaultPortions) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, default_portions: defaultPortions, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw error
}

export async function saveToddlerDob(dob) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, toddler_dob: dob, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw error
}

// Recipe selection view mode ('list' | 'photos'). Mirrored to localStorage for an
// instant first paint; this copy is what carries the choice across devices.
export async function saveRecipeView(view) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, recipe_view: view, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw error
}

// ─── Weight goal profile (singleton, same pattern as app_settings) ─
const PROFILE_FIELD_MAP = {
  goalModeEnabled: 'goal_mode_enabled', direction: 'direction', sex: 'sex', age: 'age',
  heightCm: 'height_cm', weightKg: 'weight_kg', goalWeightKg: 'goal_weight_kg',
  activityLevel: 'activity_level', pace: 'pace', units: 'units',
}

export async function fetchUserProfile() {
  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('id', 1)
    .single()
  if (error) throw error
  return {
    goalModeEnabled: data.goal_mode_enabled, direction: data.direction, sex: data.sex,
    age: data.age, heightCm: Number(data.height_cm), weightKg: Number(data.weight_kg),
    goalWeightKg: Number(data.goal_weight_kg), activityLevel: data.activity_level,
    pace: data.pace, units: data.units,
  }
}

// patch: any subset of the camelCase fields above
export async function saveUserProfile(patch) {
  const dbPatch = {}
  for (const [k, v] of Object.entries(patch)) {
    if (PROFILE_FIELD_MAP[k]) dbPatch[PROFILE_FIELD_MAP[k]] = v
  }
  await supabase
    .from('user_profile')
    .update({ ...dbPatch, updated_at: new Date().toISOString() })
    .eq('id', 1)
}

// ─── Per-portion nutrition + whole-food share for every recipe ─────
// Backs goal-mode figures (planner/daily-plan/recipe-selection row figures, the recipe
// details "Supports your goal" sheet, and the nutrition insights "Your goal" tab).
export async function fetchAllRecipeNutrition() {
  const [{ data: nutri, error: nErr }, { data: whole, error: wErr }] = await Promise.all([
    supabase.from('recipe_nutrition_per_portion').select('recipe_id, kcal, protein_g, fibre_g, coverage_pct, is_estimated'),
    supabase.from('recipe_whole_food_share').select('recipe_id, whole_food_pct'),
  ])
  if (nErr) throw nErr
  if (wErr) throw wErr
  const wholeMap = Object.fromEntries((whole || []).map(w => [w.recipe_id, w.whole_food_pct]))
  const map = {}
  ;(nutri || []).forEach(n => {
    map[n.recipe_id] = {
      kcal: n.kcal != null ? Number(n.kcal) : null,
      protein_g: n.protein_g != null ? Number(n.protein_g) : null,
      fibre_g: n.fibre_g != null ? Number(n.fibre_g) : null,
      coverage_pct: n.coverage_pct != null ? Number(n.coverage_pct) : null,
      is_estimated: !!n.is_estimated,
      whole_food_pct: wholeMap[n.recipe_id] != null ? Number(wholeMap[n.recipe_id]) : null,
    }
  })
  return map
}

// ─── Meal plan (get or create for a given week) ───────────────────
export async function getOrCreatePlan(weekOf) {
  // Upsert plan
  const { data: plan, error: planErr } = await supabase
    .from('meal_plans')
    .upsert({ week_of: weekOf }, { onConflict: 'week_of' })
    .select('id')
    .single()
  if (planErr) throw planErr

  // Upsert day entries
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const mon = new Date(weekOf)
  const entries = days.map((day, i) => {
    const d = new Date(mon)
    d.setDate(d.getDate() + i)
    return {
      meal_plan_id: plan.id,
      day_of_week:  day,
      date:         d.toISOString().split('T')[0],
    }
  })
  await supabase
    .from('day_entries')
    .upsert(entries, { onConflict: 'meal_plan_id,day_of_week' })

  return plan.id
}

// ─── Load full week plan ──────────────────────────────────────────
export async function fetchWeekPlan(planId) {
  const { data, error } = await supabase
    .from('day_entries')
    .select(`
      id, day_of_week,
      planned_meals (
        id, section, recipe_id, freezer_item_id,
        name_snapshot,
        prep_time_snapshot,
        cook_time_snapshot,
        portion,
        advance_prep_hours_snapshot,
        advance_prep_note_snapshot,
        position
      )
    `)
    .eq('meal_plan_id', planId)
    .order('position', { referencedTable: 'planned_meals' })

  if (error) throw error
  return data
}

// ─── Add meals ────────────────────────────────────────────────────
export async function addPlannedMeals(dayEntryId, meals) {
  const { data, error } = await supabase
    .from('planned_meals')
    .insert(meals.map((m, i) => ({
      day_entry_id:          dayEntryId,
      section:               m.section,
      recipe_id:             m.recipeId ?? null,
      freezer_item_id:       m.freezerItemId ?? null,
      name_snapshot:         m.name,
      prep_time_snapshot:    m.prep,
      cook_time_snapshot:    m.active,
      portion:               m.portion,
      base_portion_snapshot: m.base,
      advance_prep_hours_snapshot: m.advancePrepHours ?? null,
      advance_prep_note_snapshot:  m.advancePrepNote ?? null,
      position:              m.position + i,
    })))
    .select('id')

  if (error) throw error
  return data
}

// ─── Remove meal ──────────────────────────────────────────────────
export async function removePlannedMeal(id) {
  await supabase.from('planned_meals').delete().eq('id', id)
}

// ─── Update portion ───────────────────────────────────────────────
export async function updatePlannedMealPortion(id, portion) {
  await supabase.from('planned_meals').update({ portion }).eq('id', id)
}

// ─── Move meal to a different day ────────────────────────────────
export async function movePlannedMeal(id, newDayEntryId) {
  const { error } = await supabase
    .from('planned_meals')
    .update({ day_entry_id: newDayEntryId })
    .eq('id', id)
  if (error) throw error
}

// ─── Shopping list ────────────────────────────────────────────────
export async function fetchShoppingList(planId) {
  const { data } = await supabase
    .from('shopping_lists')
    .select('id, shopping_list_items(*)')
    .eq('meal_plan_id', planId)
    .single()
  return data
}

export async function saveShoppingList(planId, items) {
  // Upsert the list
  const { data: list } = await supabase
    .from('shopping_lists')
    .upsert({ meal_plan_id: planId }, { onConflict: 'meal_plan_id' })
    .select('id')
    .single()

  // Clear old items and insert new
  await supabase.from('shopping_list_items').delete().eq('shopping_list_id', list.id)
  if (items.length) {
    await supabase.from('shopping_list_items').insert(
      items.map(it => ({ ...it, shopping_list_id: list.id }))
    )
  }
  return list.id
}

export async function updateShoppingItem(id, checked) {
  await supabase.from('shopping_list_items').update({ checked }).eq('id', id)
}

// ─── Recipe notes ─────────────────────────────────────────────────
export async function fetchRecipeNotes(recipeId) {
  const { data } = await supabase
    .from('recipe_notes')
    .select('notes')
    .eq('recipe_id', recipeId)
    .single()
  return data?.notes ?? ''
}

export async function saveRecipeNotes(recipeId, notes) {
  await supabase
    .from('recipe_notes')
    .upsert({ recipe_id: recipeId, notes, updated_at: new Date().toISOString() },
             { onConflict: 'recipe_id' })
}

// ─── Freezer ──────────────────────────────────────────────────────
export async function fetchFreezerItems() {
  const { data, error } = await supabase
    .from('freezer')
    .select('id, name, in_stock')
    .order('name')
  if (error) throw error
  return data
}

// Bulk import — wipes the whole inventory and replaces it with the new list
export async function replaceFreezerItems(names) {
  await supabase.from('freezer').delete().gt('id', 0)
  if (!names.length) return []
  const { data, error } = await supabase
    .from('freezer')
    .insert(names.map(name => ({ name, in_stock: true })))
    .select('id, name, in_stock')
  if (error) throw error
  return data
}

// Manual single-item add — restocks if the name already exists
export async function addFreezerItem(name) {
  const { data, error } = await supabase
    .from('freezer')
    .upsert({ name, in_stock: true, updated_at: new Date().toISOString() }, { onConflict: 'name' })
    .select('id, name, in_stock')
    .single()
  if (error) throw error
  return data
}

export async function updateFreezerStock(ids, inStock) {
  await supabase
    .from('freezer')
    .update({ in_stock: inStock, updated_at: new Date().toISOString() })
    .in('id', Array.isArray(ids) ? ids : [ids])
}

export async function removeFreezerItem(id) {
  await supabase.from('freezer').delete().eq('id', id)
}

// ─── Recipe detail ────────────────────────────────────────────────
export async function fetchRecipeDetails(id) {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, prep_time_raw, cook_time_raw, prep_time_minutes, cook_time_minutes, portion_size, min_portions, fridge_storage, freezer_storage, has_thermomix_version, ingredients, instructions_standard, instructions_thermomix, chef_notes, toddler_variations, husband_variations, side_recommendation')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ─── Toddler cooking guide (cached AI content, singleton) ──────────
export async function fetchToddlerCookingGuide() {
  const { data } = await supabase
    .from('toddler_cooking_guide')
    .select('dob, content, generated_at')
    .eq('id', 1)
    .single()
  return data || null
}

export async function saveToddlerCookingGuide(dob, content) {
  await supabase
    .from('toddler_cooking_guide')
    .upsert({ id: 1, dob, content, generated_at: new Date().toISOString() }, { onConflict: 'id' })
}

// ─── Recipe toddler activities (cached AI content, per recipe) ──────
export async function fetchRecipeToddlerTask(recipeId) {
  const { data } = await supabase
    .from('recipe_toddler_tasks')
    .select('dob, age_band_id, age_band_label, task, needs_tool, activities, generated_at')
    .eq('recipe_id', recipeId)
    .single()
  return data || null
}

export async function saveRecipeToddlerTask(recipeId, { dob, ageBandId, ageBandLabel, activities }) {
  const first = activities?.[0] || {}
  await supabase
    .from('recipe_toddler_tasks')
    .upsert({
      recipe_id: recipeId, dob, age_band_id: ageBandId, age_band_label: ageBandLabel,
      activities, task: first.task ?? null, needs_tool: first.needsTool ?? null,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'recipe_id' })
}

// ─── Produce guides (Buyer's Eye) ────────────────────────────────
export async function matchProduceGuide(name) {
  const { data, error } = await supabase.rpc('match_produce_guide', { item_name: name })
  if (error) throw error
  return data // uuid | null
}

export async function fetchProduceGuide(id) {
  const { data, error } = await supabase
    .from('produce_guides')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function mergeProduceGuideAliases(id, newAliases) {
  const existing = await fetchProduceGuide(id)
  const merged = [...new Set(
    [...(existing.aliases || []), ...newAliases]
      .map(a => a.trim().toLowerCase())
      .filter(Boolean)
  )]
  const { data, error } = await supabase
    .from('produce_guides')
    .update({ aliases: merged })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function insertProduceGuide(guide) {
  const { data, error } = await supabase
    .from('produce_guides')
    .insert({ ...guide, source: 'ai' })
    .select('*')
    .single()
  if (error) throw error
  return data
}
