import { C, mn, R } from '../../lib/theme.js'

export function TodayTag(){
  return <span style={{...mn,fontSize:11,fontWeight:700,background:C.primaryFixed,border:`1px solid ${C.primary}`,color:C.primary,padding:'2px 9px',borderRadius:R.pill}}>Today</span>
}
