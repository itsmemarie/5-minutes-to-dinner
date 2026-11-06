import { describe, expect, it } from 'vitest'
import { EMPTY_RECIPE, applyTranslation, mergeAiFields, missingFields, needsTranslating, recipeForAi, recipeForTranslation } from './recipeDraft.js'

const draft = { ...EMPTY_RECIPE, name: 'Dal', ingredients: '- 200g lentils', chef_notes: 'Mine.' }
const prov = { name: 'source', ingredients: 'source' }
const touched = { chef_notes: true }

describe('new recipe defaults', () => {
  it('starts every new recipe as Try Out', () => {
    expect(EMPTY_RECIPE.try_out).toBe(true)
  })
})

describe('provenance rules for the AI steps', () => {
  it('treats untouched defaults as unknown, and typed or sourced values as known', () => {
    const missing = missingFields(draft, prov, touched)
    expect(missing).toContain('diet')            // default 'omni', nobody confirmed it
    expect(missing).toContain('portion_size')    // default 4
    expect(missing).toContain('fridge_storage')  // empty
    expect(missing).not.toContain('name')
    expect(missing).not.toContain('chef_notes')  // the user typed it
  })

  it('never lets step 2 overwrite a known field', () => {
    const { fields, changed } = mergeAiFields(draft, { name: 'AI name', chef_notes: 'AI notes', fridge_storage: '3 days', portion_size: '6' }, { onlyEmpty: true, prov, touched })
    expect(fields.name).toBe('Dal')
    expect(fields.chef_notes).toBe('Mine.')
    expect(fields.fridge_storage).toBe('3 days')
    expect(fields.portion_size).toBe(6)
    expect(changed.sort()).toEqual(['fridge_storage', 'portion_size'])
  })

  it('sets the Thermomix toggle when a Thermomix method is added', () => {
    expect(mergeAiFields(draft, { instructions_thermomix: '1. Chop: 5 sec / speed 5' }).fields.has_thermomix_version).toBe(true)
  })

  it('sends the AI only what is actually known', () => {
    expect(recipeForAi(draft, prov, touched)).toEqual({ name: 'Dal', ingredients: '- 200g lentils', chef_notes: 'Mine.' })
  })
})

describe('translating a draft', () => {
  const german = { ...EMPTY_RECIPE, name: 'Linsensuppe', ingredients: '- 200 g Linsen', chef_notes: 'Mit Zitrone.', portion_size: 6, prep_time_minutes: 10, diet: 'veg' }

  it('sends the wording only, whoever wrote it', () => {
    expect(recipeForTranslation(german)).toEqual({ name: 'Linsensuppe', ingredients: '- 200 g Linsen', chef_notes: 'Mit Zitrone.' })
  })

  it('applies a translation and reports what changed', () => {
    const sent = recipeForTranslation(german)
    const { fields, changed, kept } = applyTranslation(german, sent, { name: 'Lentil soup', ingredients: '- 200 g lentils', chef_notes: 'With lemon.' })
    expect(fields).toMatchObject({ name: 'Lentil soup', ingredients: '- 200 g lentils', chef_notes: 'With lemon.', portion_size: 6, diet: 'veg' })
    expect(changed.sort()).toEqual(['chef_notes', 'ingredients', 'name'])
    expect(kept).toEqual([])
  })

  it('keeps a field the user edited while the translation ran', () => {
    const sent = recipeForTranslation(german)
    const now = { ...german, chef_notes: 'Viel Zitrone.' }
    const { fields, changed, kept } = applyTranslation(now, sent, { name: 'Lentil soup', chef_notes: 'With lemon.' })
    expect(fields.chef_notes).toBe('Viel Zitrone.')
    expect(fields.name).toBe('Lentil soup')
    expect(changed).toEqual(['name'])
    expect(kept).toEqual(['chef_notes'])
  })

  it('does not count text that came back the same as translated', () => {
    const sent = recipeForTranslation(german)
    expect(applyTranslation(german, sent, { name: 'Linsensuppe' }).changed).toEqual([])
  })

  it('only ever writes text fields', () => {
    const sent = { ...recipeForTranslation(german), portion_size: 6 }
    const { fields, changed } = applyTranslation(german, sent, { portion_size: 99, try_out: false, source_url: 'https://x.example' })
    expect(fields).toEqual(german)
    expect(changed).toEqual([])
  })

  it('survives an empty result', () => {
    expect(applyTranslation(german, {}, undefined)).toEqual({ fields: german, changed: [], kept: [] })
  })

  it('offers a translation only for a known, different language', () => {
    expect(needsTranslating('de', 'en')).toBe(true)
    expect(needsTranslating('en', 'en')).toBe(false)
    expect(needsTranslating(null, 'en')).toBe(false)
    expect(needsTranslating('de', undefined)).toBe(false)
  })

  it('treats both written forms of Norwegian as Norwegian', () => {
    expect(needsTranslating('nb', 'no')).toBe(false)
    expect(needsTranslating('nn', 'no')).toBe(false)
  })
})
