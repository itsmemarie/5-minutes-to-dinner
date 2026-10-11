import { describe, expect, it } from 'vitest'
import { applySuggestion } from './reviewSuggestions.js'
import { EMPTY_RECIPE } from './recipeDraft.js'

const draft = {
  ...EMPTY_RECIPE,
  name: 'Dal',
  cook_time_minutes: 20,
  ingredients: '- 200g red lentils\n- 1 onion',
  instructions_standard: '1. Fry the onion.\n2. Simmer for 20 minutes.',
}

describe('applySuggestion', () => {
  it('replaces exactly the quoted text and nothing else', () => {
    const r = applySuggestion(draft, { field: 'instructions_standard', find: '20 minutes', replace: '25 minutes' })
    expect(r.ok).toBe(true)
    expect(r.fields.instructions_standard).toBe('1. Fry the onion.\n2. Simmer for 25 minutes.')
    expect(r.fields.ingredients).toBe(draft.ingredients)
  })
  it('appends in the field\'s own format', () => {
    expect(applySuggestion(draft, { field: 'ingredients', find: '', replace: '1 tsp cumin seeds' }).fields.ingredients)
      .toBe('- 200g red lentils\n- 1 onion\n- 1 tsp cumin seeds')
    expect(applySuggestion(draft, { field: 'instructions_standard', find: '', replace: 'Finish with lemon.' }).fields.instructions_standard)
      .toMatch(/\n3\. Finish with lemon\.$/)
  })
  it('refuses when the text has changed since the review', () => {
    const edited = { ...draft, instructions_standard: '1. Simmer for half an hour.' }
    expect(applySuggestion(edited, { field: 'instructions_standard', find: '20 minutes', replace: '25 minutes' }))
      .toEqual({ ok: false, reason: 'text-changed' })
  })
  it('keeps number fields numbers', () => {
    expect(applySuggestion(draft, { field: 'cook_time_minutes', find: '20', replace: '25' }).fields.cook_time_minutes).toBe(25)
    expect(applySuggestion(draft, { field: 'cook_time_minutes', find: '', replace: 'about half an hour' })).toEqual({ ok: false, reason: 'not-a-number' })
  })
  it('ignores fields the form doesn\'t have', () => {
    expect(applySuggestion(draft, { field: 'secret', find: '', replace: 'x' })).toEqual({ ok: false, reason: 'unknown-field' })
  })
})
