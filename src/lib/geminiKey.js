// ─── The user's own Google AI (Gemini) key ────────────────────────
// Stored only in this browser's localStorage — never in Supabase. It travels
// with each AI request in the x-gemini-key header so the server can fall back
// to it when the free Groq tier is busy, and is used for that request only.
// (In a native wrapper this should move to the platform keychain — see
// NATIVE_SHARING.md.)
import { useEffect, useState } from 'react'

const STORAGE_KEY = '5mtd.geminiKey'
const listeners = new Set()
const emit = () => listeners.forEach(fn => fn(readGeminiKey()))

export function readGeminiKey() {
  try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
}

// Returns false when the browser won't store it (private mode, blocked storage).
export function saveGeminiKey(key) {
  try { localStorage.setItem(STORAGE_KEY, key.trim()) } catch { return false }
  emit()
  return readGeminiKey() === key.trim()
}

export function removeGeminiKey() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
  emit()
}

// Looks like a key: one unbroken token of the right length. Google validates it.
export const looksLikeGeminiKey = k => /^[A-Za-z0-9_-]{30,100}$/.test((k || '').trim())

// "AIza…x9Qw" — enough to recognise it, not enough to reuse it.
export const maskKey = k => (k && k.length > 10 ? `${k.slice(0, 4)}…${k.slice(-4)}` : '')

export function useGeminiKey() {
  const [key, setKey] = useState(readGeminiKey)
  useEffect(() => {
    listeners.add(setKey)
    return () => listeners.delete(setKey)
  }, [])
  return key
}
