// ─── Expert review: applying one approved suggestion ──────────────
// Pure. Each suggestion from the review-recipe function is a find/replace on
// a single field, so approving it changes exactly the text that was shown —
// nothing is regenerated. If the user has since edited that text the quote no
// longer matches, and the suggestion is reported as unappliable instead of
// being forced in somewhere else.

const NUMERIC = new Set(['prep_time_minutes', 'cook_time_minutes', 'portion_size', 'min_portions', 'advance_prep_hours'])

// Appended lines follow the field's own format: "- item" for ingredients,
// the next step number for a method.
function formatAppend(field, current, addition) {
  const text = addition.trim()
  if (field === 'ingredients') {
    return text.split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => (/^\[.+\]$/.test(l) || l.startsWith('- ') ? l : `- ${l.replace(/^[-•*]\s*/, '')}`)).join('\n')
  }
  if ((field === 'instructions_standard' || field === 'instructions_thermomix') && !/^\d+\./.test(text)) {
    const steps = current.split('\n').filter(l => /^\d+\./.test(l.trim())).length
    return `${steps + 1}. ${text}`
  }
  return text
}

/**
 * @returns {{ ok: true, fields } | { ok: false, reason: 'unknown-field'|'text-changed'|'not-a-number' }}
 */
export function applySuggestion(fields, s) {
  if (!s || !Object.hasOwn(fields, s.field)) return { ok: false, reason: 'unknown-field' }
  const current = fields[s.field] == null ? '' : String(fields[s.field])
  const find = s.find ?? ''
  let next
  if (NUMERIC.has(s.field) && (!find.trim() || find.trim() === current.trim())) {
    next = s.replace
  } else if (!find.trim()) {
    const addition = formatAppend(s.field, current, s.replace ?? '')
    next = current.trim() ? `${current.replace(/\s+$/, '')}\n${addition}` : addition
  } else {
    const at = current.indexOf(find)
    if (at === -1) return { ok: false, reason: 'text-changed' }
    next = current.slice(0, at) + (s.replace ?? '') + current.slice(at + find.length)
  }
  if (NUMERIC.has(s.field)) {
    const n = Number(String(next).trim())
    if (!Number.isFinite(n) || n < 0) return { ok: false, reason: 'not-a-number' }
    next = n
  }
  return { ok: true, fields: { ...fields, [s.field]: next } }
}

export const APPLY_FAILURE_TEXT = {
  'unknown-field': "This one can't be applied here.",
  'text-changed': 'The text it refers to has changed since the review. Edit it by hand if you still want it.',
  'not-a-number': "This would make the value something other than a number, so it wasn't applied.",
}
