// Invent a recipe from a short description ("Describe what you want").
// This is generation by design — the form marks the whole result as AI-made.
// Input: { description, context?: HouseholdContext }
import { aiHandler, aiResponse, badInput, runAiStep } from '../_shared/router.ts'
import { CHEF_PERSONA, type HouseholdContext, THERMOMIX_RULES, flattenLists, hasThermomix, householdLines } from '../_shared/recipeFields.ts'

const system = (ctx: HouseholdContext) => {
  const tm = hasThermomix(ctx)
  return `${CHEF_PERSONA} Invent an original recipe that satisfies the request.
${householdLines(ctx)}${tm ? `\n${THERMOMIX_RULES}` : ''}
Return only a JSON object with these keys. Every value is a single string or number, never a list:
name: specific and descriptive, e.g. "Slow-Roasted Tomato & Ricotta Pasta", not "Pasta"
meal_type_id: main | breakfast | side | dessert | entree
diet: omni | veg | vegan
prep_time_minutes, cook_time_minutes: numbers
advance_prep_hours: hours of unattended lead time (marinating, proving, soaking, thawing); 0 if none
advance_prep_note: e.g. "Marinate chicken 4h"; "" if none
portion_size: number (default 4); min_portions: number
has_thermomix_version: ${tm ? 'true only if the Thermomix does this dish justice, otherwise false' : 'false'}
ingredients: grouped, "[Category]" lines then "- 200g ingredient" lines
instructions_standard: one step per line, "1. Step name: description with amounts (200g). Cook X minutes."${tm ? '\ninstructions_thermomix: one step per line, "1. Step name: TM6 instructions. X sec / speed Y."; pan or oven steps give heat and time instead; "" when has_thermomix_version is false' : ''}
fridge_storage: e.g. "3-4 days"
freezer_storage: how and how long, or "Not recommended"
chef_notes: one short paragraph of 2-3 chef's tips that lift the flavour or make it more reliable at home
husband_variations: protein-focused variation, towards chicken if possible
toddler_variations: ages 1-3: lower salt, smaller pieces, softer textures (the only place for child adaptations)
side_recommendation: up to 3 sides, comma-separated`
}

Deno.serve(aiHandler(async (req, body) => {
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (!description) throw badInput('Describe the recipe you want.')
  const ctx: HouseholdContext = body.context ?? {}
  const { data, meta } = await runAiStep(req, 'recipe_generate', { system: system(ctx), user: description.slice(0, 2000) })
  return aiResponse(flattenLists(data), meta)
}))
