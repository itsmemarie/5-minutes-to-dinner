// Recipe workflow — Translate. Runs after step 2, and only once the user has
// agreed (or set Settings › Translate recipes to Always). Separate from step 2
// because that step must never change existing text, and this one does nothing else.
// Input: { recipe: {field: value}, context: HouseholdContext }
// Output: { fields: { field: text }, skipped: [field] } — see sanitiseTranslation.
import { aiHandler, aiResponse, badInput, runAiStep } from '../_shared/router.ts'
import {
  type HouseholdContext, recipeForPrompt, sanitiseLanguage, sanitiseTranslation, translatableFields, translationSchema,
} from '../_shared/recipeFields.ts'
import { json } from '../_shared/http.ts'

const system = (language: string, region: string | undefined, fields: string[]) =>
  `You translate recipes into ${language} for a meal-planning app. Translate every field below faithfully: add nothing, remove nothing, correct nothing and convert nothing.
- Keep every number exactly as written, including amounts, times and temperatures. Don't change the measuring system.
- Translate unit words and abbreviations, e.g. "EL" into English is "tbsp" and "TL" is "tsp".
- Keep the layout exactly: the same lines in the same order. "[Heading]" lines keep their square brackets, ingredient lines keep their "- ", and numbered steps keep their "1. ".
- ${region ? `Use the ingredient names cooks use in ${region}.` : 'Use everyday ingredient names.'} A dish or ingredient with no real equivalent keeps its own name.
- Leave any text that is already in ${language} as it is.
Return a JSON object with exactly these keys: ${fields.join(', ')}.`

Deno.serve(aiHandler(async (req, body) => {
  const recipe = body.recipe && typeof body.recipe === 'object' ? body.recipe : null
  if (!recipe) throw badInput('Nothing to translate yet.')
  const ctx: HouseholdContext = body.context ?? {}
  const code = sanitiseLanguage(ctx.language)
  if (!code) throw badInput('Choose a recipe language in Settings first.')
  const fields = translatableFields(recipe)
  if (!fields.length) return json({ fields: {}, skipped: [] })

  const language = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  const { data, meta } = await runAiStep(req, 'recipe_translate', {
    system: system(language, ctx.region, fields),
    user: recipeForPrompt(Object.fromEntries(fields.map(f => [f, recipe[f]]))),
    schema: translationSchema(fields),
  })
  return aiResponse(sanitiseTranslation(data, recipe, fields), meta)
}))
