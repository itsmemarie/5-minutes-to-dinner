import { useEffect, useRef, useState } from 'react'
import { C, mn } from '../../lib/theme.js'
import { Icon } from '../ui/Icon.jsx'
import { sectionLabel } from '../../lib/mealSections.js'
import { RowCard, Switch, ROW_DIVIDER } from './primitives.jsx'

// ─── Meal sections: reorderable toggle list ───────────────────────
// Pointer-event drag rather than HTML5 drag-and-drop so it works on touch.
// Mouse drags start immediately; touch drags start on a 350ms long-press
// (dragging from the grip handle starts immediately on touch too). While a
// drag is live the rows between the origin and the target slot slide out of
// the way; the order is committed on release.

const LONG_PRESS_MS = 350
const CANCEL_SLOP_PX = 8

function moveItem(list, from, to) {
  if (from === to) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function MealSectionsCard({ sections, onChange }) {
  const enabledCount = sections.filter(s => s.enabled).length
  const rowRefs = useRef([])
  const gesture = useRef(null)            // pending long-press or live drag bookkeeping
  const [drag, setDrag] = useState(null)  // { from, to, dy, height } while dragging

  const toggle = id => onChange(sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))

  // Stop the page scrolling under a live touch drag. React's touch handlers are
  // passive, so this has to be a native, non-passive listener.
  useEffect(() => {
    if (!drag) return
    const prevent = e => e.preventDefault()
    document.addEventListener('touchmove', prevent, { passive: false })
    return () => document.removeEventListener('touchmove', prevent)
  }, [drag])

  const begin = (index, clientY) => {
    const rects = rowRefs.current.map(el => el.getBoundingClientRect())
    gesture.current = { active: true, from: index, startY: clientY, rects, to: index }
    setDrag({ from: index, to: index, dy: 0, height: rects[index].height })
  }

  // One handler on the row; where the press landed decides how it behaves.
  // Pointer capture stays on the row so the move/up events keep arriving here.
  const onPointerDown = (e, index) => {
    if (e.button != null && e.button !== 0) return
    if (e.target.closest('[data-nodrag]')) return
    const fromHandle = !!e.target.closest('[data-grip]')
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (e.pointerType === 'mouse' || fromHandle) { begin(index, e.clientY); return }
    const startY = e.clientY
    const timer = setTimeout(() => begin(index, startY), LONG_PRESS_MS)
    gesture.current = { active: false, timer, startY }
  }

  const onPointerMove = e => {
    const g = gesture.current
    if (!g) return
    if (!g.active) {
      if (Math.abs(e.clientY - g.startY) > CANCEL_SLOP_PX) { clearTimeout(g.timer); gesture.current = null }
      return
    }
    const dy = e.clientY - g.startY
    const centre = g.rects[g.from].top + g.rects[g.from].height / 2 + dy
    let to = g.from
    g.rects.forEach((r, i) => {
      const mid = r.top + r.height / 2
      if (i < g.from && centre < mid) to = Math.min(to, i)
      if (i > g.from && centre > mid) to = Math.max(to, i)
    })
    g.to = to
    setDrag(d => d && { ...d, to, dy })
  }

  const end = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (!g.active) { clearTimeout(g.timer); return }
    if (g.to !== g.from) onChange(moveItem(sections, g.from, g.to))
    setDrag(null)
  }

  const rowTransform = i => {
    if (!drag) return undefined
    if (i === drag.from) return `translateY(${drag.dy}px)`
    if (drag.from < i && i <= drag.to) return `translateY(-${drag.height}px)`
    if (drag.to <= i && i < drag.from) return `translateY(${drag.height}px)`
    return undefined
  }

  return (
    <RowCard style={{ position:'relative', overflow:'visible' }}>
      {sections.map((s, i) => {
        const lifted = drag?.from === i
        const lastOn = s.enabled && enabledCount === 1
        return (
          <div key={s.id} ref={el => { rowRefs.current[i] = el }}
            onPointerDown={e => onPointerDown(e, i)} onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={end}
            style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 0',
              borderTop: i > 0 ? `1px solid ${ROW_DIVIDER}` : undefined,
              transform: rowTransform(i), transition: lifted ? undefined : 'transform 0.12s',
              position:'relative', zIndex: lifted ? 2 : undefined,
              background: lifted ? C.white : undefined, boxShadow: lifted ? '0 6px 18px rgba(24,36,23,0.16)' : undefined,
              margin: lifted ? '0 -14px' : undefined, paddingLeft: lifted ? 14 : undefined, paddingRight: lifted ? 14 : undefined,
              cursor: drag ? 'grabbing' : 'grab', userSelect:'none', WebkitUserSelect:'none', WebkitTouchCallout:'none',
            }}>
            <span data-grip style={{ display:'flex', touchAction:'none', flexShrink:0 }} aria-hidden>
              <Icon name='gripLines' size={14} color={s.enabled ? C.outlineStrong : C.outlineVariant} strokeWidth={2.5}/>
            </span>
            <span style={{ ...mn, flex:1, fontSize:14, color: s.enabled ? C.onSurface : C.onSurfaceDisabled }}>{sectionLabel(s.id)}</span>
            <span data-nodrag title={lastOn ? 'At least one section has to stay on' : undefined}>
              <Switch on={s.enabled} disabled={lastOn} onClick={() => toggle(s.id)}/>
            </span>
          </div>
        )
      })}
    </RowCard>
  )
}
