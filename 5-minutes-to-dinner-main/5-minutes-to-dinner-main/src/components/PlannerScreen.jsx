import { useState } from 'react'
import { C, ep, mn, CARD } from '../lib/theme.js'
import { DAYS, DAY_LBL, TODAY, WEEK_LBL } from '../lib/dateHelpers.js'
import { Btn, CapLabel, TodayTag } from './ui/index.js'
import { NewRecipeForm } from './NewRecipeForm.jsx'

export function PlannerScreen({plan,removeMeal,moveMeal,duplicateMeal,onDayOpen,onNutrition,onShoppingList,onRecipeCreated,onCopy}){
  const [drag,setDrag]=useState(null)   // {mealId,fromDay,section}
  const [over,setOver]=useState(null)   // day string being hovered
  const [showNewRecipe,setShowNewRecipe]=useState(false)
  const [copied,setCopied]=useState(false)
  const handleCopy=()=>{onCopy();setCopied(true);setTimeout(()=>setCopied(false),2000)}
  const onDragStart=(e,mealId,fromDay,section)=>{e.stopPropagation();e.dataTransfer.effectAllowed='move';setDrag({mealId,fromDay,section})}
  const onDragEnd=()=>{setDrag(null);setOver(null)}
  const onDragOver=(e,day)=>{e.preventDefault();e.dataTransfer.dropEffect='move';if(over!==day)setOver(day)}
  const onDragLeave=(e)=>{if(!e.currentTarget.contains(e.relatedTarget))setOver(null)}
  const onDrop=(e,day)=>{e.preventDefault();if(!drag)return;const{mealId,fromDay,section}=drag;setDrag(null);setOver(null);moveMeal(fromDay,day,mealId,section)}
  return(
    <div style={{padding:'0 20px 20px'}}>
      {showNewRecipe&&<NewRecipeForm defaultMealType='main' onSave={r=>{onRecipeCreated(r);setShowNewRecipe(false)}} onCancel={()=>setShowNewRecipe(false)}/>}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 0 0'}}>
        <Btn label='+ New Recipe' small onClick={()=>setShowNewRecipe(true)}/>
        <button onClick={handleCopy} style={{...mn,background:copied?'#f0fff4':C.secondaryContainer,color:copied?'#1a7a3a':C.onSecondaryContainer,border:'none',borderRadius:99,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.2s'}}>
          {copied?'✓ Copied':'📋 Copy week'}
        </button>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0 12px'}}>
        <div style={{...ep,fontSize:22,color:C.onSurface}}>Weekly Planner</div>
        <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,background:C.surfaceContainerHigh,padding:'5px 10px',borderRadius:99}}>{WEEK_LBL} ▾</div>
      </div>
      <button onClick={onNutrition} style={{width:'100%',background:C.secondaryContainer,color:C.onSecondaryContainer,border:'none',borderRadius:12,padding:'13px',...mn,fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        📊 Calculate Nutritional Insights
      </button>
      {DAYS.map(day=>{
        const meals=[...plan[day].breakfast,...plan[day].main,...plan[day].side]
        const isToday=day===TODAY
        return(
          <div key={day} style={{marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{...ep,fontSize:16,color:isToday?C.primary:C.onSurface}}>{DAY_LBL[day]}</span>
              {isToday&&<span style={{...mn,fontSize:10,fontWeight:700,background:'transparent',border:`1px solid ${C.tertiary}`,color:C.tertiary,padding:'2px 7px',borderRadius:99}}>Today</span>}
            </div>
            {meals.length===0?(
              <div onDragOver={e=>onDragOver(e,day)} onDragLeave={onDragLeave} onDrop={e=>onDrop(e,day)} style={{...CARD,padding:22,display:'flex',flexDirection:'column',alignItems:'center',gap:8,outline:over===day&&drag?.fromDay!==day?`2px solid ${C.primary}`:'2px solid transparent',transition:'outline 0.12s'}}>
                <span style={{fontSize:26,opacity:0.3}}>🍽</span>
                <span style={{...mn,fontSize:12,color:C.outlineVariant,fontStyle:'italic'}}>"So you're going hungry."</span>
                <button onClick={()=>onDayOpen(day)} style={{...mn,background:'none',border:`1px solid ${C.primary}`,color:C.primary,borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer',marginTop:4}}>+ Plan Meals</button>
              </div>
            ):(
              <div onDragOver={e=>onDragOver(e,day)} onDragLeave={onDragLeave} onDrop={e=>onDrop(e,day)} style={{...CARD,overflow:'hidden',outline:over===day&&drag?.fromDay!==day?`2px solid ${C.primary}`:'2px solid transparent',transition:'outline 0.12s'}}>
                {meals.map((m,i)=>(
                  <div key={m.id} draggable onDragStart={e=>onDragStart(e,m.id,day,m.section)} onDragEnd={onDragEnd} onClick={()=>onDayOpen(day)} style={{padding:'10px 14px',borderBottom:i<meals.length-1?`1px solid ${C.outlineVariant}25`:undefined,display:'flex',flexDirection:isToday?'column':'row',alignItems:isToday?'stretch':'center',gap:isToday?4:0,cursor:drag?'grabbing':'grab',opacity:drag?.mealId===m.id?0.45:1,transition:'opacity 0.15s'}}>
                    {isToday&&(
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                        <span style={{...mn,fontSize:13,fontWeight:600,color:C.onSurface}}>{m.name}</span>
                        <TodayTag/>
                      </div>
                    )}
                    <div style={{display:'flex',alignItems:'center'}}>
                      <div style={{flex:1}}>
                        {!isToday&&<div style={{...mn,fontSize:13,fontWeight:600,color:C.onSurface}}>{m.name}</div>}
                        <div style={{display:'flex',gap:8,marginTop:2}}>
                          <CapLabel text={m.section==='breakfast'?'Breakfast':m.section==='main'?'Main':'Side'}/>
                          <span style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>🕒 {m.prep}m</span>
                          {m.portion!==4&&<span style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>👥 {m.portion}</span>}
                        </div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();duplicateMeal(day,m.section,m.id)}} title='Duplicate' style={{border:'none',background:'none',color:C.outlineVariant,cursor:'pointer',fontSize:14,padding:'0 0 0 10px'}}>⧉</button>
                      <button onClick={e=>{e.stopPropagation();removeMeal(day,m.section,m.id)}} style={{border:'none',background:'none',color:C.outlineVariant,cursor:'pointer',fontSize:14,padding:'0 0 0 10px'}}>✕</button>
                    </div>
                  </div>
                ))}
                <button onClick={()=>onDayOpen(day)} style={{width:'100%',background:'none',border:'none',padding:'10px 14px',textAlign:'left',...mn,fontSize:13,color:C.primary,fontWeight:600,cursor:'pointer',borderTop:`1px dashed ${C.outlineVariant}60`}}>＋ Add Meal</button>
              </div>
            )}
          </div>
        )
      })}
      <div style={{position:'sticky',bottom:10,padding:'8px 0'}}>
        <button onClick={onShoppingList} style={{width:'100%',background:C.primary,color:C.onPrimary,border:'none',borderRadius:12,padding:'14px',...mn,fontSize:14,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(45,96,47,0.3)'}}>
          🛒 Generate Shopping List
        </button>
      </div>
    </div>
  )
}
