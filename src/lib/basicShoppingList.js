// ─── Shopping list without AI ─────────────────────────────────────
// Pure. The manual-mode fallback for when the AI is unavailable (or not
// wanted): every planned recipe's ingredients, scaled to the planned portions
// by the same scaler the recipe screen uses. Lines with the same ingredient
// name are grouped and their amounts listed side by side ("200g + 150g")
// rather than summed — summing needs unit conversion this deliberately avoids.
// Aisles are a keyword guess; anything unrecognised goes under OTHER.
import { parseIngredients } from './recipeParsing.js'
import { scaleIngredientLine } from './quantityScaling.js'

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

// Same basics the AI list leaves out.
const SKIP = /^(water|cold water|warm water|boiling water|salt|pepper|salt (and|&) pepper|black pepper|oil|cooking oil)$/i

// "1 onion, finely chopped (about 150g)" → "onion"
const ingredientName = s => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/,.*$/, '').replace(/\s+/g, ' ').trim()

/**
 * @param recipes  [{ id, name, portion_size, ingredients }]
 * @param portions Map recipeId → total portions planned this week
 * @returns {{ items: [{name, amount, unit, aisle}], missing: string[] }}  missing = recipes with no ingredient list
 */
export function buildBasicShoppingList(recipes, portions) {
  const byName = new Map()
  const missing = []
  for (const r of recipes) {
    const sections = parseIngredients(r.ingredients)
    if (!sections.length) { missing.push(r.name); continue }
    const base = r.portion_size || 4
    const scale = (portions.get(r.id) ?? base) / base
    for (const line of sections.flatMap(s => s.items)) {
      const { qty, name } = scaleIngredientLine(line, scale)
      const clean = ingredientName(qty ? name : line)
      if (!clean || SKIP.test(clean)) continue
      const key = clean.toLowerCase()
      const entry = byName.get(key) || { name: clean.charAt(0).toUpperCase() + clean.slice(1), amounts: [] }
      if (qty) entry.amounts.push(qty)
      byName.set(key, entry)
    }
  }
  const items = [...byName.values()]
    .map(e => ({ name: e.name, amount: e.amounts.join(' + '), unit: '', aisle: guessAisle(e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { items, missing }
}
