// Freezer list from photos — a 1:1 transcription of item names.
// Input: { images: [{ base64, mediaType }] }   Output: { items: string[] }
// (Pasted text never reaches here; the client splits it line by line.)
import { aiHandler, aiResponse, badInput, runAiStep, StepError } from '../_shared/router.ts'

const SYSTEM = `You transcribe an inventory list from photos: a handwritten or printed list, or labelled freezer bags and containers.
Copy every distinct item name exactly as written, across all photos, into one flat list. Skip quantities, dates and non-food text unless they are part of the item's name. Do not add or correct anything.
Return JSON: {"items": ["..."]}`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: { items: { type: 'array', items: { type: 'string' } } },
}

Deno.serve(aiHandler(async (req, body) => {
  const images = Array.isArray(body.images) ? body.images : []
  if (!images.length) throw badInput('Add a photo of your freezer list.')
  if (images.length > 3) throw badInput('Up to 3 photos at a time, please.')

  const { data, meta } = await runAiStep(req, 'freezer_extract', {
    system: SYSTEM,
    user: images.length > 1 ? 'These photos show one freezer inventory. List every item.' : 'List the freezer items in this photo.',
    images: images.map((i: { base64: string; mediaType?: string }) => ({ base64: String(i.base64 ?? ''), mediaType: i.mediaType })),
    schema: SCHEMA,
  })
  // Older replies were a bare array; accept either.
  const list = Array.isArray(data) ? data : (data as { items?: unknown })?.items
  if (!Array.isArray(list)) throw new StepError("Couldn't read any items from that photo.", 'nothing_found', 422)
  const items = [...new Set(list.filter((x): x is string => typeof x === 'string' && !!x.trim()).map(x => x.trim()))]
  return aiResponse({ items }, meta)
}))
