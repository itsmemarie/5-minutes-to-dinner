import { C, mn } from '../../lib/theme.js'

export function CapLabel({text}){
  return <span style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.06em',color:C.onSurfaceVariant,textTransform:'uppercase'}}>{text}</span>
}
