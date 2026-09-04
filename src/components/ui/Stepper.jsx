import { C, mn, R } from '../../lib/theme.js'

export function Stepper({value,min,onChange,size,caption}){
  const lg = size==='lg'
  const btnSize = lg?36:28
  return(
    <div style={{display:'inline-flex',alignItems:'center',gap:lg?12:6,background:C.surfaceContainerHigh,borderRadius:R.pill,padding:lg?'12px 20px':'4px 6px'}}>
      <button onClick={()=>value>min&&onChange(value-1)} style={{width:btnSize,height:btnSize,borderRadius:R.pill,border:`1px solid ${C.outlineVariant}`,background:C.white,color:value<=min?C.outlineVariant:C.onSurface,cursor:value<=min?'default':'pointer',fontSize:lg?20:18,lineHeight:1,flexShrink:0,display:lg?'flex':undefined,alignItems:lg?'center':undefined,justifyContent:lg?'center':undefined}}>−</button>
      {lg?(
        <div style={{textAlign:'center',minWidth:50}}>
          <div style={{...mn,fontWeight:700,fontSize:28,color:C.primary,lineHeight:1}}>{value}</div>
          {caption&&<div style={{...mn,fontSize:10,fontWeight:700,letterSpacing:'0.07em',color:C.onSurfaceVariant,marginTop:2}}>{caption}</div>}
        </div>
      ):(
        <span style={{...mn,fontWeight:700,fontSize:17,color:C.onSurface,minWidth:20,textAlign:'center'}}>{value}</span>
      )}
      <button onClick={()=>onChange(value+1)} style={{width:btnSize,height:btnSize,borderRadius:R.pill,background:C.primary,color:'#fff',border:'none',cursor:'pointer',fontSize:lg?20:18,lineHeight:1,flexShrink:0,display:lg?'flex':undefined,alignItems:lg?'center':undefined,justifyContent:lg?'center':undefined}}>+</button>
    </div>
  )
}
