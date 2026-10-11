import { supabase } from './supabase.js'
import { readGeminiKey } from './geminiKey.js'
import { recordAiRun } from './aiRuns.js'

// ─── Edge Function calls ──────────────────────────────────────────
// Every AI provider key lives server-side in Supabase Edge Functions, except a
// user's own Google key, which stays on their device and rides along per
// request. The server picks the provider: the owner's chosen model when the
// signed-in email is the owner's, otherwise Groq → the user's Google key. When
// both are out, the error codes below send the user to manual entry.
const SUPA_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const AI_LIMIT_CODES = ['ai_busy', 'ai_all_limited', 'gemini_key_invalid']
export const AI_LIMIT_EVENT = '5mtd:ai-limit'

export class AiError extends Error {
  constructor(message, code = 'ai_failed', status) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
  }
}
export const isAiLimit = e => AI_LIMIT_CODES.includes(e?.code)

// App listens for this and shows the "add your Google key / carry on by hand" sheet.
export function onAiLimit(fn) {
  const handler = e => fn(e.detail)
  window.addEventListener(AI_LIMIT_EVENT, handler)
  return () => window.removeEventListener(AI_LIMIT_EVENT, handler)
}

const numHeader = (r, name) => {
  const v = r.headers.get(name)
  return v === null || v === '' ? null : Number(v)
}

// opts.quiet — don't raise the limit sheet (calls the user didn't ask for).
// opts.geminiKey — use this key instead of the saved one (key validation).
export async function callEdgeFn(name, body, { quiet = false, geminiKey } = {}) {
  const { data } = await supabase.auth.getSession()
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPA_ANON,
    // The session JWT is how the server recognises the owner; signed out, the anon key.
    Authorization: `Bearer ${data.session?.access_token || SUPA_ANON}`,
  }
  const key = geminiKey ?? readGeminiKey()
  if (key) headers['x-gemini-key'] = key

  let r
  try {
    r = await fetch(`${SUPA_URL}/${name}`, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new AiError("Couldn't reach the server. Check your connection and try again.", 'network')
  }
  let d = null
  try { d = await r.json() } catch {}
  if (!r.ok || d?.error) {
    const err = new AiError(d?.error || `Something went wrong (${r.status}). Try again.`, d?.code || 'ai_failed', r.status)
    if (!quiet && isAiLimit(err)) window.dispatchEvent(new CustomEvent(AI_LIMIT_EVENT, { detail: { code: err.code, message: err.message } }))
    throw err
  }
  const step = r.headers.get('x-ai-step')
  if (step) {
    recordAiRun(step, {
      provider: r.headers.get('x-ai-provider'), model: r.headers.get('x-ai-model'),
      ms: numHeader(r, 'x-ai-ms'), tokensIn: numHeader(r, 'x-ai-tokens-in'), tokensOut: numHeader(r, 'x-ai-tokens-out'),
    })
  }
  return d
}

// ─── Recipe workflow ──────────────────────────────────────────────
// Step 1 runs as soon as there's a source; 2 and 3 are buttons the user presses.
export const extractRecipe = ({ url, text, images }) => callEdgeFn('extract-recipe', { url, text, images })
export const completeRecipe = ({ recipe, missing, context }) => callEdgeFn('complete-recipe', { recipe, missing, context })
export const reviewRecipe = ({ recipe, context }) => callEdgeFn('review-recipe', { recipe, context })
export const generateRecipe = ({ description, context }) => callEdgeFn('generate-recipe', { description, context })

// ─── AI access settings ───────────────────────────────────────────
export const fetchAiConfig = () => callEdgeFn('ai-config', { action: 'get' }, { quiet: true })
export const setAiChoice = (step, provider, model) => callEdgeFn('ai-config', { action: 'setChoice', step, provider, model }, { quiet: true })
export const resetAiChoices = () => callEdgeFn('ai-config', { action: 'resetChoices' }, { quiet: true })
export const validateGeminiKey = key => callEdgeFn('ai-config', { action: 'validateGeminiKey' }, { quiet: true, geminiKey: key })

// ─── Freezer list extraction ──────────────────────────────────────

export function parseFreezerText(text) {
  const seen = new Set()
  const items = []
  text.split('\n').forEach(line => {
    const name = line.replace(/^[\s•\-\*\d.)]+/, '').trim()
    if (!name) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    items.push(name)
  })
  return items
}

export async function extractFreezerItems({ text, images }) {
  if (!images || !images.length) return parseFreezerText(text || '')
  const { items } = await callEdgeFn('extract-freezer-items', { images })
  return items
}
