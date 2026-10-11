import { C, mn, R, CARD } from '../../lib/theme.js'
import { Icon } from '../ui/Icon.jsx'
import { FIELD_LABELS } from '../../lib/recipeDraft.js'
import { APPLY_FAILURE_TEXT } from '../../lib/reviewSuggestions.js'

// Step 3's result. Each suggestion stands alone and is applied or skipped on
// its own; an applied one edits the recipe fields below in place. Constraint
// warnings (equipment they lack, a toddler eating it…) come first.
const clip = (s, n = 220) => (s.length > n ? `${s.slice(0, n)}…` : s)

function Suggestion({ s, onDecide }) {
  const settled = s.status !== 'pending'
  return (
    <div style={{ ...CARD, padding:'12px 14px', opacity: s.status === 'skipped' ? 0.6 : 1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <span style={{ ...mn, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:C.primary, background:C.primaryFixed, borderRadius:R.pill, padding:'2px 8px' }}>{FIELD_LABELS[s.field] || s.field}</span>
      </div>
      <div style={{ ...mn, fontSize:14, fontWeight:700, color:C.onSurface, marginBottom:3 }}>{s.title}</div>
      {s.why && <div style={{ ...mn, fontSize:12, color:C.onSurfaceVariant, lineHeight:1.5, marginBottom:8 }}>{s.why}</div>}
      <div style={{ ...mn, fontSize:12, lineHeight:1.5, background:C.surface, borderRadius:R.sm, padding:'8px 10px', marginBottom:10, whiteSpace:'pre-wrap' }}>
        {s.find?.trim() ? (
          <>
            <div style={{ color:C.onSurfaceVariant }}><b>Was:</b> <span style={{ textDecoration:'line-through' }}>{clip(s.find)}</span></div>
            <div style={{ color:C.onSurface, marginTop:4 }}><b>Now:</b> {clip(s.replace) || <i>(removed)</i>}</div>
          </>
        ) : (
          <div style={{ color:C.onSurface }}><b>Add:</b> {clip(s.replace)}</div>
        )}
      </div>
      {!settled ? (
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => onDecide(s.id, true)} style={{ ...mn, flex:1, border:'none', background:C.primary, color:C.onPrimary, borderRadius:R.pill, padding:'9px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Apply</button>
          <button onClick={() => onDecide(s.id, false)} style={{ ...mn, flex:1, border:`1px solid ${C.outlineVariant}`, background:'none', color:C.onSurface, borderRadius:R.pill, padding:'9px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Skip</button>
        </div>
      ) : (
        <div style={{ ...mn, fontSize:12, fontWeight:700, color: s.status === 'applied' ? C.primary : s.status === 'failed' ? C.errorInk : C.onSurfaceVariant, display:'flex', alignItems:'center', gap:6 }}>
          {s.status === 'applied' && <><Icon name='check' size={14} color={C.primary}/>Applied to the recipe</>}
          {s.status === 'skipped' && 'Skipped'}
          {s.status === 'failed' && (APPLY_FAILURE_TEXT[s.reason] || "Couldn't apply this one.")}
        </div>
      )}
    </div>
  )
}

export function ReviewPanel({ review, onDecide, onClose }) {
  const { suggestions, warnings } = review
  const pending = suggestions.filter(s => s.status === 'pending').length
  return (
    <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:10 }}>
      {warnings.length > 0 && (
        <div style={{ background:C.secondaryContainer, borderRadius:R.lg, padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <Icon name='alertTriangle' size={16} color={C.onSecondaryContainerStrong}/>
            <span style={{ ...mn, fontSize:13, fontWeight:700, color:C.onSecondaryContainerStrong }}>Heads-up for your kitchen</span>
          </div>
          {warnings.map((w, i) => (
            <div key={i} style={{ ...mn, fontSize:12, lineHeight:1.55, color:C.onSurface, paddingTop: i ? 8 : 0, marginTop: i ? 8 : 0, borderTop: i ? `1px solid ${C.accent2_300}60` : undefined }}>
              {w.constraint && <b>{w.constraint}: </b>}{w.issue}
              {w.workaround && <div style={{ color:C.onSecondaryContainerStrong, marginTop:2 }}><b>Try:</b> {w.workaround}</div>}
            </div>
          ))}
        </div>
      )}
      {suggestions.length === 0 ? (
        <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, background:C.white, borderRadius:R.md, padding:'10px 12px' }}>No changes suggested. This recipe looks good to go.</div>
      ) : suggestions.map(s => <Suggestion key={s.id} s={s} onDecide={onDecide}/>)}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ ...mn, fontSize:12, color:C.onSurfaceVariant }}>{pending ? `${pending} suggestion${pending === 1 ? '' : 's'} to decide` : 'All reviewed'}</span>
        <button onClick={onClose} style={{ ...mn, border:'none', background:'none', color:C.primary, fontSize:12, fontWeight:700, cursor:'pointer', padding:4 }}>Hide review</button>
      </div>
    </div>
  )
}
