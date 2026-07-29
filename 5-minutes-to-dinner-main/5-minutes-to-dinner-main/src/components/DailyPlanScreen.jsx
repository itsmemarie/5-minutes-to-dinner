import { useState } from 'react'
import { C, ep, mn, CARD } from '../lib/theme.js'
import { DAY_LBL } from '../lib/dateHelpers.js'
import { Btn, Stepper } from './ui/index.js'

export function DailyPlanScreen({day,plan,updatePortion,removeMeal,duplicateMeal,onAddToSection,onSave}){
  const [saved,setSaved]=useState(false)
  const secs=[{key:'breakfast',label:'Breakfast'},{key:'main',label:'Main Meal'},{key:'side',label:'Side Dish'}]
  const go=()=>{setSaved(true);setTimeout(()=>{setSaved(false);onSave()},1000)}
  return(
    <div style={{padding:'0 20px'}}>
      <div style={{...ep,fontSize:24,color:C.onSurface,padding:'16px 0 12px'}}>{DAY_LBL[day]}</div>
      {secs.map(s=>(
        <div key={s.key} style={{marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{...ep,fontSize:15,color:C.onSurface}}>{s.label}</span>
            <button onClick={()=>onAddToSection(day,s.key)} style={{...mn,background:'none',border:'none',color:C.primary,fontWeight:700,fontSize:13,cursor:'pointer'}}>＋ Add</button>
          </div>
          {plan[day][s.key].length===0?(
            <div onClick={()=>onAddToSection(day,s.key)} style={{border:`2px dashed ${C.outlineVariant}`,borderRadius:10,padding:20,display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer'}}>
              <span style={{fontSize:22,color:C.outlineVariant}}>⊕</span>
              <span style={{...mn,fontSize:13,color:C.outlineVariant}}>Tap to add {s.label.toLowerCase()}</span>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {plan[day][s.key].map(m=>(
                <div key={m.id} style={{...CARD,padding:'14px 14px 10px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
                    <span style={{...mn,fontSize:14,fontWeight:600,color:C.onSurface,flex:1,marginRight:8}}>{m.name}</span>
                    <button onClick={()=>duplicateMeal(day,s.key,m.id)} title='Duplicate' style={{border:'none',background:'none',color:C.onSurfaceVariant,cursor:'pointer',fontSize:16,padding:0,marginRight:12}}>⧉</button>
                    <button onClick={()=>removeMeal(day,s.key,m.id)} style={{border:'none',background:'none',color:C.error,cursor:'pointer',fontSize:16,padding:0}}>🗑</button>
                  </div>
                  <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,marginBottom:10}}>🕒 {m.prep}m prep</div>
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <Stepper value={m.portion} min={m.min} onChange={v=>updatePortion(day,s.key,m.id,v)}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div style={{height:80}}/>
      <div style={{position:'fixed',bottom:64,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,padding:'10px 20px',background:C.surface,borderTop:`1px solid ${C.outlineVariant}30`}}>
        {saved
          ?<div style={{...mn,textAlign:'center',fontSize:14,fontWeight:700,color:'#1a7a3a',padding:'13px',background:'#f0fff4',borderRadius:12}}>✓ Saved!</div>
          :<Btn label='✓  Save Day' full onClick={go}/>}
      </div>
    </div>
  )
}
