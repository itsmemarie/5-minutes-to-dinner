import { CORS } from '../_shared/cors.ts'

const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? ''

const SYSTEM = `You are a Michelin-star chef who specialises in approachable home cooking.
Extract the recipe from the provided content and return ONLY a valid JSON object — no markdown fences, no explanation, just the raw JSON.

Required JSON schema:
{
  "name": "Descriptive recipe name (specific, not generic — e.g. 'Slow-Roasted Tomato & Ricotta Pasta' not 'Pasta')",
  "meal_type_id": "main | breakfast | side | dessert | entree",
  "diet": "omni | veg | vegan",
  "prep_time_minutes": <number>,
  "cook_time_minutes": <number>,
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

  try {
    const { url, imageBase64, mediaType } = await req.json()

    let model: string
    let userContent: unknown

    if (imageBase64) {
      model = 'meta-llama/llama-4-scout-17b-16e-instruct'
      userContent = [
        { type: 'image_url', image_url: { url: `data:${mediaType ?? 'image/jpeg'};base64,${imageBase64}` } },
        { type: 'text', text: 'Extract the recipe from this image and return the JSON.' },
      ]
    } else if (url) {
      model = 'llama-3.3-70b-versatile'
      let pageText = ''
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' },
        })
        const html = await res.text()
        pageText = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 12000)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        return new Response(JSON.stringify({ error: `Could not fetch URL: ${msg}` }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      userContent = `Extract the recipe from this web page and return the JSON:\n\n${pageText}`
    } else {
      return new Response(JSON.stringify({ error: 'Provide url or imageBase64' }), {
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
        model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userContent },
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
    const text: string = groqData.choices[0].message.content
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
