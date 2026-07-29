import { C, mn } from '../../lib/theme.js'

export function Btn({label,full,onClick,disabled,secondary,small}){
  return <button onClick={disabled?undefined:onClick} style={{...mn,background:disabled?C.surfaceContainerHigh:secondary?C.secondaryContainer:C.primary,color:disabled?C.outline:secondary?C.onSecondaryContainer:C.onPrimary,border:'none',borderRadius:99,padding:small?'9px 18px':'13px 22px',fontSize:small?13:15,fontWeight:700,cursor:disabled?'not-allowed':'pointer',width:full?'100%':undefined,opacity:disabled?0.72:1}}>{label}</button>
}
