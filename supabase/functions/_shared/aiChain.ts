// ─── The fallback chain ───────────────────────────────────────────
// Pure orchestration (the provider calls are injected), so every hop is
// unit-tested without a network.
//
// Everyone except the owner:
//   1. Groq, on the owner's key            — the default
//   2. the user's own Gemini key, if saved  — when Groq is limited/unavailable
//   3. manual mode                          — the client's job; signalled by the
//      codes below so it can offer the Google-key flow or "carry on by hand".
// The owner gets exactly the provider they chose for the step, with no silent
// substitution — they use it to compare models, so a fallback would hide the
// thing being measured.
import { AiProviderError, shouldFallThrough } from './aiErrors.ts'
import type { Route } from './aiCatalogue.ts'

export class StepError extends Error {
  constructor(message: string, public code: string, public status = 500) {
    super(message)
  }
}

export const CHAIN_MESSAGES = {
  ai_busy: "The free AI is busy right now. Add your own free Google AI key to keep going, or fill it in by hand.",
  gemini_key_invalid: "Google didn't accept your AI key. Check it in Settings, or fill this in by hand.",
  ai_all_limited: 'Both free AI options are used up or unavailable right now. Carry on by hand and try AI again later.',
  ai_refused: 'The AI declined this one. Try different wording, or fill it in by hand.',
  ai_failed: "The AI's answer didn't come through properly. Try again, or fill it in by hand.",
}

// Groq failing on its key is the owner's problem, not the user's — move on.
const groqShouldFallThrough = (e: unknown) =>
  shouldFallThrough(e) || (e instanceof AiProviderError && e.kind === 'auth')

export function toPublicError(e: unknown): StepError {
  if (e instanceof StepError) return e
  if (e instanceof AiProviderError) {
    if (e.userMessage) return new StepError(e.userMessage, 'bad_input', 400)
    if (e.kind === 'refused') return new StepError(CHAIN_MESSAGES.ai_refused, 'ai_refused', 422)
  }
  return new StepError(CHAIN_MESSAGES.ai_failed, 'ai_failed', 502)
}

export async function runPublicChain<T>(
  attempt: (route: Route) => Promise<T>,
  groq: Route,
  gemini: Route | null,         // null when the user has no key saved
): Promise<T> {
  try {
    return await attempt(groq)
  } catch (e) {
    if (!groqShouldFallThrough(e)) throw toPublicError(e)
    if (!gemini) throw new StepError(CHAIN_MESSAGES.ai_busy, 'ai_busy', 429)
  }
  try {
    return await attempt(gemini)
  } catch (e) {
    if (e instanceof AiProviderError && e.kind === 'auth') throw new StepError(CHAIN_MESSAGES.gemini_key_invalid, 'gemini_key_invalid', 401)
    if (shouldFallThrough(e)) throw new StepError(CHAIN_MESSAGES.ai_all_limited, 'ai_all_limited', 429)
    throw toPublicError(e)
  }
}

export async function runOwnerRoute<T>(attempt: (route: Route) => Promise<T>, route: Route): Promise<T> {
  try {
    return await attempt(route)
  } catch (e) {
    if (e instanceof StepError) throw e
    // The owner sees the provider's own words — this is their debugging view.
    const detail = e instanceof Error ? e.message : String(e)
    const status = e instanceof AiProviderError && e.kind === 'limit' ? 429 : 502
    throw new StepError(`${route.provider} · ${route.model}: ${detail}`, 'owner_provider_error', status)
  }
}
