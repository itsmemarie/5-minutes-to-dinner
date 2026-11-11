import { useEffect, useRef, useState } from 'react'

// ─── Autosave ─────────────────────────────────────────────────────
// Saves as you go, for screens with no Save button (the saved-week editor).
// Changes are merged into one patch and sent `delay` ms after the last one. Only
// one save runs at a time, so an older write can never land after a newer one.
// A failed patch is kept and merged with anything typed since, to go with the
// next save or a retry.
//
// `status` is 'saved' | 'pending' (waiting for the delay) | 'saving' | 'error'.
export const AUTOSAVE_DELAY_MS = 450

export function createAutosaver({ save, delay = AUTOSAVE_DELAY_MS, onChange = () => {} }) {
  let pending = null
  let inFlight = null
  let timer = null
  let state = { status: 'saved', error: null }
  const set = next => { state = { ...state, ...next }; onChange(state) }

  // Sends what's waiting now. Resolves once everything queued so far has been
  // tried, and never rejects: a failure shows in `status`.
  async function flush() {
    clearTimeout(timer); timer = null
    if (inFlight) {
      await inFlight
      return pending ? flush() : undefined
    }
    if (!pending) return
    const patch = pending
    pending = null
    set({ status: 'saving', error: null })
    inFlight = (async () => {
      try {
        await save(patch)
        set({ status: pending ? 'pending' : 'saved' })
      } catch (e) {
        pending = { ...patch, ...pending }
        set({ status: 'error', error: e?.message || String(e) })
      }
    })()
    try { await inFlight } finally { inFlight = null }
  }

  return {
    queue(patch) {
      pending = { ...pending, ...patch }
      set({ status: 'pending' })
      clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    flush,
    // Drops anything not yet sent, for when the row is about to be deleted.
    discard() { clearTimeout(timer); timer = null; pending = null; if (!inFlight) set({ status: 'saved', error: null }) },
    idle: () => !pending && !inFlight,
    get state() { return state },
  }
}

// The hook form. Whatever is still waiting is sent when the screen closes.
export function useAutosave(save, delay = AUTOSAVE_DELAY_MS) {
  const saveRef = useRef(save)
  saveRef.current = save
  const [state, setState] = useState({ status: 'saved', error: null })
  const saver = useRef(null)
  if (!saver.current) saver.current = createAutosaver({ save: patch => saveRef.current(patch), delay, onChange: setState })
  useEffect(() => () => { saver.current.flush() }, [])
  const s = saver.current
  return { ...state, queue: s.queue, flush: s.flush, retry: s.flush, discard: s.discard, idle: s.idle }
}
