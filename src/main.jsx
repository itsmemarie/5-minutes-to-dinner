import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './lib/App.jsx'
// Early, so the beforeinstallprompt listener exists before the browser fires it.
import './lib/install.js'
import { isNativeApp } from './lib/platform.js'

// The service worker only receives Web Share Target posts (public/sw.js).
// Production only: the share sheet needs an installed, HTTPS-served app anyway.
// A native wrapper receives shares natively instead (NATIVE_SHARING.md).
if (import.meta.env.PROD && 'serviceWorker' in navigator && !isNativeApp()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => console.error('service worker registration failed', e))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
