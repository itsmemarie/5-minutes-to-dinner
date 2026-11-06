// ─── Shopping list, by recipe ─────────────────────────────────────
// Pure. Saved list items are consolidated and carry no link to the recipes they
// came from, so the link is rebuilt here by name: each planned recipe's own
// lines, scaled to the planned portions, are paired with the list item they
// most likely became. Ticks stay on the list item, so both views always agree.
//
// AI lists reword names ("Cooked beetroot" → "Beetroot"), which is why the
// pairing is fuzzy. It's allowed to miss: nothing is hidden when it does. A
// recipe line with no item shows as not on the list, and an item with no recipe
// line comes back in `others`.
import { splitRecipeName } from './recipeParsing.js'
import { ingredientName, recipeShoppingLines } from './basicShoppingList.js'

// Words that don't change what you'd pick up in the shop, some of which would
// otherwise hide the head noun ("Parmesan shavings", "celery sticks").
const NOISE = new Set(['fresh', 'freshly', 'ripe', 'raw', 'cooked', 'small', 'medium', 'large', 'good', 'quality', 'clove', 'leaf', 'leave', 'shaving', 'cheese', 'floret', 'fillet', 'stick', 'stalk', 'sprig', 'slice', 'piece', 'bunch', 'head'])

// Words that make it a different product, not a variety of the same one:
// "Coconut milk" can't stand in for "Milk", nor "Spring onions" for "Onion".
const DISTINCT = new Set(['spring', 'sweet', 'coconut', 'peanut', 'almond', 'oat', 'soy', 'soya'])

const singular = w => w
  .replace(/llies$/, 'lli')
  .replace(/ies$/, 'y')
  .replace(/(oes|ches|shes|xes)$/, m => m.slice(0, -2))
  .replace(/([^s])s$/, '$1')

const words = text => {
  const plain = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\begg (yolk|white)s?\b/g, 'egg')
    .replace(/\bcream cheese\b/g, 'creamcheese')
  const all = plain.split(/[^\p{L}]+/u).filter(Boolean).map(singular)
  const kept = all.filter(w => !NOISE.has(w))
  return kept.length ? kept : all
}

// "Honey or maple syrup" and "Pickles / gherkins" answer to either name.
const profile = rawName => {
  const name = ingredientName(rawName)
  return { key: words(name).join(' '), options: name.split(/\s+or\s+|\s*\/\s*/).map(words).filter(w => w.length) }
}

// Two names are the same thing when one's words all appear in the other and
// they end on the same word, English's head noun: "Olive oil" fits "Extra-virgin
// olive oil", but "Onion powder" doesn't fit "Onions", nor "Chicken stock"
// "Chicken". More shared words beat fewer, then fewer left over.
function wordScore(a, b) {
  if (!a.length || !b.length || a[a.length - 1] !== b[b.length - 1]) return 0
  const [fewer, more] = a.length <= b.length ? [a, b] : [b, a]
  if (!fewer.every(w => more.includes(w))) return 0
  if (more.some(w => DISTINCT.has(w) && !fewer.includes(w))) return 0
  return fewer.length * 10 - (more.length - fewer.length)
}

const pairScore = (a, b) => a.key === b.key
  ? Infinity
  : Math.max(0, ...a.options.flatMap(x => b.options.map(y => wordScore(x, y))))

/**
 * @param recipes  [{ id, name, portion_size, ingredients }]
 * @param portions Map recipeId → total portions planned, in plan order
 * @param shopping the week's list items
 * @returns {{ groups: [{ id, title, portions, lines: [{ name, qty, items }] }], others: item[] }}
 *   lines[].items holds every list item the line paired with: real lists can
 *   repeat a name, and those rows should tick as one. Empty = not on the list.
 */
export function groupShoppingByRecipe(recipes, portions, shopping) {
  const listed = new Map()
  for (const item of shopping) {
    const p = profile(item.name)
    const entry = listed.get(p.key) || { ...p, items: [] }
    entry.items.push(item)
    listed.set(p.key, entry)
  }
  const bestItems = line => {
    let best = 0, items = []
    for (const entry of listed.values()) {
      const score = pairScore(line, entry)
      if (score > best) { best = score; items = entry.items }
    }
    return items
  }

  const paired = new Set()
  const byId = new Map(recipes.map(r => [r.id, r]))
  const groups = [...portions].flatMap(([id, planned]) => {
    const recipe = byId.get(id)
    if (!recipe) return []
    // A recipe can use one ingredient in several sections: one row, amounts
    // side by side, the same way the basic list shows them.
    const lines = new Map()
    for (const { name, qty } of recipeShoppingLines(recipe, planned / (recipe.portion_size || 4))) {
      const p = profile(name)
      const line = lines.get(p.key) || { name: name.charAt(0).toUpperCase() + name.slice(1), amounts: [], items: bestItems(p) }
      if (qty) line.amounts.push(qty)
      lines.set(p.key, line)
      line.items.forEach(item => paired.add(item.id))
    }
    return [{
      id,
      title: splitRecipeName(recipe.name).title,
      portions: planned,
      lines: [...lines.values()].map(({ name, amounts, items }) => ({ name, qty: amounts.join(' + '), items })),
    }]
  })
  return { groups, others: shopping.filter(item => !paired.has(item.id)) }
}
