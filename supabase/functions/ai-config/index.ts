// AI access settings.
//   { action: 'get' }                          → who am I, and (owner) the per-step model choices
//   { action: 'setChoice', step, provider, model }   owner only
//   { action: 'resetChoices' }                       owner only
//   { action: 'validateGeminiKey' }            → test the key in the x-gemini-key header
// Owner status comes from the verified JWT (auth.ts); the client's `isOwner`
// is display-only and every owner action is re-checked here.
import { aiHandler, badInput, StepError, userGeminiKey } from '../_shared/router.ts'
import { getCaller, serviceClient } from '../_shared/auth.ts'
import { GEMINI_DEFAULT_MODEL, catalogueForClient, validateChoice } from '../_shared/aiCatalogue.ts'
import { ANTHROPIC_KEY, GROQ_KEY, callGemini } from '../_shared/providers.ts'
import { AiProviderError } from '../_shared/aiErrors.ts'
import { json } from '../_shared/http.ts'

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL')?.trim() || GEMINI_DEFAULT_MODEL
const ownerOnly = () => new StepError('Only the owner account can change AI models.', 'forbidden', 403)

Deno.serve(aiHandler(async (req, body) => {
  const caller = await getCaller(req)
  const action = body.action ?? 'get'

  if (action === 'get') {
    const base = { signedIn: caller.signedIn, email: caller.email, isOwner: caller.isOwner, geminiModel: GEMINI_MODEL }
    if (!caller.isOwner) return json(base)
    const { data, error } = await serviceClient().from('ai_model_choices').select('step, provider, model')
    if (error) console.error('ai_model_choices read failed', error.message)
    return json({
      ...base,
      ...catalogueForClient(),
      // With no Claude key the unset steps run on Groq, so show that as the default.
      defaults: { ...catalogueForClient().defaults, owner: ANTHROPIC_KEY ? catalogueForClient().defaults.owner : { provider: 'groq', model: '' } },
      choices: Object.fromEntries((data ?? []).map(r => [r.step, { provider: r.provider, model: r.model }])),
      keys: { claude: !!ANTHROPIC_KEY, groq: !!GROQ_KEY },
      choicesTableReady: !error,
    })
  }

  if (action === 'setChoice') {
    if (!caller.isOwner) throw ownerOnly()
    const problem = validateChoice(body.step, body.provider, body.model)
    if (problem) throw badInput(problem)
    const { error } = await serviceClient().from('ai_model_choices')
      .upsert({ step: body.step, provider: body.provider, model: body.model, updated_at: new Date().toISOString() }, { onConflict: 'step' })
    if (error) throw new StepError(`Couldn't save: ${error.message}`, 'save_failed', 500)
    return json({ ok: true })
  }

  if (action === 'resetChoices') {
    if (!caller.isOwner) throw ownerOnly()
    const { error } = await serviceClient().from('ai_model_choices').delete().neq('step', '')
    if (error) throw new StepError(`Couldn't reset: ${error.message}`, 'save_failed', 500)
    return json({ ok: true })
  }

  if (action === 'validateGeminiKey') {
    const key = userGeminiKey(req)
    if (!key) return json({ ok: false, error: "That doesn't look like a Google AI key — it should be one long code with no spaces." })
    // A cheap test call: a few output tokens on the model the key will actually
    // be used with. The key is used for this request only and not stored.
    try {
      await callGemini(key, { model: GEMINI_MODEL, system: 'Reply with OK.', user: 'OK?', maxTokens: 8, temperature: 0, json: false, claudeEffort: 'low' })
      return json({ ok: true, model: GEMINI_MODEL })
    } catch (e) {
      if (e instanceof AiProviderError && e.kind === 'limit') {
        return json({ ok: true, model: GEMINI_MODEL, warning: 'The key works, but it has hit its free limit for now. It will be used again once the limit resets.' })
      }
      // Google answered, just not with text (a thinking model can spend 8 tokens
      // before writing) — the key itself was accepted.
      if (e instanceof AiProviderError && (e.kind === 'bad_output' || e.kind === 'refused')) {
        return json({ ok: true, model: GEMINI_MODEL })
      }
      if (e instanceof AiProviderError && e.kind === 'auth') {
        return json({ ok: false, error: "Google didn't accept that key. Check you copied all of it, or create a new one." })
      }
      return json({ ok: false, error: "Couldn't check the key with Google right now. Try again in a minute." })
    }
  }

  throw badInput('Unknown action.')
}))
