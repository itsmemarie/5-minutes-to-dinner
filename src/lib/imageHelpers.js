// ─── Photos → AI payloads ─────────────────────────────────────────
// Everything happens on the device, before upload: crop to the part that
// matters → ≤1024px long edge → grayscale when colour doesn't matter → JPEG
// at quality 0.7. A phone photo of a recipe page goes from ~3 MB to ~100 KB.
import { AI_IMAGE_QUALITY, cropToPixels, fitWithin, toGrayscale } from './imageMath.js'

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    img.src = url
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(blob)
  })
}

/**
 * @param {Blob & {name?: string}} file
 * @param {{crop?: {x,y,w,h}|null, grayscale?: boolean}} opts  crop is relative (0–1)
 * @returns {Promise<{base64, mediaType, name, bytes, width, height}>}
 */
export async function prepareImageForAi(file, { crop = null, grayscale = true } = {}) {
  const name = file.name || 'photo'
  if (!file.type || !file.type.startsWith('image/')) throw new Error(`${name} is not an image`)
  let img
  try {
    img = await loadImage(file)
  } catch {
    // e.g. HEIC outside Safari. The AI providers can't read it either, so say so
    // rather than uploading a file that will fail.
    throw new Error(`${name} couldn't be opened here. Try a screenshot of it, or save it as a JPEG.`)
  }
  const { sx, sy, sw, sh } = cropToPixels(crop, img.naturalWidth, img.naturalHeight)
  const { width, height } = fitWithin(sw, sh)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
  if (grayscale) {
    const px = ctx.getImageData(0, 0, width, height)
    toGrayscale(px.data)
    ctx.putImageData(px, 0, 0)
  }
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not compress the photo'))), 'image/jpeg', AI_IMAGE_QUALITY)
  })
  return { base64: await blobToBase64(blob), mediaType: 'image/jpeg', name, bytes: blob.size, width, height }
}

// A photo of the finished dish, kept as the recipe's picture. Larger and cleaner
// than the AI payload (the strip shows it up to 430px wide, so 1200px covers
// 2x screens) but still a few hundred KB, not the 3-5 MB a phone produces.
export const RECIPE_PHOTO_MAX_EDGE = 1200
export const RECIPE_PHOTO_QUALITY = 0.82

// crop is relative (0–1), as the cropper returns it; null keeps the whole photo.
export async function prepareRecipePhoto(file, { crop = null } = {}) {
  const name = file.name || 'photo'
  if (!file.type || !file.type.startsWith('image/')) throw new Error(`${name} is not an image`)
  let img
  try {
    img = await loadImage(file)
  } catch {
    throw new Error(`${name} couldn't be opened here. Try saving it as a JPEG first.`)
  }
  const { sx, sy, sw, sh } = cropToPixels(crop, img.naturalWidth, img.naturalHeight)
  const { width, height } = fitWithin(sw, sh, RECIPE_PHOTO_MAX_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not compress the photo'))), 'image/jpeg', RECIPE_PHOTO_QUALITY)
  })
  return { base64: await blobToBase64(blob), mediaType: 'image/jpeg', bytes: blob.size }
}

// PhotoPicker items ({ file, crop }) → the { base64, mediaType } list the edge functions take.
export async function preparePhotoItems(items, { grayscale = true } = {}) {
  const prepared = await Promise.all(items.map(it => prepareImageForAi(it.file, { crop: it.crop, grayscale })))
  return prepared.map(({ base64, mediaType }) => ({ base64, mediaType }))
}
