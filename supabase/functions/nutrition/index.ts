import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { aiHandler, aiResponse, badInput, runAiStep } from '../_shared/router.ts'

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

Deno.serve(aiHandler(async (req, body) => {
  const { profile, meals, weekOf, region } = body
  const mealSummary = (Array.isArray(meals) ? meals : [])
    .filter((m: { name?: string }) => m.name)
    .map((m: { day: string; section: string; name: string; portion: number }) => `${m.day} ${m.section}: ${m.name} (${m.portion} portions)`)
    .join('\n')
  if (!mealSummary) throw badInput('Add some meals to the planner first.')

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

  const { data, meta } = await runAiStep(req, 'nutrition', { system: SYSTEM_PROMPT, user: userPrompt })
  return aiResponse(data, meta)
}))
