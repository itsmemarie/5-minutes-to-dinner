// ─── Last AI run per step ─────────────────────────────────────────
// Filled from the x-ai-* response headers so the owner's model switcher can
// show what actually answered each step, how long it took and its token
// counts — the comparison the switcher exists for. Device-local only.
import { useEffect, useState } from 'react'

const STORAGE_KEY = '5mtd.aiRuns'
const listeners = new Set()

let runs = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {} } catch { return {} }
})()

export function recordAiRun(step, run) {
  runs = { ...runs, [step]: { ...run, at: Date.now() } }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs)) } catch {}
  listeners.forEach(fn => fn(runs))
}

export function useAiRuns() {
  const [value, setValue] = useState(runs)
  useEffect(() => {
    listeners.add(setValue)
    return () => listeners.delete(setValue)
  }, [])
  return value
}
