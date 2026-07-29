import { C, mn } from '../../lib/theme.js'

export function Spinner({msg='Loading…'}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,gap:14,padding:40,minHeight:200}}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:36,height:36,border:`3px solid ${C.secondaryContainer}`,borderTop:`3px solid ${C.primary}`,borderRadius:'50%',animation:'sp 0.9s linear infinite'}}/>
      <span style={{...mn,fontSize:13,color:C.onSurfaceVariant}}>{msg}</span>
    </div>
  )
}
