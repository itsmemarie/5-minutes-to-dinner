import { useState } from 'react'
import { C, ep, mn, screenTitle, R, CARD } from '../lib/theme.js'
import { DAYS, DAY_LBL, TODAY, formatAdvance } from '../lib/dateHelpers.js'
import { Icon, TodayTag } from './ui/index.js'
import { NewRecipeForm } from './NewRecipeForm.jsx'

const SEC_LBL = { breakfast:'Breakfast', main:'Main', side:'Side' }

export function HomeScreen({ plan, onDayOpen, onRecipeOpen, moveMeal, onCopy, onRecipeCreated }) {
  const [showNewRecipe, setShowNewRecipe] = useState(false)
  const [drag, setDrag] = useState(null)   // {mealId,fromDay,section}
  const [over, setOver] = useState(null)   // day string being hovered
  const onDragStart = (e,mealId,fromDay,section) => { e.stopPropagation(); e.dataTransfer.effectAllowed='move'; setDrag({mealId,fromDay,section}) }
  const onDragEnd = () => { setDrag(null); setOver(null) }
  const onDragOver = (e,day) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; if (over!==day) setOver(day) }
  const onDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null) }
  const onDrop = (e,day) => { e.preventDefault(); if (!drag) return; const {mealId,fromDay,section}=drag; setDrag(null); setOver(null); moveMeal(fromDay,day,mealId,section) }
  return (
    <div style={{ padding:'16px 20px 20px' }}>
      {showNewRecipe && <NewRecipeForm defaultMealType='main' onSave={r=>{onRecipeCreated(r);setShowNewRecipe(false)}} onCancel={()=>setShowNewRecipe(false)}/>}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div style={{...screenTitle, color:C.onSurface}}>This week</div>
        <button onClick={()=>setShowNewRecipe(true)} style={{display:'flex',alignItems:'center',gap:8,border:'none',background:C.secondaryContainer,color:C.onSecondaryContainerStrong,borderRadius:R.pill,padding:'7px 14px',...mn,fontWeight:700,fontSize:12,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0}}>
          <Icon name='plus' size={14}/>Add recipe
        </button>
      </div>
      {DAYS.map(day => {
        const meals = [...plan[day].breakfast, ...plan[day].main, ...plan[day].side]
        const isToday = day === TODAY
        return (
          <div key={day} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.06em',color:isToday?C.primary:C.onSurfaceVariant,textTransform:'uppercase'}}>{DAY_LBL[day]}</span>
              {isToday && <TodayTag/>}
            </div>
            <div onDragOver={e=>onDragOver(e,day)} onDragLeave={onDragLeave} onDrop={e=>onDrop(e,day)} style={{...CARD,overflow:'hidden',outline:over===day&&drag?.fromDay!==day?`2px solid ${C.primary}`:'2px solid transparent',transition:'outline 0.12s'}}>
              {meals.map((m,i) => (
                <div key={m.id} draggable onDragStart={e=>onDragStart(e,m.id,day,m.section)} onDragEnd={onDragEnd} onClick={()=>onRecipeOpen(m.recipeId, m.portion)} style={{padding:'11px 14px',borderBottom:i<meals.length-1?`1px solid ${C.outlineVariant}26`:undefined,display:'flex',alignItems:'center',cursor:'pointer',opacity:drag?.mealId===m.id?0.45:1,transition:'opacity 0.15s'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{...mn,fontSize:13,fontWeight:600,color:C.onSurface,marginBottom:3,textDecoration:'underline',textDecorationColor:C.outlineVariant,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                      <span style={{...mn,fontSize:11,color:C.onSurface,opacity:0.55}}>{SEC_LBL[m.section]}</span>
                      <span style={{...mn,fontSize:11,color:C.onSurface,opacity:0.6}}>{m.prep}m</span>
                      {m.advancePrepHours>0&&(
                        <span title={m.advancePrepNote||undefined} style={{...mn,fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',gap:4,color:C.onSecondaryContainer}}>
                          <Icon name='alarmClock' size={11} color={C.onSecondaryContainer}/>Start {formatAdvance(m.advancePrepHours)} ahead
                        </span>
                      )}
                      <span style={{...mn,fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',gap:3,background:C.primaryFixed,color:C.primary,padding:'2px 7px',borderRadius:R.pill}}>
                        <Icon name='utensilsCrossed' size={11} color={C.primary}/>{m.portion}
                        <span style={{display:'flex',transform:'rotate(90deg)'}}><Icon name='chevronRight' size={10} color={C.primary}/></span>
                      </span>
                    </div>
                  </div>
                  <div style={{width:26,height:26,flexShrink:0,marginLeft:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Icon name='chevronRight' size={14} color={C.outlineVariant}/>
                  </div>
                </div>
              ))}
              <button onClick={()=>onDayOpen(day)} style={{width:'100%',background:'none',border:'none',padding:'11px 14px',textAlign:'left',...mn,fontSize:13,color:C.primary,fontWeight:700,cursor:'pointer',borderTop:meals.length?`1px dashed ${C.outlineVariant}60`:'none'}}>+ Add meal</button>
            </div>
          </div>
        )
      })}
      <div style={{ position:'sticky', bottom:10, padding:'8px 0' }}>
        <button onClick={onCopy} style={{width:'100%',background:C.primary,color:C.onPrimary,border:'none',borderRadius:R.pill,padding:'15px',...mn,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 20px rgba(45,96,47,0.3)'}}>
          <Icon name='clipboardCheck' size={17} color={C.onPrimary}/> Copy to text
        </button>
      </div>
    </div>
  )
}
