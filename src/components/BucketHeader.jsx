import { C, ep, mn, R } from '../lib/theme.js'

// A picker bucket's heading: title, count pill and subtitle on the left, an
// optional action (a button or two) on the right. `id` goes on the h2, so the
// bucket's <section> can point at it with aria-labelledby.
export function BucketHeader({ id, title, count, subtitle, action }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:'2px 8px' }}>
          <h2 id={id} style={{ ...ep, fontSize:21, lineHeight:1.2, color:C.onSurface, margin:0 }}>{title}</h2>
          {count != null && (
            <span style={{ ...mn, fontSize:12, fontWeight:700, color:C.primary, background:C.primaryFixed, padding:'2px 9px', borderRadius:R.pill }}>
              {count}
            </span>
          )}
        </div>
        {subtitle && (
          <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{subtitle}</div>
        )}
      </div>
      {action && <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>{action}</div>}
    </div>
  )
}
