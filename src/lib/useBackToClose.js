import { useEffect, useRef } from 'react'

// While `open`, the phone's back gesture closes what's open instead of leaving the
// screen. A history entry stands in for it, and is taken back out if it closes any
// other way. `open` stays true when one sheet hands over to another, so that swap
// doesn't touch history.
export function useBackToClose(open, onClose) {
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    let wentBack = false
    const onPop = () => { wentBack = true; close.current() }
    window.history.pushState(window.history.state, '')
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!wentBack) window.history.back()
    }
  }, [open])
}
