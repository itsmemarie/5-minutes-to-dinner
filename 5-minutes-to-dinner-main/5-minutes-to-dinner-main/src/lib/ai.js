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

const GROQ_GENERATE_SYSTEM = `You are a Michelin-star chef who specialises in approachable home cooking.
Invent an original recipe that satisfies the user's request below. Return ONLY a valid JSON object — no markdown fences, no explanation, just the raw JSON.

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

const GROQ_VISION_MODEL = 'qwen/qwen3.6-27b'

const GROQ_IMAGE_TRANSCRIBE_SYSTEM = `You are transcribing a recipe photo. Read every piece of recipe-relevant text visible in the image — title, ingredients with quantities, instructions, notes — and return it as plain text, exactly as written, preserving order. No commentary, no markdown, no JSON.`

async function fetchGroq(body) {
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Runs a Groq chat completion; on a 413 or rate-limit response, waits 25s and retries once. */
async function groqChat(body) {
  let res = await fetchGroq(body)
  if (!res.ok && (res.status === 413 || res.status === 429)) {
    await new Promise(resolve => setTimeout(resolve, 25000))
    res = await fetchGroq(body)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Groq error ${res.status}`)
  }
  const data = await res.json()
  return data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/gi, '')
}

export async function extractRecipe({ url, images, onProgress }) {
  let model, userContent

  if (images && images.length) {
    let combinedText = ''
    for (let i = 0; i < images.length; i++) {
      onProgress?.(i + 1, images.length)
      const img = images[i]
      const text = await groqChat({
        model: GROQ_VISION_MODEL,
        max_tokens: 2048,
        reasoning_effort: 'none',
        messages: [
          { role: 'system', content: GROQ_IMAGE_TRANSCRIBE_SYSTEM },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${img.mediaType ?? 'image/jpeg'};base64,${img.base64}` } },
            { type: 'text', text: 'Transcribe the recipe text from this photo.' },
          ] },
        ],
      })
      combinedText += (combinedText ? '\n\n' : '') + text
    }
    model = 'llama-3.1-8b-instant'
    userContent = `Extract the recipe from the following text, transcribed from ${images.length > 1 ? `${images.length} photos of the same recipe` : 'a photo'}, and return the JSON:\n\n${combinedText}`
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

  const text = await groqChat({
    model,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: GROQ_SYSTEM },
      { role: 'user', content: userContent },
    ],
  })
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse recipe from AI response')
  return JSON.parse(match[0])
}

export async function generateRecipe({ description }) {
  const text = await groqChat({
    model: 'llama-3.1-8b-instant',
    max_tokens: 4096,
    messages: [
      { role: 'system', content: GROQ_GENERATE_SYSTEM },
      { role: 'user', content: description },
    ],
  })
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse recipe from AI response')
  return JSON.parse(match[0])
}

// ─── Freezer list extraction ──────────────────────────────────────
const FREEZER_SYSTEM = `You are extracting an inventory list from a photo. The photo may show a handwritten or printed list, or labeled freezer bags/containers.
Extract every distinct item name visible across all provided photos and return ONLY a raw JSON array of strings — no markdown fences, no explanation, no wrapper object, just the array. Combine items from all images into one flat array. Skip quantities, dates, and non-food text unless they're part of the item's name.`

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

  const userContent = [
    ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mediaType ?? 'image/jpeg'};base64,${img.base64}` } })),
    { type: 'text', text: images.length > 1
      ? 'These images are multiple photos of freezer inventory (list pages or labeled containers). Extract all item names across all of them and return the JSON array.'
      : 'Extract the freezer item names from this image and return the JSON array.' },
  ]

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      max_tokens: 2048,
      reasoning_effort: 'none',
      messages: [
        { role: 'system', content: FREEZER_SYSTEM },
        { role: 'user', content: userContent },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Groq error ${res.status}`)
  }
  const data = await res.json()
  const raw = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/gi, '')

  const arrMatch = raw.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    const parsed = JSON.parse(arrMatch[0])
    return parsed.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim())
  }
  const objMatch = raw.match(/\{[\s\S]*\}/)
  if (objMatch) {
    const parsed = JSON.parse(objMatch[0])
    if (Array.isArray(parsed.items)) return parsed.items.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim())
  }
  throw new Error('Could not parse freezer items from AI response')
}
