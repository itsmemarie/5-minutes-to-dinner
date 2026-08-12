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
