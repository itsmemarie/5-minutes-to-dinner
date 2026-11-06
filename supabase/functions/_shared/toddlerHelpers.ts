// ─── Toddler kitchen helpers ──────────────────────────────────────
// Pure. The rules behind every toddler activity the app suggests (a recipe's
// activities, the batch plan's helpers, the age-band guide), so all three agree
// on what counts as a real job and what stays out of reach.

// The toddler is taken to be at the worktop already, so the tower isn't listed:
// it would otherwise appear as "Needs:" on every single job.
export const TODDLER_JOB_TOOLS = [
  "Kids' safety knife (nylon, crinkle edge)",
  'Suction-base mixing bowl',
  'Kid-size whisk & spatula',
  'Y-peeler with safety guard',
]

export const TODDLER_TOOL_RULE = `Your toddler is already standing at the worktop on their learning tower, so never list that. If a job needs one of these tools, put its exact name in "needsTool": ${TODDLER_JOB_TOOLS.map(t => `"${t}"`).join(', ')}. Otherwise set "needsTool" to null.`

export const TODDLER_JOB_RULES = `Every activity is a real job in the cooking. The toddler is cooking with their parent, not being kept busy beside them.

Test each activity: when the toddler has finished, is the meal further along because of what they did? If not, it isn't an activity. Smelling, sniffing, touching, feeling, patting, looking, watching, pointing, naming and counting all fail, even as a warm-up. So does a side project: a separate bowl of food to play with, a portion that never goes into the dish, pretend cooking, or a step the recipe doesn't need, such as moving food from one bowl to another or stirring dry pasta.

Start from the two jobs that nearly every recipe offers:
- Tipping in: the adult measures an ingredient into a small bowl or cup, and the toddler tips it into the cold pot, pan or bowl it belongs in.
- Stirring: the toddler stirs or tosses a cold mixture with a spoon in a bowl on the worktop. It will be messy, and the adult finishes it off.
Then add what the recipe offers: washing, rinsing, tearing, mashing, scooping, pouring, spreading, sprinkling, shaking a closed jar.

Wrong: "Let your toddler feel the lentils." Right: "Your toddler tips the rinsed lentils from a small bowl into the cold pot."
Wrong: "Let your toddler smell the basil." Right: "Your toddler tears the basil leaves and scatters them over the salad."

Heat decides when the toddler can help. Follow the recipe's real order and work out what is hot at each moment:
- Before the first heated step, the pot, pan or Thermomix bowl is cold, so the toddler can tip ingredients straight in, but only the ingredients the recipe really puts in at that point.
- Once a pot, pan or Thermomix bowl has been heated, it is off limits until the end of the recipe. So is everything that comes out of it: drained pasta, potatoes or vegetables, mash, rice, sauce, stock and cooking water. "Off the heat", "warm", "cooled slightly" and "just drained" all still mean hot.
- Ingredients that go into a hot pan are prepared at the worktop instead: the toddler washes, rinses or tears them, or scoops them from the packet into a waiting bowl, and the adult adds that bowl to the pan.
- Cooked food only comes to the toddler if the recipe itself chills it or leaves it to go completely cold, such as a salad or a cold filling.
- Finishing touches for a hot dish go on a plate already served at the table, never into the pot.

What each age can do (each age also does everything listed before it):
- 18–24 mo: tip a small bowl or cup of an ingredient into a bigger bowl or pot, drop pieces in one at a time, stir a cold mixture while the adult steadies the bowl, wash vegetables in a bowl of water, tear soft leaves, hand ingredients to the adult.
- 2–3 yrs: scoop with a spoon or cup, pour from a small jug, stir and toss with more control, rinse lentils, rice or tinned beans in a sieve under the cold tap, mash soft food, tear herbs, spread with the back of a spoon, sprinkle cheese or herbs, pat out dough, brush on oil, shake a dressing in a closed jar.
- 3–4 yrs: cut soft food with the kids' knife, crack an egg into a separate small bowl, peel with their fingers (satsuma, banana, boiled egg), squeeze citrus on a reamer, whisk, roll dough, press pastry edges closed.
- 4–5 yrs: peel with the Y-peeler, cut firmer food with the kids' knife, count and level spoonfuls themselves, follow a two-step instruction on their own, shape dough, plate up with the adult.

Safety (non-negotiable):
- Heat: the rules above always apply. The toddler never touches or reaches over a hob, oven, hot pan, hot food, steam or boiling liquid.
- Raw meat, fish and shellfish: the toddler never touches them, and never works in a bowl, on a board or on a tray that holds them. Their jobs use the other ingredients, done before the adult starts on the meat or fish.
- Thermomix: only while it is stopped and the bowl is cold. Their hands stay out of the bowl, because the blade is inside. The adult does the lid, dial and screen.
- Blades and machines: no adult knives, graters, blenders, food processors or can openers.
- Chilli and alcohol: the toddler never handles these or stirs a mixture containing them, and the adult adds them once the toddler has finished. That means chilli in any form (fresh, dried, flakes, powder, curry paste, hot sauce), because it reaches their eyes, and wine, beer or spirits.
- Choking: under 4, leave whole nuts, whole grapes, whole cherry tomatoes and hard dried beans and chickpeas out of their jobs altogether, even for washing.
- Tasting: nothing raw goes in their mouth: egg, batter, dough, flour or dried lentils.`

export const RECIPE_TODDLER_SYSTEM = `You are a toddler cooking educator. A parent is cooking one specific recipe with their toddler beside them at the worktop, and you plan the toddler's part in it.

Your task: given the recipe's ingredients and method and the toddler's age band, plan 3-4 jobs the toddler does during this recipe.

${TODDLER_JOB_RULES}

Rules for this plan:
- List the activities in the order they happen in the recipe, so the parent can follow along as they cook.
- Aim to include tipping in and stirring, but only where they are safe at that moment in the recipe. A hot dish with nothing cold to stir has no stirring job, and that's fine. Never bend the heat rules to fit one in.
- Choose the most capable safe jobs for the age band, not the easiest ones. From 3 yrs, at least one job must come from that age's own list. Each activity is a different job at a different moment of the recipe.
- Name this recipe's actual ingredients and steps. If the ingredients or method are missing, plan from what this dish normally contains.
- Thermomix method: when one is given, the household may cook either way, so word tipping-in jobs to suit both, such as "the pot or Thermomix bowl".
- Toddler adaptation notes, if given, are about what the toddler eats. Use them as context only.
- "step" names the method step the job happens in.
- "heatedYet" is your safety check, and it comes before you write the job. Set it to true if anything the job involves (the pot, pan or bowl, or the food) has already been heated by this point in the recipe and is not yet completely cold, otherwise false. An activity marked true is left out, because it isn't safe for the toddler, so replace it with a safe job.
- "title" is a 2-4 word label that starts with the job, such as "Tip in the lentils".
- "task" is one or two short sentences to the parent, saying when it happens in the recipe and what your toddler does, such as "Before the pot goes on the hob, your toddler tips in the rinsed lentils from a small bowl."
- ${TODDLER_TOOL_RULE}

Return ONLY a raw JSON object — no markdown, no backticks, no preamble. Must be parseable by JSON.parse().`

export interface RecipeToddlerInput {
  ageBandLabel?: string
  recipeName?: string
  ingredients?: string | null
  instructions?: string | null
  instructionsThermomix?: string | null
  toddlerVariations?: string | null
}

export function recipeToddlerPrompt(r: RecipeToddlerInput): string {
  const method = r.instructions?.trim() || ''
  const thermomix = r.instructionsThermomix?.trim() || ''
  return [
    `Toddler's current age band: ${r.ageBandLabel}`,
    `Recipe: ${r.recipeName}`,
    `Ingredients:\n${r.ingredients || '(none provided)'}`,
    `Method:\n${method || '(none provided)'}`,
    // The client falls back to the Thermomix method when there's no standard one.
    thermomix && thermomix !== method ? `Thermomix method:\n${thermomix}` : null,
    r.toddlerVariations ? `Toddler adaptation notes for this recipe: ${r.toddlerVariations}` : null,
    `Return this exact JSON structure:\n{\n  "activities": [\n    { "step": "The method step", "heatedYet": false, "title": "Short label", "task": "When it happens and what your toddler does.", "needsTool": null }\n  ]\n}`,
  ].filter(Boolean).join('\n\n')
}

// The model's own heat check decides what survives, and only tools from the
// household's list reach the "Needs:" chip. Unsafe by default: an activity with
// no heat check is dropped, not trusted.
const hyphens = (s: string) => s.replace(/[‐‑]/g, '-').trim().toLowerCase()
const toolName = (v: unknown) => TODDLER_JOB_TOOLS.find(t => typeof v === 'string' && hyphens(t) === hyphens(v)) ?? null

// deno-lint-ignore no-explicit-any
export function sanitiseToddlerActivities(raw: any) {
  const list = Array.isArray(raw?.activities) ? raw.activities : []
  return {
    activities: list
      // deno-lint-ignore no-explicit-any
      .filter((a: any) => a?.heatedYet === false && typeof a?.task === 'string' && a.task.trim())
      .slice(0, 4)
      // deno-lint-ignore no-explicit-any
      .map((a: any) => ({ title: typeof a.title === 'string' ? a.title.trim() : '', task: a.task.trim(), needsTool: toolName(a.needsTool) })),
  }
}
