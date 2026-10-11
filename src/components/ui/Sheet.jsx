import { C, ep, R } from '../../lib/theme.js'

// Bottom sheet over the app frame (max 430px), same look as ConfirmDialog.
// `zIndex` lets a sheet sit above the full-screen recipe form (z 100).
export function Sheet({ title, children, onClose, zIndex = 150, busy }) {
  return (
    <div onClick={busy ? undefined : onClose} style={{ position:'fixed', inset:0, zIndex, background:'rgba(24,36,23,0.42)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div role='dialog' aria-modal='true' onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:430, maxHeight:'88vh', overflowY:'auto', background:C.white, borderRadius:'16px 16px 0 0', padding:'8px 20px 24px' }}>
        <div style={{ width:44, height:4, borderRadius:R.pill, background:C.outlineVariant, margin:'0 auto 16px' }}/>
        {title && <div style={{ ...ep, fontSize:19, color:C.onSurface, marginBottom:8 }}>{title}</div>}
        {children}
      </div>
    </div>
  )
}
