import { describe, expect, it } from 'vitest'
import { buildBasicShoppingList, guessAisle } from './basicShoppingList.js'

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
