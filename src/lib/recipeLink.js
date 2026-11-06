// ─── Link to a recipe's original page ─────────────────────────────
// Pure. The link gets opened in a new tab and recipes has RLS off, so only
// http(s) links get through: checked on the way in and again on the way out.

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const HOST_AND_PORT = /^[^\s/:]+:\d+(\/|$)/   // "site.com:8080/x" isn't a scheme

// A clean http(s) URL, or null when the input is blank or isn't a web link.
// Adds https:// to links typed without one ("bbcgoodfood.com/recipes/dal").
export function normaliseRecipeLink(input) {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw || /\s/.test(raw)) return null
  const full = HAS_SCHEME.test(raw) && !HOST_AND_PORT.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(full)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url.href
  } catch {
    return null
  }
}

// Whether a photo from a recipe's link can take over from the current one, given
// that photo's image_source. It fills an empty slot and replaces a stock picture
// or one from an earlier link; a photo the user added or an AI one they accepted stays.
export const linkPhotoMayReplace = imageSource => !imageSource || imageSource === 'stock' || imageSource === 'import'

export const linkPhotoCredit = image => (image.from ? `Photo from ${image.from}` : null)

// The site's name for showing next to the link: "bbcgoodfood.com".
export function recipeLinkHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}
