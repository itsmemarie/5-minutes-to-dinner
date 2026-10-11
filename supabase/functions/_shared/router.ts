// ─── AI step router ───────────────────────────────────────────────
// Every AI edge function calls `runAiStep` with a step id from the catalogue
// and a prompt; this decides who answers (see aiChain.ts) and parses the JSON.
// Functions are wrapped in `aiHandler` for CORS, body parsing and errors.
import {
  GEMINI_DEFAULT_MODEL, STEPS, type Route, defaultOwnerRoute, defaultPublicRoute, groqModelFor,
} from './aiCatalogue.ts'
import { AiProviderError } from './aiErrors.ts'
import { StepError, runOwnerRoute, runPublicChain } from './aiChain.ts'
import { ANTHROPIC_KEY, type AiCall, type AiImage, callClaude, callGemini, callGroq } from './providers.ts'
import { parseModelJson } from './json.ts'
import { getCaller, serviceClient } from './auth.ts'
import { json, jsonError, preflight } from './http.ts'

export { StepError }

// The model a user's own Google key runs on. Overridable without a redeploy of
// the client if Google retires it.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL')?.trim() || GEMINI_DEFAULT_MODEL

export interface StepInput {
  system: string
  user: string
  images?: AiImage[]
  schema?: Record<string, unknown>
  json?: boolean                // default true
}
export interface StepMeta {
  step: string; provider: string; model: string; ms: number
  tokensIn: number | null; tokensOut: number | null
}

// A user's own Google key, sent per request from their device. Never stored or
// logged here.
export function userGeminiKey(req: Request): string | null {
  const k = (req.headers.get('x-gemini-key') ?? '').trim()
  return /^[A-Za-z0-9_\-]{20,100}$/.test(k) ? k : null
}

async function ownerRoute(stepId: string): Promise<Route> {
  const { data, error } = await serviceClient()
    .from('ai_model_choices').select('provider, model').eq('step', stepId).maybeSingle()
  if (error) console.error('ai_model_choices read failed', error.message)
  if (data) return { provider: data.provider, model: data.model }
  // No Claude key set (it's optional): the owner uses the same free Groq
  // default as everyone else until they pick a model for the step.
  return ANTHROPIC_KEY ? defaultOwnerRoute(stepId) : defaultPublicRoute(stepId)
}

export async function runAiStep(req: Request, stepId: string, input: StepInput): Promise<{ data: unknown; meta: StepMeta }> {
  const step = STEPS[stepId]
  if (!step) throw new StepError(`Unknown AI step ${stepId}`, 'ai_failed', 500)
  const geminiKey = userGeminiKey(req)
  const hasImages = !!input.images?.length
  const call: AiCall = {
    model: '',
    system: input.system,
    user: input.user,
    images: input.images,
    maxTokens: step.maxTokens,
    temperature: step.temperature,
    json: input.json ?? true,
    schema: input.schema,
    groqReasoning: step.groqReasoning,
    claudeEffort: step.claudeEffort,
  }

  const attempt = async (route: Route) => {
    const model = route.provider === 'groq' ? groqModelFor(route.model, hasImages) : route.model
    const started = Date.now()
    let reply
    if (route.provider === 'claude') reply = await callClaude({ ...call, model })
    else if (route.provider === 'groq') reply = await callGroq({ ...call, model })
    else if (geminiKey) reply = await callGemini(geminiKey, { ...call, model })
    else throw new AiProviderError('gemini', 'unavailable', 'Gemini needs a Google AI key saved on this device (Settings › Free Google AI key)')

    let data: unknown = reply.text
    if (call.json) {
      data = parseModelJson(reply.text)
      if (data === undefined) throw new AiProviderError(route.provider, 'bad_output', "The AI's reply wasn't valid JSON")
    }
    const meta: StepMeta = { step: stepId, provider: route.provider, model, ms: Date.now() - started, tokensIn: reply.tokensIn, tokensOut: reply.tokensOut }
    return { data, meta }
  }

  const caller = await getCaller(req)
  if (caller.isOwner) return runOwnerRoute(attempt, await ownerRoute(stepId))
  return runPublicChain(attempt, defaultPublicRoute(stepId), geminiKey ? { provider: 'gemini', model: GEMINI_MODEL } : null)
}

export function aiResponse(data: unknown, meta: StepMeta) {
  return json(data, {
    headers: {
      'x-ai-step': meta.step,
      'x-ai-provider': meta.provider,
      'x-ai-model': meta.model,
      'x-ai-ms': String(meta.ms),
      'x-ai-tokens-in': meta.tokensIn == null ? '' : String(meta.tokensIn),
      'x-ai-tokens-out': meta.tokensOut == null ? '' : String(meta.tokensOut),
    },
  })
}

// deno-lint-ignore no-explicit-any
type Body = Record<string, any>

// CORS preflight, POST + JSON body, and one error format for every function.
export function aiHandler(fn: (req: Request, body: Body) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return preflight()
    if (req.method !== 'POST') return jsonError('Use POST', 'bad_input', 405)
    let body: Body
    try { body = await req.json() } catch { return jsonError('The request body must be JSON', 'bad_input', 400) }
    try {
      return await fn(req, body ?? {})
    } catch (e) {
      if (e instanceof StepError) return jsonError(e.message, e.code, e.status)
      console.error(e)
      return jsonError('Something went wrong. Try again, or fill it in by hand.', 'ai_failed', 500)
    }
  }
}

export const badInput = (message: string) => new StepError(message, 'bad_input', 400)
