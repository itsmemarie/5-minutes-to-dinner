import { describe, expect, it } from 'vitest'
import {
  completableRequest, completionSchema, householdLines, recipeForPrompt, sanitiseCompletion, sanitiseLanguage, sanitiseReview,
  sanitiseTranslation, translatableFields, translationSchema,
} from './recipeFields.ts'

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
    expect(s.required).toEqual(['diet', 'portion_size', 'language'])
    expect(s.additionalProperties).toBe(false)
    expect(s.properties.portion_size).toEqual({ type: 'integer' })
    expect(s.properties.language).toEqual({ type: 'string' })
  })
  it('never treats the reported language as a recipe field', () => {
    expect(sanitiseCompletion({ chef_notes: 'Toast the spices.', language: 'de' }, ['chef_notes'])).toEqual({ chef_notes: 'Toast the spices.' })
  })
})

describe('sanitiseLanguage', () => {
  it('keeps a language code, lower-cased and without its region', () => {
    expect(sanitiseLanguage('de')).toBe('de')
    expect(sanitiseLanguage(' DE ')).toBe('de')
    expect(sanitiseLanguage('zh-CN')).toBe('zh')
    expect(sanitiseLanguage('pt_BR')).toBe('pt')
  })
  it('treats anything else as unknown', () => {
    expect(sanitiseLanguage('German')).toBeNull()
    expect(sanitiseLanguage('')).toBeNull()
    expect(sanitiseLanguage(null)).toBeNull()
    expect(sanitiseLanguage(42)).toBeNull()
  })
})

describe('translate', () => {
  const german = {
    name: 'Linsensuppe',
    ingredients: '[Suppe]\n- 200 g rote Linsen\n- 1 EL Öl',
    instructions_standard: '1. Kochen: 20 Minuten köcheln.\n2. Würzen: Mit Salz abschmecken.',
    portion_size: 4,
    meal_type_id: 'main',
    chef_notes: '',
  }
  const fields = translatableFields(german)
  const good = {
    name: 'Lentil soup',
    ingredients: '[Soup]\n- 200 g red lentils\n- 1 tbsp oil',
    instructions_standard: '1. Cook: Simmer for 20 minutes.\n2. Season: Add salt to taste.',
  }

  it('sends text fields that have a value, and nothing else', () => {
    expect(fields).toEqual(['ingredients', 'name', 'instructions_standard'])
  })
  it('builds a strict schema for exactly those fields', () => {
    const s = translationSchema(fields)
    expect(s.required).toEqual(fields)
    expect(s.additionalProperties).toBe(false)
  })
  it('accepts a faithful translation', () => {
    expect(sanitiseTranslation(good, german, fields)).toEqual({ fields: good, skipped: [] })
  })
  it('drops anything the model adds beyond the request', () => {
    const { fields: out } = sanitiseTranslation({ ...good, portion_size: 6, secret: 'x' }, german, fields)
    expect(Object.keys(out).sort()).toEqual(['ingredients', 'instructions_standard', 'name'])
  })
  it('rejects a field that lost a line', () => {
    const r = sanitiseTranslation({ ...good, ingredients: '[Soup]\n- 200 g red lentils' }, german, fields)
    expect(r.skipped).toEqual(['ingredients'])
    expect(r.fields).not.toHaveProperty('ingredients')
    expect(r.fields.name).toBe('Lentil soup')
  })
  it('rejects a field whose lines lost their marker, which the recipe view would drop', () => {
    const r = sanitiseTranslation({ ...good, ingredients: '[Soup]\n200 g red lentils\n1 tbsp oil' }, german, fields)
    expect(r.skipped).toEqual(['ingredients'])
  })
  it('rejects a field that changed an amount', () => {
    const r = sanitiseTranslation({ ...good, ingredients: '[Soup]\n- 20 g red lentils\n- 1 tbsp oil' }, german, fields)
    expect(r.skipped).toEqual(['ingredients'])
  })
  it('needs each repeated number to survive, not just one of them', () => {
    const source = { chef_notes: '2 EL Öl und 2 EL Butter' }
    expect(sanitiseTranslation({ chef_notes: '2 tbsp oil and butter' }, source, ['chef_notes']).skipped).toEqual(['chef_notes'])
  })
  it('allows a number word to become a digit', () => {
    const source = { ingredients: '- Ein Ei' }
    expect(sanitiseTranslation({ ingredients: '- 1 egg' }, source, ['ingredients']).fields).toEqual({ ingredients: '- 1 egg' })
  })
  it('accepts a decimal comma written as a point', () => {
    const source = { ingredients: '- 1,5 kg Mehl' }
    expect(sanitiseTranslation({ ingredients: '- 1.5 kg flour' }, source, ['ingredients']).skipped).toEqual([])
  })
  it('does not mistake a decimal for a step number', () => {
    const source = { ingredients: '2,5 kg Mehl' }
    expect(sanitiseTranslation({ ingredients: '2.5 kg flour' }, source, ['ingredients']).skipped).toEqual([])
  })
  it('reports a missing or empty field instead of blanking it', () => {
    const r = sanitiseTranslation({ name: '   ' }, german, ['name', 'ingredients'])
    expect(r).toEqual({ fields: {}, skipped: ['name', 'ingredients'] })
  })
  it('survives garbage', () => {
    expect(sanitiseTranslation(null, german, ['name'])).toEqual({ fields: {}, skipped: ['name'] })
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
  it('never suggests toddler changes', () => {
    const raw = { suggestions: [{ field: 'toddler_variations', title: 'Softer', why: '', find: '', replace: 'Mash it.' }], warnings: [] }
    expect(sanitiseReview(raw, recipe).suggestions).toEqual([])
  })
})

describe('householdLines', () => {
  it('keeps children to toddler_variations', () => {
    expect(householdLines({ children: ['2 yrs'] })).toContain('Use this only for toddler_variations')
    expect(householdLines({})).not.toContain('Children')
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
