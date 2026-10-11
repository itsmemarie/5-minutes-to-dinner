import { describe, expect, it } from 'vitest'
import { EMPTY_RECIPE, mergeAiFields, missingFields, recipeForAi } from './recipeDraft.js'

const draft = { ...EMPTY_RECIPE, name: 'Dal', ingredients: '- 200g lentils', chef_notes: 'Mine.' }
const prov = { name: 'source', ingredients: 'source' }
const touched = { chef_notes: true }

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
