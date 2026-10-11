import { C, mn, R } from '../lib/theme.js'
import { Sheet } from './ui/Sheet.jsx'
import { Icon } from './ui/Icon.jsx'
import { suggestDestination } from '../lib/share/classifyShare.js'

// Something was shared into the app (text or photos — a link goes straight to
// the recipe form). Ask where it belongs; the likelier answer is listed first.
export function ShareSheet({ share, onChoose, onDismiss }) {
  const suggested = suggestDestination(share)
  const what = share.kind === 'images'
    ? `${share.files.length} photo${share.files.length === 1 ? '' : 's'}`
    : `“${(share.title || share.text).slice(0, 80)}${(share.title || share.text).length > 80 ? '…' : ''}”`
  const options = [
    { id: 'recipe', icon: 'chefHat', title: 'Add as a new recipe', sub: 'Read it into the recipe form to check and save.' },
    { id: 'freezer', icon: 'fridge', title: 'Add to my freezer list', sub: 'Each line or labelled item becomes a freezer item.' },
  ].sort((a, b) => (a.id === suggested ? -1 : b.id === suggested ? 1 : 0))

  return (
    <Sheet title='Shared to 5 Minutes to Dinner' onClose={onDismiss}>
      <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, marginBottom:14, lineHeight:1.5 }}>What should we do with {what}?</div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {options.map((o, i) => (
          <button key={o.id} onClick={() => onChoose(o.id)} style={{ display:'flex', alignItems:'center', gap:12, textAlign:'left', border:`1.5px solid ${i === 0 ? C.primary : C.outlineVariant}`, background: i === 0 ? C.primaryFixed : C.white, borderRadius:R.lg, padding:'12px 14px', cursor:'pointer' }}>
            <Icon name={o.icon} size={20} color={C.primary}/>
            <span style={{ flex:1 }}>
              <span style={{ ...mn, display:'block', fontSize:14, fontWeight:700, color:C.onSurface }}>{o.title}</span>
              <span style={{ ...mn, display:'block', fontSize:12, color:C.onSurfaceVariant, marginTop:2 }}>{o.sub}</span>
            </span>
            <Icon name='chevronRight' size={16} color={C.outlineStrong}/>
          </button>
        ))}
      </div>
      <button onClick={onDismiss} style={{ ...mn, marginTop:14, width:'100%', border:'none', background:'none', color:C.onSurfaceVariant, fontSize:13, fontWeight:700, cursor:'pointer', padding:8 }}>Ignore this share</button>
    </Sheet>
  )
}
