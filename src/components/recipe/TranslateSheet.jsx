import { C, mn, R } from '../../lib/theme.js'
import { Btn } from '../ui/Btn.jsx'
import { Sheet } from '../ui/Sheet.jsx'

// Asked once per draft, after "Fill in the gaps" finds the recipe in another
// language and Settings › Translate recipes is on Ask. Dismissing the sheet
// keeps the original, and the AI help card still offers to translate it later.
export function TranslateSheet({ from, to, onTranslate, onKeep }) {
  const keep = { ...mn, border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'12px', fontSize:14, fontWeight:700, color:C.onSurface, cursor:'pointer' }
  return (
    <Sheet title='Translate this recipe?' onClose={onKeep}>
      <div style={{ ...mn, fontSize:14, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:18 }}>
        It's written in {from}. Translate it to {to}, including the details just added? The {from} text isn't kept.
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <Btn label={`Translate to ${to}`} full onClick={onTranslate}/>
        <button onClick={onKeep} style={keep}>Keep it in {from}</button>
      </div>
      <div style={{ ...mn, fontSize:12, color:C.onSurfaceVariant, lineHeight:1.5, marginTop:14, textAlign:'center' }}>You can change the language, and whether this asks, in Settings.</div>
    </Sheet>
  )
}
