// ─── Fetching a picture from someone else's site ──────────────────
// Used when an imported recipe brings its photo along. The type comes from the
// file's first bytes, not the server's Content-Type (CDNs often send
// application/octet-stream), and anything that isn't a photo is dropped.

// Only public http(s) addresses — not this server's own network.
export const isPrivateHost = (hostname: string) => {
  const h = hostname.toLowerCase()
  return h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h)
}

export function sniffImageType(b: Uint8Array): string | null {
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (ascii(4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(8, 12))) return 'image/avif'
  return null
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

// The app shrinks it to 1200px before saving; this only stops a 20 MB original
// being sent to a phone.
export const MAX_REMOTE_IMAGE_BYTES = 4_000_000

export async function fetchRemoteImage(
  raw: string,
  { signal, maxBytes = MAX_REMOTE_IMAGE_BYTES }: { signal?: AbortSignal; maxBytes?: number } = {},
): Promise<{ base64: string; mediaType: string; bytes: number } | null> {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) return null

  const res = await fetch(u, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 5MinutesToDinner/1.0; recipe import)', Accept: 'image/avif,image/webp,image/*;q=0.9' },
    redirect: 'follow',
    signal: signal ?? AbortSignal.timeout(10_000),
  })
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !res.body || /^text\//i.test(type) || Number(res.headers.get('content-length')) > maxBytes) {
    await res.body?.cancel()
    return null
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) { await reader.cancel(); return null }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let at = 0
  for (const c of chunks) { bytes.set(c, at); at += c.length }

  const mediaType = sniffImageType(bytes)
  return mediaType ? { base64: bytesToBase64(bytes), mediaType, bytes: total } : null
}
