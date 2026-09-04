import { C, mn, R } from '../../lib/theme.js'

export function TodayTag(){
  return <span style={{...mn,fontSize:10,fontWeight:700,background:'transparent',border:`1px solid ${C.tertiary}`,color:C.tertiary,padding:'2px 10px',borderRadius:R.pill}}>Today</span>
}
