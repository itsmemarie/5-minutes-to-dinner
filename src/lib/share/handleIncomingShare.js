// ─── The one way shared content enters the app ────────────────────
// Every share source calls handleIncomingShare(payload):
//   • today:  the PWA share target (public/sw.js → pwaShareInbox.js)
//   • later:  the Android intent / iOS Share Extension bridges of a native
//             wrapper (see NATIVE_SHARING.md) — same function, same payload.
// payload: { title?, text?, url?, files?: File[], source?: 'pwa'|'android'|'ios' }
//
// App subscribes with onIncomingShare and routes the normalised share to the
// recipe form or the freezer screen. A share that arrives before App mounts
// is held and delivered on subscribe.
import { normaliseShare } from './classifyShare.js'

let pending = null
const listeners = new Set()

export function handleIncomingShare(payload) {
  const share = normaliseShare(payload)
  if (!share) return null
  pending = share
  listeners.forEach(fn => fn(share))
  return share
}

export function onIncomingShare(fn) {
  listeners.add(fn)
  if (pending) fn(pending)
  return () => listeners.delete(fn)
}

// Called once the share has been routed, so a re-subscribe doesn't replay it.
export function clearIncomingShare() {
  pending = null
}
