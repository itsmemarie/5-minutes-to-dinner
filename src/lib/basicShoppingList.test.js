import { describe, expect, it } from 'vitest'
import { buildBasicShoppingList, guessAisle, recipeShoppingLines } from './basicShoppingList.js'

const lines = (text, scale = 1) => recipeShoppingLines({ ingredients: text }, scale)

describe('recipeShoppingLines', () => {
  it('reads the name-first format most saved recipes use', () => {
    expect(lines('- Cherry tomatoes: 200g (halved)', 2)).toEqual([{ name: 'Cherry tomatoes', qty: '400g' }])
    expect(lines('- Beef mince (20% fat — important for juicy burgers): 500g')).toEqual([{ name: 'Beef mince', qty: '500g' }])
    expect(lines('- Iceberg lettuce: 3 large leaves', 2)).toEqual([{ name: 'Iceberg lettuce', qty: '6 large leaves' }])
  })
  it('keeps an amount it cannot scale as written', () => {
    expect(lines('- Olive oil: a drizzle', 2)).toEqual([{ name: 'Olive oil', qty: 'a drizzle' }])
  })
  it('keeps only the line\'s own amount when it offers an alternative', () => {
    expect(lines('- Baby spinach: 80 g / broccoli tiny florets: 60g', 0.5)).toEqual([{ name: 'Baby spinach', qty: '40 g' }])
  })
  it('skips lines that only point at other lines', () => {
    expect(lines('- Honey-Dijon dressing: (see Dressing below)')).toEqual([])
  })
  it('reads ranges and the egg forms', () => {
    expect(lines('- 40–60g Emmental, Gouda, or cheddar, grated (optional)', 2)).toEqual([{ name: 'Emmental', qty: '80–120g' }])
    expect(lines('- 4 eggs, beaten')).toEqual([{ name: 'egg', qty: '4' }])
    expect(lines('- 1 egg yolk')).toEqual([{ name: 'egg yolk', qty: '1' }])
  })
  it('drops the "of" after a unit', () => {
    expect(lines('- 1 tin of chopped tomatoes')).toEqual([{ name: 'chopped tomatoes', qty: '1 tin' }])
  })
  it('leaves out basics however they are worded, but not the vegetable', () => {
    const basics = ['Salt: 1 pinch', 'Black pepper: 1 pinch', 'Boiling water: 240g', '1 pinch fine sea salt', 'Flaky sea salt and cracked black pepper', 'Salt and white pepper', 'Black pepper to taste']
    expect(lines(basics.map(b => `- ${b}`).join('\n'))).toEqual([])
    expect(lines('- 1 pepper\n- Pepper')).toEqual([{ name: 'pepper', qty: '1' }])
  })
})

describe('buildBasicShoppingList', () => {
  const recipes = [
    { id: 'a', name: 'Curry', portion_size: 4, ingredients: '[Main]\n- 400g chicken thighs\n- 2 onions, sliced\n- salt\n- 1 tbsp curry powder' },
    { id: 'b', name: 'Soup', portion_size: 2, ingredients: '- 1 onion\n- 300ml chicken stock' },
    { id: 'c', name: 'Takeaway night', portion_size: 4, ingredients: null },
  ]
  const portions = new Map([['a', 2], ['b', 4], ['c', 4]])

  it('scales to planned portions and groups lines by ingredient', () => {
    const { items, missing } = buildBasicShoppingList(recipes, portions)
    const byName = Object.fromEntries(items.map(i => [i.name.toLowerCase(), i]))
    expect(byName['chicken thighs'].amount).toBe('200g')          // 400g at half portions
    expect(byName['chicken thighs'].aisle).toBe('MEAT')
    expect(byName['chicken stock'].amount).toBe('600ml')          // doubled
    expect(byName['chicken stock'].aisle).toBe('PANTRY')
    expect(byName['onions'].amount).toBe('1')                     // "2 onions, sliced" halved
    expect(byName['salt']).toBeUndefined()                        // basics left out, as the AI list does
    expect(missing).toEqual(['Takeaway night'])
  })
})

describe('guessAisle', () => {
  it('prefers the specific aisle', () => {
    expect(guessAisle('Coconut milk')).toBe('PANTRY')
    expect(guessAisle('Egg noodles')).toBe('DRY GOODS')
    expect(guessAisle('Courgettes')).toBe('VEGETABLES')
    expect(guessAisle('Frozen peas')).toBe('FROZEN')
    expect(guessAisle('Something unusual')).toBe('OTHER')
  })
})
