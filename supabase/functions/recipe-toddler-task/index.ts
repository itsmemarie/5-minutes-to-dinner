import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GROQ_KEY = (Deno.env.get('GROQ_API_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'openai/gpt-oss-120b'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are a toddler cooking educator helping a parent involve their toddler in cooking a specific recipe, matched to the toddler's age.

Your task: given one recipe's ingredients and steps, and a toddler's current age band, invent 2-3 safe, concrete, recipe-specific activities the toddler can help with while this recipe is being cooked.

Rules (non-negotiable):
- Return 2-3 activities, ordered easiest first. Grade them within the age band: one simple/sensory warm-up, one core hands-on job, and (where the recipe allows) one slightly more independent step. Each activity must be distinct — no restating the same job.
- Every activity must reference actual ingredients or steps from THIS recipe (e.g. "tear the basil leaves", "stir the batter", "cut the cooled cooked pepper strips") — never a generic task unrelated to the recipe.
- Never suggest activities involving raw meat, raw fish, hot surfaces, boiling liquids, ovens, or hobs.
- Each activity must be appropriate for the given age band — simpler/more supervised for younger bands, more independent for older bands.
- If the recipe genuinely offers little that is hands-on and safe, fall back to simple sensory/naming activities using this recipe's actual ingredients (e.g. smelling a spice used in the recipe, naming a vegetable in it) rather than returning fewer than 2.
- If toddler adaptation notes are provided, use them only as extra context — do not repeat them verbatim, these are specific hands-on activities, not general dietary adaptation advice.
- "title" is a short 2-4 word label for the activity; "task" is one concrete sentence describing what the toddler does.
- If an activity requires a tool, name it in that activity's "needsTool" using ONLY one of these exact names (they are guaranteed to exist in the household): "Kids' safety knife (nylon, crinkle edge)", "Learning tower or sturdy step stool", "Suction-base mixing bowl", "Kid-size whisk & spatula", "Y-peeler with safety guard". Otherwise set needsTool to null.

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
    const { ageBandLabel, recipeName, ingredients, instructions, toddlerVariations } = await req.json()

    const userPrompt = `Toddler's current age band: ${ageBandLabel}\n\nRecipe: ${recipeName}\n\nIngredients:\n${ingredients || '(none provided)'}\n\nInstructions:\n${instructions || '(none provided)'}\n\n${toddlerVariations ? `Existing general toddler adaptation notes for this recipe (context only, don't repeat verbatim): ${toddlerVariations}\n\n` : ''}Return this exact JSON structure:\n{\n  "activities": [\n    { "title": "Short label", "task": "One concrete, recipe-specific sentence describing what the toddler does.", "needsTool": null }\n  ]\n}`

    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        include_reasoning: false,
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
