import { C, mn } from '../../lib/theme.js'

export function TodayTag(){
  return <span style={{...mn,background:C.tertiaryFixed,color:C.onTertiaryFixed,fontSize:9,fontWeight:700,letterSpacing:'0.08em',padding:'3px 8px',borderRadius:99,textTransform:'uppercase',whiteSpace:'nowrap',flexShrink:0}}>TODAY'S PLAN</span>
}
