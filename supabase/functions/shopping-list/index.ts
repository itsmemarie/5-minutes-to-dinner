import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const GROQ_KEY = (Deno.env.get('GROQ_API_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'openai/gpt-oss-120b'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are a UK-based meal planning assistant generating a consolidated grocery shopping list.

Your task: given a set of recipes with their scaled ingredient lists, produce a deduplicated, consolidated shopping list suitable for a UK supermarket.

Rules:
- Consolidate the same ingredient across multiple recipes (e.g. onions used in 3 recipes → total quantity needed)
- Quantities have already been scaled by the scale factor shown — use them as-is
- Use UK-standard units (g, kg, ml, l, tins, bags, bunches, etc.) — convert sensibly (e.g. 1000g → 1kg)
- Use UK ingredient names (courgette not zucchini, coriander not cilantro, aubergine not eggplant)
- Categorise each item into one of: VEGETABLES, FRUIT, MEAT, FISH, DAIRY, BAKERY, DRY GOODS, PANTRY, FROZEN, OTHER
- Do not include salt, pepper, or basic cooking oil as standalone items unless used in significant quantities by a recipe
- Amount must be a string number (e.g. "400", "2", "1.5"). If no numeric quantity is given, use "1"
- Return ONLY a raw JSON object — no markdown, no backticks, no preamble. Must be parseable by JSON.parse().`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  if (!GROQ_KEY) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY secret is not configured on this project' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { meals, weekOf, region } = await req.json()

    const recipePortions = new Map<string, number>()
    for (const m of meals as any[]) {
      if (!m.recipeId) continue
      recipePortions.set(m.recipeId, (recipePortions.get(m.recipeId) ?? 0) + (m.portion ?? 4))
    }

    const recipeIds = [...recipePortions.keys()]
    if (!recipeIds.length) throw new Error('No meals with recipe IDs provided')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('id, name, portion_size, ingredients')
      .in('id', recipeIds)

    if (error) throw new Error(`DB error: ${error.message}`)

    const recipeBlocks = (recipes ?? []).map((r: any) => {
      const totalPortions = recipePortions.get(r.id) ?? 4
      const basePortions = r.portion_size ?? 4
      const scale = (totalPortions / basePortions).toFixed(2)
      return `Recipe: ${r.name}\nBase portions: ${basePortions} | Planned this week: ${totalPortions} | Scale: ${scale}x\nIngredients:\n${r.ingredients ?? '(none)'}`
    }).join('\n\n---\n\n')

    const userPrompt = `Week of: ${weekOf}\nRegion: ${region ?? 'UK'}\n\nRecipes planned this week (scale each ingredient by the factor shown, then consolidate duplicates):\n\n${recipeBlocks}\n\nReturn this exact JSON structure:\n{\n  "items": [\n    { "name": "Ingredient name", "amount": "500", "unit": "g", "aisle": "VEGETABLES" }\n  ]\n}\n\nAisle must be one of: VEGETABLES, FRUIT, MEAT, FISH, DAIRY, BAKERY, DRY GOODS, PANTRY, FROZEN, OTHER.`

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
