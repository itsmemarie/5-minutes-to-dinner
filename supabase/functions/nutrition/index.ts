import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GROQ_KEY = (Deno.env.get('GROQ_API_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'openai/gpt-oss-120b'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are a board-certified physician and clinical nutritional scientist specialising in gut microbiome health, preventive medicine, and paediatric nutrition.

Your task: analyse the provided weekly meal plan and return a nutritional assessment as a raw JSON object.

Scoring rules:
- All scores are integers 0-100 (100 = optimal)
- gutHealth: microbiome support, prebiotic fibre, fermented foods, polyphenol diversity
- vitaminMineral: micronutrient density vs EFSA/RDA values
- inflammation: omega-3:6 ratio, polyphenols, Mediterranean alignment (100 = maximally anti-inflammatory)
- metabolic: GI of carbs, fibre-to-sugar ratio, refined vs complex carbs
- antioxidant: Vitamin C/E, carotenoids, flavonoids, colour diversity
- overall: weighted average (gut 25%, vitamin 20%, inflammation 20%, metabolic 20%, antioxidant 15%)

For toddler profile: apply WHO infant thresholds (12-24 months), penalise added sugar/high sodium/honey/whole nuts, flag low iron.

Recommendations:
- Identify the 2 lowest scoring dimensions, emit at least one warning or critical per low dimension
- Emit at least one positive recommendation
- For mealRecommendations: one actionable swap per recipe where it would meaningfully improve a low score
- type: 'positive' | 'warning' | 'critical'

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
    const { profile, meals, weekOf, region } = await req.json()

    const mealSummary = meals
      .filter((m: any) => m.name)
      .map((m: any) => `${m.day} ${m.section}: ${m.name} (${m.portion} portions)`)
      .join('\n')

    const userPrompt = `Profile: ${profile}
Week of: ${weekOf}
Region: ${region || 'UK'}

Planned meals:
${mealSummary}

Return this exact JSON structure:
{
  "profile": "${profile}",
  "weekOfDate": "${weekOf}",
  "scores": {
    "gutHealth": 0,
    "vitaminMineral": 0,
    "inflammation": 0,
    "metabolic": 0,
    "antioxidant": 0,
    "overall": 0
  },
  "generalRecommendations": [
    { "title": "", "text": "", "type": "positive|warning|critical" }
  ],
  "mealRecommendations": [
    { "forMeal": "", "text": "", "type": "positive|warning|critical" }
  ]
}`

    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2048,
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
