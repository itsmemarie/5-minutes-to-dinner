import { CORS } from './cors.ts'

export const preflight = () => new Response('ok', { headers: CORS })

export function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { ...CORS, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

// Error body shape every function returns: `error` is a sentence a person can
// read, `code` is what the client branches on (see src/lib/ai.js).
export const jsonError = (error: string, code: string, status = 500) => json({ error, code }, { status })
