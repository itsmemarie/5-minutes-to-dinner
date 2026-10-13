// Recipe workflow, step 2 — Complete (an optional button).
// Fills only the fields the client lists as empty; the response holds exactly
// those keys, so the form can mark each one "Added by AI".
// Input: { recipe: {field: value}, missing: [field], context: HouseholdContext }
// Output: { fields: { field: value } }
import { aiHandler, aiResponse, badInput, runAiStep } from '../_shared/router.ts'
import {
  CHEF_PERSONA, COMPLETABLE, type HouseholdContext, THERMOMIX_RULES, completableRequest, completionSchema,
  householdLines, recipeForPrompt, sanitiseCompletion,
} from '../_shared/recipeFields.ts'
import { json } from '../_shared/http.ts'

Deno.serve(aiHandler(async (req, body) => {
  const recipe = body.recipe && typeof body.recipe === 'object' ? body.recipe : null
  if (!recipe || !String(recipe.ingredients ?? '').trim()) throw badInput('Add the ingredients first, then fill in the rest.')
  const ctx: HouseholdContext = body.context ?? {}
  const fields = completableRequest(body.missing, recipe, ctx)
  if (!fields.length) return json({ fields: {} })

  const system = `${CHEF_PERSONA} You are completing a recipe for a meal-planning app. Fill in ONLY the fields listed below, based on the recipe as given. Never change the recipe itself. Be concise and practical.
${householdLines(ctx)}${fields.includes('instructions_thermomix') ? `\n${THERMOMIX_RULES}` : ''}
Fields to fill:
${fields.map(f => `- ${f}: ${COMPLETABLE[f].guide}`).join('\n')}
Return a JSON object with exactly these keys.`

  const { data, meta } = await runAiStep(req, 'recipe_complete', {
    system,
    user: recipeForPrompt(recipe),
    schema: completionSchema(fields),
  })
  return aiResponse({ fields: sanitiseCompletion(data, fields) }, meta)
}))
