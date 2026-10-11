// ─── Web ↔ native seam ────────────────────────────────────────────
// The only place that asks "am I inside a native wrapper?". Today the app is a
// PWA and every branch here takes the web path; a Capacitor wrapper swaps in
// native behaviour without touching the screens (see NATIVE_SHARING.md).

export const isNativeApp = () => !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.())

// Opens a page outside the app (Google AI Studio, GitHub issues). In a native
// wrapper this becomes the Capacitor Browser plugin.
export function openExternal(url) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function devicePlatform() {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}
