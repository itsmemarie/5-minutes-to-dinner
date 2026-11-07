import { useRef, useState } from 'react'
import { C, ep, R } from '../../lib/theme.js'

const SWIPE_CLOSE_PX = 80

// Bottom sheet over the app frame (max 430px), same look as ConfirmDialog.
// `zIndex` lets a sheet sit above the full-screen recipe form (z 100).
// `head` replaces the plain title. `swipe` lets the handle and head drag the sheet
// closed. Only those drag it, so a sheet that scrolls still scrolls.
export function Sheet({ title, head, label, children, onClose, zIndex = 150, busy, radius = 16, swipe }) {
  const [dragY, setDragY] = useState(0)
  const startY = useRef(0)
  const grab = swipe && !busy ? {
    onTouchStart: e => { startY.current = e.touches[0].clientY },
    onTouchMove: e => setDragY(Math.max(0, e.touches[0].clientY - startY.current)),
    onTouchEnd: () => { if (dragY > SWIPE_CLOSE_PX) onClose(); else setDragY(0) },
    onTouchCancel: () => setDragY(0),
  } : null
  return (
    <div onClick={busy ? undefined : onClose} style={{ position:'fixed', inset:0, zIndex, background:'rgba(24,36,23,0.42)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div role='dialog' aria-modal='true' aria-label={label} onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:430, maxHeight:'88vh', overflowY:'auto', background:C.white, borderRadius:`${radius}px ${radius}px 0 0`, padding:'8px 20px 24px', transform:dragY ? `translateY(${dragY}px)` : undefined, transition:dragY ? undefined : 'transform 0.15s' }}>
        <div {...grab} style={grab ? { touchAction:'none' } : undefined}>
          <div style={{ width:44, height:4, borderRadius:R.pill, background:C.outlineVariant, margin:'0 auto 16px' }}/>
          {head}
          {title && <div style={{ ...ep, fontSize:19, color:C.onSurface, marginBottom:8 }}>{title}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}
