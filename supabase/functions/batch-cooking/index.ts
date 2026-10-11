import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { aiHandler, aiResponse, runAiStep } from '../_shared/router.ts'

// Before kitchen equipment was a setting, every plan assumed this kitchen.
const DEFAULT_EQUIPMENT = ['Thermomix TM6', 'Oven', 'Hob']

const SYSTEM_PROMPT = `You are an expert batch cooking planner for a home kitchen. The household's equipment is listed in the user message: plan only with what they have.

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
- If they have a Thermomix (TM6), use it for aromatics first (sequential, no washing between)
- Run parallel tasks where possible (oven + TM6 simultaneously)

Instruction specificity (non-negotiable):
- Never write a vague instruction. Every step's "body" must be fully self-contained and concrete: state the exact quantity and size/descriptor for anything being prepped, e.g. "Cut 4 medium size onions into 1cm dice" — never a bare "Chop onions" or "Prep veg".
- Every step tagged TM6 must include the exact appliance setting inline, in parentheses, inside the "body" text itself, e.g. "Cut 4 medium size onions (TM6 instructions: speed 10, time 3 sec)." This must match the values also given in "chips" — the body text must stand on its own even if chips are not shown.
- Do the same for HOB/OVEN steps where relevant: state exact heat/time, e.g. "Roast at 200°C Fan for 35 minutes, tossing at the halfway point."

Portion scaling (non-negotiable):
- Each meal in the plan states the portions actually being cooked and the portions its recipe was written for. Every quantity you write in "qty" and "body" must be scaled to the portions ACTUALLY BEING COOKED, not the recipe's own base.
- Where the same ingredient is prepped once for several meals, sum the scaled amounts across those meals and state the combined quantity.
- Scale only food quantities. Never scale cooking times, oven temperatures, Thermomix speeds or settings, pan and dish sizes, or resting/chilling times.

Food safety (non-negotiable):
- Cooked rice: 1 day max
- Cooked meat/stews: 3 days max
- Roasted veg: 3-4 days
- Raw marinated meat: 1-2 days
- Cooked fish: 2 days

Appliance tags: TM6, HOB, OVEN, KNIFE, NO_COOK, DONE

Toddler helpers (non-negotiable):
- After the sessions, also return one top-level "toddlerActivities" array of 3-6 items: safe, concrete jobs a toddler can do DURING these batch sessions, each referencing actual prep that appears in the steps above (e.g. "wash the potatoes you diced in the Monday session", "tear the basil for the sauce", "stir the cold marinade", "spoon the cooled stew into storage tubs", "press the labels onto the containers").
- Age-appropriate for the toddler age band given in the user message — simpler and more supervised for younger bands, more independent for older bands.
- Never involve hot surfaces, the hob, ovens, boiling liquids, raw meat, raw fish, or adult knives.
- "title" is a short 2-4 word label; "task" is one concrete sentence. If an activity needs a tool, set "needsTool" to ONLY one of: "Kids' safety knife (nylon, crinkle edge)", "Learning tower or sturdy step stool", "Suction-base mixing bowl", "Kid-size whisk & spatula", "Y-peeler with safety guard". Otherwise null. Pick a fitting emoji for "icon".

Return ONLY a raw JSON object — no markdown, no backticks, no preamble. Must be parseable by JSON.parse().`

Deno.serve(aiHandler(async (req, body) => {
  const { meals, ageBandLabel } = body
  const equipment: string[] = Array.isArray(body.equipment) && body.equipment.length ? body.equipment.map(String) : DEFAULT_EQUIPMENT

  // Each meal carries the portions actually being cooked plus the portions the
  // recipe is written for. Quantities in the schedule must reflect the former.
  // deno-lint-ignore no-explicit-any
  const describe = (label: string) => (m: any) => {
    const portion = m?.portion, base = m?.base
    const scale = portion && base ? ` — cooking ${portion} portions, recipe written for ${base} (scale ${(portion / base).toFixed(2)}x)` : ''
    return `${label}: ${m.name}${scale}`
  }

  const mealSummary = Object.entries(meals ?? {})
    // deno-lint-ignore no-explicit-any
    .map(([day, sections]: [string, any]) => {
      const items = [
        ...(sections.breakfast || []).map(describe('breakfast')),
        ...(sections.main || []).map(describe('main')),
        ...(sections.side || []).map(describe('side')),
      ]
      return items.length ? `${day}:\n  ${items.join('\n  ')}` : null
    })
    .filter(Boolean)
    .join('\n')

  const userPrompt = `Weekly meal plan:\n${mealSummary}\n\nKitchen equipment: ${equipment.join(', ')}. Only use appliances on this list, and only tag a step TM6 if a Thermomix is listed. If a meal really needs an appliance they don't have, say so in that step's "warn" with a workaround.\n\nToddler age band (for the toddlerActivities): ${ageBandLabel || '2–3 yrs'}\n\nGenerate a batch cooking schedule with this exact JSON structure:\n{\n  "sessions": [\n    {\n      "id": "big",\n      "label": "Monday · 2 hrs",\n      "groundRule": "",\n      "overview": [{"e": "emoji", "t": "description"}],\n      "steps": [\n        {\n          "time": "0:00",\n          "tag": "OVEN",\n          "title": "",\n          "full": false,\n          "chips": ["200°C Fan"],\n          "qty": null,\n          "body": "",\n          "storage": null,\n          "warn": null,\n          "safety": null\n        },\n        {\n          "time": "0:05",\n          "tag": "TM6",\n          "title": "Chop Aromatics",\n          "full": false,\n          "chips": ["3s", "Speed 10"],\n          "qty": "4 medium onions, 4 garlic cloves",\n          "body": "Cut 4 medium size onions and 4 garlic cloves into rough chunks (TM6 instructions: speed 10, time 3 sec).",\n          "storage": null,\n          "warn": null,\n          "safety": null\n        }\n      ]\n    },\n    {\n      "id": "medium",\n      "label": "Thursday · 1 hr",\n      "groundRule": "",\n      "overview": [{"e": "emoji", "t": "description"}],\n      "steps": []\n    },\n    {\n      "id": "evenings",\n      "label": "Weekday Evenings",\n      "groundRule": "",\n      "overview": null,\n      "steps": [\n        {\n          "time": "Mon",\n          "tag": "HOB",\n          "title": "",\n          "full": false,\n          "chips": ["20m active"],\n          "qty": null,\n          "body": "",\n          "storage": "20 min total",\n          "warn": null,\n          "safety": null\n        }\n      ]\n    }\n  ],\n  "toddlerActivities": [\n    { "icon": "🥔", "title": "Short label", "task": "One concrete sentence tied to a step above.", "needsTool": null }\n  ]\n}\n\nEvery "body" field must follow the instruction specificity rules from the system prompt: exact quantities/sizes, and inline appliance settings for TM6/HOB/OVEN steps. The "Chop Aromatics" step above is an example of the required level of detail, not literal content to reuse verbatim. "toddlerActivities" must follow the Toddler helpers rules: 3-6 items, each tied to real prep in the steps, age-appropriate, never near heat or blades.`

  const { data, meta } = await runAiStep(req, 'batch_cooking', { system: SYSTEM_PROMPT, user: userPrompt })
  return aiResponse(data, meta)
}))
