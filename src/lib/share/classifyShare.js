// ─── Shared content → one normalised shape ────────────────────────
// Pure. Share sheets are inconsistent about where they put things: Android
// apps often send the link inside `text` ("Look at this https://…"), some put
// the page title in `title`, others leave `url` empty. Everything is folded
// into one shape so the rest of the app never cares where a share came from:
//   { kind: 'url' | 'images' | 'text', url, text, title, files, source, receivedAt }

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/i
const trimUrl = u => u.replace(/[),.;!?'"]+$/, '')
const str = v => (typeof v === 'string' ? v.trim() : '')
const isImage = f => !!f && typeof f.type === 'string' && f.type.startsWith('image/')

export function normaliseShare(raw) {
  if (!raw || typeof raw !== 'object') return null
  const title = str(raw.title)
  const text = str(raw.text)
  const files = (Array.isArray(raw.files) ? raw.files : []).filter(isImage)

  let url = str(raw.url)
  if (url && !/^https?:\/\//i.test(url)) url = ''
  let token = url   // the text as it appears in `text`, punctuation and all
  if (!url) {
    const m = text.match(URL_RE) || title.match(URL_RE)
    if (m) { url = trimUrl(m[0]); token = m[0] }
  }
  const words = url ? text.replace(token, '').replace(url, '').trim() : text

  const kind = files.length ? 'images' : url ? 'url' : (words || title) ? 'text' : null
  if (!kind) return null
  return {
    kind,
    url: url || null,
    text: words || (kind === 'text' ? title : ''),
    title,
    files,
    source: raw.source || 'pwa',
    receivedAt: Date.now(),
  }
}

// Where a share should open before the user picks. A link is a recipe; a
// list of short lines without amounts reads like a freezer inventory.
export function suggestDestination(share) {
  if (!share || share.kind === 'url') return 'recipe'
  if (share.kind === 'text') {
    const lines = share.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const hasAmounts = /\d+\s*(g|kg|ml|l|tbsp|tsp|cups?|oz)\b/i.test(share.text)
    if (lines.length >= 3 && lines.every(l => l.length <= 40) && !hasAmounts) return 'freezer'
  }
  return 'recipe'
}
