// ─── Model JSON parsing ───────────────────────────────────────────
// Providers are asked for raw JSON, but replies still arrive wrapped in
// <think> blocks, ``` fences or a sentence of preamble. Parse the clean case
// first, then fall back to the outermost {...} or [...] span. Returns
// undefined when there is nothing parseable — callers decide what that means.
export function parseModelJson(raw: string): unknown {
  if (typeof raw !== 'string') return undefined
  const text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  if (!text) return undefined
  try { return JSON.parse(text) } catch { /* fall through to span search */ }

  // Try whichever shape opens first, so "[{...}]" stays an array.
  const shapes = [['{', '}'], ['[', ']']] as const
  const order = text.indexOf('[') !== -1 && (text.indexOf('{') === -1 || text.indexOf('[') < text.indexOf('{'))
    ? [shapes[1], shapes[0]] : [shapes[0], shapes[1]]
  for (const [open, close] of order) {
    const start = text.indexOf(open)
    const end = text.lastIndexOf(close)
    if (start === -1 || end <= start) continue
    try { return JSON.parse(text.slice(start, end + 1)) } catch { /* try the other shape */ }
  }
  return undefined
}
