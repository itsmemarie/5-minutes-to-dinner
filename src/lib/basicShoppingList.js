// ─── Shopping list without AI ─────────────────────────────────────
// Pure. The manual-mode fallback for when the AI is unavailable (or not
// wanted): every planned recipe's ingredients, scaled to the planned portions
// by the same scaler the recipe screen uses. Lines with the same ingredient
// name are grouped and their amounts listed side by side ("200g + 150g")
// rather than summed — summing needs unit conversion this deliberately avoids.
// Aisles are a keyword guess; anything unrecognised goes under OTHER.
import { parseIngredients } from './recipeParsing.js'
import { scaleIngredientLine, scaleQuantity } from './quantityScaling.js'

// First match wins, so the specific aisles come first ("chicken stock" is
// pantry, "egg noodles" dry goods, "coconut milk" pantry).
const AISLE_RULES = [
  ['FROZEN', /\bfrozen\b/],
  ['PANTRY', /\b(oil|vinegar|sauce|stock|paste|spices?|cumin|paprika|turmeric|cinnamon|garam masala|curry powder|oregano|dried|salt|black pepper|honey|syrup|mustard|tinned|tins?|cans?|chopped tomatoes|passata|coconut milk|soy|ketchup|mayonnaise|baking|bicarbonate|vanilla|cocoa|chickpeas|kidney beans|stock cubes?)\b/],
  ['DRY GOODS', /\b(rice|pasta|spaghetti|penne|fusilli|linguine|noodles?|flour|oats|lentils|couscous|quinoa|bulgur|breadcrumbs|panko|polenta|sugar|nuts?|almonds|seeds)\b/],
  ['FISH', /\b(salmon|cod|haddock|tuna|prawns?|shrimps?|mackerel|sea bass|fish|anchov\w*|mussels)\b/],
  ['MEAT', /\b(chicken|beef|pork|lamb|mince|bacon|sausages?|ham|chorizo|turkey|steak|pancetta|duck|gammon)\b/],
  ['DAIRY', /\b(milk|cheese|cheddar|parmesan|mozzarella|feta|halloumi|butter|yog(h)?urt|cream|crème fraîche|creme fraiche|eggs?|ricotta|mascarpone)\b/],
  ['BAKERY', /\b(bread|tortillas?|wraps?|pitta|naan|buns?|rolls?|bagels?|baguette|brioche|sourdough)\b/],
  ['FRUIT', /\b(apples?|bananas?|lemons?|limes?|oranges?|berries|strawberries|blueberries|raspberries|grapes|mangoe?s?|pineapple|pears?|avocados?|peach(es)?|lemon juice|lime juice)\b/],
  ['VEGETABLES', /\b(onions?|shallots?|garlic|carrots?|peppers?|tomato(es)?|potato(es)?|courgettes?|aubergines?|spinach|kale|broccoli|cauliflower|cabbage|leeks?|celery|mushrooms?|peas|lettuce|cucumbers?|ginger|chill(i|ies)|coriander|parsley|basil|mint|squash|beetroot|asparagus|rocket|herbs?|sweetcorn|green beans|spring onions?)\b/],
]

export function guessAisle(name) {
  const n = String(name || '').toLowerCase()
  for (const [aisle, re] of AISLE_RULES) if (re.test(n)) return aisle
  return 'OTHER'
}

// Same basics the AI list leaves out, in the many ways recipes word them
// ("Flaky sea salt and cracked black pepper"). A counted pepper ("1 pepper") is
// the vegetable.
const BASICS = /^(?:(?:salt|pepper|water|oil|flaky|fine|sea|cracked|freshly|ground|black|white|cooking|cold|warm|hot|boiling|and|&|to|taste)\s*)+$/i
const isBasic = ({ name, qty }) => BASICS.test(name) && !(/^pepper$/i.test(name) && /^[\d.½⅓⅔¼¾⅛]+$/.test(qty || ''))

// "1 onion, finely chopped (about 150g)" → "onion"
export const ingredientName = s => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/,.*$/, '').replace(/^\s*of\s+/i, '').replace(/\s+/g, ' ').trim()

// "Cherry tomatoes: 200g (halved)", the format most saved recipes use. A
// quantity of "(see Dressing below)" points at other lines: nothing to buy, and
// only the first of "80g / broccoli: 60g" is this line's own amount.
const NAME_FIRST = /^([^:]+):\s*(.*)$/
const CROSS_REFERENCE = /^\(?\s*see\b/i
// The scaler treats eggs as a unit, so "4 eggs, beaten" comes back as "4 eggs"
// + ", beaten" and "1 egg yolk" as "1 egg" + "yolk". Here the egg is what's bought.
const EGG_QTY = /^(\S+)\s*eggs?$/i

function parseShoppingLine(line, scale) {
  const { qty, name } = scaleIngredientLine(line, scale)
  if (qty) {
    const egg = qty.match(EGG_QTY)
    return egg ? { name: ingredientName(`egg ${name}`), qty: egg[1] } : { name: ingredientName(name), qty }
  }
  const nameFirst = String(line).match(NAME_FIRST)
  if (!nameFirst) return { name: ingredientName(line), qty: null }
  if (CROSS_REFERENCE.test(nameFirst[2])) return { name: '', qty: null }
  const written = nameFirst[2].replace(/\([^)]*\)/g, ' ').split(/\s\/\s/)[0].trim()
  return { name: ingredientName(nameFirst[1]), qty: scaleQuantity(written, scale) || written || null }
}

/** A recipe's ingredients as things to buy, scaled: [{ name, qty }], basics left out. */
export function recipeShoppingLines(recipe, scale) {
  return parseIngredients(recipe.ingredients)
    .flatMap(s => s.items)
    .map(line => parseShoppingLine(line, scale))
    .filter(l => l.name && !isBasic(l))
}

/**
 * @param recipes  [{ id, name, portion_size, ingredients }]
 * @param portions Map recipeId → total portions planned this week
 * @returns {{ items: [{name, amount, unit, aisle}], missing: string[] }}  missing = recipes with no ingredient list
 */
export function buildBasicShoppingList(recipes, portions) {
  const byName = new Map()
  const missing = []
  for (const r of recipes) {
    if (!parseIngredients(r.ingredients).length) { missing.push(r.name); continue }
    const base = r.portion_size || 4
    for (const { name, qty } of recipeShoppingLines(r, (portions.get(r.id) ?? base) / base)) {
      const key = name.toLowerCase()
      const entry = byName.get(key) || { name: name.charAt(0).toUpperCase() + name.slice(1), amounts: [] }
      if (qty) entry.amounts.push(qty)
      byName.set(key, entry)
    }
  }
  const items = [...byName.values()]
    .map(e => ({ name: e.name, amount: e.amounts.join(' + '), unit: '', aisle: guessAisle(e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { items, missing }
}
