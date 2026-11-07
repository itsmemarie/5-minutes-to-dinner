import { useEffect, useRef, useState } from 'react'
import { autoScrollStep } from './tryDeck.js'
import { dayAt, visibleEdges } from './useTrayDrag.js'

export const LONG_PRESS_MS = 400
export const MOVE_SLOP = 8         // px; more than this before the hold ends is a scroll
const CLICK_SWALLOW_MS = 400       // a drag ending on touch may never produce a click

export const movedTooFar = (startX, startY, x, y) => Math.hypot(x - startX, y - startY) > MOVE_SLOP
// Controls inside a row keep their own taps: mark them with data-no-drag.
export const canStartPress = (button, target) => !(button > 0) && !target?.closest?.('[data-no-drag]')

const GHOST_STYLE = {
  position:'fixed', left:'0', top:'0', margin:'0', zIndex:'300', pointerEvents:'none', opacity:'1', background:'#fff',
  borderRadius:'10px', boxShadow:'0 8px 24px rgba(24,36,23,.18)', transformOrigin:'center',
}

function swallowNextClick() {
  const stop = e => { e.stopPropagation(); e.preventDefault() }
  window.addEventListener('click', stop, { capture:true, once:true })
  setTimeout(() => window.removeEventListener('click', stop, true), CLICK_SWALLOW_MS)
}

// Page text stays unselected for the length of a drag, so iOS shows no text menu.
function lockPageSelection() {
  const { style } = document.body
  const before = [style.userSelect, style.webkitUserSelect, style.webkitTouchCallout]
  style.userSelect = style.webkitUserSelect = 'none'
  style.webkitTouchCallout = 'none'
  window.getSelection()?.removeAllRanges()
  return () => { [style.userSelect, style.webkitUserSelect, style.webkitTouchCallout] = before }
}

// Press and hold a row, then drag it to another day: touch, pen or mouse. Spread
// `pressProps(item)` on a row with touch-action: pan-y, so the list still scrolls.
// `item` is { mealId, fromDay, section }. Days are found by their data-day attribute,
// as with useTrayDrag. `dragging` is the item while it's held and `overDay` the day
// under it. `onDrop(item, day)` runs on release over a different day.
export function useLongPressDrag({ onDrop }) {
  const [dragging, setDragging] = useState(null)
  const [overDay, setOverDay] = useState(null)
  const press = useRef(null)
  const dropRef = useRef(onDrop)
  dropRef.current = onDrop

  useEffect(() => {
    // Setting touch-action once a touch is under way does nothing, so this is what
    // keeps the page still during a drag. It has to be in place before the touch
    // starts, and it can't be passive.
    const holdPageStill = e => { if (press.current?.active && e.cancelable) e.preventDefault() }
    document.addEventListener('touchmove', holdPageStill, { passive:false })
    return () => {
      document.removeEventListener('touchmove', holdPageStill)
      press.current?.cleanup()
    }
  }, [])

  const pressProps = item => ({
    onContextMenu: e => { if (press.current) e.preventDefault() },
    onPointerDown: e => {
      if (press.current || !canStartPress(e.button, e.target)) return
      const row = e.currentTarget
      const p = { id:e.pointerId, startX:e.clientX, startY:e.clientY, x:e.clientX, y:e.clientY, active:false }

      const placeGhost = () => { p.ghost.style.transform = `translate(${p.x - p.grabX}px, ${p.y - p.grabY}px) scale(1.02)` }

      const tick = () => {
        const { top, bottom } = visibleEdges()
        const step = autoScrollStep(p.y, top, bottom)
        if (step) window.scrollBy(0, step)
        setOverDay(dayAt(p.x, p.y))
        p.frame = requestAnimationFrame(tick)
      }

      const begin = () => {
        p.active = true
        navigator.vibrate?.(10)
        p.unlock = lockPageSelection()
        const box = row.getBoundingClientRect()
        p.grabX = p.x - box.left
        p.grabY = p.y - box.top
        p.ghost = row.cloneNode(true)
        p.ghost.setAttribute('aria-hidden', 'true')
        Object.assign(p.ghost.style, GHOST_STYLE, { width:`${box.width}px`, height:`${box.height}px` })
        document.body.appendChild(p.ghost)
        placeGhost()
        setDragging(item)
        tick()
      }

      const end = drop => {
        const wasActive = p.active
        p.cleanup()
        if (!wasActive) return
        swallowNextClick()
        const day = drop ? dayAt(p.x, p.y) : null
        if (day && day !== item.fromDay) dropRef.current(item, day)
      }

      const onMove = ev => {
        if (ev.pointerId !== p.id) return
        p.x = ev.clientX; p.y = ev.clientY
        if (p.active) placeGhost()
        else if (movedTooFar(p.startX, p.startY, p.x, p.y)) p.cleanup()
      }
      const onUp = ev => { if (ev.pointerId === p.id) { p.x = ev.clientX; p.y = ev.clientY; end(true) } }
      const onCancel = ev => { if (ev.pointerId === p.id) end(false) }
      const onKey = ev => { if (ev.key === 'Escape') end(false) }

      p.cleanup = () => {
        clearTimeout(p.timer)
        cancelAnimationFrame(p.frame)
        p.ghost?.remove()
        p.unlock?.()
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('keydown', onKey)
        press.current = null
        setDragging(null)
        setOverDay(null)
      }

      press.current = p
      p.timer = setTimeout(begin, LONG_PRESS_MS)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      window.addEventListener('keydown', onKey)
    },
  })

  return { dragging, overDay, pressProps }
}
