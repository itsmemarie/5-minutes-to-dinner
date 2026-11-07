import { C, mn } from '../../lib/theme.js'

// A short message over the app, above any bottom controls. `action` is an optional
// { label, onClick }, such as Undo; it sits clear of the planner's shopping button.
// Longer messages wrap: max-content stops left:50% from halving the width they get.
export function Toast({ message, action }) {
  if (!message) return null
  return (
    <div role='status' style={{ ...mn, position:'fixed', left:'50%', bottom:action ? 140 : 112, transform:'translateX(-50%)', zIndex:200, width:'max-content', maxWidth:'calc(100% - 32px)', boxSizing:'border-box', display:'flex', alignItems:'center', gap:14, background:C.onSurface, color:C.onPrimary, borderRadius:20, padding:'10px 16px', fontSize:13, fontWeight:600, lineHeight:1.35, pointerEvents:action ? 'auto' : 'none' }}>
      <span>{message}</span>
      {action && <button onClick={action.onClick} style={{ ...mn, minHeight:44, margin:'-12px -6px', padding:'0 6px', flexShrink:0, border:'none', background:'none', color:C.onPrimary, fontSize:13, fontWeight:700, textDecoration:'underline', cursor:'pointer', whiteSpace:'nowrap' }}>{action.label}</button>}
    </div>
  )
}
