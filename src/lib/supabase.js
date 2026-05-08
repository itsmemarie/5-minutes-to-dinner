import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(url, key)

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
      should_have_side,
      try_out,
      order_out,
      fun_recipe,
      husband_approved,
      recipe_dietary_tags ( dietary_tag_id )
    `)
    .in('meal_type_id', ['breakfast', 'main', 'side', 'entree'])
    .order('name')

  if (error) throw error

  return data.return data.filter(r => r.name && !r.name.startsWith('[')).map(r => {.map(r => {
    const tags = (r.recipe_dietary_tags || []).map(t => t.dietary_tag_id)
    return {
      id:         r.id,
      name:       r.name,
      cat:        r.meal_type_id === 'breakfast' ? 'Breakfast'
                : r.meal_type_id === 'side'      ? 'Sides'
                : 'Mains',
      prep:       r.prep_time_minutes  || 0,
      active:     r.cook_time_minutes  || 0,
      base:       r.portion_size       || 4,
      min:        r.min_portions       || 1,
      diet:       tags.includes('vegan')       ? 'vegan'
                : tags.includes('vegetarian')  ? 'veg'
                : 'omni',
      hasSides:   !!r.should_have_side,
      tryOut:     !!r.try_out,
      orderOut:   !!r.order_out,
      defaultDay: r.weekdays?.[0] || null,
      fun:        !!r.fun_recipe,
      husband:    !!r.husband_approved,
    }
  })
}

// ─── App settings ─────────────────────────────────────────────────
export async function fetchSettings() {
  const { data } = await supabase
    .from('app_settings')
    .select('default_portions')
    .eq('id', 1)
    .single()
  return data
}

export async function saveSettings(defaultPortions) {
  await supabase
    .from('app_settings')
    .update({ default_portions: defaultPortions, updated_at: new Date().toISOString() })
    .eq('id', 1)
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
        id, section, recipe_id,
        name_snapshot,
        prep_time_snapshot,
        cook_time_snapshot,
        portion,
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
      recipe_id:             m.recipeId,
      name_snapshot:         m.name,
      prep_time_snapshot:    m.prep,
      cook_time_snapshot:    m.active,
      portion:               m.portion,
      base_portion_snapshot: m.base,
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

// ─── Ratings ──────────────────────────────────────────────────────
export async function fetchRatings(plannedMealIds) {
  if (!plannedMealIds.length) return []
  const { data } = await supabase
    .from('meal_ratings')
    .select('planned_meal_id, rating')
    .in('planned_meal_id', plannedMealIds)
  return data || []
}

export async function upsertRating(plannedMealId, rating) {
  await supabase
    .from('meal_ratings')
    .upsert({ planned_meal_id: plannedMealId, rating, rated_at: new Date().toISOString() },
             { onConflict: 'planned_meal_id' })
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
