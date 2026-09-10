// ─── Portion scaling for recipe text ──────────────────────────────
// Recipe method text bakes absolute amounts into prose ("Add aubergine (300g)"),
// so at 2 portions of a 4-portion recipe the steps contradict the ingredient list.
//
// The danger is that the same prose is full of numbers that must NEVER scale:
// times ("Cook 5–6 minutes"), oven temps ("200°C"), Thermomix speeds ("speed 7"),
// dimensions ("2cm cubes", "40×20cm"), and derived weights ("about 165g each").
//
// Two gates make that structurally safe:
//   1. Only numbers followed by a unit on FOOD_UNITS are candidates. Minutes,
//      seconds, °C, cm and "speed" are simply not on the list.
//   2. A candidate is scaled only if the same {value, unit} appears in THIS
//      recipe's own ingredient list. That kills "165g each" and "reserve 120ml
//      of pasta water", neither of which is an ingredient.
// Anything unconfirmed is left exactly as written — under-scaling is the safe
// failure, and ScaledText marks what did change so the gap stays visible.

// ── Units ─────────────────────────────────────────────────────────
// The keys ARE the allowlist. Adding a unit here makes it scalable everywhere;
// never add a unit of time, temperature, distance or appliance setting.
const FOOD_UNITS = {
  g: 'g', gram: 'g', grams: 'g', gr: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  cl: 'cl', dl: 'dl',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  cup: 'cup', cups: 'cup',
  pint: 'pint', pints: 'pint',
  clove: 'clove', cloves: 'clove',
  tin: 'tin', tins: 'tin', can: 'can', cans: 'can',
  piece: 'piece', pieces: 'piece',
  slice: 'slice', slices: 'slice',
  sprig: 'sprig', sprigs: 'sprig',
  sheet: 'sheet', sheets: 'sheet',
  stalk: 'stalk', stalks: 'stalk', stick: 'stick', sticks: 'stick',
  bunch: 'bunch', bunches: 'bunch',
  handful: 'handful', handfuls: 'handful',
  drop: 'drop', drops: 'drop',
  bag: 'bag', bags: 'bag',
  punnet: 'punnet', punnets: 'punnet',
  fillet: 'fillet', fillets: 'fillet',
  ball: 'ball', balls: 'ball',
  knob: 'knob', knobs: 'knob',
  egg: 'egg', eggs: 'egg', yolk: 'yolk', yolks: 'yolk',
}

// Abbreviations that must never gain an "s".
const NON_PLURAL = new Set(['g', 'kg', 'ml', 'l', 'cl', 'dl', 'tsp', 'tbsp', 'oz', 'lb'])
const pluralOf = u => /(?:ch|sh|s|x)$/.test(u) ? u + 'es' : u + 's'

// "3 cloves" halved should read "1½ cloves", and doubled from "1 clove" should
// read "2 cloves". Unusual wordings ("tablespoons") are left exactly as written.
function renderUnit(unitRaw, canon, valueStr) {
  if (!canon || NON_PLURAL.has(canon)) return unitRaw
  const lower = unitRaw.toLowerCase()
  if (lower !== canon && lower !== pluralOf(canon)) return unitRaw
  return valueStr === '1' ? canon : pluralOf(canon)
}

// Alternation for the regexes below, longest-first so "tablespoons" wins over "tbsp".
const UNIT_ALT = Object.keys(FOOD_UNITS).sort((a, b) => b.length - a.length).join('|')

export function normalizeUnit(word) {
  if (!word) return null
  return FOOD_UNITS[word.toLowerCase().replace(/\.$/, '')] || null
}

// ── Numbers ───────────────────────────────────────────────────────
const VULGAR = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 }
const VULGAR_CHARS = Object.keys(VULGAR).join('')

// Matches "400", "4.4", "1/2", "½", "1½", "1 1/2".
// ORDER IS LOAD-BEARING: JS alternation takes the first branch that matches, not
// the longest. With the plain-number branch first, "1/2" parses as 1.
const NUM_SRC = '(?:' + [
  `\\d+\\s+\\d+\\s*\\/\\s*\\d+`,   // 1 1/2
  `\\d+\\s*[${VULGAR_CHARS}]`,     // 1½
  `\\d+\\s*\\/\\s*\\d+`,           // 1/2
  `[${VULGAR_CHARS}]`,             // ½
  `\\d+(?:\\.\\d+)?`,              // 400, 4.4
].join('|') + ')'

// The live bug this replaces: parseFloat("1/2") returns 1, so "1/2 tsp salt"
// rendered as "1tsp salt".
export function parseNumber(str) {
  if (str == null) return null
  const s = String(str).trim()
  if (!s) return null
  let total = 0, matched = false
  // Leading whole number, but not the numerator of a bare "1/2"
  const whole = s.match(/^(\d+(?:\.\d+)?)(?!\s*\/)/)
  let rest = s
  if (whole) { total += parseFloat(whole[1]); rest = s.slice(whole[0].length); matched = true }
  const frac = rest.match(/^\s*(\d+)\/(\d+)/)
  if (frac) {
    const d = parseInt(frac[2], 10)
    if (d) { total += parseInt(frac[1], 10) / d; matched = true }
  } else {
    const v = rest.trim()[0]
    if (v && VULGAR[v] != null) { total += VULGAR[v]; matched = true }
  }
  return matched ? total : null
}

const FRACTION_STEPS = [
  [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.375, '⅜'], [0.5, '½'],
  [0.625, '⅝'], [2 / 3, '⅔'], [0.75, '¾'], [0.875, '⅞'],
]

// Cook-friendly output: 0.5 → "½", 1.5 → "1½", 2 → "2".
// Weights/volumes are rounded to whole numbers above 10 — no cook measures 133.3g.
export function formatNumber(n, unit) {
  if (n == null || !isFinite(n)) return null
  const metric = unit === 'g' || unit === 'ml' || unit === 'kg' || unit === 'l' || unit === 'cl' || unit === 'dl'
  // Above 20 a half-gram is noise; below it, halving 27ml should read 13.5ml.
  if (metric && n >= 20) return String(Math.round(n))
  if (metric && n >= 1) return String(Math.round(n * 10) / 10)
  const whole = Math.floor(n + 1e-9)
  const frac = n - whole
  if (frac < 0.06) return String(whole)
  for (const [v, glyph] of FRACTION_STEPS) {
    if (Math.abs(frac - v) < 0.042) return whole ? `${whole}${glyph}` : glyph
  }
  if (1 - frac < 0.06) return String(whole + 1)
  return String(Math.round(n * 100) / 100)
}

// Canonicalise so "0.5kg" in the ingredients matches "500g" in the method.
const BASE = { kg: ['g', 1000], g: ['g', 1], l: ['ml', 1000], dl: ['ml', 100], cl: ['ml', 10], ml: ['ml', 1] }
const key = (value, unit) => {
  const b = BASE[unit]
  const v = b ? value * b[1] : value
  return `${Math.round(v * 1000) / 1000}|${b ? b[0] : (unit || '')}`
}

// Methods routinely split one ingredient across steps — "Heat 30ml olive oil"
// then "the remaining 30ml" from a single 60ml line. Without this, neither half
// scales. Restricted to the fractions cooks actually write.
const SPLIT_FRACTIONS = [1 / 2, 1 / 3, 1 / 4, 2 / 3, 3 / 4]

function isKnownQuantity(value, unit, knownQtys) {
  if (value == null || !unit) return false
  if (knownQtys.has(key(value, unit))) return true
  for (const f of SPLIT_FRACTIONS) {
    if (knownQtys.has(key(Math.round((value / f) * 1000) / 1000, unit))) return true
  }
  return false
}

// Two phrasings survive the ingredient-match guard but must still never scale:
// a rate ("30g salt per litre") and a per-item figure ("about 165g each").
const RATE_AFTER = /^[^.,;:)]{0,20}\bper\b/i
const EACH_AFTER = /^\s*(?:each|apiece)\b/i

// ── Ingredient quantities ─────────────────────────────────────────
// Builds the set of quantities that are legitimately scalable for one recipe.
//
// Ingredient lines put the unit in varying positions — "3 garlic cloves" and
// "3 cloves garlic" are both common — so the unit is collected from anywhere in
// the line rather than only adjacent to the number. Method text meanwhile writes
// the compact form "garlic (3 cloves)"; registering both value|unit and value|''
// lets those meet.
export function collectQuantities(ingredientsText) {
  const set = new Set()
  if (!ingredientsText) return set
  // The \b after the unit is load-bearing: without it "3 garlic cloves" parses
  // the g of "garlic" as a unit, and "2 large onions" the l of "large".
  const numLead = new RegExp(`^(${NUM_SRC})\\s*(?:(${UNIT_ALT})\\b)?`, 'i')
  const unitAnywhere = new RegExp(`\\b(${UNIT_ALT})\\b`, 'i')
  for (const raw of String(ingredientsText).split(/\r?\n/)) {
    const line = raw.trim().replace(/^-\s*/, '')
    if (!line || /^\[.*\]$/.test(line)) continue

    // Every number+unit anywhere in the line, not just the leading one. Lines
    // like "1 medium aubergine (eggplant, approx. 300g)" lead with a count while
    // the mass the method quotes sits inside the name.
    const tokens = createTokenRe()
    let m
    while ((m = tokens.exec(line))) {
      const unit = normalizeUnit(m[3])
      if (!unit) continue
      for (const part of [m[1], m[2]]) {
        if (!part) continue
        const v = parseNumber(part)
        if (v != null && v !== 0) set.add(key(v, unit))
      }
    }

    // A leading count whose unit word sits later in the line — "3 garlic cloves"
    // has to match the method's compact "garlic (3 cloves)".
    const lead = line.match(numLead)
    if (!lead) continue
    const value = parseNumber(lead[1])
    if (value == null || value === 0) continue
    set.add(key(value, ''))
    if (!lead[2]) {
      // Every unit word in the rest of the line, except ones glued to a digit —
      // those belong to their own quantity ("approx. 300g"), not to this count.
      // "2 egg yolks" must register as both 2 eggs and 2 yolks.
      const rest = line.slice(lead[0].length)
      const scan = new RegExp(unitAnywhere.source, 'gi')
      let u
      while ((u = scan.exec(rest))) {
        if (/\d/.test(rest[u.index - 1] || '')) continue
        const unit = normalizeUnit(u[1])
        if (unit) set.add(key(value, unit))
      }
    }
  }
  return set
}

// ── Text scaling ──────────────────────────────────────────────────
// A number immediately followed by a food unit, optionally as a range
// ("13–26ml"). Bare numbers are not matched at all, by design.
// A fresh regex per scan — a shared /g object would carry lastIndex between
// callers and silently skip matches on re-render.
const createTokenRe = () => new RegExp(
  `(${NUM_SRC})(?:\\s*(?:[–—-]|to)\\s*(${NUM_SRC}))?\\s*(${UNIT_ALT})\\b`,
  'gi'
)

/**
 * Split text into render segments, rescaling only confirmed ingredient amounts.
 * @returns Array<{t:string, scaled?:true, was?:string}>
 */
export function scaleText(text, scale, knownQtys) {
  if (!text) return []
  if (!scale || scale === 1 || !knownQtys || !knownQtys.size) return [{ t: text }]

  const segments = []
  let last = 0
  const tokens = createTokenRe()
  let m
  while ((m = tokens.exec(text))) {
    const [full, aRaw, bRaw, unitRaw] = m
    const unit = normalizeUnit(unitRaw)
    const a = parseNumber(aRaw)
    const b = bRaw ? parseNumber(bRaw) : null
    // Gate 2: every endpoint must be a real ingredient quantity of this recipe.
    if (!isKnownQuantity(a, unit, knownQtys)) continue
    if (bRaw && !isKnownQuantity(b, unit, knownQtys)) continue

    const after = text.slice(m.index + full.length)
    if (RATE_AFTER.test(after) || EACH_AFTER.test(after)) continue

    const fa = formatNumber(a * scale, unit)
    const fb = b == null ? null : formatNumber(b * scale, unit)
    if (fa == null || (b != null && fb == null)) continue

    // Preserve the original spacing between number and unit ("15 g" vs "15g").
    const gap = /\s$/.test(full.slice(0, full.length - unitRaw.length)) ? ' ' : ''
    const shown = fb ? `${fa}–${fb}` : fa
    const replacement = `${shown}${gap}${renderUnit(unitRaw, unit, fb ? null : fa)}`
    if (replacement === full) continue

    if (m.index > last) segments.push({ t: text.slice(last, m.index) })
    segments.push({ t: replacement, scaled: true, was: full })
    last = m.index + full.length
  }
  if (!segments.length) return [{ t: text }]
  if (last < text.length) segments.push({ t: text.slice(last) })
  return segments
}

/** Convenience: the scaled text as a plain string (clipboard, AI payloads). */
export function scaleTextPlain(text, scale, knownQtys) {
  return scaleText(text, scale, knownQtys).map(s => s.t).join('')
}

// ── Ingredient lines ──────────────────────────────────────────────
// Replaces the old parseIngredientParts. Same {qty, name} shape, but fractions
// parse correctly and output is cook-friendly.
// Group 2 captures the gap so "24 sticks" doesn't come back as "12sticks".
const ING_RE = new RegExp(`^(${NUM_SRC})(\\s*)(?:(${UNIT_ALT})\\b)?\\.?\\s*(.+)$`, 'i')

export function scaleIngredientLine(text, scale) {
  if (!text) return { qty: null, name: text }
  const m = String(text).match(ING_RE)
  if (!m) return { qty: null, name: text }
  const value = parseNumber(m[1])
  if (value == null) return { qty: null, name: text }
  const gap = m[2] || ''
  const unitRaw = m[3] || ''
  const unit = normalizeUnit(unitRaw)
  const d = formatNumber(value * (scale || 1), unit)
  if (d == null) return { qty: null, name: text }
  return { qty: unitRaw ? `${d}${gap}${renderUnit(unitRaw, unit, d)}` : d, name: m[4] }
}
