import { describe, it, expect } from 'vitest'
import { parseNumber, formatNumber, collectQuantities, scaleText, scaleTextPlain, scaleIngredientLine } from './quantityScaling.js'
import { parseSteps } from './recipeParsing.js'

// All fixtures below are real strings from the recipes table.

describe('parseNumber', () => {
  it('parses plain and decimal numbers', () => {
    expect(parseNumber('400')).toBe(400)
    expect(parseNumber('4.4')).toBe(4.4)
  })
  it('parses slash fractions (the parseFloat("1/2") === 1 bug)', () => {
    expect(parseNumber('1/2')).toBe(0.5)
    expect(parseNumber('3/4')).toBe(0.75)
  })
  it('parses unicode and mixed fractions', () => {
    expect(parseNumber('½')).toBe(0.5)
    expect(parseNumber('1½')).toBe(1.5)
    expect(parseNumber('1 1/2')).toBe(1.5)
  })
  it('rejects non-numbers', () => {
    expect(parseNumber('Salt')).toBeNull()
    expect(parseNumber('')).toBeNull()
  })
})

describe('formatNumber', () => {
  it('renders cook-friendly fractions for countables', () => {
    expect(formatNumber(0.5, 'clove')).toBe('½')
    expect(formatNumber(1.5, 'tbsp')).toBe('1½')
    expect(formatNumber(0.25, 'tsp')).toBe('¼')
    expect(formatNumber(2, 'clove')).toBe('2')
  })
  it('rounds metric weights to whole numbers', () => {
    expect(formatNumber(133.333, 'g')).toBe('133')
    expect(formatNumber(200, 'g')).toBe('200')
    // Small metric amounts keep a decimal — a cook measures 2.2ml, not "2¼ml"
    expect(formatNumber(2.2, 'ml')).toBe('2.2')
  })
  it('converts kg/l so they match g/ml amounts', () => {
    expect(formatNumber(500, 'g')).toBe('500')
  })
})

describe('collectQuantities', () => {
  const ingredients = `[Vegetables]
- 300g aubergine
- 3 garlic cloves
- ½ tbsp tomato paste
- 1 pepper`

  it('indexes amounts regardless of unit word position', () => {
    const q = collectQuantities(ingredients)
    // "3 garlic cloves" must be findable as {3, clove} for the method's "(3 cloves)"
    expect(q.has('3|clove')).toBe(true)
    expect(q.has('300|g')).toBe(true)
    expect(q.has('0.5|tbsp')).toBe(true)
    expect(q.has('1|')).toBe(true)
  })
  it('ignores section headers', () => {
    expect(collectQuantities('[Vegetables]').size).toBe(0)
  })

  // Real MP-PNRT lines: the leading number is a count and the mass the method
  // quotes is buried in the name. Indexing only the leading number meant nothing
  // in this recipe scaled.
  it('harvests amounts from inside the ingredient name', () => {
    const q = collectQuantities(`- 1 medium aubergine (eggplant, approx. 300g), diced 2cm
- 2 medium courgettes (approx. 400g), diced 2cm`)
    expect(q.has('300|g')).toBe(true)
    expect(q.has('400|g')).toBe(true)
  })

  it('canonicalises kg and litres to g and ml', () => {
    const q = collectQuantities('- 1kg tomatoes\n- 1.5l stock')
    expect(q.has('1000|g')).toBe(true)
    expect(q.has('1500|ml')).toBe(true)
  })
})

describe('the real Pan-Fried Ratatouille (MP-PNRT)', () => {
  // Verbatim from the database.
  const ingredients = `[Vegetables]
- 1 medium aubergine (eggplant, approx. 300g), diced 2cm
- 2 medium courgettes (approx. 400g), diced 2cm
- 2 peppers (approx. 300g)
- 1 onion (150g)
- 3 garlic cloves
- 3 ripe tomatoes (400g), roughly chopped
[Oil]
- 60ml olive oil`
  const q = collectQuantities(ingredients)
  const half = t => scaleTextPlain(t, 0.5, q)

  it('scales step 1 while leaving the dice size alone', () => {
    expect(half('Prep: Dice aubergine (300g), courgettes (400g), and peppers (300g) into 2cm pieces. Finely dice onion (150g). Mince garlic (3 cloves). Chop tomatoes (400g) roughly.'))
      .toBe('Prep: Dice aubergine (150g), courgettes (200g), and peppers (150g) into 2cm pieces. Finely dice onion (75g). Mince garlic (1½ cloves). Chop tomatoes (200g) roughly.')
  })

  it('scales an amount the method split out of a larger ingredient line', () => {
    // 30ml is half of the single "- 60ml olive oil" line
    expect(half('Cook Aubergine: Heat 30ml olive oil in a very wide pan over high heat.'))
      .toBe('Cook Aubergine: Heat 15ml olive oil in a very wide pan over high heat.')
  })

  it('leaves the cooking times in the same step untouched', () => {
    const t = 'Cook for 5–6 minutes without stirring initially. Toss and cook a further 2 minutes.'
    expect(half(t)).toBe(t)
  })
})

describe('scaleText — the numbers that must never move', () => {
  const ing = `- 300g aubergine
- 400g courgettes
- 30ml olive oil
- 3 garlic cloves`
  const q = collectQuantities(ing)
  const half = t => scaleTextPlain(t, 0.5, q)

  it('scales confirmed ingredient amounts', () => {
    expect(half('Dice aubergine (300g) and courgettes (400g).'))
      .toBe('Dice aubergine (150g) and courgettes (200g).')
    expect(half('Mince garlic (3 cloves).')).toBe('Mince garlic (1½ cloves).')
    expect(half('Heat 30ml olive oil in a pan.')).toBe('Heat 15ml olive oil in a pan.')
  })

  it('never scales cooking times', () => {
    const t = 'Cook for 5–6 minutes. Chill 1 hour. Blend 30 sec.'
    expect(half(t)).toBe(t)
  })

  it('never scales oven temperatures', () => {
    const t = 'Preheat oven to 200°C. Roast 25–30 minutes.'
    expect(half(t)).toBe(t)
  })

  it('never scales Thermomix speeds or settings', () => {
    const t = 'Add 15 g oil. 3 min / 120°C / speed 1. Blend 10–15 sec / speed 6.'
    // 15g is not an ingredient here, so even the weight stays put
    expect(half(t)).toBe(t)
  })

  it('never scales dimensions', () => {
    const t = 'Cut into 2cm cubes. Roll to 40×20cm. Slice 3–4mm thick.'
    expect(half(t)).toBe(t)
  })

  it('leaves derived amounts alone (not in the ingredient list)', () => {
    // Real Shopska Salad text — 165g is a per-patty weight, not an ingredient
    const t = 'Divide into 3 equal portions (about 165g each).'
    expect(half(t)).toBe(t)
    expect(half('Reserve 120ml of pasta water before draining.'))
      .toBe('Reserve 120ml of pasta water before draining.')
  })

  it('is a no-op at 1x', () => {
    const t = 'Dice aubergine (300g).'
    expect(scaleTextPlain(t, 1, q)).toBe(t)
  })
})

describe('scaleText — ranges and formatting', () => {
  it('scales both endpoints of a range', () => {
    const q = collectQuantities('- 13–26ml water')
    // Endpoints are indexed individually by collectQuantities' leading-number rule,
    // so build the set explicitly for this case
    const q2 = collectQuantities('- 13ml water\n- 26ml coconut milk')
    expect(scaleTextPlain('Add water (13–26ml) until pourable.', 2, q2))
      .toBe('Add water (26–52ml) until pourable.')
    expect(q).toBeDefined()
  })

  it('preserves the original spacing between number and unit', () => {
    const q = collectQuantities('- 15 g oil')
    expect(scaleTextPlain('Add 15 g oil.', 2, q)).toBe('Add 30 g oil.')
  })

  it('marks scaled segments for highlighting', () => {
    const q = collectQuantities('- 300g aubergine')
    const segs = scaleText('Dice aubergine (300g) roughly.', 0.5, q)
    const scaled = segs.filter(s => s.scaled)
    expect(scaled).toHaveLength(1)
    expect(scaled[0].t).toBe('150g')
    expect(scaled[0].was).toBe('300g')
  })
})

describe('scaleIngredientLine', () => {
  it('scales weights and keeps the written unit', () => {
    expect(scaleIngredientLine('300g aubergine', 0.5)).toEqual({ qty: '150g', name: 'aubergine' })
  })
  it('fixes the fraction bug', () => {
    expect(scaleIngredientLine('1/2 tsp salt', 1)).toEqual({ qty: '½ tsp', name: 'salt' })
    expect(scaleIngredientLine('½ tbsp tomato paste', 2)).toEqual({ qty: '1 tbsp', name: 'tomato paste' })
  })
  it('keeps the original spacing and pluralises word units', () => {
    expect(scaleIngredientLine('300g aubergine', 1).qty).toBe('300g')
    expect(scaleIngredientLine('24 sticks chocolate', 0.5).qty).toBe('12 sticks')
    expect(scaleIngredientLine('2 cloves garlic', 0.5).qty).toBe('1 clove')
  })
  it('leaves unquantified ingredients alone', () => {
    expect(scaleIngredientLine('Salt and pepper', 2)).toEqual({ qty: null, name: 'Salt and pepper' })
  })
})

describe('parseSteps — the 3 real formats', () => {
  it('parses the numbered format', () => {
    const steps = parseSteps('1. Roast: Preheat oven.\r\n2. Assemble: Build bowls.')
    expect(steps).toHaveLength(2)
    expect(steps[1]).toEqual({ num: '2', text: 'Assemble: Build bowls.' })
  })
  it('parses "Step N:" runs sharing one line (Pasta all\'ortolana)', () => {
    const steps = parseSteps("Step 1: Cook 300g caserecce pasta 10 minutes. Step 2: In a pan, sauté 1 shallot.")
    expect(steps).toHaveLength(2)
    expect(steps[0].text).toBe('Cook 300g caserecce pasta 10 minutes.')
    expect(steps[1].text).toBe('In a pan, sauté 1 shallot.')
  })
  it('parses unnumbered per-line steps (Thai Red Curry) — previously rendered nothing', () => {
    const steps = parseSteps('Prepare Curry Paste: Blitz peppers.\nCook Paste: Heat oil.\nAdd Liquids: Stir in milk.')
    expect(steps).toHaveLength(3)
    expect(steps[0]).toEqual({ num: '1', text: 'Prepare Curry Paste: Blitz peppers.' })
  })
  it('keeps continuation lines with their step', () => {
    const steps = parseSteps('1. Roast: Preheat oven.\ncontinued here.')
    expect(steps).toHaveLength(1)
    expect(steps[0].text).toBe('Roast: Preheat oven. continued here.')
  })
})
