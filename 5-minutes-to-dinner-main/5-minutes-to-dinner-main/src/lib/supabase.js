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
      try_out,
      order_out,
      fun_recipe,
      husband_approved,
      advance_prep_hours,
      advance_prep_note,
      side_recommendation,
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
