import { C, mn } from '../../lib/theme.js'

export function PillBtn({label,active,onClick}){
  return <button onClick={onClick} style={{...mn,background:active?C.primary:C.secondaryContainer,color:active?C.onPrimary:C.onSecondaryContainer,border:'none',borderRadius:99,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{label}</button>
}
