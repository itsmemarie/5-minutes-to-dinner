import { C, mn, R } from '../../lib/theme.js'

// A short message over the app, above any bottom controls.
export function Toast({ message }) {
  if (!message) return null
  return (
    <div role='status' style={{ ...mn, position:'fixed', left:'50%', bottom:112, transform:'translateX(-50%)', zIndex:200, maxWidth:'calc(100% - 32px)', background:C.onSurface, color:C.onPrimary, borderRadius:R.pill, padding:'10px 16px', fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', pointerEvents:'none' }}>
      {message}
    </div>
  )
}
