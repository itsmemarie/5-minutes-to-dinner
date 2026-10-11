// ─── AI step & model catalogue ────────────────────────────────────
// Pure data + rules, no Deno or network APIs, so it is unit-tested from the
// app's vitest run. Every AI call in the app is one of these steps; the router
// (router.ts) picks a provider/model per step:
//   • owner  → their saved choice for the step, else Claude (CLAUDE_DEFAULT_MODEL)
//   • others → Groq on the owner's key, then the user's own Gemini key, then
//              manual mode (the client handles that last hop).

export type Provider = 'claude' | 'groq' | 'gemini'
export type Effort = 'low' | 'medium' | 'high'

export interface StepDef {
  id: string
  label: string
  group: 'Recipes' | 'Freezer' | 'Planning' | 'Shopping' | 'Toddler'
  vision?: boolean            // may receive photos
  maxTokens: number           // output cap for Groq / Gemini
  temperature: number         // Groq / Gemini only — current Claude models reject sampling params
  groqModel: string           // default for everyone who isn't the owner
  groqReasoning?: Effort      // gpt-oss hidden reasoning; lower = fewer billed tokens
  claudeEffort: Effort        // owner default on Claude
}

export const GROQ_TEXT_MODEL = 'openai/gpt-oss-120b'
// qwen/qwen3.6-27b was shut down on 2026-09-14; this is Groq's replacement and
// its only vision model. Max 3 images per request.
export const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b'
export const GROQ_MAX_IMAGES = 3
export const CLAUDE_DEFAULT_MODEL = 'claude-opus-5-5'
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash'

const step = (d: StepDef) => d
export const STEPS: Record<string, StepDef> = {
  recipe_extract:  step({ id: 'recipe_extract',  label: 'Read a recipe (step 1)',            group: 'Recipes',  vision: true, maxTokens: 3000, temperature: 0,   groqModel: GROQ_TEXT_MODEL, groqReasoning: 'low',    claudeEffort: 'low' }),
  recipe_complete: step({ id: 'recipe_complete', label: 'Fill in missing details (step 2)',  group: 'Recipes',  maxTokens: 2500, temperature: 0.3, groqModel: GROQ_TEXT_MODEL, groqReasoning: 'low',    claudeEffort: 'medium' }),
  recipe_review:   step({ id: 'recipe_review',   label: 'Expert review (step 3)',            group: 'Recipes',  maxTokens: 2500, temperature: 0.2, groqModel: GROQ_TEXT_MODEL, groqReasoning: 'medium', claudeEffort: 'high' }),
  recipe_generate: step({ id: 'recipe_generate', label: 'Create a recipe from a description', group: 'Recipes', maxTokens: 4096, temperature: 0.7, groqModel: GROQ_TEXT_MODEL, groqReasoning: 'medium', claudeEffort: 'medium' }),
  freezer_extract: step({ id: 'freezer_extract', label: 'Read a freezer list photo',         group: 'Freezer',  vision: true, maxTokens: 1500, temperature: 0,   groqModel: GROQ_VISION_MODEL,                       claudeEffort: 'low' }),
  shopping_list:   step({ id: 'shopping_list',   label: 'Shopping list',                     group: 'Shopping', maxTokens: 4096, temperature: 0.2, groqModel: GROQ_TEXT_MODEL, groqReasoning: 'low',    claudeEffort: 'low' }),
  buyers_eye:      step({ id: 'buyers_eye',      label: "Buyer's Eye produce tips",          group: 'Shopping', maxTokens: 700,  temperature: 0.3, groqModel: GROQ_TEXT_MODEL, groqReasoning: 'low',    claudeEffort: 'low' }),
  nutrition:       step({ id: 'nutrition',       label: 'Nutrition insights',                group: 'Planning', maxTokens: 2048, temperature: 0.2, groqModel: GROQ_TEXT_MODEL, groqReasoning: 'medium', claudeEffort: 'medium' }),
  batch_cooking:   step({ id: 'batch_cooking',   label: 'Batch cooking plan',                group: 'Planning', maxTokens: 8192, temperature: 0.2, groqModel: GROQ_TEXT_MODEL, groqReasoning: 'medium', claudeEffort: 'medium' }),
  toddler_guide:   step({ id: 'toddler_guide',   label: 'Toddler cooking guide',             group: 'Toddler',  maxTokens: 4096, temperature: 0.4, groqModel: GROQ_TEXT_MODEL, groqReasoning: 'low',    claudeEffort: 'low' }),
  recipe_toddler:  step({ id: 'recipe_toddler',  label: 'Toddler activities for a recipe',   group: 'Toddler',  maxTokens: 900,  temperature: 0.5, groqModel: GROQ_TEXT_MODEL, groqReasoning: 'low',    claudeEffort: 'low' }),
}

export interface ModelPreset { id: string; label: string; vision?: boolean }
export const MODEL_PRESETS: Record<Provider, ModelPreset[]> = {
  claude: [
    { id: 'claude-opus-5-5',   label: 'Opus 5.5' },
    { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
    { id: 'claude-haiku-5-5',  label: 'Haiku 5.5' },
    { id: 'claude-fable-5-1',  label: 'Fable 5.1' },
  ],
  groq: [
    { id: 'openai/gpt-oss-120b',     label: 'GPT-OSS 120B' },
    { id: 'openai/gpt-oss-20b',      label: 'GPT-OSS 20B' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: GROQ_VISION_MODEL,         label: 'Qwen 3.8 27B (vision)', vision: true },
  ],
  gemini: [
    { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
    { id: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro' },
  ],
}
export const PROVIDERS: Provider[] = ['claude', 'groq', 'gemini']

export interface Route { provider: Provider; model: string }

export const isStep = (id: unknown): id is string => typeof id === 'string' && Object.hasOwn(STEPS, id)
export const defaultOwnerRoute = (_stepId: string): Route => ({ provider: 'claude', model: CLAUDE_DEFAULT_MODEL })
export const defaultPublicRoute = (stepId: string): Route => ({ provider: 'groq', model: STEPS[stepId].groqModel })

// Custom ids are allowed so the owner can try a model released after this list
// was written; this only keeps obvious junk out of the database.
export const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._\-\/:]{1,79}$/

export function validateChoice(stepId: unknown, provider: unknown, model: unknown): string | null {
  if (!isStep(stepId)) return 'Unknown AI step.'
  if (!PROVIDERS.includes(provider as Provider)) return 'Unknown provider.'
  if (typeof model !== 'string' || !MODEL_ID_RE.test(model)) return 'That model id doesn\'t look right.'
  if (provider === 'claude' && !model.startsWith('claude-')) return 'Claude model ids start with "claude-".'
  if (provider === 'gemini' && !model.startsWith('gemini-')) return 'Gemini model ids start with "gemini-".'
  return null
}

// Groq serves one vision model; a photo request on a text-only choice is moved
// onto it rather than failing.
export const isGroqVisionModel = (model: string) =>
  model === GROQ_VISION_MODEL || MODEL_PRESETS.groq.some(p => p.id === model && p.vision)
export const groqModelFor = (model: string, hasImages: boolean) =>
  hasImages && !isGroqVisionModel(model) ? GROQ_VISION_MODEL : model

// ── Per-model request options ─────────────────────────────────────
// Server-side refusal fallback (`fallbacks: "default"`) exists for these
// models on the Claude API; Haiku has none.
const CLAUDE_SERVER_FALLBACK = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-1'])
export const claudeSupportsServerFallback = (model: string) => CLAUDE_SERVER_FALLBACK.has(model)
// `output_config.effort` — current families only; older ids would 400 on it.
export const claudeSupportsEffort = (model: string) =>
  /^claude-(opus|sonnet|haiku|fable|mythos)-5/.test(model) || /^claude-opus-4-[5-8]$/.test(model) || model === 'claude-sonnet-4-6'

// gpt-oss exposes a reasoning effort; Qwen 3 takes 'none' to skip thinking.
export function groqReasoningParams(model: string, effort?: Effort): Record<string, unknown> {
  if (model.startsWith('openai/gpt-oss')) return { reasoning_effort: effort ?? 'low', include_reasoning: false }
  if (model.startsWith('qwen/')) return { reasoning_effort: 'none' }
  return {}
}

// Gemini 2.5 Flash / Flash-Lite think by default; a zero budget turns that off.
// Pro can't disable thinking, and 3.x uses a different control, so leave those.
export const geminiThinkingOff = (model: string) => /^gemini-2\.5-flash/.test(model)

// What the Settings › AI models screen needs to draw itself.
export function catalogueForClient() {
  return {
    steps: Object.values(STEPS).map(s => ({ id: s.id, label: s.label, group: s.group, vision: !!s.vision, groqModel: s.groqModel })),
    presets: MODEL_PRESETS,
    defaults: { owner: { provider: 'claude', model: CLAUDE_DEFAULT_MODEL }, groqVision: GROQ_VISION_MODEL, gemini: GEMINI_DEFAULT_MODEL },
  }
}
