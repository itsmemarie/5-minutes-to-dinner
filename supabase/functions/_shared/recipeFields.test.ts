import { describe, expect, it } from 'vitest'
import { completableRequest, completionSchema, recipeForPrompt, sanitiseCompletion, sanitiseReview } from './recipeFields.ts'

const recipe = { name: 'Dal', ingredients: '- 200g red lentils\n- 1 onion', instructions_standard: '1. Simmer for 20 minutes.' }

describe('step 2: complete', () => {
  it('only asks for empty, completable fields', () => {
    const asked = completableRequest(['name', 'chef_notes', 'ingredients', 'instructions_thermomix', 'bogus', 'chef_notes'], recipe, { equipment: ['Oven'] })
    expect(asked).toEqual(['chef_notes'])   // name is filled; ingredients aren't completable; no Thermomix
  })
  it('asks for a Thermomix method only when they have one', () => {
    expect(completableRequest(['instructions_thermomix'], recipe, { equipment: ['Thermomix TM6'] })).toEqual(['instructions_thermomix'])
  })
  it('drops anything the model returns beyond the request, and fixes types', () => {
    const out = sanitiseCompletion({ chef_notes: '  Toast the spices. ', prep_time_minutes: '15 mins', diet: 'carnivore', ingredients: 'overwrite!' }, ['chef_notes', 'prep_time_minutes', 'diet'])
    expect(out).toEqual({ chef_notes: 'Toast the spices.', prep_time_minutes: 15 })
  })
  it('builds a strict schema for exactly the requested keys', () => {
    const s = completionSchema(['diet', 'portion_size'])
    expect(s.required).toEqual(['diet', 'portion_size'])
    expect(s.additionalProperties).toBe(false)
    expect(s.properties.portion_size).toEqual({ type: 'integer' })
  })
})

describe('step 3: review', () => {
  it('keeps suggestions whose quote is really in the field, and caps the list', () => {
    const raw = {
      suggestions: [
        { field: 'instructions_standard', title: 'Longer simmer', why: 'Red lentils need ~25 min.', find: '20 minutes', replace: '25 minutes' },
        { field: 'ingredients', title: 'Ghost', why: '', find: 'not in the recipe', replace: 'x' },
        { field: 'secret_column', title: 'Nope', why: '', find: '', replace: 'x' },
        { field: 'chef_notes', title: 'Add a tip', why: '', find: '', replace: 'Finish with lemon.' },
      ],
      warnings: [{ constraint: 'No oven', issue: '', workaround: '' }, { constraint: 'Toddler', issue: 'Whole spices are a choking risk.', workaround: 'Remove them before serving.' }],
    }
    const { suggestions, warnings } = sanitiseReview(raw, recipe)
    expect(suggestions.map(s => s.title)).toEqual(['Longer simmer', 'Add a tip'])
    expect(suggestions[0].id).toBe('s1')
    expect(warnings).toHaveLength(1)
  })
  it('survives garbage', () => {
    expect(sanitiseReview(null, recipe)).toEqual({ suggestions: [], warnings: [] })
  })
})

describe('recipeForPrompt', () => {
  it('tags present fields and skips empty ones', () => {
    const p = recipeForPrompt({ ...recipe, chef_notes: '', portion_size: 4 })
    expect(p).toContain('<name>\nDal\n</name>')
    expect(p).toContain('<portion_size>\n4\n</portion_size>')
    expect(p).not.toContain('chef_notes')
  })
})
