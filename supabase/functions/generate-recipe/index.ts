const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? ''

const SYSTEM = `You are a Michelin-star chef who specialises in approachable home cooking.
Invent an original recipe that satisfies the user's request. Return ONLY a valid JSON object — no markdown fences, no explanation, just the raw JSON.

Required JSON schema:
{
  "name": "Descriptive recipe name (specific, not generic — e.g. 'Slow-Roasted Tomato & Ricotta Pasta' not 'Pasta')",
  "meal_type_id": "main | breakfast | side | dessert | entree",
  "diet": "omni | veg | vegan",
  "prep_time_minutes": <number>,
  "cook_time_minutes": <number>,
  "advance_prep_hours": <number, hours of unattended lead time needed before cooking can start — marinating, brining, dough proofing/fermenting, thawing, overnight chilling. 0 if none needed.>,
  "advance_prep_note": "Short human-readable description of the advance step, e.g. 'Marinate chicken 4h' or 'Cold-ferment dough overnight (8-12h)'. Empty string if advance_prep_hours is 0.",
  "portion_size": <number, default 4>,
  "min_portions": <number>,
  "should_have_side": <boolean>,
  "has_thermomix_version": true,
  "ingredients": "Grouped list. Format:\\n[Category]\\n- 200g ingredient\\n- 3 pieces ingredient",
  "instructions_standard": "Steps with inline amounts. Format: 'Step Name: Description with amounts (200g). Cook X minutes.'",
  "instructions_thermomix": "Thermomix conversion. Format: 'Step Name: TM6 instructions. X sec / speed Y.'",
  "fridge_storage": "Days as text e.g. '3-4 days'",
  "freezer_storage": "Freeze instructions + duration, or 'Not Recommended'",
  "chef_notes": "2-3 technical tips written for a home cook (what makes this dish work)",
  "husband_variations": "Protein-focused pivot — towards chicken if possible, beef/lamb fine if it's the original",
  "toddler_variations": "Ages 1-3 adaptations: lower salt, smaller pieces, softer textures",
  "side_recommendation": "Up to 3 side suggestions, comma-separated, no explanations"
}`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  if (!GROQ_KEY) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY secret is not configured on this project' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { description } = await req.json()
    if (!description) {
      return new Response(JSON.stringify({ error: 'Provide description' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const apiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 4096,
        include_reasoning: false,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: description },
        ],
      }),
    })

    if (!apiRes.ok) {
      const errText = await apiRes.text()
      return new Response(JSON.stringify({ error: `Groq error: ${errText}` }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const groqData = await apiRes.json()
    const text: string = groqData.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/gi, '')
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return new Response(JSON.stringify({ error: 'Could not extract structured recipe from AI response' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const recipe = JSON.parse(match[0])
    return new Response(JSON.stringify(recipe), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
