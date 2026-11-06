import { C, mn, R } from '../../lib/theme.js'

// Says which week a screen is showing when it isn't this one. `onBack` is left
// out on screens that can't change week, such as nutrition.
export function WeekBanner({ label, onBack }) {
  return (
    <div role='status' style={{ ...mn, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, margin:'12px 20px 0', padding:'9px 14px', background:C.primaryFixed, borderRadius:R.md, fontSize:12, color:C.primary }}>
      <span style={{ fontWeight:700, whiteSpace:'nowrap' }}>{label}</span>
      {onBack && <button onClick={onBack} style={{ ...mn, border:'none', background:'none', padding:0, fontSize:12, fontWeight:700, color:C.primary, textDecoration:'underline', cursor:'pointer', whiteSpace:'nowrap' }}>Back to this week</button>}
    </div>
  )
}
