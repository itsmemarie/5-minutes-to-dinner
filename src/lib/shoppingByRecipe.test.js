import { describe, expect, it } from 'vitest'
import { groupShoppingByRecipe } from './shoppingByRecipe.js'

const item = (name, extra = {}) => ({ id: name.toLowerCase().replace(/\W+/g, '-') + (extra.n ?? ''), name, checked: false })
const recipe = (id, ingredients, extra = {}) => ({ id, name: `Recipe ${id}`, portion_size: 4, ingredients, ...extra })

// The one recipe line, paired against a list of item names.
const pairOf = (line, names) => {
  const shopping = names.map(n => item(n))
  const { groups } = groupShoppingByRecipe([recipe('a', `- ${line}`)], new Map([['a', 4]]), shopping)
  return groups[0].lines[0].items.map(i => i.name)
}

describe('groupShoppingByRecipe', () => {
  it('keeps recipes in plan order, scaled to the planned portions', () => {
    const recipes = [recipe('b', '- Rice: 200g'), recipe('a', '- 400g chicken thighs')]
    const portions = new Map([['a', 2], ['b', 8]])
    const { groups } = groupShoppingByRecipe(recipes, portions, [])
    expect(groups.map(g => g.id)).toEqual(['a', 'b'])
    expect(groups[0]).toMatchObject({ portions: 2, lines: [{ name: 'Chicken thighs', qty: '200g' }] })
    expect(groups[1].lines[0].qty).toBe('400g')
  })

  it('shows the title without the recipe code', () => {
    const { groups } = groupShoppingByRecipe([recipe('a', '- Rice: 200g', { name: 'Avocado Pancakes | MP-VCBN' })], new Map([['a', 4]]), [])
    expect(groups[0].title).toBe('Avocado Pancakes')
  })

  it('falls back to 4 base portions, as the list generators do', () => {
    const { groups } = groupShoppingByRecipe([recipe('a', '- Rice: 200g', { portion_size: null })], new Map([['a', 2]]), [])
    expect(groups[0].lines[0].qty).toBe('100g')
  })

  it('keeps a recipe with no ingredient list, and skips one that no longer exists', () => {
    const { groups } = groupShoppingByRecipe([recipe('a', null)], new Map([['a', 4], ['gone', 4]]), [])
    expect(groups).toHaveLength(1)
    expect(groups[0].lines).toEqual([])
  })

  it('merges one ingredient used across a recipe\'s sections', () => {
    const r = recipe('a', '[Salad]\n- Honey: 10g\n[Dressing]\n- Honey: 15g')
    const { groups } = groupShoppingByRecipe([r], new Map([['a', 4]]), [])
    expect(groups[0].lines).toEqual([{ name: 'Honey', qty: '10g + 15g', items: [] }])
  })

  it('links a shared ingredient into every recipe that uses it', () => {
    const onion = item('Onions')
    const recipes = [recipe('a', '- 2 onions'), recipe('b', '- Onion: 1 piece (diced)')]
    const { groups, others } = groupShoppingByRecipe(recipes, new Map([['a', 4], ['b', 4]]), [onion])
    expect(groups.map(g => g.lines[0].items)).toEqual([[onion], [onion]])
    expect(others).toEqual([])
  })

  it('links every copy when the list repeats a name', () => {
    const copies = [item('Eggs', { n: 1 }), item('Eggs', { n: 2 }), item('Eggs', { n: 3 })]
    const { groups, others } = groupShoppingByRecipe([recipe('a', '- Eggs: 3 pieces')], new Map([['a', 4]]), copies)
    expect(groups[0].lines[0].items).toEqual(copies)
    expect(others).toEqual([])
  })

  it('returns list items no recipe claims, and marks lines not on the list', () => {
    const milk = item('Milk'), bin = item('Bin bags')
    const { groups, others } = groupShoppingByRecipe([recipe('a', '- Milk: 100ml\n- Saffron: 1 pinch')], new Map([['a', 4]]), [milk, bin])
    expect(groups[0].lines.map(l => l.items)).toEqual([[milk], []])
    expect(others).toEqual([bin])
  })
})

// Pairs seen on real generated lists.
describe('name pairing', () => {
  it.each([
    ['Cooked beetroot: 400g', 'Beetroot'],
    ['Parmesan shavings: 40g', 'Parmesan'],
    ['Fresh blueberries: 100g', 'Blueberries'],
    ['Ripe avocados: 2 pieces', 'Avocado'],
    ['60ml extra virgin olive oil', 'Extra-virgin olive oil'],
    ['Olive oil: 40g', 'Extra-virgin olive oil'],
    ['Fresh basil leaves: 10g', 'Fresh basil'],
    ['2 garlic cloves, minced', 'Garlic'],
    ['1 egg yolk', 'Eggs'],
    ['4 celery sticks', 'Celery'],
    ['Soft goat cheese (chèvre): 40g', 'Soft goat cheese'],
    ['50g Parmesan cheese, grated', 'Parmesan'],
    ['Honey: 10g', 'Honey or maple syrup'],
    ['Fresh coriander or basil: ½ bunch', 'Coriander or basil'],
    ['Passata or tinned tomatoes: 250g', 'Passata'],
    ['2 red chillies', 'Red chilli'],
  ])('%s → %s', (line, name) => {
    expect(pairOf(line, [name])).toEqual([name])
  })

  it.each([
    ['Chicken stock: 300ml', 'Chicken'],
    ['Onion powder: 2g', 'Onions'],
    ['Garlic powder: 3g', 'Garlic'],
    ['Lemon juice: 15ml', 'Lemon'],
    ['Red cabbage: 150g', 'White cabbage'],
    ['1 medium onion, finely diced', 'Spring onions'],
    ['Milk: 100ml', 'Coconut milk'],
    ['Butter: 10g', 'Peanut butter'],
    ['2 potatoes', 'Sweet potatoes'],
    ['Cream cheese: 100g', 'Double cream'],
  ])('does not pair %s with %s', (line, name) => {
    expect(pairOf(line, [name])).toEqual([])
  })

  it('prefers the closest of several candidates', () => {
    expect(pairOf('Roasted red peppers: 100g', ['Pepper', 'Red peppers'])).toEqual(['Red peppers'])
    expect(pairOf('Butter: 10g', ['Butter or coconut oil', 'Butter'])).toEqual(['Butter'])
    expect(pairOf('Coriander or basil: 1 bunch', ['Basil', 'Coriander or basil'])).toEqual(['Coriander or basil'])
  })
})
