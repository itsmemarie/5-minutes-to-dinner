// Recipe workflow, step 3 — Expert review (an optional button).
// Separate, small suggestions the user accepts or skips one by one; each one
// is a find/replace on a single field so it can be applied to the original
// without regenerating anything. Constraints that limit the result (missing
// equipment, young children, …) come back as warnings with a workaround.
// Input: { recipe: {field: value}, context: HouseholdContext }
// Output: { suggestions: [{ id, field, title, why, find, replace }], warnings: [{ constraint, issue, workaround }] }
import { aiHandler, aiResponse, badInput, runAiStep } from '../_shared/router.ts'
import { type HouseholdContext, householdLines, recipeForPrompt, reviewSchema, sanitiseReview } from '../_shared/recipeFields.ts'

const SYSTEM = `You are a top home-cooking expert reviewing a family recipe for practical, everyday use: weeknight timing, reliable results, little washing-up, food safety.
Find real mistakes first (missing or wrong amounts, steps that don't match the ingredients, unsafe temperatures or timings, unclear steps), then the few improvements that matter most. Skip nitpicks and style. At most 6 suggestions, most important first.
Each suggestion changes one field:
- field: the tag name of the field to change
- find: text copied exactly, character for character, from that field (short but unique); or "" to append
- replace: the new text for that span, or the text to append
- title: what changes, in a few words
- why: one sentence
Use the household details below. When a constraint limits the result (an appliance they don't have, a young child eating it, region or units), add a warning naming the constraint, the issue and a practical workaround. No constraint problems means an empty warnings list.
Return JSON: {"suggestions":[...],"warnings":[...]}`

Deno.serve(aiHandler(async (req, body) => {
  const recipe = body.recipe && typeof body.recipe === 'object' ? body.recipe : null
  if (!recipe || (!String(recipe.ingredients ?? '').trim() && !String(recipe.instructions_standard ?? '').trim())) {
    throw badInput('Add the ingredients or method first, then ask for a review.')
  }
  const ctx: HouseholdContext = body.context ?? {}

  const { data, meta } = await runAiStep(req, 'recipe_review', {
    system: SYSTEM,
    user: `Household:\n${householdLines(ctx)}\n\nRecipe:\n${recipeForPrompt(recipe)}`,
    schema: reviewSchema,
  })
  return aiResponse(sanitiseReview(data, recipe), meta)
}))
