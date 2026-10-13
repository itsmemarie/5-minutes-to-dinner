// An AI picture of a recipe, from its name and ingredients.
// Input: { name, ingredients? }
// Output: { image: { base64, mediaType }, provider, model }
// Nothing is saved here: the app shows the picture first, and only one the
// user accepts goes up through ingest-recipe-image like any other photo.
import { aiHandler, badInput } from '../_shared/router.ts'
import { imagePrompt, runImageChain } from '../_shared/imageGen.ts'
import { imageAttempts } from '../_shared/imageProviders.ts'
import { json } from '../_shared/http.ts'

Deno.serve(aiHandler(async (req, body) => {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) throw badInput('Add the recipe name first.')
  const ingredients = typeof body.ingredients === 'string' ? body.ingredients.slice(0, 4000) : ''

  const { attempts, isOwner } = await imageAttempts(req, imagePrompt(name, ingredients))
  const started = Date.now()
  const { base64, mediaType, provider, model } = await runImageChain(attempts, { detail: isOwner })
  return json({ image: { base64, mediaType }, provider, model }, {
    headers: { 'x-ai-step': 'recipe_image', 'x-ai-provider': provider, 'x-ai-model': model, 'x-ai-ms': String(Date.now() - started) },
  })
}))
