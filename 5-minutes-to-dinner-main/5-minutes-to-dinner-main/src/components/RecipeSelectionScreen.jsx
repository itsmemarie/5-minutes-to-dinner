import { useState, useMemo } from 'react'
import { C, mn, CARD } from '../lib/theme.js'
import { DAYS } from '../lib/dateHelpers.js'
import { Btn, PillBtn } from './ui/index.js'
import { RecipeBucket } from './RecipeBucket.jsx'
import { NewRecipeForm } from './NewRecipeForm.jsx'
import { parseSideNames, matchSideRecipes } from '../lib/sidePairing.js'

export function RecipeSelectionScreen({day,section,plan,recipes,onAdd,onRecipeCreated,onPreview}){
  const [search,setSearch]=useState('')
  const [chip,setChip]=useState('cat')
  const [selected,setSelected]=useState([])
  const catName=section==='breakfast'?'Breakfast':section==='main'?'Mains':'Sides'
  const sectionLabel=section==='breakfast'?'Breakfast':section==='main'?'Main Meal':'Side Dish'

  // Recipes already on the *current* day (any section) — prevent duplicates on the same day
  const currentDayIds=useMemo(()=>[...plan[day].breakfast,...plan[day].main,...plan[day].side].map(m=>m.recipeId),[plan,day])

  // Recipes planned on *other* days this week — surface as "Already Planned This Week" (selectable for leftovers)
  const otherDaysIds=useMemo(()=>{
    const ids=new Set()
    DAYS.forEach(d=>{
      if(d===day)return
      ;['breakfast','main','side'].forEach(sec=>plan[d][sec].forEach(m=>ids.add(m.recipeId)))
    })
    return [...ids]
  },[plan,day])

  const filtered=useMemo(()=>{
    let list=recipes.filter(r=>r.cat===catName)
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

  const handleRecipeCreated = r => {
    onRecipeCreated(r)
    setSelected(s=>[...s,r.id])
    setShowNewRecipe(false)
  }

  return(
    <div style={{display:'flex',flexDirection:'column',minHeight:'100%'}}>
      {showNewRecipe&&<NewRecipeForm defaultMealType={section==='breakfast'?'breakfast':section==='side'?'side':'main'} onSave={handleRecipeCreated} onCancel={()=>setShowNewRecipe(false)}/>}
      <div style={{flex:1,padding:'12px 20px 120px'}}>
        <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='🔍 Search meals…' style={{flex:1,padding:'10px 14px',borderRadius:12,border:`1px solid ${C.outlineVariant}`,fontSize:14,...mn,background:C.white,outline:'none'}}/>
          <Btn label='+ New' small onClick={()=>setShowNewRecipe(true)}/>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto',paddingBottom:4}}>
          <PillBtn label={sectionLabel} active={chip==='cat'} onClick={()=>setChip('cat')}/>
          <PillBtn label='❄ Freezer' active={chip==='freezer'} onClick={()=>setChip('freezer')}/>
          <PillBtn icon='filter' label='Filter' active={false} onClick={()=>{}}/>
        </div>
        {chip==='freezer'?(
          <div style={{...CARD,padding:24,textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>❄</div>
            <div style={{...mn,fontSize:14,color:C.onSurfaceVariant}}>No freezer items for this week.</div>
          </div>
        ):(
          <>
            <RecipeBucket title='Suggested' items={suggested} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview} suggestionLabel={mainRecipe?.name}/>
            <RecipeBucket title='Already Planned This Week' items={alreadyWeek} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview}/>
            <RecipeBucket title='Default' items={defaults} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview}/>
            <RecipeBucket title='Try Out' items={tryOut} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview}/>
            <RecipeBucket title='Order Out' items={orderOut} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview}/>
            <RecipeBucket title='Other Meals' items={other} disabled={false} selected={selected} onToggle={toggle} onPreview={onPreview}/>
          </>
        )}
      </div>
      <div style={{position:'fixed',bottom:64,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,padding:'10px 20px',background:C.white,borderTop:`1px solid ${C.outlineVariant}30`}}>
        <Btn label={selected.length?`Add Selected (${selected.length})`:'Select recipes above'} full onClick={()=>{onAdd(selected);setSelected([])}} disabled={selected.length===0}/>
      </div>
    </div>
  )
}
