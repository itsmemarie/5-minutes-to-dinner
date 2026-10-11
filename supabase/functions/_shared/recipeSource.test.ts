import { describe, expect, it } from 'vitest'
import {
  findJsonLdRecipe, pageTextForAi, parseDurationMinutes, parseServings, toIngredientText, toStepsText, transcriptToFields,
} from './recipeSource.ts'

const page = (ld: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>story…</body></html>`

describe('schema.org JSON-LD (no AI needed)', () => {
  it('reads a Recipe nested in @graph, with HowToSection steps', () => {
    const html = page({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Blog' },
        {
          '@type': ['Recipe'],
          name: 'Lemon &amp; Herb Chicken',
          recipeYield: ['4', '4 servings'],
          prepTime: 'PT15M',
          cookTime: 'PT1H5M',
          recipeIngredient: ['4 chicken thighs', '1 lemon, zested'],
          recipeInstructions: [
            { '@type': 'HowToSection', name: 'Prep', itemListElement: [{ '@type': 'HowToStep', text: 'Zest the lemon.' }] },
            { '@type': 'HowToStep', text: 'Roast for 1 hour.' },
          ],
        },
      ],
    })
    const t = findJsonLdRecipe(html)!
    expect(t.name).toBe('Lemon & Herb Chicken')
    expect(t.ingredients).toEqual(['4 chicken thighs', '1 lemon, zested'])
    expect(t.steps).toEqual(['Zest the lemon.', 'Roast for 1 hour.'])
    expect(transcriptToFields(t)).toEqual({
      name: 'Lemon & Herb Chicken',
      portion_size: 4,
      prep_time_minutes: 15,
      cook_time_minutes: 65,
      ingredients: '- 4 chicken thighs\n- 1 lemon, zested',
      instructions_standard: '1. Zest the lemon.\n2. Roast for 1 hour.',
    })
  })

  it('skips a Recipe without both ingredients and steps (lets the AI read the page)', () => {
    expect(findJsonLdRecipe(page({ '@type': 'Recipe', name: 'Teaser', recipeIngredient: ['x'] }))).toBeNull()
    expect(findJsonLdRecipe('<html>no data</html>')).toBeNull()
  })
})

describe('formatting helpers only reformat', () => {
  it('parses durations without guessing', () => {
    expect(parseDurationMinutes('PT1H30M')).toBe(90)
    expect(parseDurationMinutes('1 hr 10 mins')).toBe(70)
    expect(parseDurationMinutes('45 minutes')).toBe(45)
    expect(parseDurationMinutes('overnight')).toBeNull()
    expect(parseDurationMinutes(null)).toBeNull()
  })
  it('parses servings', () => {
    expect(parseServings('Serves 4-6')).toBe(4)
    expect(parseServings(['', '6 portions'])).toBe(6)
    expect(parseServings('a crowd')).toBeNull()
  })
  it('keeps headings and adds the app\'s bullets/numbers', () => {
    expect(toIngredientText(['[Sauce]', '• 2 tbsp soy', 'For the topping:', '50g cheese']))
      .toBe('[Sauce]\n- 2 tbsp soy\n[For the topping]\n- 50g cheese')
    expect(toStepsText(['Step 1: Boil.', '2) Drain.', ''])).toBe('1. Boil.\n2. Drain.')
  })
  it('leaves out fields the source didn\'t have', () => {
    expect(transcriptToFields({ name: 'Toast', ingredients: null, steps: ['Toast it'], servings: null })).toEqual({
      name: 'Toast',
      instructions_standard: '1. Toast it',
    })
  })
})

describe('page text for the AI fallback', () => {
  it('drops scripts and chrome and jumps to the recipe card', () => {
    const html = `<nav>menu</nav><script>track()</script><p>${'Long story. '.repeat(50)}</p><div class="wprm-recipe-container"><h2>Ingredients</h2><ul><li>2 eggs</li></ul></div><footer>©</footer>`
    const text = pageTextForAi(html)
    expect(text.startsWith('Ingredients')).toBe(true)
    expect(text).toContain('2 eggs')
    expect(text).not.toMatch(/menu|track|©/)
  })
  it('caps the text it sends', () => {
    expect(pageTextForAi(`<p>${'word '.repeat(10000)}</p>`, 500).length).toBeLessThanOrEqual(500)
  })
})
