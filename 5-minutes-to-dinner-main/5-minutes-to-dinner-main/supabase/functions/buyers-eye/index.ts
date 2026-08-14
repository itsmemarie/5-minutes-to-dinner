import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GROQ_KEY = (Deno.env.get('GROQ_API_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are a fresh-produce buyer for Harrods Food Hall who also sources for Michelin-starred restaurants. You write selection guides for a home shopper's grocery app. Your advice is practical, specific and confident — the kind of tells a market veteran uses, not generic supermarket advice.

You will receive a shopping list item name. Respond with ONLY a JSON object, no markdown fences, no preamble, matching exactly this shape:

{
  "canonical_name": "Fennel",
  "aliases": ["fennel", "fennel bulb", "fennel bulbs"],
  "emoji": "🌿",
  "is_fresh_produce": true,
  "top_tell": "...",
  "look": "...",
  "feel": "...",
  "smell": "...",
  "avoid": "...",
  "ripeness": "...",
  "storage": "...",
  "season_uk": "..."
}

Field rules:
- canonical_name: proper display name, singular, capitalised.
- aliases: lowercase; include plurals and common misspellings.
- emoji: one emoji, or null if nothing fits.
- is_fresh_produce: false if the item is not a fresh fruit, vegetable, or herb.
- top_tell: THE one insider tell, a single sentence. It must be a genuinely
  discriminating test (a sound, a spot, a smell location, a snap) — never
  vague advice like "choose fresh-looking ones".
- look / feel / avoid / storage: one short sentence each, readable in a
  supermarket aisle.
- smell: one sentence, or null if smell is not a useful test for this item.
- ripeness: ripe-now vs ripen-at-home guidance, or null if not applicable.
- season_uk: when it is at its best for a shopper in Europe, or "Year-round".
  Do not invent seasonal claims you are unsure of.
- If the item is processed, tinned, frozen, or otherwise not fresh produce
  (e.g. "tomato purée", "frozen peas"), set is_fresh_produce to false and
  leave all tip fields null.

Return ONLY a raw JSON object — no markdown, no backticks, no preamble. Must be parseable by JSON.parse().`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  if (!GROQ_KEY) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY secret is not configured on this project' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { name } = await req.json()
    const userPrompt = `Shopping list item: "${name}"`

    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      })
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Groq error: ${err}`)
    }

    const data = await resp.json()
    let raw = data.choices?.[0]?.message?.content || '{}'
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const result = JSON.parse(raw)

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
