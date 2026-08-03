import { C, mn } from '../../lib/theme.js'

export function Stepper({value,min,onChange}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,background:C.surfaceContainerHigh,borderRadius:99,padding:'4px 6px'}}>
      <button onClick={()=>value>min&&onChange(value-1)} style={{width:28,height:28,borderRadius:99,border:`1px solid ${C.outlineVariant}`,background:C.white,color:value<=min?C.outlineVariant:C.onSurface,cursor:value<=min?'default':'pointer',fontSize:18,lineHeight:1,flexShrink:0}}>−</button>
      <span style={{...mn,fontWeight:700,fontSize:17,color:C.onSurface,minWidth:20,textAlign:'center'}}>{value}</span>
      <button onClick={()=>onChange(value+1)} style={{width:28,height:28,borderRadius:99,background:C.primary,color:'#fff',border:'none',cursor:'pointer',fontSize:18,lineHeight:1,flexShrink:0}}>+</button>
    </div>
  )
}
