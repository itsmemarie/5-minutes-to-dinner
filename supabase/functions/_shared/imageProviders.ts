// ─── Image providers ──────────────────────────────────────────────
// Which ones exist is decided by the secrets that are set:
//   CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN — FLUX.1 schnell, free daily allowance
//   GEMINI_API_KEY — Google's image model, billed per image (no free tier),
//                    used only for the signed-in owner
// A user's own Google key (x-gemini-key) is tried for them too; it only works
// if their Google project has billing on.
import { AiProviderError, classifyHttpError, excerpt } from './aiErrors.ts'
import { getCaller } from './auth.ts'
import { userGeminiKey } from './router.ts'
import { type GeneratedImage, type ImageAttempt, findImageBlock } from './imageGen.ts'

const clean = (k: string | undefined) => (k ?? '').replace(/[^\x20-\x7E]/g, '').trim()
const CF_ACCOUNT = clean(Deno.env.get('CLOUDFLARE_ACCOUNT_ID'))
const CF_TOKEN = clean(Deno.env.get('CLOUDFLARE_API_TOKEN'))
const CF_MODEL = Deno.env.get('CLOUDFLARE_IMAGE_MODEL')?.trim() || '@cf/black-forest-labs/flux-1-schnell'
const GEMINI_SERVER_KEY = clean(Deno.env.get('GEMINI_API_KEY'))
// The cheapest, fastest Google image model as of Oct 2026 (~$0.034 an image).
const GEMINI_IMAGE_MODEL = Deno.env.get('GEMINI_IMAGE_MODEL')?.trim() || 'gemini-3.1-flash-lite-image'

async function post(provider: string, url: string, headers: Record<string, string>, body: unknown) {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    throw new AiProviderError(provider, 'unavailable', `${provider} could not be reached: ${e instanceof Error ? e.message : e}`)
  }
  const text = await res.text()
  if (!res.ok) {
    if (/nsfw|safety/i.test(text)) throw new AiProviderError(provider, 'refused', `${provider} declined: ${excerpt(text)}`, res.status)
    // Cloudflare's "used up your daily free allocation" / "capacity exceeded".
    if (/allocation|capacity/i.test(text)) throw new AiProviderError(provider, 'limit', `${provider} limit reached`, res.status)
    throw classifyHttpError(provider, res.status, text)
  }
  try { return JSON.parse(text) } catch {
    throw new AiProviderError(provider, 'bad_output', `${provider} sent back something that isn't JSON`)
  }
}

// https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/ — 1024px JPEG.
async function cloudflareImage(prompt: string): Promise<GeneratedImage> {
  const data = await post('cloudflare', `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`,
    { Authorization: `Bearer ${CF_TOKEN}` }, { prompt, steps: 6 })
  const base64 = data?.result?.image ?? data?.image
  if (typeof base64 !== 'string' || !base64) throw new AiProviderError('cloudflare', 'bad_output', 'Cloudflare returned no image')
  return { base64, mediaType: 'image/jpeg' }
}

// Gemini's Interactions API (image models moved there from generateContent).
// `store: false` — the request isn't kept on Google's side for follow-ups.
async function geminiImage(key: string, prompt: string): Promise<GeneratedImage> {
  const data = await post('gemini', 'https://generativelanguage.googleapis.com/v1beta/interactions', { 'x-goog-api-key': key }, {
    model: GEMINI_IMAGE_MODEL,
    input: prompt,
    response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '4:3' },
    store: false,
  })
  const img = findImageBlock(data)
  if (!img) throw new AiProviderError('gemini', 'bad_output', `Gemini returned no image (${excerpt(JSON.stringify(data?.status ?? data?.errors ?? ''))})`)
  return img
}

export async function imageAttempts(req: Request, prompt: string): Promise<{ attempts: ImageAttempt[]; isOwner: boolean }> {
  const attempts: ImageAttempt[] = []
  if (CF_ACCOUNT && CF_TOKEN) attempts.push({ provider: 'cloudflare', model: CF_MODEL, run: () => cloudflareImage(prompt) })
  const { isOwner } = await getCaller(req)
  const key = isOwner && GEMINI_SERVER_KEY ? GEMINI_SERVER_KEY : userGeminiKey(req)
  if (key) attempts.push({ provider: 'gemini', model: GEMINI_IMAGE_MODEL, run: () => geminiImage(key, prompt) })
  return { attempts, isOwner }
}
