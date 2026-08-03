import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const GROQ_KEY = (Deno.env.get('GROQ_API_KEY') ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are an expert batch cooking planner for a TM6 Thermomix household with a standard oven and hob.

Your task: generate a structured batch cooking schedule from the provided weekly meal plan.

Rules:
- Big session (Monday, 2 hours): prep consumed by Wednesday
- Medium session (Thursday, 1 hour): prep consumed by Saturday
- Evenings: heat-and-assemble only, max 40 min active
- Sunday meals always cooked fresh
- Rice: always cook fresh, never batch
- Soups/stews/sauces: safe to batch and refrigerate
- Roasted veg: batch only if used within 2 days
- Raw meat: never pre-slice and store overnight
- Every storage label must include: item + days + eat-by day
- Open oven preheat as first step of each session
- Group all chopping into a single mise en place block at the start
- Use TM6 for aromatics first (sequential, no washing between)
- Run parallel tasks where possible (oven + TM6 simultaneously)

Instruction specificity (non-negotiable):
- Never write a vague instruction. Every step's "body" must be fully self-contained and concrete: state the exact quantity and size/descriptor for anything being prepped, e.g. "Cut 4 medium size onions into 1cm dice" — never a bare "Chop onions" or "Prep veg".
- Every step tagged TM6 must include the exact appliance setting inline, in parentheses, inside the "body" text itself, e.g. "Cut 4 medium size onions (TM6 instructions: speed 10, time 3 sec)." This must match the values also given in "chips" — the body text must stand on its own even if chips are not shown.
- Do the same for HOB/OVEN steps where relevant: state exact heat/time, e.g. "Roast at 200°C Fan for 35 minutes, tossing at the halfway point."

Food safety (non-negotiable):
- Cooked rice: 1 day max
- Cooked meat/stews: 3 days max
- Roasted veg: 3-4 days
- Raw marinated meat: 1-2 days
- Cooked fish: 2 days

Appliance tags: TM6, HOB, OVEN, KNIFE, NO_COOK, DONE

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
    const { meals } = await req.json()

    const mealSummary = Object.entries(meals)
      .map(([day, sections]: [string, any]) => {
        const items = [
          ...(sections.breakfast || []).map((m: any) => `breakfast: ${m.name}`),
          ...(sections.main || []).map((m: any) => `main: ${m.name}`),
          ...(sections.side || []).map((m: any) => `side: ${m.name}`),
        ]
        return items.length ? `${day}: ${items.join(', ')}` : null
      })
      .filter(Boolean)
      .join('\n')

    const userPrompt = `Weekly meal plan:\n${mealSummary}\n\nGenerate a batch cooking schedule with this exact JSON structure:\n{\n  "sessions": [\n    {\n      "id": "big",\n      "label": "Monday · 2 hrs",\n      "groundRule": "",\n      "overview": [{"e": "emoji", "t": "description"}],\n      "steps": [\n        {\n          "time": "0:00",\n          "tag": "OVEN",\n          "title": "",\n          "full": false,\n          "chips": ["200°C Fan"],\n          "qty": null,\n          "body": "",\n          "storage": null,\n          "warn": null,\n          "safety": null\n        },\n        {\n          "time": "0:05",\n          "tag": "TM6",\n          "title": "Chop Aromatics",\n          "full": false,\n          "chips": ["3s", "Speed 10"],\n          "qty": "4 medium onions, 4 garlic cloves",\n          "body": "Cut 4 medium size onions and 4 garlic cloves into rough chunks (TM6 instructions: speed 10, time 3 sec).",\n          "storage": null,\n          "warn": null,\n          "safety": null\n        }\n      ]\n    },\n    {\n      "id": "medium",\n      "label": "Thursday · 1 hr",\n      "groundRule": "",\n      "overview": [{"e": "emoji", "t": "description"}],\n      "steps": []\n    },\n    {\n      "id": "evenings",\n      "label": "Weekday Evenings",\n      "groundRule": "",\n      "overview": null,\n      "steps": [\n        {\n          "time": "Mon",\n          "tag": "HOB",\n          "title": "",\n          "full": false,\n          "chips": ["20m active"],\n          "qty": null,\n          "body": "",\n          "storage": "20 min total",\n          "warn": null,\n          "safety": null\n        }\n      ]\n    }\n  ]\n}\n\nEvery "body" field must follow the instruction specificity rules from the system prompt: exact quantities/sizes, and inline appliance settings for TM6/HOB/OVEN steps. The "Chop Aromatics" step above is an example of the required level of detail, not literal content to reuse verbatim.`

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
        max_tokens: 8192,
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
