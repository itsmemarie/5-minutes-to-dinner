import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GROQ_KEY = (Deno.env.get('GROQ_API_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are a paediatric-informed toddler cooking educator helping a parent involve their toddler in home cooking every day, matched to their skill level.

Your task: generate reference content for a parent with two parts.

Part 1 — "Tools worth having": exactly 5 safe, commonly available kitchen tools/products that make it easier for a toddler to help cook. Good examples: a kids' safety knife (nylon, crinkle edge), a learning tower or sturdy step stool, a suction-base mixing bowl, a kid-size whisk & spatula, a Y-peeler with a safety guard — adapt or substitute if you have better ideas, but keep exactly 5. Each needs a single representative emoji icon, a short name, and a one-sentence description of why it helps.

Part 2 — age-appropriate kitchen tasks for EACH of these 4 fixed age bands, covering the full range regardless of the toddler's current age (this is a forward-looking reference, not just for today): "18-24m" (18-24 months), "2-3y" (2-3 years), "3-4y" (3-4 years), "4-5y" (4-5 years). For each band, generate 4-6 tasks.

Rules for tasks (non-negotiable):
- Every task must be concrete and specific — never vague. "Pour water or milk into a small jug" not "Help in kitchen".
- Every task must be safe for that age: no hot surfaces, no boiling liquids, no ovens/hobs, no adult knives, no unsupervised tool use, nothing that could choke or burn.
- Tasks must be developmentally graded — later bands should involve more independence, finer motor skill, and more tool use than earlier bands.
- If a task requires one of the 5 tools from Part 1, set needsTool to that tool's exact name (as written in Part 1); otherwise null.
- Each task needs a single representative emoji icon, a short title, and a one-sentence description.

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
    const { dob } = await req.json()
    const today = new Date().toISOString().split('T')[0]

    const userPrompt = `Toddler's date of birth: ${dob}\nToday's date: ${today}\n\nGenerate the reference content with this exact JSON structure:\n{\n  "tools": [\n    { "icon": "🔪", "name": "Kids' safety knife (nylon, crinkle edge)", "description": "Cuts soft food but is too dull to cut skin." }\n  ],\n  "ageBands": {\n    "18-24m": [\n      { "icon": "💧", "title": "Pour water or milk into a bowl", "description": "Use a small jug, adult keeps a hand near the base.", "needsTool": null }\n    ],\n    "2-3y": [],\n    "3-4y": [],\n    "4-5y": []\n  }\n}\n\n"tools" must have exactly 5 entries. Every age band key must be present with 4-6 task entries each. The example entries above are formatting examples only, not content to copy.`

    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      })
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Groq error: ${err}`)
    }

    const data = await resp.json()
    const result = JSON.parse(data.choices?.[0]?.message?.content || '{}')

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
