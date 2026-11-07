import { useState } from 'react'
import { C, ep, mn, CARD, screenTitle, R } from '../lib/theme.js'
import { DAY_LBL, TODAY, dayDateLabel } from '../lib/dateHelpers.js'
import { dayMeals, sectionShort } from '../lib/mealSections.js'
import { Btn, Icon } from './ui/index.js'
import { dayNutritionTotals, dayRemainingLine, rowFigure, mealNutrition } from '../lib/goalMaths.js'
import { WeekStrip } from './WeekStrip.jsx'
import { SaveWeekSheet, FillWeekSheet } from './SavedWeekSheets.jsx'
import { DragGhost, PlannerTray, TryEntryCard } from './PlannerTray.jsx'
import { useTrayDrag } from '../lib/useTrayDrag.js'

// `week` is the week on screen (dateHelpers.weekBounds) and `weekOffset` how far
// it is from this one. `loadState` is what to show instead of the days while the
// week loads or if it couldn't, so a week that isn't there yet can't be edited.
// `tryouts` is the swipe deck's part of the planner: { waiting, pill, onOpen, tray,
// newMealIds, onDrop, onRemove }. It stays off past weeks, which are for looking back.
export function PlannerScreen({plan,week,weekOffset=0,weekStrip=[],onSelectWeek,onSaveWeek,onFillWeek,notice,onDismissNotice,loadState,sectionIds,removeMeal,moveMeal,duplicateMeal,updatePortion,onDayOpen,onRecipeOpen,onNutrition,goalProfile,goalTargets,nutritionByRecipe={},tryouts}){
  const goalMode = !!goalProfile?.goalModeEnabled && !!goalTargets
  const days=week.days
  const isThisWeek=weekOffset===0
  const mealCount=days.flatMap(day=>dayMeals(plan[day],sectionIds)).length
  const [sheet,setSheet]=useState(null)   // 'save' | 'fill' | null
  const [drag,setDrag]=useState(null)   // {mealId,fromDay,section}
  const [over,setOver]=useState(null)   // day string being hovered
  const [servingsOpenId,setServingsOpenId]=useState(null)   // meal id whose servings panel is expanded
  const {drag:trayDrag,handlers:trayHandlers}=useTrayDrag({onDrop:(item,day)=>tryouts.onDrop(item.pick,day)})
  const showTryouts=!!tryouts&&weekOffset>=0
  // How a day looks while a tray card is being dragged.
  const dropStyle=day=>!trayDrag?null:trayDrag.day===day
    ?{outline:`2px dashed ${C.primary}`,background:C.primaryFixed}
    :{outline:`1.5px dashed ${C.outlineVariant}`}
  const onDragStart=(e,mealId,fromDay,section)=>{e.stopPropagation();e.dataTransfer.effectAllowed='move';setDrag({mealId,fromDay,section})}
  const onDragEnd=()=>{setDrag(null);setOver(null)}
  const onDragOver=(e,day)=>{e.preventDefault();e.dataTransfer.dropEffect='move';if(over!==day)setOver(day)}
  const onDragLeave=(e)=>{if(!e.currentTarget.contains(e.relatedTarget))setOver(null)}
  const onDrop=(e,day)=>{e.preventDefault();if(!drag)return;const{mealId,fromDay,section}=drag;setDrag(null);setOver(null);moveMeal(fromDay,day,mealId,section)}
  return(
    <div style={{padding:'16px 20px 20px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <div style={{...screenTitle,color:C.onSurface}}>Weekly planner</div>
        {isThisWeek
          ?<span style={{...mn,fontSize:12,color:C.onSurfaceVariant,background:C.surfaceContainerHigh,padding:'5px 12px',borderRadius:R.pill,whiteSpace:'nowrap'}}>{week.label}</span>
          :<button onClick={()=>onSelectWeek(0)} style={{...mn,fontSize:12,fontWeight:700,color:C.onPrimary,background:C.primary,border:'none',padding:'5px 12px',borderRadius:R.pill,whiteSpace:'nowrap',cursor:'pointer'}}>This week</button>}
      </div>
      {showTryouts&&<TryEntryCard waiting={tryouts.waiting} pill={tryouts.pill} onOpen={tryouts.onOpen}/>}
      <WeekStrip weeks={weekStrip} selectedOffset={weekOffset} onSelect={onSelectWeek}/>
      {!loadState&&(
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <div style={{flex:1}}><Btn label={<><Icon name='bookmark' size={14}/><span>Save week</span></>} secondary small full disabled={mealCount===0} onClick={()=>setSheet('save')}/></div>
          {weekOffset>=0&&<div style={{flex:1}}><Btn label={<><Icon name='copy' size={14}/><span>Fill from saved</span></>} secondary small full onClick={()=>setSheet('fill')}/></div>}
        </div>
      )}
      {notice&&!loadState&&(
        <div role='status' style={{...mn,display:'flex',alignItems:'flex-start',gap:8,fontSize:12,lineHeight:1.5,color:C.onSurface,background:C.surfaceContainerHigh,borderRadius:R.md,padding:'10px 12px',marginBottom:14}}>
          <span style={{flex:1}}>{notice}</span>
          <button onClick={onDismissNotice} aria-label='Dismiss' style={{border:'none',background:'none',padding:0,cursor:'pointer',display:'flex'}}><Icon name='x' size={14} color={C.onSurfaceVariant}/></button>
        </div>
      )}
      {loadState||<>
      {goalMode&&(
        <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5,margin:'-10px 0 16px'}}>Nutritional figures assume one portion per person, per planned meal.</div>
      )}
      <button onClick={onNutrition} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'none',background:C.secondaryContainer,color:'#924b1a',borderRadius:R.pill,padding:'12px 14px',...mn,fontWeight:700,fontSize:14,whiteSpace:'nowrap',cursor:'pointer',marginBottom:20}}>
        <Icon name='barChart3' size={16}/>{goalMode?'Goal & Nutritional Insights':'Calculate nutritional insights'}
      </button>
      {showTryouts&&<PlannerTray items={tryouts.tray} drag={trayDrag} handlers={trayHandlers} onRemove={tryouts.onRemove}/>}
      {days.map(day=>{
        const meals=dayMeals(plan[day],sectionIds)
        const isToday=isThisWeek&&day===TODAY
        const dayTotals=goalMode?dayNutritionTotals(meals,nutritionByRecipe):null
        return(
          <div key={day} data-day={day} style={{marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{...ep,fontSize:16,color:isToday?C.primary:C.onSurface}}>{DAY_LBL[day]}</span>
              {!isThisWeek&&<span style={{...mn,fontSize:12,color:C.onSurfaceVariant}}>{dayDateLabel(week,day)}</span>}
              {isToday&&(
                <span style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase',display:'inline-flex',alignItems:'center',gap:6,color:C.tertiary}}>
                  <span style={{width:6,height:6,borderRadius:R.pill,background:C.tertiary,display:'inline-block'}}/>Today
                </span>
              )}
            </div>
            {goalMode&&(
              <div style={{...mn,fontSize:11,color:dayTotals.hasData&&goalTargets.calories-dayTotals.calories<0?C.tertiary:C.onSurfaceVariant,margin:'-4px 0 8px',lineHeight:1.5,fontVariantNumeric:'tabular-nums'}}>{dayRemainingLine(dayTotals,goalTargets)}</div>
            )}
            {meals.length===0?(
              <div onDragOver={e=>onDragOver(e,day)} onDragLeave={onDragLeave} onDrop={e=>onDrop(e,day)} style={{...CARD,padding:22,display:'flex',flexDirection:'column',alignItems:'center',gap:8,outline:over===day&&drag?.fromDay!==day?`2px solid ${C.primary}`:'2px solid transparent',transition:'outline 0.12s',...dropStyle(day)}}>
                {trayDrag?<span style={{...mn,fontSize:13,fontWeight:700,color:trayDrag.day===day?C.primary:C.onSurfaceVariant}}>Drop it here</span>:<>
                <Icon name='utensilsCrossed' size={24} color={C.outlineVariant}/>
                <span style={{...mn,fontSize:12,color:C.outlineVariant,fontStyle:'italic'}}>"So you're going hungry."</span>
                <button onClick={()=>onDayOpen(day)} style={{...mn,display:'flex',alignItems:'center',gap:6,background:'none',border:`1px solid ${C.primary}`,color:C.primary,borderRadius:R.sm,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer',marginTop:4}}>
                  <Icon name='plus' size={13}/>Plan meals
                </button>
                </>}
              </div>
            ):(
              <div onDragOver={e=>onDragOver(e,day)} onDragLeave={onDragLeave} onDrop={e=>onDrop(e,day)} style={{...CARD,overflow:'hidden',outline:over===day&&drag?.fromDay!==day?`2px solid ${C.primary}`:'2px solid transparent',transition:'outline 0.12s',...dropStyle(day)}}>
                {meals.map((m,i)=>(
                  <div key={m.id} draggable onDragStart={e=>onDragStart(e,m.id,day,m.section)} onDragEnd={onDragEnd} onClick={()=>onDayOpen(day)} style={{padding:'11px 14px',borderBottom:i<meals.length-1?`1px solid ${C.outlineVariant}25`:undefined,display:'flex',flexDirection:'column',alignItems:'stretch',cursor:drag?'grabbing':'grab',opacity:drag?.mealId===m.id?0.45:1,transition:'opacity 0.15s'}}>
                    <div style={{display:'flex',alignItems:'center',width:'100%'}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div onClick={e=>{if(m.recipeId){e.stopPropagation();onRecipeOpen(m.recipeId,m.portion,m.id)}}} style={{...mn,fontSize:13,fontWeight:600,color:C.onSurface,marginBottom:3,cursor:m.recipeId?'pointer':'default',textDecoration:m.recipeId?'underline':'none',textDecorationColor:m.recipeId?C.outlineVariant:'transparent'}}>{m.name}</div>
                        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                          {tryouts?.newMealIds.has(m.id)&&<span style={{...mn,fontSize:11,fontWeight:700,color:C.onSecondaryContainerStrong,background:C.secondaryContainer,padding:'2px 7px',borderRadius:R.pill}}>New</span>}
                          <span style={{...mn,fontSize:11,color:C.onSurface,opacity:0.55}}>{sectionShort(m.section)}</span>
                          <span style={{...mn,fontSize:11,color:C.onSurface,opacity:0.6}}>{m.prep}m</span>
                          <span onClick={e=>{e.stopPropagation();setServingsOpenId(id=>id===m.id?null:m.id)}} style={{...mn,fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',gap:3,background:C.primaryFixed,color:C.primary,padding:'2px 7px',borderRadius:R.pill,cursor:'pointer'}}>
                            <Icon name='utensilsCrossed' size={11} color={C.primary}/>{m.portion}
                            <span style={{display:'flex',transform:servingsOpenId===m.id?'rotate(-90deg)':'rotate(90deg)',transition:'transform 0.15s'}}><Icon name='chevronRight' size={10} color={C.primary}/></span>
                          </span>
                          {goalMode&&mealNutrition(m.recipeId,nutritionByRecipe)&&(
                            <span style={{...mn,fontSize:11,color:C.onSurfaceVariant,fontVariantNumeric:'tabular-nums',borderLeft:`1px solid ${C.outlineVariant}`,paddingLeft:10}}>{rowFigure(mealNutrition(m.recipeId,nutritionByRecipe))}</span>
                          )}
                        </div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();duplicateMeal(day,m.section,m.id)}} title='Duplicate' style={{width:26,height:26,flexShrink:0,marginLeft:10,border:'none',background:'none',color:C.outlineVariant,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name='copy' size={14} color={C.outlineVariant}/></button>
                      <button onClick={e=>{e.stopPropagation();removeMeal(day,m.section,m.id)}} title='Remove' style={{width:26,height:26,flexShrink:0,marginLeft:16,border:'none',background:'none',color:C.outlineVariant,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name='x' size={14} color={C.outlineVariant}/></button>
                    </div>
                    {servingsOpenId===m.id&&(
                      <div onClick={e=>e.stopPropagation()} style={{marginTop:8,padding:'10px 12px',background:C.primaryFixed,borderRadius:R.md,display:'flex',alignItems:'center',gap:10}}>
                        <span style={{...mn,fontSize:12,color:C.primary,flex:1}}>Adjust servings for this meal</span>
                        <button onClick={()=>updatePortion(day,m.section,m.id,m.portion-1)} style={{width:26,height:26,borderRadius:R.pill,border:`1px solid ${C.outlineVariant}`,background:C.white,color:C.onSurface,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon name='minus' size={12} color={C.onSurface}/></button>
                        <span style={{...mn,fontWeight:700,fontSize:14,minWidth:14,textAlign:'center',color:C.primary}}>{m.portion}</span>
                        <button onClick={()=>updatePortion(day,m.section,m.id,m.portion+1)} style={{width:26,height:26,borderRadius:R.pill,border:'none',background:C.primary,color:C.onPrimary,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon name='plus' size={12} color={C.onPrimary}/></button>
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
      {goalMode&&(
        <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,lineHeight:1.6}}>A ~ marks a recipe where some ingredients are not matched to reference data yet.</div>
      )}
      </>}
      <DragGhost drag={trayDrag}/>
      {sheet==='save'&&<SaveWeekSheet week={week} mealCount={mealCount} onSave={onSaveWeek} onClose={()=>setSheet(null)}/>}
      {sheet==='fill'&&<FillWeekSheet week={week} mealCount={mealCount} onFill={onFillWeek} onClose={()=>setSheet(null)}/>}
    </div>
  )
}
