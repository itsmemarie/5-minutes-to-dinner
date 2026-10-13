import { describe, expect, it } from 'vitest'
import { dishName, findImageBlock, imagePrompt, ingredientName, mainIngredients, runImageChain, type ImageAttempt } from './imageGen.ts'
import { AiProviderError } from './aiErrors.ts'
import type { StepError } from './aiChain.ts'

describe('ingredient names for the prompt', () => {
  it.each([
    ['- 400g tinned tomatoes, drained', 'tinned tomatoes'],
    ['— Chicken thighs (600g)', 'chicken thighs'],
    ['2 cloves garlic, crushed', 'garlic'],
    ['1 x 400g tin chopped tomatoes', 'chopped tomatoes'],
    ['½ tsp ground cumin', 'ground cumin'],
    ['2 garlic cloves', 'garlic cloves'],
    ['1 lemon, zested', 'lemon'],
    ['a pinch of chilli flakes', 'chilli flakes'],
    ['Fresh basil', 'fresh basil'],
    ['[Sauce]', ''],
    ['For the dressing:', ''],
  ])('%s → %s', (line, name) => {
    expect(ingredientName(line)).toBe(name)
  })

  it('skips headings, seasoning and repeats, and caps the list', () => {
    const text = '[Main]\n- 600g chicken thighs\n- 1 onion\n- Salt and pepper\n- 2 tbsp olive oil\n- 1 onion, sliced\n[Sauce]\n- 400g tinned tomatoes'
    expect(mainIngredients(text)).toEqual(['chicken thighs', 'onion', 'tinned tomatoes'])
    expect(mainIngredients(Array.from({ length: 20 }, (_, i) => `- item${i}`).join('\n'))).toHaveLength(8)
    expect(mainIngredients(null)).toEqual([])
  })
})

describe('imagePrompt', () => {
  it('uses the dish name without its id suffix, and the main ingredients', () => {
    expect(dishName('Slow-Roasted Tomato Pasta | MP-SLRS')).toBe('Slow-Roasted Tomato Pasta')
    const p = imagePrompt('Lemon Chicken | MP-LMNC', '- 4 chicken thighs\n- 1 lemon\n- salt')
    expect(p).toContain('photograph of Lemon Chicken, a home-cooked dish, made with chicken thighs, lemon.')
    expect(p).toContain('No text')
  })

  it('works with a name alone', () => {
    expect(imagePrompt('Banana Bread', '')).toContain('photograph of Banana Bread, a home-cooked dish. ')
  })
})

describe('findImageBlock', () => {
  it('reads an Interactions image block', () => {
    const reply = { id: 'x', status: 'completed', steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: 'Here' }, { type: 'image', data: 'QUJD', mime_type: 'image/jpeg' }] }] }
    expect(findImageBlock(reply)).toEqual({ base64: 'QUJD', mediaType: 'image/jpeg' })
  })

  it('reads a generateContent inlineData part', () => {
    const reply = { candidates: [{ content: { parts: [{ text: 'hi' }, { inlineData: { mimeType: 'image/png', data: 'UE5H' } }] } }] }
    expect(findImageBlock(reply)).toEqual({ base64: 'UE5H', mediaType: 'image/png' })
  })

  it('is null when there is no picture', () => {
    expect(findImageBlock({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Sorry' }] }] })).toBeNull()
  })
})

describe('runImageChain', () => {
  const img = { base64: 'QUJD', mediaType: 'image/jpeg' }
  const ok = (provider: string): ImageAttempt => ({ provider, model: `${provider}-m`, run: async () => img })
  const failing = (provider: string, kind: 'limit' | 'unavailable' | 'refused' | 'bad_output' | 'auth'): ImageAttempt =>
    ({ provider, model: `${provider}-m`, run: async () => { throw new AiProviderError(provider, kind, `${provider} ${kind}`) } })
  const codeOf = async (p: Promise<unknown>) => {
    try { await p } catch (e) { return (e as StepError).code }
    return 'resolved'
  }

  it('answers from the first provider that works', async () => {
    expect(await runImageChain([ok('cloudflare'), ok('gemini')])).toEqual({ ...img, provider: 'cloudflare', model: 'cloudflare-m' })
    expect(await runImageChain([failing('cloudflare', 'limit'), ok('gemini')])).toMatchObject({ provider: 'gemini' })
    expect(await runImageChain([failing('cloudflare', 'bad_output'), ok('gemini')])).toMatchObject({ provider: 'gemini' })
  })

  it('reports why nothing worked', async () => {
    expect(await codeOf(runImageChain([]))).toBe('image_unavailable')
    expect(await codeOf(runImageChain([failing('cloudflare', 'limit'), failing('gemini', 'auth')]))).toBe('image_limited')
    expect(await codeOf(runImageChain([failing('cloudflare', 'unavailable')]))).toBe('image_failed')
  })

  it('stops at a refusal rather than asking another model', async () => {
    let asked = false
    const second: ImageAttempt = { provider: 'gemini', model: 'g', run: async () => { asked = true; return img } }
    expect(await codeOf(runImageChain([failing('cloudflare', 'refused'), second]))).toBe('image_refused')
    expect(asked).toBe(false)
  })

  it("gives the owner the provider's own words", async () => {
    await expect(runImageChain([failing('cloudflare', 'unavailable')], { detail: true })).rejects.toThrow('(cloudflare unavailable)')
    await expect(runImageChain([failing('cloudflare', 'unavailable')])).rejects.not.toThrow('cloudflare unavailable')
  })
})
