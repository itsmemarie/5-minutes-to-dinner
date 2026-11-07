import { describe, expect, it } from 'vitest'
import {
  completableRequest, completionSchema, tidyRecipeText, householdLines, recipeForPrompt, sanitiseCompletion, sanitiseLanguage, sanitiseReview,
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

describe('text fields answered with a list', () => {
  const tips = ['Toast the rice first.', 'Keep the stock hot.']

  it('joins chef notes into one paragraph', () => {
    expect(sanitiseCompletion({ chef_notes: tips }, ['chef_notes'])).toEqual({ chef_notes: 'Toast the rice first. Keep the stock hot.' })
  })
  it('keeps a method on separate lines', () => {
    expect(sanitiseCompletion({ instructions_standard: ['1. Chop.', '2. Fry.'] }, ['instructions_standard']))
      .toEqual({ instructions_standard: '1. Chop.\n2. Fry.' })
  })
  it('separates sides with commas', () => {
    expect(sanitiseCompletion({ side_recommendation: ['Rice', 'Green salad'] }, ['side_recommendation']))
      .toEqual({ side_recommendation: 'Rice, Green salad' })
  })
  it('keeps only the text in a list', () => {
    expect(sanitiseCompletion({ chef_notes: ['Rest it.', 7, null, '  '] }, ['chef_notes'])).toEqual({ chef_notes: 'Rest it.' })
  })
  it('leaves a field out when the list has nothing in it', () => {
    expect(sanitiseCompletion({ chef_notes: [] }, ['chef_notes'])).toEqual({})
  })
  it('still drops other wrong types', () => {
    expect(sanitiseCompletion({ chef_notes: 12, fridge_storage: { days: 3 } }, ['chef_notes', 'fridge_storage'])).toEqual({})
  })
  it('still lets advance_prep_note be empty', () => {
    expect(sanitiseCompletion({ advance_prep_note: '' }, ['advance_prep_note'])).toEqual({ advance_prep_note: '' })
  })

  it('flattens a generated recipe into the lines the app parses', () => {
    const out = tidyRecipeText({
      name: 'Risotto',
      portion_size: 4,
      ingredients: ['[Rice]', '- 300g Arborio rice', '[Mushrooms]', '- 300g mushrooms'],
      instructions_standard: ['1. Toast the rice.', '2. Add the stock.'],
      chef_notes: tips,
    })
    expect(out).toEqual({
      name: 'Risotto',
      portion_size: 4,
      ingredients: '[Rice]\n- 300g Arborio rice\n[Mushrooms]\n- 300g mushrooms',
      instructions_standard: '1. Toast the rice.\n2. Add the stock.',
      chef_notes: 'Toast the rice first. Keep the stock hot.',
    })
  })
  it('leaves a recipe with no lists as it was', () => {
    const recipe = { name: 'Dal', portion_size: 4, has_thermomix_version: false, chef_notes: 'Toast the spices.' }
    expect(tidyRecipeText(recipe)).toEqual(recipe)
  })
  it('passes through an answer that is not a recipe', () => {
    expect(tidyRecipeText(null)).toBeNull()
    expect(tidyRecipeText('nope')).toBe('nope')
  })
})

describe('text with its line breaks in the wrong form', () => {
  it('turns written-out line breaks into real ones', () => {
    const out = tidyRecipeText({ ingredients: '[Rice]\\n- 300g rice\\n[Stock]\\n- 1.2L stock' })
    expect(out).toEqual({ ingredients: '[Rice]\n- 300g rice\n[Stock]\n- 1.2L stock' })
  })
  it('does the same for a field filled in by step 2', () => {
    expect(sanitiseCompletion({ instructions_standard: '1. Chop.\\n2. Fry.' }, ['instructions_standard']))
      .toEqual({ instructions_standard: '1. Chop.\n2. Fry.' })
  })
  it('puts a method run together on one line back into steps', () => {
    const out = tidyRecipeText({ instructions_standard: '1. Prep: Pat dry. 2. Sauté: Cook 5 minutes. 3. Serve: Add rice.' })
    expect(out).toEqual({ instructions_standard: '1. Prep: Pat dry.\n2. Sauté: Cook 5 minutes.\n3. Serve: Add rice.' })
  })
  it('splits a Thermomix method too', () => {
    const out = tidyRecipeText({ instructions_thermomix: '1. Chop: 5 sec / speed 5. 2. Cook: 10 min / 100C.' })
    expect(out).toEqual({ instructions_thermomix: '1. Chop: 5 sec / speed 5.\n2. Cook: 10 min / 100C.' })
  })
  it('only starts a step on the next number in sequence', () => {
    const text = '1. Mix 5. 5 tins fit.'
    expect(tidyRecipeText({ instructions_standard: text })).toEqual({ instructions_standard: text })
  })
  it('leaves a method that is already on separate lines', () => {
    const text = '1. Add 2 eggs. 2. 5 cups of flour go in next.\n2. Stir.'
    expect(tidyRecipeText({ instructions_standard: text })).toEqual({ instructions_standard: text })
  })
  it('leaves text that does not start at step 1', () => {
    const text = 'Heat the oil. 2. Add the onion.'
    expect(tidyRecipeText({ instructions_standard: text })).toEqual({ instructions_standard: text })
  })
  it('never splits numbered tips in chef notes', () => {
    const text = '1. Rest the dough. 2. Salt early.'
    expect(tidyRecipeText({ chef_notes: text })).toEqual({ chef_notes: text })
  })
  it('joins a list before tidying it', () => {
    expect(tidyRecipeText({ ingredients: ['[Rice]\\n- 300g rice', '- 1 onion'] })).toEqual({ ingredients: '[Rice]\n- 300g rice\n- 1 onion' })
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
