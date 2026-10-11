// ─── Image geometry for AI uploads ────────────────────────────────
// Pure helpers behind imageHelpers.prepareImageForAi and the crop UI. Crop
// rectangles are relative to the image (0–1), so they survive resizing and
// don't depend on how large the image is drawn on screen.

// In a vision call the image is usually most of the cost: ~1024px on the long
// edge keeps print legible while cutting tokens.
export const AI_IMAGE_MAX_EDGE = 1024
export const AI_IMAGE_QUALITY = 0.7
export const MIN_CROP = 0.08

export function fitWithin(w, h, maxEdge = AI_IMAGE_MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

export function clampRect({ x, y, w, h }) {
  const cw = Math.min(1, Math.max(MIN_CROP, w))
  const ch = Math.min(1, Math.max(MIN_CROP, h))
  return { x: Math.min(1 - cw, Math.max(0, x)), y: Math.min(1 - ch, Math.max(0, y)), w: cw, h: ch }
}

export const isFullFrame = c => !c || (c.x <= 0.001 && c.y <= 0.001 && c.w >= 0.999 && c.h >= 0.999)

// Relative crop → source pixels for drawImage.
export function cropToPixels(crop, w, h) {
  if (isFullFrame(crop)) return { sx: 0, sy: 0, sw: w, sh: h }
  const c = clampRect(crop)
  const sx = Math.round(c.x * w), sy = Math.round(c.y * h)
  return { sx, sy, sw: Math.max(1, Math.min(w - sx, Math.round(c.w * w))), sh: Math.max(1, Math.min(h - sy, Math.round(c.h * h))) }
}

// One drag step of the crop box. `mode` is 'move' or a corner ('nw','ne','sw','se');
// dx/dy are the pointer travel as a fraction of the image's drawn size.
export function moveCropRect(start, mode, dx, dy) {
  if (mode === 'move') return clampRect({ ...start, x: start.x + dx, y: start.y + dy })
  let left = start.x, top = start.y, right = start.x + start.w, bottom = start.y + start.h
  if (mode.includes('w')) left = Math.min(right - MIN_CROP, Math.max(0, left + dx))
  if (mode.includes('e')) right = Math.max(left + MIN_CROP, Math.min(1, right + dx))
  if (mode.includes('n')) top = Math.min(bottom - MIN_CROP, Math.max(0, top + dy))
  if (mode.includes('s')) bottom = Math.max(top + MIN_CROP, Math.min(1, bottom + dy))
  return { x: left, y: top, w: right - left, h: bottom - top }
}

// In place, on canvas ImageData pixels. Printed or handwritten text reads the
// same without colour, and a grey JPEG compresses smaller.
export function toGrayscale(data) {
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = data[i + 1] = data[i + 2] = l
  }
  return data
}

export const formatBytes = n => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)
