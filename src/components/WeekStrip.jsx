import { useEffect, useRef } from 'react'
import { C, mn, R } from '../lib/theme.js'

// Sideways-scrolling row of weeks (see dateHelpers.weekStripItems). A dot marks
// a week with meals. The selected week is kept in the middle of the row.
export function WeekStrip({ weeks, selectedOffset, onSelect }) {
  const stripRef = useRef(null)
  const chipRef = useRef(null)
  const settled = useRef(false)

  // Scrolls the strip itself rather than using scrollIntoView, which would also
  // move the page. Re-runs when the strip grows, as it does once the weeks with
  // meals have loaded and the older weeks appear to the left.
  useEffect(() => {
    const strip = stripRef.current, chip = chipRef.current
    if (!strip || !chip) return
    strip.scrollTo({ left: chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2, behavior: settled.current ? 'smooth' : 'auto' })
    settled.current = true
  }, [selectedOffset, weeks.length])

  return (
    <div ref={stripRef} style={{ position:'relative', display:'flex', gap:8, overflowX:'auto', margin:'0 -20px 14px', padding:'2px 20px 6px', scrollbarWidth:'none' }}>
      {weeks.map(w => {
        const selected = w.offset === selectedOffset
        const ink = selected ? C.onPrimary : C.onSurface
        return (
          <button key={w.weekOf} ref={selected ? chipRef : undefined} onClick={() => onSelect(w.offset)} aria-pressed={selected}
            aria-label={`${w.label}${w.isThisWeek ? ', this week' : ''}${w.hasMeals ? ', has meals' : ''}`}
            style={{ ...mn, flexShrink:0, minWidth:88, display:'flex', flexDirection:'column', alignItems:'center', gap:3, border:'none', borderRadius:R.md, padding:'8px 12px', background:selected ? C.primary : C.surfaceContainerHigh, color:ink, cursor:'pointer' }}>
            <span style={{ fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>{w.shortLabel}</span>
            <span style={{ display:'flex', alignItems:'center', gap:5, height:12, fontSize:10, fontWeight:600, whiteSpace:'nowrap', opacity:selected ? 0.85 : 0.65 }}>
              {w.isThisWeek && 'This week'}
              {w.hasMeals && <span style={{ width:5, height:5, borderRadius:R.pill, background:selected ? C.onPrimary : C.primary }}/>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
