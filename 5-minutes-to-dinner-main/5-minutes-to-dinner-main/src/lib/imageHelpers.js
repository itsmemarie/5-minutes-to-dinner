const MAX_DIMENSION = 1500
const JPEG_QUALITY = 0.75

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read image: ${file.name || 'file'}`)) }
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
 * Resizes an image to a 1500px long edge and re-encodes as JPEG at 75%
 * quality so large phone screenshots/photos fit under upload size limits.
 * Falls back to sending the original file's base64 if the browser can't
 * decode it (e.g. HEIC on non-Safari browsers) rather than dropping it.
 */
export async function compressImageFile(file) {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error(`${file.name || 'File'} is not an image`)
  }

  try {
    const img = await loadImage(file)
    const { width, height } = img
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('Canvas compression failed')),
        'image/jpeg',
        JPEG_QUALITY
      )
    })

    const base64 = await blobToBase64(blob)
    return { base64, mediaType: 'image/jpeg', name: file.name }
  } catch {
    const base64 = await blobToBase64(file)
    return { base64, mediaType: file.type, name: file.name }
  }
}

/** Compresses multiple files concurrently; a failed file becomes null rather than blocking the rest. */
export async function compressImageFiles(files) {
  const results = await Promise.allSettled(files.map(compressImageFile))
  return results.map(r => r.status === 'fulfilled' ? r.value : null)
}

const RESIZE_MAX_DIMENSION = 1024
const RESIZE_JPEG_QUALITY = 0.8

/**
 * Resizes an image File to a maximum of 1024px on the longest edge
 * (preserving aspect ratio) and re-encodes as JPEG at 80% quality, so
 * photos stay under the Groq vision API's free-tier token-per-minute
 * limit. Returns the original file unchanged if it's already small
 * enough, or if the browser can't decode it (e.g. HEIC on non-Safari).
 */
export async function resizeImage(file) {
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error(`${file.name || 'File'} is not an image`)
  }

  try {
    const img = await loadImage(file)
    const { width, height } = img
    if (Math.max(width, height) <= RESIZE_MAX_DIMENSION) return file

    const scale = RESIZE_MAX_DIMENSION / Math.max(width, height)
    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => b ? resolve(b) : reject(new Error('Canvas resize failed')),
        'image/jpeg',
        RESIZE_JPEG_QUALITY
      )
    })

    return new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

async function resizeImageToPayload(file) {
  const resized = await resizeImage(file)
  const base64 = await blobToBase64(resized)
  return { base64, mediaType: resized.type || 'image/jpeg', name: file.name }
}

/** Resizes multiple files concurrently; a failed file becomes null rather than blocking the rest. */
export async function resizeImageFiles(files) {
  const results = await Promise.allSettled(files.map(resizeImageToPayload))
  return results.map(r => r.status === 'fulfilled' ? r.value : null)
}
