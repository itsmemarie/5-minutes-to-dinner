import { useEffect, useRef, useState } from 'react'
import { C, ep, mn, R } from '../../lib/theme.js'
import { moveCropRect } from '../../lib/imageMath.js'

// Full-screen crop before a photo goes to the AI: drag the box or its corners
// so only the recipe (or list) is inside. The crop is relative (0–1) and is
// applied later by prepareImageForAi, so nothing is re-encoded here.
const CORNERS = ['nw', 'ne', 'sw', 'se']
const FULL = { x: 0, y: 0, w: 1, h: 1 }

function useObjectUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) return undefined
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

const AI_HINT = 'Keep just the recipe inside the box. Less to send means faster, cheaper AI.'

export function ImageCropper({ file, initial, onDone, onCancel, title = 'Crop to the recipe', hint = AI_HINT }) {
  const src = useObjectUrl(file)
  const boxRef = useRef(null)
  const drag = useRef(null)
  const [rect, setRect] = useState(initial || { x: 0.04, y: 0.04, w: 0.92, h: 0.92 })

  const begin = mode => e => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { mode, x: e.clientX, y: e.clientY, rect }
  }
  const move = e => {
    const d = drag.current
    if (!d || !boxRef.current) return
    const b = boxRef.current.getBoundingClientRect()
    setRect(moveCropRect(d.rect, d.mode, (e.clientX - d.x) / b.width, (e.clientY - d.y) / b.height))
  }
  const end = () => { drag.current = null }
  const handlers = mode => ({ onPointerDown: begin(mode), onPointerMove: move, onPointerUp: end, onPointerCancel: end })
  const pct = v => `${v * 100}%`
  const barBtn = { ...mn, border:'none', background:'none', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', padding:'8px 4px' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'#121512', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px' }}>
        <button onClick={onCancel} style={barBtn}>Cancel</button>
        <span style={{ ...ep, fontSize:16, color:'#fff' }}>{title}</span>
        <button onClick={() => onDone(rect)} style={{ ...barBtn, color:'#bfe3bf' }}>Done</button>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:16, minHeight:0 }}>
        {src && (
          <div ref={boxRef} style={{ position:'relative', display:'inline-block', overflow:'hidden', touchAction:'none', userSelect:'none', WebkitUserSelect:'none' }}>
            <img src={src} alt='Photo to crop' draggable={false} style={{ display:'block', maxWidth:'calc(100vw - 32px)', maxHeight:'calc(100vh - 190px)' }}/>
            <div {...handlers('move')} aria-label='Crop area'
              style={{ position:'absolute', left:pct(rect.x), top:pct(rect.y), width:pct(rect.w), height:pct(rect.h), border:'2px solid #fff', boxShadow:'0 0 0 9999px rgba(0,0,0,0.55)', cursor:'move', boxSizing:'border-box' }}>
              {CORNERS.map(c => (
                <div key={c} {...handlers(c)} aria-label={`Resize ${c}`}
                  style={{ position:'absolute', width:30, height:30, [c[0] === 'n' ? 'top' : 'bottom']:-2, [c[1] === 'w' ? 'left' : 'right']:-2, cursor:`${c}-resize`, display:'flex', alignItems: c[0] === 'n' ? 'flex-start' : 'flex-end', justifyContent: c[1] === 'w' ? 'flex-start' : 'flex-end' }}>
                  <div style={{ width:16, height:16, borderStyle:'solid', borderColor:'#fff', borderWidth:`${c[0] === 'n' ? 4 : 0}px ${c[1] === 'e' ? 4 : 0}px ${c[0] === 's' ? 4 : 0}px ${c[1] === 'w' ? 4 : 0}px` }}/>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ padding:'8px 20px 22px', display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ ...mn, fontSize:12, color:'#c9d3c7', lineHeight:1.5, flex:1 }}>{hint}</span>
        <button onClick={() => setRect(FULL)} style={{ ...mn, border:'1px solid #5c6a58', background:'none', color:'#fff', borderRadius:R.pill, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>Whole photo</button>
      </div>
    </div>
  )
}

export { useObjectUrl }
