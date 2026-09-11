import { useEffect, useLayoutEffect, useRef } from 'react'

// Remembers the window scroll position per `key` (a screen id), so coming back
// from a sub-screen lands where the user left. The app frame grows with its
// content and the window does the scrolling (the header is sticky), which is
// why this listens on the window rather than a container.
//
// The position is recorded as the user scrolls rather than read at the moment
// the key changes: by then React has already swapped the content and the
// browser has clamped the offset to the new, possibly shorter, page.
// Positions live for the life of the component — nothing is persisted.
export function useScrollMemory(key) {
  const positions = useRef(new Map())
  const activeKey = useRef(key)

  useEffect(() => {
    const onScroll = () => positions.current.set(activeKey.current, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    activeKey.current = key
    window.scrollTo(0, positions.current.get(key) ?? 0)
  }, [key])
}
