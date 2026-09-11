import { C, ep, mn, CARD, R } from '../../lib/theme.js'
import { Icon } from '../ui/Icon.jsx'

// ─── Settings primitives ──────────────────────────────────────────
// The three patterns every settings section is built from — section heading,
// row card, list switch — plus the small controls that sit at the end of a
// row. Shared only by the settings screens; nothing here knows about data.

// #c8d6c5 at 19% / 35% — the in-card row divider and the expanded-section divider.
export const ROW_DIVIDER     = `${C.outlineVariant}30`
export const SECTION_DIVIDER = `${C.outlineVariant}59`

export function SectionHeading({ children, sub, first }) {
  return (
    <>
      <div style={{ ...ep, fontSize:15, color:C.onSurface, margin: first ? '0 0 10px' : sub ? '22px 0 4px' : '22px 0 10px' }}>{children}</div>
      {sub && <div style={{ ...mn, fontSize:12, color:C.onSurfaceVariant, lineHeight:1.5, marginBottom:10 }}>{sub}</div>}
    </>
  )
}

// `flush` drops the inner padding so a section can lay out its own full-width
// blocks (the expandable Your children / Weight goal cards).
export function RowCard({ children, flush, style }) {
  return <div style={{ ...CARD, padding: flush ? 0 : '4px 14px', ...style }}>{children}</div>
}

// One row: optional title/sub on the left, `children` on the right. Rows after
// the first inside a card pass `divider`. `onClick` makes the whole row the
// target (chevron rows), with a 44px minimum height.
export function Row({ title, sub, children, divider, onClick, gap = 12, padding = '13px 0', titleColor, titleWeight, style }) {
  const hasSub = !!sub
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap, padding, minHeight: onClick ? 44 : undefined, borderTop: divider ? `1px solid ${ROW_DIVIDER}` : undefined, cursor: onClick ? 'pointer' : undefined, ...style }}>
      {(title || sub) && (
        <div style={{ flex:1, minWidth:0 }}>
          {title && <div style={{ ...mn, fontSize:14, fontWeight: titleWeight ?? (hasSub ? 600 : 400), color: titleColor || C.onSurface }}>{title}</div>}
          {sub && <div style={{ ...mn, fontSize:12, color:C.onSurfaceVariant, lineHeight:1.5, marginTop:2 }}>{sub}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function Chevron({ color = C.outlineStrong }) {
  return <span style={{ display:'flex', flexShrink:0 }}><Icon name='chevronRight' size={16} color={color} strokeWidth={2.5}/></span>
}

// Trailing value + chevron for navigational rows.
export function RowValue({ children }) {
  return (
    <>
      {children != null && <span style={{ ...mn, fontSize:13, fontWeight:600, color:C.onSurfaceVariant, flexShrink:0 }}>{children}</span>}
      <Chevron/>
    </>
  )
}

// `sm` (40×22) for list rows; `md` (46×27) for the two section-opening master toggles.
const SWITCH_SIZES = {
  sm: { w:40, h:22, knob:16, inset:3 },
  md: { w:46, h:27, knob:21, inset:3 },
}
export function Switch({ on, onClick, size = 'sm', disabled }) {
  const s = SWITCH_SIZES[size]
  return (
    <div role='switch' aria-checked={!!on} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}
      style={{ width:s.w, height:s.h, borderRadius:R.pill, background: on ? C.primary : C.outlineVariant, position:'relative', flexShrink:0, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition:'background 0.15s' }}>
      <div style={{ position:'absolute', top:s.inset, left: on ? s.w - s.knob - s.inset : s.inset, width:s.knob, height:s.knob, borderRadius:R.pill, background:'#fff', transition:'left 0.15s' }}/>
    </div>
  )
}

// Segmented pill. `compact` is the 11px trailing control used on Region & units
// rows; the default is the full-width form the goal section uses.
export function SegPill({ options, value, onChange, upper, compact }) {
  return (
    <div style={{ display:'flex', background:C.surfaceContainerHigh, borderRadius:R.pill, padding: compact ? 2 : 3, flexShrink:0 }}>
      {options.map(o => {
        const sel = value === o.value
        return (
          <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={sel}
            style={{ ...mn, flex: compact ? undefined : 1, padding: compact ? '5px 12px' : o.small ? '8px 4px' : 9, borderRadius:R.pill, border:'none', background: sel ? C.primary : 'transparent', color: sel ? C.onPrimary : C.onSurfaceVariant, fontWeight:700, fontSize: compact || o.small ? 11 : 12, letterSpacing:'0.04em', textTransform: upper ? 'uppercase' : undefined, cursor:'pointer', whiteSpace:'nowrap' }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Compact stepper for the default-portion row.
export function InlineStepper({ value, min = 1, onChange }) {
  const atMin = value <= min
  const btn = { width:30, height:30, borderRadius:R.pill, border:'none', fontSize:17, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0 }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, background:ROW_DIVIDER, borderRadius:R.pill, padding:3, flexShrink:0 }}>
      <button onClick={() => !atMin && onChange(value - 1)} disabled={atMin} aria-label='Fewer portions'
        style={{ ...btn, background:'#fff', color: atMin ? C.outlineVariant : C.onSurface, boxShadow:'0 1px 4px rgba(0,0,0,0.1)', cursor: atMin ? 'default' : 'pointer' }}>−</button>
      <span style={{ ...mn, fontSize:15, fontWeight:700, color:C.onSurface, minWidth:16, textAlign:'center', fontVariantNumeric:'tabular-nums' }}>{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label='More portions'
        style={{ ...btn, background:C.primary, color:'#fff', cursor:'pointer' }}>+</button>
    </div>
  )
}

// Labelled input box used by the goal section and the child editor.
export function FieldBox({ label, children, emphasise }) {
  return (
    <div>
      <div style={{ ...mn, fontSize:10, fontWeight:700, color:C.onSurfaceVariant, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>{label}</div>
      <div style={{ border:`${emphasise ? 1.5 : 1}px solid ${emphasise ? C.primary : C.outlineVariant}`, borderRadius:R.md, padding:'10px 12px', display:'flex', alignItems:'baseline', gap:5 }}>
        {children}
      </div>
    </div>
  )
}
export const fieldInputStyle = { ...mn, border:'none', outline:'none', background:'none', fontWeight:700, fontSize:15, width:'100%', padding:0, color:C.onSurface }

// 10px uppercase label above a group inside an expanded section.
export function GroupLabel({ children, style }) {
  return <div style={{ ...mn, fontSize:10, fontWeight:700, color:C.onSurfaceVariant, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8, ...style }}>{children}</div>
}

// Blocking confirmation for destructive rows. Rendered inline by the screen
// that needs it; the overlay covers the app frame (max 430px wide).
export function ConfirmDialog({ title, body, confirmLabel = 'Confirm', destructive, busy, onConfirm, onCancel }) {
  return (
    <div onClick={busy ? undefined : onCancel} style={{ position:'fixed', inset:0, zIndex:40, background:'rgba(24,36,23,0.42)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:430, background:C.white, borderRadius:'16px 16px 0 0', padding:'8px 20px 22px' }}>
        <div style={{ width:44, height:4, borderRadius:R.pill, background:C.outlineVariant, margin:'0 auto 16px' }}/>
        <div style={{ ...ep, fontSize:19, color: destructive ? C.errorInk : C.onSurface, marginBottom:8 }}>{title}</div>
        <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:18 }}>{body}</div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onCancel} disabled={busy} style={{ ...mn, flex:1, border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'12px', fontSize:14, fontWeight:700, color:C.onSurface, cursor:'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={{ ...mn, flex:1, border:'none', background: destructive ? C.errorInk : C.primary, borderRadius:R.pill, padding:'12px', fontSize:14, fontWeight:700, color:'#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
