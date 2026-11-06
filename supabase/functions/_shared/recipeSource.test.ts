import { describe, expect, it } from 'vitest'
import {
  findJsonLdRecipe, findPageImageUrls, pageTextForAi, parseDurationMinutes, parseServings, toIngredientText, toStepsText, transcriptToFields,
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

describe("the page's picture of the dish", () => {
  const PAGE = 'https://www.example-food.com/recipes/lemon-chicken/'

  it("prefers the Recipe's own image, choosing a well-sized rendition", () => {
    const html = page({
      '@type': 'Recipe', name: 'Lemon Chicken',
      image: [
        'https://cdn.example-food.com/lemon-chicken-225x225.jpg',
        'https://cdn.example-food.com/lemon-chicken-500x375.jpg',
        'https://cdn.example-food.com/lemon-chicken-1200x900.jpg',
        'https://cdn.example-food.com/lemon-chicken.jpg',
      ],
    }).replace('<head>', '<head><meta property="og:image" content="https://cdn.example-food.com/pin.jpg">')
    expect(findPageImageUrls(html, PAGE)).toEqual([
      'https://cdn.example-food.com/lemon-chicken-1200x900.jpg',
      'https://cdn.example-food.com/lemon-chicken-500x375.jpg',
      'https://cdn.example-food.com/lemon-chicken.jpg',
      'https://cdn.example-food.com/lemon-chicken-225x225.jpg',
      'https://cdn.example-food.com/pin.jpg',
    ])
  })

  it('reads ImageObject sizes, relative urls and entities', () => {
    const html = page({ '@graph': [{ '@type': 'Recipe', image: { '@type': 'ImageObject', url: '/img/dish.jpg?w=1&amp;h=2', width: 1600 } }] })
    expect(findPageImageUrls(html, PAGE)).toEqual(['https://www.example-food.com/img/dish.jpg?w=1&h=2'])
  })

  it("falls back to the share image, as on an Instagram post", () => {
    const html = `<html><head>
      <meta name="twitter:image" content="https://scontent-ham3-1.cdninstagram.com/v/t51/502_n.jpg?stp=dst-jpg&amp;_nc_cat=109" />
      <meta property="og:image" content="https://scontent-ham3-1.cdninstagram.com/v/t51/502_n.jpg?stp=dst-jpg&amp;_nc_cat=109" />
      <meta property="og:url" content="https://www.instagram.com/terzompls/reel/Cs7MUHIJW7w/" />
      </head><body></body></html>`
    expect(findPageImageUrls(html, 'https://www.instagram.com/p/Cs7MUHIJW7w/')).toEqual([
      'https://scontent-ham3-1.cdninstagram.com/v/t51/502_n.jpg?stp=dst-jpg&_nc_cat=109',
    ])
  })

  it('handles attributes in any order and skips logos', () => {
    const html = `<meta content='https://x.com/site-logo.png' property='og:image'><meta content="https://x.com/dish.webp" name="twitter:image">`
    expect(findPageImageUrls(html, PAGE)).toEqual(['https://x.com/dish.webp'])
  })

  it("skips the logo on Instagram's login wall", () => {
    const html = `<meta property="og:image" content="https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png" />`
    expect(findPageImageUrls(html, 'https://www.instagram.com/accounts/login/')).toEqual([])
  })

  it('is empty when the page has no picture', () => {
    expect(findPageImageUrls('<html><body><p>Just text</p></body></html>', PAGE)).toEqual([])
  })
})
