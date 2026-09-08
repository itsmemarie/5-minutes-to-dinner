import { C, mn } from '../../lib/theme.js'

// 34px ring: r=14, stroke-width=4, circumference≈88, 12 o'clock start, round cap.
function Ring({ pct, color }) {
  const FULL = 88
  const dash = Math.max(0, Math.min(1, pct)) * FULL
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" style={{flexShrink:0}}>
      <circle cx="17" cy="17" r="14" fill="none" stroke={C.outlineVariant} strokeWidth="4"/>
      <circle cx="17" cy="17" r="14" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${dash} ${FULL}`} transform="rotate(-90 17 17)"/>
    </svg>
  )
}

function Cell({ consumed, target, label, color, fmt }) {
  const remaining = Math.max(0, target - consumed)
  return (
    <div style={{flex:1,display:'flex',alignItems:'center',gap:7}}>
      <Ring pct={target ? consumed / target : 0} color={color}/>
      <div style={{minWidth:0,fontVariantNumeric:'tabular-nums'}}>
        <div style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface,lineHeight:1.15}}>{fmt(remaining)}</div>
        <div style={{...mn,fontSize:10,color:C.onSurfaceVariant,lineHeight:1.3}}>{label}</div>
        <div style={{...mn,fontSize:10,color:C.onSurfaceVariant,opacity:0.8,lineHeight:1.3}}>{fmt(consumed)} / {fmt(target)}</div>
      </div>
    </div>
  )
}

// dayTotals: from goalMaths.dayNutritionTotals — {calories, protein, fibre, hasData}
export function BudgetStrip({ dayTotals, targets }) {
  const c = dayTotals?.hasData ? dayTotals.calories : 0
  const p = dayTotals?.hasData ? dayTotals.protein  : 0
  const f = dayTotals?.hasData ? dayTotals.fibre    : 0
  const fmtCal = n => Math.round(n).toLocaleString('en-GB')
  const fmtG   = n => `${Math.round(n)}g`
  return (
    <div style={{background:'#f3f8f2',borderBottom:`1px solid ${C.outlineVariant}99`,padding:'11px 14px',display:'flex',gap:6,margin:'0 -20px 4px'}}>
      <Cell consumed={c} target={targets.calories} label="cal left"      color={C.primary}   fmt={fmtCal}/>
      <Cell consumed={p} target={targets.protein}  label="protein left" color={C.tertiary}   fmt={fmtG}/>
      <Cell consumed={f} target={targets.fibre}    label="fibre left"   color="#A86000"      fmt={fmtG}/>
    </div>
  )
}
