import { C, mn, R } from '../../lib/theme.js'

// `strong` swaps a secondary button's text for the accessible darker orange.
export function Btn({label,full,onClick,disabled,secondary,small,strong}){
  return <button onClick={disabled?undefined:onClick} style={{...mn,background:disabled?C.surfaceContainerHigh:secondary?C.secondaryContainer:C.primary,color:disabled?C.outline:secondary?(strong?C.onSecondaryContainerStrong:C.onSecondaryContainer):C.onPrimary,border:'none',borderRadius:R.pill,padding:small?'9px 18px':'13px 22px',fontSize:small?13:15,fontWeight:700,cursor:disabled?'not-allowed':'pointer',width:full?'100%':undefined,opacity:disabled?0.72:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8}}>{label}</button>
}
