import { useState } from 'react'
import { C, ep, mn, CARD, R } from '../lib/theme.js'
import { DAY_LBL } from '../lib/dateHelpers.js'
import { Btn, Stepper, BudgetStrip } from './ui/index.js'
import { Icon } from './ui/Icon.jsx'
import { parseSideNames, formatSideNames } from '../lib/sidePairing.js'
import { dayNutritionTotals, dayRemainingLine } from '../lib/goalMaths.js'

export function DailyPlanScreen({day,plan,recipes,updatePortion,removeMeal,onAddToSection,onRecipeOpen,onSave,goalProfile,goalTargets,nutritionByRecipe={}}){
  const [saved,setSaved]=useState(false)
  const secs=[{key:'breakfast',label:'Breakfast'},{key:'main',label:'Main Meal'},{key:'side',label:'Sides & Snacks'}]
  const go=()=>{setSaved(true);setTimeout(()=>{setSaved(false);onSave()},1000)}
  const mainMeal=plan[day].main[0]
  const mainRecipe=recipes?.find(r=>r.id===mainMeal?.recipeId)
  const sideNames=parseSideNames(mainRecipe?.sideRecommendation)
  const showSideHint=plan[day].side.length===0&&mainMeal&&sideNames.length>0
  const goalMode=!!goalProfile?.goalModeEnabled&&!!goalTargets
  const dayMeals=[...plan[day].breakfast,...plan[day].main,...plan[day].side]
  const dayTotals=goalMode?dayNutritionTotals(dayMeals,nutritionByRecipe):null
  return(
    <div style={{padding:'0 20px'}}>
      {goalMode&&<BudgetStrip dayTotals={dayTotals} targets={goalTargets}/>}
      <div style={{...ep,fontSize:24,color:C.onSurface,padding:'16px 0 2px'}}>{DAY_LBL[day]}</div>
      {goalMode&&(
        <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5,paddingBottom:4}}>{dayMeals.length===0?'Nothing planned yet':dayRemainingLine(dayTotals,goalTargets)}</div>
      )}
      <div style={{height:12}}/>
      {secs.map(s=>(
        <div key={s.key} style={{marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{...ep,fontSize:15,color:C.onSurface}}>{s.label}</span>
            <button onClick={()=>onAddToSection(day,s.key)} style={{...mn,display:'flex',alignItems:'center',gap:4,background:'none',border:'none',color:C.primary,fontWeight:700,fontSize:13,cursor:'pointer',padding:0}}><Icon name='circlePlus' size={16} color={C.primary}/>Add</button>
          </div>
          {plan[day][s.key].length===0?(
            <>
              {s.key==='side'&&showSideHint&&(
                <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:8}}>
                  <span style={{marginTop:1,flexShrink:0}}><Icon name='sparkles' size={16} color={C.accent2_600}/></span>
                  <span style={{...mn,fontSize:14,color:C.accent2_800,lineHeight:1.4}}>
                    <span style={{fontWeight:700}}>{formatSideNames(sideNames)}</span> would go well with <span style={{fontWeight:700}}>{mainRecipe?.name}</span>
                  </span>
                </div>
              )}
              <div onClick={()=>onAddToSection(day,s.key)} style={{border:`2px dashed ${C.outlineVariant}`,borderRadius:R.md,padding:20,display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer'}}>
                <Icon name='circlePlus' size={26} color={C.outlineVariant}/>
                <span style={{...mn,fontSize:13,color:C.outlineVariant}}>Tap to add {s.label.toLowerCase()}</span>
              </div>
            </>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {plan[day][s.key].map(m=>(
                <div key={m.id} style={{...CARD,background:C.surfaceContainerHigh,boxShadow:'none',padding:'14px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
                    <span onClick={()=>m.recipeId&&onRecipeOpen(m.recipeId,m.portion,m.id)} style={{...mn,fontSize:15,fontWeight:700,color:C.onSurface,flex:1,marginRight:8,cursor:m.recipeId?'pointer':'default',textDecoration:m.recipeId?'underline':'none',textDecorationColor:m.recipeId?C.outlineVariant:'transparent'}}>{m.name}</span>
                    <button onClick={()=>removeMeal(day,s.key,m.id)} style={{width:26,height:26,flexShrink:0,border:'none',background:'none',padding:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name='x' size={16} color={C.primary}/></button>
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{...mn,fontSize:13,color:C.onSurfaceVariant}}>{m.prep}m prep</span>
                    <Stepper value={m.portion} min={m.min} onChange={v=>updatePortion(day,s.key,m.id,v)}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div style={{height:80}}/>
      <div style={{position:'fixed',bottom:64,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,padding:'10px 20px',background:C.white,borderTop:`1px solid ${C.outlineVariant}30`}}>
        {saved
          ?<div style={{...mn,textAlign:'center',fontSize:14,fontWeight:700,color:'#1a7a3a',padding:'13px',background:'#f0fff4',borderRadius:12}}>✓ Saved!</div>
          :<Btn label='✓  Save Day' full onClick={go}/>}
      </div>
    </div>
  )
}
