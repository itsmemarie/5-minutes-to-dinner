import { C, mn, CARD, R } from '../../lib/theme.js'
import { Icon } from './Icon.jsx'

// Full-width card-button that opens the Toddler cooking screen (current age
// activities + what's coming next). Shared by RecipeScreen and BatchScreen.
export function NeedMoreIdeasBtn({ onClick }) {
  if (!onClick) return null
  return (
    <button
      onClick={onClick}
      style={{
        ...CARD, width:'100%', padding:'14px 16px', display:'flex', alignItems:'center', gap:12,
        border:`1px solid ${C.accent2_300}`, background:C.accent2_100, cursor:'pointer', textAlign:'left',
      }}
    >
      <span style={{fontSize:22}}>🧸</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{...mn,fontSize:14,fontWeight:700,color:C.onSurface}}>Need more ideas?</div>
        <div style={{...mn,fontSize:12,color:C.onSurfaceVariant}}>Age-appropriate activities &amp; what's coming next</div>
      </div>
      <Icon name='chevronRight' size={18} color={C.accent2_700}/>
    </button>
  )
}
