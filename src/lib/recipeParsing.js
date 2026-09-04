// ─── Recipe text-parsing helpers ───────────────────────────────────
export function parseIngredients(text) {
  if (!text) return []
  const sections = []
  let cur = { title: null, items: [] }
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim()
    if (!t) continue
    const m = t.match(/^\[(.+)\]$/)
    if (m) { if (cur.items.length || cur.title) sections.push(cur); cur = { title: m[1], items: [] } }
    else if (t.startsWith('- ')) cur.items.push(t.slice(2))
  }
  if (cur.items.length || cur.title) sections.push(cur)
  return sections
}

export function parseIngredientParts(text, scale) {
  const m = text.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)\s*(g|kg|ml|l|cl|tsp|tbsp|oz|lb|cups?|pints?|tins?|bags?|bunches?|pinch(?:es)?|slices?|cloves?|pieces?|sprigs?|sheets?|drops?)?\s+(.+)$/i)
  if (!m) return { qty: null, name: text }
  const num = parseFloat(m[1]), unit = m[2] || '', name = m[3]
  const s = Math.round(num * scale * 10) / 10
  const d = s % 1 === 0 ? String(Math.round(s)) : s.toFixed(1)
  return { qty: unit ? `${d}${unit}` : d, name }
}

export function parseSteps(text) {
  if (!text) return []
  const steps = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    const m = t.match(/^(\d+)\.\s+(.+)/)
    if (m) steps.push({ num: m[1], text: m[2] })
    else if (steps.length && t) steps[steps.length - 1].text += ' ' + t
  }
  return steps
}
