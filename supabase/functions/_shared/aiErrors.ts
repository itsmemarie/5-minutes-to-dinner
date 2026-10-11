// ─── Provider errors ──────────────────────────────────────────────
// Every provider failure is reduced to one of a few kinds, because that is all
// the fallback chain needs to know:
//   limit       → rate/quota exhausted: try the next provider in the chain
//   unavailable → provider down, key missing, network: also try the next one
//   auth        → the key was rejected (only meaningful for a user's own key)
//   refused     → the model declined the request
//   bad_output  → it answered, but not with usable JSON / it ran out of room
//   bad_request → our request was wrong (too many images, bad model id …)
export type AiErrorKind = 'limit' | 'unavailable' | 'auth' | 'refused' | 'bad_output' | 'bad_request'

export class AiProviderError extends Error {
  constructor(
    public provider: string,
    public kind: AiErrorKind,
    message: string,
    public status?: number,
    // Set when the message is fit to show anyone (e.g. "Up to 3 photos").
    public userMessage?: string,
  ) {
    super(message)
  }
}

// Keep provider error bodies out of user-facing text — they can be long and
// occasionally echo request details. A short, trimmed excerpt is enough for the
// owner's debugging view.
export const excerpt = (s: string, n = 160) => s.replace(/\s+/g, ' ').trim().slice(0, n)

export function classifyHttpError(provider: string, status: number, body: string): AiProviderError {
  const text = body.toLowerCase()
  const looksLikeLimit =
    status === 429 ||
    text.includes('rate_limit') || text.includes('rate limit') ||
    text.includes('resource_exhausted') || text.includes('quota') ||
    (status === 413 && text.includes('tokens per minute'))
  if (looksLikeLimit) return new AiProviderError(provider, 'limit', `${provider} limit reached`, status)
  if (status === 401 || status === 403 || text.includes('api_key_invalid') || text.includes('api key not valid')) {
    return new AiProviderError(provider, 'auth', `${provider} rejected the API key`, status)
  }
  if (status >= 500 || status === 408) return new AiProviderError(provider, 'unavailable', `${provider} is unavailable (${status})`, status)
  // A retired model (Groq shut qwen3.6 down in Sep 2026) is an outage for the
  // user, not a bad request — let the chain move on.
  if (status === 404 || text.includes('model_not_found') || text.includes('decommissioned')) {
    return new AiProviderError(provider, 'unavailable', `${provider} model unavailable: ${excerpt(body)}`, status)
  }
  return new AiProviderError(provider, 'bad_request', `${provider} error ${status}: ${excerpt(body)}`, status)
}

// The chain moves on to the next provider for these; anything else is a real
// answer (or a real bug) and is reported as-is.
export const shouldFallThrough = (e: unknown) =>
  e instanceof AiProviderError && (e.kind === 'limit' || e.kind === 'unavailable')
