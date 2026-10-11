// ─── Provider clients ─────────────────────────────────────────────
// One call shape for all three providers. Each returns the reply text plus
// token counts (for the owner's comparison view) or throws AiProviderError.
import Anthropic from 'npm:@anthropic-ai/sdk@^0.133.0'
import { AiProviderError, classifyHttpError, excerpt } from './aiErrors.ts'
import {
  type Effort, GROQ_MAX_IMAGES, claudeSupportsEffort, claudeSupportsServerFallback,
  geminiThinkingOff, groqReasoningParams,
} from './aiCatalogue.ts'

export interface AiImage { base64: string; mediaType?: string }
export interface AiCall {
  model: string
  system: string
  user: string
  images?: AiImage[]
  maxTokens: number
  temperature: number
  json: boolean                          // ask for a JSON object back
  schema?: Record<string, unknown>       // Claude structured outputs, when the step has one
  groqReasoning?: Effort
  claudeEffort: Effort
}
export interface AiReply { text: string; tokensIn: number | null; tokensOut: number | null }

const clean = (k: string | undefined) => (k ?? '').replace(/[^\x20-\x7E]/g, '').trim()
export const GROQ_KEY = clean(Deno.env.get('GROQ_API_KEY'))
export const ANTHROPIC_KEY = clean(Deno.env.get('ANTHROPIC_API_KEY'))

async function postJson(provider: string, url: string, headers: Record<string, string>, body: unknown) {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  } catch (e) {
    throw new AiProviderError(provider, 'unavailable', `${provider} could not be reached: ${e instanceof Error ? e.message : e}`)
  }
  if (!res.ok) throw classifyHttpError(provider, res.status, await res.text())
  return res.json()
}

// ── Groq (OpenAI-compatible) ──────────────────────────────────────
export async function callGroq(c: AiCall): Promise<AiReply> {
  if (!GROQ_KEY) throw new AiProviderError('groq', 'unavailable', 'GROQ_API_KEY is not set on this project')
  const images = c.images ?? []
  if (images.length > GROQ_MAX_IMAGES) {
    const msg = `Up to ${GROQ_MAX_IMAGES} photos at a time, please.`
    throw new AiProviderError('groq', 'bad_request', msg, 400, msg)
  }
  const userContent = images.length
    ? [
        ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mediaType ?? 'image/jpeg'};base64,${img.base64}` } })),
        { type: 'text', text: c.user },
      ]
    : c.user
  const data = await postJson('groq', 'https://api.groq.com/openai/v1/chat/completions', { Authorization: `Bearer ${GROQ_KEY}` }, {
    model: c.model,
    max_tokens: c.maxTokens,
    temperature: c.temperature,
    ...groqReasoningParams(c.model, c.groqReasoning),
    // JSON mode isn't used with images: the vision model handles it less reliably
    // than a plain instruction, and parseModelJson copes with either.
    ...(c.json && !images.length ? { response_format: { type: 'json_object' } } : {}),
    messages: [{ role: 'system', content: c.system }, { role: 'user', content: userContent }],
  })
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    tokensIn: data.usage?.prompt_tokens ?? null,
    tokensOut: data.usage?.completion_tokens ?? null,
  }
}

// ── Gemini (a user's own key, or the owner's when they pick it) ──────
export async function callGemini(key: string, c: AiCall): Promise<AiReply> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`
  const parts = [
    ...(c.images ?? []).map(img => ({ inlineData: { mimeType: img.mediaType ?? 'image/jpeg', data: img.base64 } })),
    { text: c.user },
  ]
  const data = await postJson('gemini', url, { 'x-goog-api-key': key }, {
    systemInstruction: { parts: [{ text: c.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: c.maxTokens,
      temperature: c.temperature,
      ...(c.json ? { responseMimeType: 'application/json' } : {}),
      ...(geminiThinkingOff(c.model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  })
  const cand = data.candidates?.[0]
  if (!cand) {
    const reason = data.promptFeedback?.blockReason
    throw new AiProviderError('gemini', reason ? 'refused' : 'bad_output', reason ? `Gemini declined the request (${reason})` : 'Gemini returned no answer')
  }
  if (cand.finishReason === 'SAFETY') throw new AiProviderError('gemini', 'refused', 'Gemini declined the request')
  const text = (cand.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
  if (cand.finishReason === 'MAX_TOKENS' && !text) throw new AiProviderError('gemini', 'bad_output', 'Gemini ran out of room for its answer')
  return {
    text,
    tokensIn: data.usageMetadata?.promptTokenCount ?? null,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? null,
  }
}

// ── Claude (owner only, on the owner's Anthropic key) ─────────────
let anthropic: Anthropic | null = null
const claudeClient = () => (anthropic ??= new Anthropic({ apiKey: ANTHROPIC_KEY, maxRetries: 1, timeout: 140_000 }))

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const CLAUDE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export async function callClaude(c: AiCall): Promise<AiReply> {
  if (!ANTHROPIC_KEY) throw new AiProviderError('claude', 'unavailable', 'ANTHROPIC_API_KEY is not set on this project')
  const content: Anthropic.ContentBlockParam[] = [
    ...(c.images ?? []).map(img => {
      const mediaType = (CLAUDE_IMAGE_TYPES.has(img.mediaType ?? '') ? img.mediaType : 'image/jpeg') as ImageMediaType
      return { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: img.base64 } }
    }),
    { type: 'text', text: c.user },
  ]
  const outputConfig: Record<string, unknown> = {}
  if (claudeSupportsEffort(c.model)) outputConfig.effort = c.claudeEffort
  if (c.schema) outputConfig.format = { type: 'json_schema', schema: c.schema }

  // Thinking is adaptive (always on for current Claude models) and its tokens
  // count against max_tokens, so Claude gets headroom the other providers don't
  // need. No temperature: current Claude models reject sampling params.
  const params = {
    model: c.model,
    max_tokens: 16000,
    system: c.json && !c.schema ? `${c.system}\n\nReply with the JSON only.` : c.system,
    messages: [{ role: 'user' as const, content }],
    ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
  }

  // The casts: `fallbacks: "default"` and `output_config` are newer than some
  // SDK typings, and the params are assembled conditionally above.
  let msg: Anthropic.Message | Anthropic.Beta.BetaMessage
  try {
    msg = claudeSupportsServerFallback(c.model)
      // Server-side refusal fallback: a policy decline is re-run on Anthropic's
      // recommended fallback model inside the same call.
      ? await claudeClient().beta.messages.create({
          ...params,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        } as never)
      : await claudeClient().messages.create(params as never)
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiProviderError('claude', 'limit', 'Claude rate limit reached', 429)
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new AiProviderError('claude', 'auth', 'Claude rejected the API key', e.status)
    }
    if (e instanceof Anthropic.BadRequestError) throw new AiProviderError('claude', 'bad_request', `Claude: ${excerpt(e.message)}`, 400)
    if (e instanceof Anthropic.APIConnectionError) throw new AiProviderError('claude', 'unavailable', 'Claude could not be reached')
    if (e instanceof Anthropic.APIError) {
      const kind = e.status === 529 || (e.status ?? 0) >= 500 ? 'unavailable' : 'bad_request'
      throw new AiProviderError('claude', kind, `Claude error ${e.status}: ${excerpt(e.message)}`, e.status)
    }
    throw e
  }

  if (msg.stop_reason === 'refusal') throw new AiProviderError('claude', 'refused', 'Claude declined this request')
  const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('')
  if (msg.stop_reason === 'max_tokens' && !text.trim()) throw new AiProviderError('claude', 'bad_output', 'Claude ran out of room for its answer')
  return { text, tokensIn: msg.usage?.input_tokens ?? null, tokensOut: msg.usage?.output_tokens ?? null }
}
