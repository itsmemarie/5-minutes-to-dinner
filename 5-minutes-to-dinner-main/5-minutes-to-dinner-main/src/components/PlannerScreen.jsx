import { useState } from 'react'
import { C, ep, mn, CARD, screenTitle } from '../lib/theme.js'
import { DAYS, DAY_LBL, TODAY, WEEK_LBL } from '../lib/dateHelpers.js'
import { Btn, Icon } from './ui/index.js'

const SEC_LBL = { breakfast:'Breakfast', main:'Main', side:'Side' }

// e.g. 4 -> "4h", 24 -> "1d", 1.5 -> "1.5h"
const formatAdvance = h => {
  const n = Number(h)
  if (n >= 24 && n % 24 === 0) return `${n/24}d`
  return `${Number.isInteger(n) ? n : n.toFixed(1)}h`
}

export function PlannerScreen({plan,removeMeal,moveMeal,duplicateMeal,updatePortion,onDayOpen,onNutrition}){
  const [drag,setDrag]=useState(null)   // {mealId,fromDay,section}
  const [over,setOver]=useState(null)   // day string being hovered
  const [servingsOpenId,setServingsOpenId]=useState(null)   // meal id whose servings panel is expanded
  const onDragStart=(e,mealId,fromDay,section)=>{e.stopPropagation();e.dataTransfer.effectAllowed='move';setDrag({mealId,fromDay,section})}
  const onDragEnd=()=>{setDrag(null);setOver(null)}
  const onDragOver=(e,day)=>{e.preventDefault();e.dataTransfer.dropEffect='move';if(over!==day)setOver(day)}
  const onDragLeave=(e)=>{if(!e.currentTarget.contains(e.relatedTarget))setOver(null)}
  const onDrop=(e,day)=>{e.preventDefault();if(!drag)return;const{mealId,fromDay,section}=drag;setDrag(null);setOver(null);moveMeal(fromDay,day,mealId,section)}
  return(
    <div style={{padding:'16px 20px 20px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
        <div style={{...screenTitle,color:C.onSurface}}>Weekly planner</div>
        <span style={{...mn,fontSize:12,color:C.onSurfaceVariant,background:C.surfaceContainerHigh,padding:'5px 12px',borderRadius:99,whiteSpace:'nowrap'}}>{WEEK_LBL}</span>
      </div>
      <button onClick={onNutrition} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'none',background:C.secondaryContainer,color:'#924b1a',borderRadius:999,padding:'12px 14px',...mn,fontWeight:700,fontSize:14,whiteSpace:'nowrap',cursor:'pointer',marginBottom:20}}>
        <Icon name='barChart3' size={16}/>Calculate nutritional insights
      </button>
      {DAYS.map(day=>{
        const meals=[...plan[day].breakfast,...plan[day].main,...plan[day].side]
        const isToday=day===TODAY
        return(
          <div key={day} style={{marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{...ep,fontSize:16,color:isToday?C.primary:C.onSurface}}>{DAY_LBL[day]}</span>
              {isToday&&(
                <span style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase',display:'inline-flex',alignItems:'center',gap:6,color:C.tertiary}}>
                  <span style={{width:6,height:6,borderRadius:99,background:C.tertiary,display:'inline-block'}}/>Today
                </span>
              )}
            </div>
            {meals.length===0?(
              <div onDragOver={e=>onDragOver(e,day)} onDragLeave={onDragLeave} onDrop={e=>onDrop(e,day)} style={{...CARD,padding:22,display:'flex',flexDirection:'column',alignItems:'center',gap:8,outline:over===day&&drag?.fromDay!==day?`2px solid ${C.primary}`:'2px solid transparent',transition:'outline 0.12s'}}>
                <Icon name='utensilsCrossed' size={24} color={C.outlineVariant}/>
                <span style={{...mn,fontSize:12,color:C.outlineVariant,fontStyle:'italic'}}>"So you're going hungry."</span>
                <button onClick={()=>onDayOpen(day)} style={{...mn,display:'flex',alignItems:'center',gap:6,background:'none',border:`1px solid ${C.primary}`,color:C.primary,borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer',marginTop:4}}>
                  <Icon name='plus' size={13}/>Plan meals
                </button>
              </div>
            ):(
              <div onDragOver={e=>onDragOver(e,day)} onDragLeave={onDragLeave} onDrop={e=>onDrop(e,day)} style={{...CARD,overflow:'hidden',outline:over===day&&drag?.fromDay!==day?`2px solid ${C.primary}`:'2px solid transparent',transition:'outline 0.12s'}}>
                {meals.map((m,i)=>(
                  <div key={m.id} draggable onDragStart={e=>onDragStart(e,m.id,day,m.section)} onDragEnd={onDragEnd} onClick={()=>onDayOpen(day)} style={{padding:'11px 14px',borderBottom:i<meals.length-1?`1px solid ${C.outlineVariant}25`:undefined,display:'flex',flexDirection:'column',alignItems:'stretch',cursor:drag?'grabbing':'grab',opacity:drag?.mealId===m.id?0.45:1,transition:'opacity 0.15s'}}>
                    <div style={{display:'flex',alignItems:'center',width:'100%'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{...mn,fontSize:13,fontWeight:600,color:C.onSurface,marginBottom:3}}>{m.name}</div>
                        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                          <span style={{...mn,fontSize:11,color:C.onSurface,opacity:0.55}}>{SEC_LBL[m.section]}</span>
                          <span style={{...mn,fontSize:11,color:C.onSurface,opacity:0.6}}>{m.prep}m</span>
                          {m.advancePrepHours>0&&(
                            <span title={m.advancePrepNote||undefined} style={{...mn,fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',gap:4,color:C.onSecondaryContainer}}>
                              <Icon name='alarmClock' size={11} color={C.onSecondaryContainer}/>Start {formatAdvance(m.advancePrepHours)} ahead
                            </span>
                          )}
                          <span onClick={e=>{e.stopPropagation();setServingsOpenId(id=>id===m.id?null:m.id)}} style={{...mn,fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',gap:3,background:C.primaryFixed,color:C.primary,padding:'2px 7px',borderRadius:99,cursor:'pointer'}}>
                            <Icon name='utensilsCrossed' size={11} color={C.primary}/>{m.portion}
                            <span style={{display:'flex',transform:servingsOpenId===m.id?'rotate(-90deg)':'rotate(90deg)',transition:'transform 0.15s'}}><Icon name='chevronRight' size={10} color={C.primary}/></span>
                          </span>
                        </div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();duplicateMeal(day,m.section,m.id)}} title='Duplicate' style={{width:26,height:26,flexShrink:0,marginLeft:10,border:'none',background:'none',color:C.outlineVariant,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name='copy' size={14} color={C.outlineVariant}/></button>
                      <button onClick={e=>{e.stopPropagation();removeMeal(day,m.section,m.id)}} title='Remove' style={{width:26,height:26,flexShrink:0,marginLeft:16,border:'none',background:'none',color:C.outlineVariant,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name='x' size={14} color={C.outlineVariant}/></button>
                    </div>
                    {servingsOpenId===m.id&&(
                      <div onClick={e=>e.stopPropagation()} style={{marginTop:8,padding:'10px 12px',background:C.primaryFixed,borderRadius:10,display:'flex',alignItems:'center',gap:10}}>
                        <span style={{...mn,fontSize:12,color:C.primary,flex:1}}>Adjust servings for this meal</span>
                        <button onClick={()=>updatePortion(day,m.section,m.id,m.portion-1)} style={{width:26,height:26,borderRadius:99,border:`1px solid ${C.outlineVariant}`,background:C.white,color:C.onSurface,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon name='minus' size={12} color={C.onSurface}/></button>
                        <span style={{...mn,fontWeight:700,fontSize:14,minWidth:14,textAlign:'center',color:C.primary}}>{m.portion}</span>
                        <button onClick={()=>updatePortion(day,m.section,m.id,m.portion+1)} style={{width:26,height:26,borderRadius:99,border:'none',background:C.primary,color:C.onPrimary,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon name='plus' size={12} color={C.onPrimary}/></button>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={()=>onDayOpen(day)} style={{width:'100%',background:'none',border:'none',padding:'11px 14px',textAlign:'left',...mn,fontSize:13,color:C.primary,fontWeight:700,cursor:'pointer',borderTop:`1px dashed ${C.outlineVariant}60`}}>+ Add meal</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
