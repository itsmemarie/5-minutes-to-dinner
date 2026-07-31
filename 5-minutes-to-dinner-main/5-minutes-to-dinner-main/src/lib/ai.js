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

// ─── Groq recipe extraction ──────────────────────────────────────
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY

const GROQ_SYSTEM = `You are a Michelin-star chef who specialises in approachable home cooking.
Extract the recipe from the provided content and return ONLY a valid JSON object — no markdown fences, no explanation, just the raw JSON.

Required JSON schema:
{
  "name": "Descriptive recipe name (specific — e.g. 'Slow-Roasted Tomato & Ricotta Pasta' not 'Pasta')",
  "meal_type_id": "main | breakfast | side | dessert | entree",
  "diet": "omni | veg | vegan",
  "prep_time_minutes": <number>,
  "cook_time_minutes": <number>,
  "portion_size": <number, default 4>,
  "min_portions": <number>,
  "has_thermomix_version": true,
  "ingredients": "Grouped list. Format each group as:\\n[Category]\\n- 200g ingredient\\n- 3 pieces ingredient",
  "instructions_standard": "Steps with inline amounts. Format: 'Step Name: Description (200g). Cook X minutes.'",
  "instructions_thermomix": "Thermomix conversion. Format: 'Step Name: TM6 instructions. X sec / speed Y.'",
  "fridge_storage": "Days as text e.g. '3-4 days'",
  "freezer_storage": "Freeze instructions + duration, or 'Not Recommended'",
  "chef_notes": "2-3 technical tips for a home cook",
  "husband_variations": "Protein-focused pivot towards chicken where possible",
  "toddler_variations": "Ages 1-3 adaptations: lower salt, smaller pieces, softer textures",
  "side_recommendation": "Up to 3 sides, comma-separated"
}`

export async function extractRecipe({ url, imageBase64, mediaType }) {
  let model, userContent

  if (imageBase64) {
    model = 'meta-llama/llama-4-scout-17b-16e-instruct'
    userContent = [
      { type: 'image_url', image_url: { url: `data:${mediaType ?? 'image/jpeg'};base64,${imageBase64}` } },
      { type: 'text', text: 'Extract the recipe from this image and return the JSON.' },
    ]
  } else {
    model = 'llama-3.1-8b-instant'
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`
    const res = await fetch(proxyUrl)
    if (!res.ok) throw new Error(`Could not fetch the URL (try pasting the recipe text instead)`)
    const html = await res.text()
    const pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000)
    userContent = `Extract the recipe from this page and return the JSON:\n\n${pageText}`
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: GROQ_SYSTEM },
        { role: 'user', content: userContent },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Groq error ${res.status}`)
  }
  const data = await res.json()
  const text = data.choices[0].message.content
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse recipe from AI response')
  return JSON.parse(match[0])
}
