import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { aiHandler, aiResponse, badInput, runAiStep } from '../_shared/router.ts'
import { serviceClient } from '../_shared/auth.ts'

const SYSTEM_PROMPT = `You are a UK-based meal planning assistant generating a consolidated grocery shopping list.

Your task: given a set of recipes with their scaled ingredient lists, produce a deduplicated, consolidated shopping list suitable for a UK supermarket.

Rules:
- Consolidate the same ingredient across multiple recipes (e.g. onions used in 3 recipes → total quantity needed)
- Quantities have already been scaled by the scale factor shown — use them as-is
- Use UK-standard units (g, kg, ml, l, tins, bags, bunches, etc.) — convert sensibly (e.g. 1000g → 1kg)
- Use UK ingredient names (courgette not zucchini, coriander not cilantro, aubergine not eggplant)
- Categorise each item into one of: VEGETABLES, FRUIT, MEAT, FISH, DAIRY, BAKERY, DRY GOODS, PANTRY, FROZEN, OTHER
- Do not include salt, pepper, or basic cooking oil as standalone items unless used in significant quantities by a recipe
- Amount must be a string number (e.g. "400", "2", "1.5"). If no numeric quantity is given, use "1"
- Return ONLY a raw JSON object — no markdown, no backticks, no preamble. Must be parseable by JSON.parse().`

Deno.serve(aiHandler(async (req, body) => {
  const { meals, weekOf, region, units, measurements } = body

  const recipePortions = new Map<string, number>()
  for (const m of (Array.isArray(meals) ? meals : []) as { recipeId?: string; portion?: number }[]) {
    if (!m.recipeId) continue
    recipePortions.set(m.recipeId, (recipePortions.get(m.recipeId) ?? 0) + (m.portion ?? 4))
  }
  const recipeIds = [...recipePortions.keys()]
  if (!recipeIds.length) throw badInput('Add some meals to the planner first.')

  const { data: recipes, error } = await serviceClient()
    .from('recipes')
    .select('id, name, portion_size, ingredients')
    .in('id', recipeIds)
  if (error) throw new Error(`DB error: ${error.message}`)

  const recipeBlocks = (recipes ?? []).map((r: { id: string; name: string; portion_size: number | null; ingredients: string | null }) => {
    const totalPortions = recipePortions.get(r.id) ?? 4
    const basePortions = r.portion_size ?? 4
    const scale = (totalPortions / basePortions).toFixed(2)
    return `Recipe: ${r.name}\nBase portions: ${basePortions} | Planned this week: ${totalPortions} | Scale: ${scale}x\nIngredients:\n${r.ingredients ?? '(none)'}`
  }).join('\n\n---\n\n')

  const userPrompt = `Week of: ${weekOf}\nRegion: ${region ?? 'UK'}\nUnits: ${units ?? 'metric'}, ${measurements === 'cups' ? 'cups' : 'grams & ml'}\n\nRecipes planned this week (scale each ingredient by the factor shown, then consolidate duplicates):\n\n${recipeBlocks}\n\nReturn this exact JSON structure:\n{\n  "items": [\n    { "name": "Ingredient name", "amount": "500", "unit": "g", "aisle": "VEGETABLES" }\n  ]\n}\n\nAisle must be one of: VEGETABLES, FRUIT, MEAT, FISH, DAIRY, BAKERY, DRY GOODS, PANTRY, FROZEN, OTHER.`

  const { data, meta } = await runAiStep(req, 'shopping_list', { system: SYSTEM_PROMPT, user: userPrompt })
  return aiResponse(data, meta)
}))
