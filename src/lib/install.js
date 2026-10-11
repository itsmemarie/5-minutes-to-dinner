// ─── PWA install state ────────────────────────────────────────────
// Sharing into the app only works once it's installed (Chrome on Android, and
// desktop Chrome/Edge); iOS Safari has no Web Share Target at all. Imported
// from main.jsx so the beforeinstallprompt listener is in place before the
// browser fires it.
import { useEffect, useState } from 'react'
import { devicePlatform, isNativeApp } from './platform.js'

let deferredPrompt = null
const listeners = new Set()

export function isInstalled() {
  if (typeof window === 'undefined') return false
  return isNativeApp() || window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function getInstallState() {
  const platform = devicePlatform()
  return {
    installed: isInstalled(),
    canPrompt: !!deferredPrompt,
    platform,
    // iOS can't receive web shares even once installed — that needs the native app.
    canReceiveShares: platform !== 'ios' || isNativeApp(),
  }
}

const emit = () => { const s = getInstallState(); listeners.forEach(fn => fn(s)) }

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; emit() })
  window.addEventListener('appinstalled', () => { deferredPrompt = null; emit() })
}

// Shows the browser's own install dialog. False when the browser hasn't
// offered one (already installed, iOS, or not eligible yet).
export async function promptInstall() {
  if (!deferredPrompt) return false
  const p = deferredPrompt
  deferredPrompt = null
  p.prompt()
  const { outcome } = await p.userChoice
  emit()
  return outcome === 'accepted'
}

export function useInstallState() {
  const [state, setState] = useState(getInstallState)
  useEffect(() => {
    listeners.add(setState)
    return () => listeners.delete(setState)
  }, [])
  return state
}
