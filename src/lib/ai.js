// ─── Edge Function URLs ───────────────────────────────────────────
const SUPA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function callEdgeFn(name, body) {
  const r = await fetch(`${SUPA_URL}/${name}?apikey=${SUPA_ANON}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error)
  return d
}

// ─── Recipe extraction / generation ───────────────────────────────
// All Groq calls happen server-side in Supabase Edge Functions — the
// Groq key never reaches the client bundle.

export async function extractRecipe({ url, images }) {
  return callEdgeFn('extract-recipe', { url, images })
}

export async function generateRecipe({ description }) {
  return callEdgeFn('generate-recipe', { description })
}

// ─── Freezer list extraction ──────────────────────────────────────

export function parseFreezerText(text) {
  const seen = new Set()
  const items = []
  text.split('\n').forEach(line => {
    const name = line.replace(/^[\s•\-\*\d.)]+/, '').trim()
    if (!name) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    items.push(name)
  })
  return items
}

export async function extractFreezerItems({ text, images }) {
  if (!images || !images.length) return parseFreezerText(text || '')
  const { items } = await callEdgeFn('extract-freezer-items', { images })
  return items
}
