import { useState, useMemo } from 'react'
import { C, mn, CARD, R } from '../lib/theme.js'
import { DAYS } from '../lib/dateHelpers.js'
import { ALL_SECTION_IDS, dayMeals, sectionInfo } from '../lib/mealSections.js'
import { Btn, PillBtn, Icon, BudgetStrip } from './ui/index.js'
import { RecipeBucket } from './RecipeBucket.jsx'
import { RecipePhotoBucket } from './RecipePhotoBucket.jsx'
import { NewRecipeForm } from './NewRecipeForm.jsx'
import { parseSideNames, matchSideRecipes } from '../lib/sidePairing.js'
import { dayNutritionTotals } from '../lib/goalMaths.js'

// Local primitive, following the pattern SettingsScreen establishes with
// Switch/SegPill/FieldBox. SegPill itself is label-text driven and would need
// most of its styling overridden for a 34×32 icon-only button.
function ViewToggle({ value, onChange }) {
  const btn = active => ({
    width:34,height:32,borderRadius:R.pill,border:'none',padding:0,position:'relative',
    background:active?C.primary:'transparent',
    color:active?C.onPrimary:C.onSurfaceVariant,
    display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
  })
  // Transparent overlay lifts the tap target to ~44px without changing the
  // visual pill size. No CSS classes in this kit, so no ::before.
  const hit = <span style={{position:'absolute',top:-6,bottom:-6,left:-4,right:-4}}/>
  return (
    <div style={{display:'flex',background:C.surfaceContainerHigh,borderRadius:R.pill,padding:3,gap:2,flexShrink:0}}>
      <button title='List view' aria-label='List view' aria-pressed={value==='list'} onClick={()=>onChange('list')} style={btn(value==='list')}>
        <Icon name='list' size={17}/>{hit}
      </button>
      <button title='Photo view' aria-label='Photo view' aria-pressed={value==='photos'} onClick={()=>onChange('photos')} style={btn(value==='photos')}>
        <Icon name='layoutGrid' size={17}/>{hit}
      </button>
    </div>
  )
}

export function RecipeSelectionScreen({day,section,plan,recipes,freezerItems,onAdd,onAddFreezer,onManageFreezer,onRecipeCreated,onPreview,goalProfile,goalTargets,nutritionByRecipe={},recipeView='list',setRecipeView,search,setSearch,chip,setChip,selected,setSelected,days=DAYS,sectionIds=ALL_SECTION_IDS}){
  const goalMode=!!goalProfile?.goalModeEnabled&&!!goalTargets
  const dayTotals=useMemo(()=>goalMode?dayNutritionTotals(dayMeals(plan[day],sectionIds),nutritionByRecipe):null,[goalMode,plan,day,nutritionByRecipe,sectionIds])
  const [freezerSelected,setFreezerSelected]=useState([])
  // Same prop signature on both, so only the identifier changes below.
  const Bucket=recipeView==='photos'?RecipePhotoBucket:RecipeBucket
  // Which recipe category this section draws from (null = every recipe).
  const { category:catName, label:sectionLabel, mealType:defaultMealType } = sectionInfo(section)

  // Recipes already on the *current* day (any section) — prevent duplicates on the same day
  const currentDayIds=useMemo(()=>dayMeals(plan[day]).map(m=>m.recipeId),[plan,day])

  // Recipes planned on *other* days this week — surface as "Already Planned This Week" (selectable for leftovers)
  const otherDaysIds=useMemo(()=>{
    const ids=new Set()
    days.forEach(d=>{
      if(d===day)return
      dayMeals(plan[d]).forEach(m=>ids.add(m.recipeId))
    })
    return [...ids]
  },[plan,day,days])

  const filtered=useMemo(()=>{
    let list=catName?recipes.filter(r=>r.cat===catName):recipes
    if(search)list=list.filter(r=>r.name.toLowerCase().includes(search.toLowerCase()))
    return list
  },[catName,search,recipes])

  // Drop recipes already on this day (any section) — they shouldn't appear at all
  const available=filtered.filter(r=>!currentDayIds.includes(r.id))

  // Side pairing: pin recipes matching the day's Main's recommended side(s) at the top
  const mainMeal=plan[day].main[0]
  const mainRecipe=section==='side'?recipes.find(r=>r.id===mainMeal?.recipeId):null
  const suggested=section==='side'&&mainRecipe
    ?matchSideRecipes(parseSideNames(mainRecipe.sideRecommendation),available)
    :[]
  const suggestedIds=suggested.map(r=>r.id)
  const availableRest=available.filter(r=>!suggestedIds.includes(r.id))

  // Bucket order requested: Suggested → Already Planned This Week → Default → Try Out → Order Out → Other
  // Default takes priority: if a recipe has this day in defaultDays it always lands here
  const alreadyWeek=availableRest.filter(r=>otherDaysIds.includes(r.id))
  const rest=availableRest.filter(r=>!otherDaysIds.includes(r.id))
  const defaults=rest.filter(r=>(r.defaultDays||[]).includes(day))
  const notDefault=rest.filter(r=>!(r.defaultDays||[]).includes(day))
  const tryOut=notDefault.filter(r=>r.tryOut&&!r.orderOut)
  const orderOut=notDefault.filter(r=>r.orderOut)
  const other=notDefault.filter(r=>!r.tryOut&&!r.orderOut)

  const [showNewRecipe,setShowNewRecipe]=useState(false)
  const toggle=rid=>setSelected(s=>s.includes(rid)?s.filter(x=>x!==rid):[...s,rid])
  const toggleFreezer=iid=>setFreezerSelected(s=>s.includes(iid)?s.filter(x=>x!==iid):[...s,iid])
  const inStockFreezer=useMemo(()=>(freezerItems||[]).filter(it=>it.in_stock),[freezerItems])

  const handleRecipeCreated = r => {
    onRecipeCreated(r)
    setSelected(s=>[...s,r.id])
    setShowNewRecipe(false)
  }

  return(
    <div style={{display:'flex',flexDirection:'column',minHeight:'100%'}}>
      {showNewRecipe&&<NewRecipeForm defaultMealType={defaultMealType} onSave={handleRecipeCreated} onCancel={()=>setShowNewRecipe(false)}/>}
      {goalMode&&<div style={{padding:'0 20px'}}><BudgetStrip dayTotals={dayTotals} targets={goalTargets}/></div>}
      <div style={{flex:1,padding:'12px 20px 120px'}}>
        <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='🔍 Search meals…' style={{flex:1,minWidth:0,padding:'10px 14px',borderRadius:R.md,border:`1px solid ${C.outlineVariant}`,fontSize:14,...mn,background:C.white,outline:'none'}}/>
          {chip!=='freezer'&&<ViewToggle value={recipeView} onChange={setRecipeView}/>}
          <Btn label='+ New' small onClick={()=>setShowNewRecipe(true)}/>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto',paddingBottom:4}}>
          <PillBtn label={sectionLabel} active={chip==='cat'} onClick={()=>setChip('cat')}/>
          <PillBtn label='❄ Freezer' active={chip==='freezer'} onClick={()=>setChip('freezer')}/>
          <PillBtn icon='filter' label='Filter' active={false} onClick={()=>{}}/>
        </div>
        {chip==='freezer'?(
          <div>
            <div onClick={onManageFreezer} style={{display:'flex',alignItems:'center',justifyContent:'space-between',...CARD,padding:'10px 14px',marginBottom:12,cursor:'pointer'}}>
              <span style={{...mn,fontSize:13,fontWeight:600,color:C.primary}}>Manage Freezer</span>
              <span style={{...mn,fontSize:13,color:C.primary}}>→</span>
            </div>
            {inStockFreezer.length===0?(
              <div style={{...CARD,padding:24,textAlign:'center'}}>
                <div style={{fontSize:32,marginBottom:8}}>❄</div>
                <div style={{...mn,fontSize:14,color:C.onSurfaceVariant}}>No freezer items available. Add some via Manage Freezer.</div>
              </div>
            ):(
              <div style={{...CARD,overflow:'hidden'}}>
                {inStockFreezer.map((item,i)=>{
                  const sel=freezerSelected.includes(item.id)
                  return (
                    <div key={item.id} onClick={()=>toggleFreezer(item.id)} style={{padding:'11px 14px',borderBottom:i<inStockFreezer.length-1?`1px solid ${C.outlineVariant}26`:undefined,display:'flex',alignItems:'center',cursor:'pointer'}}>
                      <div style={{flex:1,minWidth:0,...mn,fontSize:13,fontWeight:600,color:C.onSurface}}>{item.name}</div>
                      <div style={{width:26,height:26,borderRadius:R.pill,border:`2px solid ${sel?C.primary:C.outlineVariant}`,background:sel?C.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:10,color:sel?C.onPrimary:C.outline}}>
                        {sel?<Icon name='check' size={14} color={C.onPrimary}/>:<Icon name='plus' size={14} color={C.outline}/>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ):(
          <>
            <Bucket title='Suggested' items={suggested} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview} suggestionLabel={mainRecipe?.name} nutritionByRecipe={goalMode?nutritionByRecipe:null}/>
            <Bucket title='Already Planned This Week' items={alreadyWeek} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview} nutritionByRecipe={goalMode?nutritionByRecipe:null}/>
            <Bucket title='Default' items={defaults} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview} nutritionByRecipe={goalMode?nutritionByRecipe:null}/>
            <Bucket title='Try Out' items={tryOut} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview} nutritionByRecipe={goalMode?nutritionByRecipe:null}/>
            <Bucket title='Order Out' items={orderOut} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview} nutritionByRecipe={goalMode?nutritionByRecipe:null}/>
            <Bucket title='Other Meals' items={other} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview} nutritionByRecipe={goalMode?nutritionByRecipe:null}/>
          </>
        )}
      </div>
      <div style={{position:'fixed',bottom:64,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,padding:'10px 20px',background:C.white,borderTop:`1px solid ${C.outlineVariant}30`}}>
        {chip==='freezer'
          ?<Btn label={freezerSelected.length?`Add Selected (${freezerSelected.length})`:'Select freezer items above'} full onClick={()=>{onAddFreezer(freezerSelected);setFreezerSelected([])}} disabled={freezerSelected.length===0}/>
          :<Btn label={selected.length?`Add Selected (${selected.length})`:'Select recipes above'} full onClick={()=>{onAdd(selected);setSelected([])}} disabled={selected.length===0}/>
        }
      </div>
    </div>
  )
}
