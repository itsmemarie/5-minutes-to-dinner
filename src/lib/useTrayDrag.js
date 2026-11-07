import { useEffect, useRef, useState } from 'react'
import { autoScrollStep } from './tryDeck.js'

const START_SLOP = 4   // px before a press on a tray card counts as a drag

export const dayAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-day]')?.dataset.day ?? null

// The part of the window the list is visible in, between the app's sticky bars.
export function visibleEdges() {
  const top = document.querySelector('[data-top-bar]')?.getBoundingClientRect().bottom ?? 0
  const bottom = document.querySelector('[data-bottom-bar]')?.getBoundingClientRect().top ?? window.innerHeight
  return { top, bottom }
}

// Dragging a tray card onto a day, with Pointer Events: the planner's meal drag
// uses HTML5 drag and drop, which doesn't fire on iOS touch. Spread `handlers(item)`
// on a card with touch-action: none. `drag` is { item, x, y, day } while it's moving,
// where `day` is the one under the finger. `onDrop(item, day)` runs on release over
// a day; releasing anywhere else, or the system cancelling the gesture, does nothing.
export function useTrayDrag({ onDrop }) {
  const [drag, setDrag] = useState(null)
  const press = useRef(null)   // { id, item, startX, startY, x, y, active }
  const frame = useRef(null)

  const stopScrolling = () => { cancelAnimationFrame(frame.current); frame.current = null }
  useEffect(() => stopScrolling, [])

  // Each frame, so a finger held still near an edge keeps the list moving and the
  // day under it stays current as the list passes.
  const tick = () => {
    const p = press.current
    if (!p?.active) return
    const { top, bottom } = visibleEdges()
    const step = autoScrollStep(p.y, top, bottom)
    if (step) window.scrollBy(0, step)
    setDrag({ item:p.item, x:p.x, y:p.y, day:dayAt(p.x, p.y) })
    frame.current = requestAnimationFrame(tick)
  }

  const finish = drop => {
    const p = press.current
    press.current = null
    stopScrolling()
    setDrag(null)
    if (!p?.active || !drop) return
    const day = dayAt(p.x, p.y)
    if (day) onDrop(p.item, day)
  }

  const handlers = item => ({
    onPointerDown: e => {
      if (e.button > 0 || press.current) return
      e.currentTarget.setPointerCapture(e.pointerId)
      press.current = { id:e.pointerId, item, startX:e.clientX, startY:e.clientY, x:e.clientX, y:e.clientY, active:false }
    },
    onPointerMove: e => {
      const p = press.current
      if (!p || p.id !== e.pointerId) return
      p.x = e.clientX; p.y = e.clientY
      if (!p.active && Math.hypot(p.x - p.startX, p.y - p.startY) >= START_SLOP) {
        p.active = true
        frame.current = requestAnimationFrame(tick)
      }
    },
    onPointerUp: e => { if (press.current?.id === e.pointerId) { press.current.x = e.clientX; press.current.y = e.clientY; finish(true) } },
    onPointerCancel: e => { if (press.current?.id === e.pointerId) finish(false) },
  })

  return { drag, handlers }
}
