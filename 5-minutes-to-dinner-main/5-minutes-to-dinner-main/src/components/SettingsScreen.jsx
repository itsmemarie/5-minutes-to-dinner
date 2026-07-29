import { C, ep, mn, CARD } from '../lib/theme.js'

export function SettingsScreen({defPort,setDefPort}){
  return(
    <div style={{padding:'20px 20px 40px'}}>
      <div style={{...ep,fontSize:26,color:C.onSurface,marginBottom:4}}>Settings</div>
      <div style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:20}}>Customise your culinary experience</div>
      <div style={{...CARD}}>
        <div style={{background:C.secondaryContainer,borderRadius:'10px 10px 0 0',padding:'12px 16px',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:18}}>🍴</span>
          <span style={{...ep,fontSize:16,color:C.onSecondaryContainer}}>Meal Planning Defaults</span>
        </div>
        <div style={{padding:'28px 20px',textAlign:'center'}}>
          <div style={{...ep,fontSize:16,color:C.onSurface,marginBottom:6}}>Default Portion Size</div>
          <div style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:24,lineHeight:1.5}}>Base for scaling all recipes in your planner.</div>
          <div style={{display:'inline-flex',alignItems:'center',gap:12,background:C.surfaceContainerHigh,borderRadius:99,padding:'12px 20px'}}>
            <button onClick={()=>defPort>1&&setDefPort(defPort-1)} style={{width:36,height:36,borderRadius:8,border:`1px solid ${C.outlineVariant}`,background:C.white,color:defPort<=1?C.outlineVariant:C.onSurface,cursor:defPort<=1?'default':'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
            <div style={{textAlign:'center',minWidth:50}}>
              <div style={{...ep,fontSize:28,color:C.primary,lineHeight:1}}>{defPort}</div>
              <div style={{...mn,fontSize:10,fontWeight:700,letterSpacing:'0.07em',color:C.onSurfaceVariant,marginTop:2}}>SERVINGS</div>
            </div>
            <button onClick={()=>setDefPort(defPort+1)} style={{width:36,height:36,borderRadius:8,background:C.primary,color:'#fff',border:'none',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
          </div>
        </div>
      </div>
      <div style={{marginTop:20,...CARD,padding:16}}>
        <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.05em',marginBottom:12,textTransform:'uppercase'}}>Connected to Supabase</div>
        {[['Project','5 Minutes to Dinner'],['Region','eu-west-1'],['Recipes','Live from your database'],['Plan data','Saved in real time'],['Ratings','Persisted per meal instance']].map(([k,v])=>(
          <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.outlineVariant}30`,gap:12}}>
            <span style={{...mn,fontSize:12,color:C.onSurfaceVariant,flexShrink:0}}>{k}</span>
            <span style={{...mn,fontSize:12,fontWeight:600,color:C.onSurface,textAlign:'right'}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
