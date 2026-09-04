import { C, mn } from '../../lib/theme.js'

export function SecHead({text}){
  return <div style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.07em',color:C.onSurfaceVariant,marginBottom:10,textTransform:'uppercase'}}>{text}</div>
}
