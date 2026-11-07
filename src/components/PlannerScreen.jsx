import { useState } from 'react'
import { C, ep, mn, CARD, screenTitle, R } from '../lib/theme.js'
import { DAY_LBL, TODAY, addWeeks, dayDateLabel, weekBounds, weekLabel } from '../lib/dateHelpers.js'
import { dayMeals, sectionShort } from '../lib/mealSections.js'
import { Icon } from './ui/index.js'
import { ConfirmDialog } from './settings/primitives.jsx'
import { dayNutritionTotals, dayRemainingLine, rowFigure, mealNutrition } from '../lib/goalMaths.js'
import { WeekStepper, WeekPicker } from './WeekStepper.jsx'
import { NutritionCard, EmptyWeekCard } from './PlannerCards.jsx'
import { SaveWeekSheet, FillWeekSheet, WeekActionsSheet } from './SavedWeekSheets.jsx'
import { DragGhost, PlannerTray, TryEntryCard } from './PlannerTray.jsx'
import { useTrayDrag } from '../lib/useTrayDrag.js'
import { useBackToClose } from '../lib/useBackToClose.js'

// Sized so the title, Today pill and ⋯ button just fit a narrow phone on one line.
const TITLE_BESIDE_TODAY = 'min(28px, calc((100vw - 176px) / 7.8))'
const dinnerSection = m => m.section === 'main' || m.section === 'dinner'
const countOf = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// `week` is the week on screen (dateHelpers.weekBounds) and `weekOffset` how far
// it is from this one. `loadState` is what to show instead of the days while the
// week loads or if it couldn't, so a week that isn't there yet can't be edited.
// `tryouts` is the swipe deck's part of the planner: { waiting, pill, onOpen, tray,
// newMealIds, onDrop, onRemove }. It stays off past weeks, which are for looking back.
// `plannedWeeks` is a Set of the weekOf dates with meals. `nutrition` is what
// NutritionCard needs, and `onNutrition` opens the Nutrition insights screen.
export function PlannerScreen({plan,week,weekOffset=0,weekStartsOn,plannedWeeks=new Set(),onSelectWeek,onSaveWeek,onFillWeek,onCopyWeek,onClearWeek,notice,onDismissNotice,loadState,sectionIds,removeMeal,moveMeal,duplicateMeal,updatePortion,onDayOpen,onRecipeOpen,nutrition={},onCalculateNutrition,onNutrition,goalProfile,goalTargets,nutritionByRecipe={},tryouts}){
  const goalMode = !!goalProfile?.goalModeEnabled && !!goalTargets
  const days=week.days
  const isThisWeek=weekOffset===0
  const mealCount=days.flatMap(day=>dayMeals(plan[day],sectionIds)).length
  // Dinners are days with a main. A week of only breakfasts still gets analysed, so it says meals instead.
  const dinnerCount=days.filter(day=>dayMeals(plan[day],sectionIds).some(dinnerSection)).length
  const canFill=weekOffset>=0
  const label=weekLabel(weekOffset)
  const [sheet,setSheet]=useState(null)   // 'picker' | 'actions' | 'save' | 'fill' | 'clear' | null
  const [clearing,setClearing]=useState(false)
  const closeSheet=()=>setSheet(null)
  useBackToClose(!!sheet,closeSheet)
  const selectWeek=offset=>{closeSheet();onSelectWeek(offset)}
  // Where this week can be copied: this week and next week, less the one on screen.
  const copyTargets=[0,1].filter(offset=>offset!==weekOffset).map(offset=>{
    const target=weekBounds(weekStartsOn,addWeeks(new Date(),offset))
    return{offset,title:`Copy to ${weekLabel(offset).toLowerCase()}`,hint:plannedWeeks.has(target.weekOf)?`${target.range} · adds to what's planned`:target.range}
  })
  const copyWeek=offset=>{closeSheet();onCopyWeek(offset)}
  const clearWeek=async()=>{
    setClearing(true)
    try{await onClearWeek();closeSheet()}
    finally{setClearing(false)}
  }
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
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,minHeight:44,marginBottom:14}}>
        {/* Stays on one line, however narrow the phone, so the row can't grow and move the stepper under a thumb. */}
        <div style={{...screenTitle,color:C.onSurface,whiteSpace:'nowrap',fontSize:isThisWeek?screenTitle.fontSize:TITLE_BESIDE_TODAY}}>Weekly planner</div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          {!isThisWeek&&(
            <button onClick={()=>onSelectWeek(0)} style={{...mn,minHeight:44,padding:'0 10px',display:'flex',alignItems:'center',gap:4,border:`1.5px solid ${C.outlineVariant}`,background:C.white,borderRadius:22,fontSize:13,fontWeight:700,color:C.primary,whiteSpace:'nowrap',cursor:'pointer'}}>
              <Icon name='rotateCcw' size={14} color={C.primary}/>Today
            </button>
          )}
          <button onClick={()=>setSheet('actions')} disabled={!!loadState} aria-label='Week actions' aria-haspopup='dialog' style={{width:44,height:44,boxSizing:'border-box',border:`1.5px solid ${C.outlineVariant}`,background:C.white,borderRadius:R.pill,display:'flex',alignItems:'center',justifyContent:'center',opacity:loadState?0.5:1,cursor:loadState?'default':'pointer'}}>
            <Icon name='moreHorizontal' size={20} color={C.primary}/>
          </button>
        </div>
      </div>
      <WeekStepper week={week} label={label} isThisWeek={isThisWeek} hasMeals={plannedWeeks.has(week.weekOf)} onStep={dir=>onSelectWeek(weekOffset+dir)} onOpen={()=>setSheet('picker')}/>
      {notice&&!loadState&&(
        <div role='status' style={{...mn,display:'flex',alignItems:'flex-start',gap:8,fontSize:12,lineHeight:1.5,color:C.onSurface,background:C.surfaceContainerHigh,borderRadius:R.md,padding:'10px 12px',marginBottom:14}}>
          <span style={{flex:1}}>{notice}</span>
          <button onClick={onDismissNotice} aria-label='Dismiss' style={{border:'none',background:'none',padding:0,cursor:'pointer',display:'flex'}}><Icon name='x' size={14} color={C.onSurfaceVariant}/></button>
        </div>
      )}
      {loadState||<>
      {goalMode&&(
        <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5,margin:'-2px 0 12px'}}>Nutritional figures assume one portion per person, per planned meal.</div>
      )}
      {mealCount>0
        ?<NutritionCard title={`Nutrition ${label.toLowerCase()}`} basis={`From ${dinnerCount?countOf(dinnerCount,'planned dinner'):countOf(mealCount,'planned meal')}`} nutrition={nutrition} goalMode={goalMode} onCalculate={onCalculateNutrition} onOpen={onNutrition}/>
        :<EmptyWeekCard onFill={canFill?()=>setSheet('fill'):null}/>}
      {showTryouts&&<TryEntryCard waiting={tryouts.waiting} pill={tryouts.pill} onOpen={tryouts.onOpen}/>}
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
      {sheet==='picker'&&<WeekPicker week={week} weekOffset={weekOffset} weekStartsOn={weekStartsOn} plannedWeeks={plannedWeeks} onSelect={selectWeek} onClose={closeSheet}/>}
      {sheet==='actions'&&<WeekActionsSheet label={label} range={week.range} hasMeals={mealCount>0} canFill={canFill} copyTargets={copyTargets} onCopy={copyWeek} onSave={()=>setSheet('save')} onFill={()=>setSheet('fill')} onClear={()=>setSheet('clear')} onClose={closeSheet}/>}
      {sheet==='save'&&<SaveWeekSheet week={week} mealCount={mealCount} onSave={onSaveWeek} onClose={closeSheet}/>}
      {sheet==='fill'&&<FillWeekSheet week={week} mealCount={mealCount} onFill={onFillWeek} onClose={closeSheet}/>}
      {sheet==='clear'&&<ConfirmDialog destructive radius={28} title={`Clear all meals for ${week.range}?`} body="Freezer meals go back in stock. You'll have a few seconds to undo this." confirmLabel='Clear week' busy={clearing} onConfirm={clearWeek} onCancel={closeSheet}/>}
    </div>
  )
}
