import { describe, expect, it } from 'vitest'
import { StepError, runOwnerRoute, runPublicChain } from './aiChain.ts'
import { AiProviderError, classifyHttpError } from './aiErrors.ts'
import type { Route } from './aiCatalogue.ts'

const GROQ: Route = { provider: 'groq', model: 'openai/gpt-oss-120b' }
const GEMINI: Route = { provider: 'gemini', model: 'gemini-2.5-flash' }
const limit = (p: string) => new AiProviderError(p, 'limit', `${p} limit`, 429)

// A fake provider: each route either answers or throws the given error.
const fake = (outcomes: Record<string, unknown>) => {
  const calls: string[] = []
  const attempt = async (r: Route) => {
    calls.push(r.provider)
    const o = outcomes[r.provider]
    if (o instanceof Error) throw o
    return o
  }
  return { attempt, calls }
}

const codeOf = async (p: Promise<unknown>) => {
  try { await p } catch (e) { return (e as StepError).code }
  return 'resolved'
}

describe('public fallback chain', () => {
  it('uses Groq when it answers, and never touches the user key', async () => {
    const f = fake({ groq: 'from groq' })
    expect(await runPublicChain(f.attempt, GROQ, GEMINI)).toBe('from groq')
    expect(f.calls).toEqual(['groq'])
  })

  it('falls back to the user\'s Gemini key when Groq is limited', async () => {
    const f = fake({ groq: limit('groq'), gemini: 'from gemini' })
    expect(await runPublicChain(f.attempt, GROQ, GEMINI)).toBe('from gemini')
    expect(f.calls).toEqual(['groq', 'gemini'])
  })

  it('also falls back when Groq is down or its key is broken', async () => {
    for (const err of [new AiProviderError('groq', 'unavailable', 'down'), new AiProviderError('groq', 'auth', 'bad key')]) {
      const f = fake({ groq: err, gemini: 'ok' })
      expect(await runPublicChain(f.attempt, GROQ, GEMINI)).toBe('ok')
    }
  })

  it('asks for a Google key (ai_busy) when Groq is limited and there is none', async () => {
    const f = fake({ groq: limit('groq') })
    expect(await codeOf(runPublicChain(f.attempt, GROQ, null))).toBe('ai_busy')
  })

  it('sends the user to manual mode (ai_all_limited) when both are out', async () => {
    const f = fake({ groq: limit('groq'), gemini: limit('gemini') })
    expect(await codeOf(runPublicChain(f.attempt, GROQ, GEMINI))).toBe('ai_all_limited')
  })

  it('reports a rejected Google key separately', async () => {
    const f = fake({ groq: limit('groq'), gemini: new AiProviderError('gemini', 'auth', 'nope', 400) })
    expect(await codeOf(runPublicChain(f.attempt, GROQ, GEMINI))).toBe('gemini_key_invalid')
  })

  it('does not fall back on a bad answer or a refusal — those are real results', async () => {
    const bad = fake({ groq: new AiProviderError('groq', 'bad_output', 'junk'), gemini: 'never' })
    expect(await codeOf(runPublicChain(bad.attempt, GROQ, GEMINI))).toBe('ai_failed')
    expect(bad.calls).toEqual(['groq'])
    const refused = fake({ groq: new AiProviderError('groq', 'refused', 'no') })
    expect(await codeOf(runPublicChain(refused.attempt, GROQ, GEMINI))).toBe('ai_refused')
  })

  it('passes user-facing provider messages through', async () => {
    const f = fake({ groq: new AiProviderError('groq', 'bad_request', 'x', 400, 'Up to 3 photos at a time, please.') })
    await expect(runPublicChain(f.attempt, GROQ, GEMINI)).rejects.toMatchObject({ code: 'bad_input', message: 'Up to 3 photos at a time, please.' })
  })
})

describe('owner route', () => {
  it('runs exactly the chosen provider, with no silent fallback', async () => {
    const f = fake({ claude: limit('claude'), groq: 'should not run' })
    const err = await runOwnerRoute(f.attempt, { provider: 'claude', model: 'claude-opus-5-5' }).catch(e => e)
    expect(err).toBeInstanceOf(StepError)
    expect(err.code).toBe('owner_provider_error')
    expect(err.message).toContain('claude-opus-5-5')
    expect(f.calls).toEqual(['claude'])
  })
})

describe('classifyHttpError', () => {
  it('recognises limits, bad keys, outages and retired models', () => {
    expect(classifyHttpError('groq', 429, '{}').kind).toBe('limit')
    expect(classifyHttpError('groq', 413, 'Request too large: tokens per minute (TPM)').kind).toBe('limit')
    expect(classifyHttpError('gemini', 429, '{"error":{"status":"RESOURCE_EXHAUSTED"}}').kind).toBe('limit')
    expect(classifyHttpError('gemini', 400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}').kind).toBe('auth')
    expect(classifyHttpError('groq', 401, 'Invalid API Key').kind).toBe('auth')
    expect(classifyHttpError('groq', 503, 'unavailable').kind).toBe('unavailable')
    expect(classifyHttpError('groq', 400, '{"error":{"code":"model_decommissioned"}}').kind).toBe('unavailable')
    expect(classifyHttpError('groq', 400, 'bad field').kind).toBe('bad_request')
  })
})
