// ─── Recipe text-parsing helpers ───────────────────────────────────
import { scaleIngredientLine } from './quantityScaling.js'

// Recipe names carry a code suffix: "Avocado & Banana Pancakes | MP-VCBN".
// Photo tiles show the title alone and move the code onto the image placeholder;
// list rows keep the full name. indexOf/slice rather than split('|')[1] so a
// second pipe can't silently truncate the code.
export function splitRecipeName(name) {
  const s = String(name || '')
  const i = s.indexOf('|')
  if (i === -1) return { title: s.trim(), code: '' }
  return { title: s.slice(0, i).trim(), code: s.slice(i + 1).trim() }
}

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

// Thin wrapper over the shared scaler so ingredient rows and method text agree
// on fractions and rounding. Same {qty, name} shape as before.
export function parseIngredientParts(text, scale) {
  return scaleIngredientLine(text, scale)
}

// Recipes arrive in three different step formats. Only the first was handled
// before, which left the whole Preparation Methods block empty for the ~25
// recipes written in the other two.
export function parseSteps(text) {
  if (!text) return []
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []

  // 1. "1. Roast Sweet Potato: ..." — the dominant format. Unnumbered lines are
  //    continuations of the step above.
  if (/^\d+\.\s+/.test(lines[0])) {
    const steps = []
    for (const t of lines) {
      const m = t.match(/^(\d+)\.\s+(.+)/)
      if (m) steps.push({ num: m[1], text: m[2] })
      else if (steps.length) steps[steps.length - 1].text += ' ' + t
    }
    return steps
  }

  // 2. "Step 1: ... Step 2: ..." — may run several steps together on one line.
  if (/\bStep\s+\d+\s*:/i.test(text)) {
    const steps = []
    const re = /\bStep\s+(\d+)\s*:\s*/gi
    const joined = lines.join(' ')
    let m, prev = null, lastEnd = 0
    while ((m = re.exec(joined))) {
      if (prev) steps.push({ num: prev, text: joined.slice(lastEnd, m.index).trim() })
      prev = m[1]; lastEnd = re.lastIndex
    }
    if (prev) steps.push({ num: prev, text: joined.slice(lastEnd).trim() })
    if (steps.length) return steps.filter(s => s.text)
  }

  // 3. "Prepare Curry Paste: Blitz ..." — one unnumbered step per line.
  return lines.map((t, i) => ({ num: String(i + 1), text: t }))
}
