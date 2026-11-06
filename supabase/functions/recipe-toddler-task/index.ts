import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { aiHandler, aiResponse, runAiStep } from '../_shared/router.ts'
import { RECIPE_TODDLER_SYSTEM, recipeToddlerPrompt, sanitiseToddlerActivities } from '../_shared/toddlerHelpers.ts'

Deno.serve(aiHandler(async (req, body) => {
  const { data, meta } = await runAiStep(req, 'recipe_toddler', { system: RECIPE_TODDLER_SYSTEM, user: recipeToddlerPrompt(body) })
  return aiResponse(sanitiseToddlerActivities(data), meta)
}))
