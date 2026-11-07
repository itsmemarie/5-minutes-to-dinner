import { useMemo, useState } from 'react'
import { C, ep, mn, screenTitle, R, CARD } from '../lib/theme.js'
import { DAYS, DAY_LBL, TODAY } from '../lib/dateHelpers.js'
import { ALL_SECTION_IDS, dayMeals } from '../lib/mealSections.js'
import { canRate } from '../lib/mealRating.js'
import { useLongPressDrag } from '../lib/useLongPressDrag.js'
import { Icon, TodayTag } from './ui/index.js'
import { MealRow } from './home/MealRow.jsx'
import { NewRecipeForm } from './NewRecipeForm.jsx'

// days is the week in the user's order; sectionIds the sections turned on
// in Settings — both come from App's preferences. `recipes` gives each meal its
// status tag, and `childName` is who the child chip asks about, if anyone.
export function HomeScreen({ plan, weekLabel, days = DAYS, sectionIds = ALL_SECTION_IDS, recipes = [], childName, onDayOpen, onRecipeOpen, moveMeal, removeMeal, onRate, onAte, onCopy, onRecipeCreated, aiContext }) {
  const [showNewRecipe, setShowNewRecipe] = useState(false)
  const statusById = useMemo(() => new Map(recipes.map(r => [r.id, r.status])), [recipes])
  const { dragging, overDay, pressProps } = useLongPressDrag({ onDrop: (item, day) => moveMeal(item.fromDay, day, item.mealId, item.section) })
  return (
    <div style={{ padding:'16px 20px 20px' }}>
      {showNewRecipe && <NewRecipeForm defaultMealType='main' aiContext={aiContext} onSave={r=>{onRecipeCreated(r);setShowNewRecipe(false)}} onCancel={()=>setShowNewRecipe(false)}/>}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:14 }}>
        <div style={{...screenTitle, color:C.onSurface}}>This week</div>
        {weekLabel && <span style={{...mn,fontSize:12,color:C.onSurfaceVariant,background:C.surfaceContainerHigh,padding:'5px 12px',borderRadius:R.pill,whiteSpace:'nowrap'}}>{weekLabel}</span>}
      </div>
      <button onClick={()=>setShowNewRecipe(true)} style={{width:'100%',height:44,display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'none',background:C.secondaryContainer,color:C.onSecondaryContainerStrong,borderRadius:R.pill,...mn,fontWeight:700,fontSize:14,cursor:'pointer'}}>
        <Icon name='plus' size={16}/>Add recipe
      </button>
      {days.map(day => {
        const meals = dayMeals(plan[day], sectionIds)
        const isToday = day === TODAY
        return (
          <section key={day}>
            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'20px 0 10px' }}>
              <h2 style={{...ep,fontSize:18,margin:0,color:isToday?C.primary:C.onSurface}}>{DAY_LBL[day]}</h2>
              {isToday && <TodayTag/>}
            </div>
            <div data-day={day} style={{...CARD,outline:overDay===day&&dragging?.fromDay!==day?`2px solid ${C.primary}`:'2px solid transparent',transition:'outline 0.12s'}}>
              {meals.map((m,i) => (
                <MealRow key={m.id} meal={m} day={day} status={statusById.get(m.recipeId)} childName={childName}
                  rateable={canRate(m,day,days)} divider={i<meals.length-1} held={dragging?.mealId===m.id}
                  pressProps={pressProps({ mealId:m.id, fromDay:day, section:m.section })}
                  onOpen={()=>onRecipeOpen(m.recipeId, m.portion, m.id)}
                  onRate={rating=>onRate(m, day, rating)} onAte={ate=>onAte(m, ate)} onRemove={()=>removeMeal(day, m.section, m.id)}/>
              ))}
              <button onClick={()=>onDayOpen(day)} style={{width:'100%',background:'none',border:'none',padding:'11px 14px',textAlign:'left',...mn,fontSize:13,color:C.primary,fontWeight:700,cursor:'pointer',borderTop:meals.length?`1px solid ${C.outlineVariant}26`:'none'}}>+ Add meal</button>
            </div>
          </section>
        )
      })}
      <div style={{ position:'sticky', bottom:10, padding:'8px 0', marginTop:16 }}>
        <button onClick={onCopy} style={{width:'100%',background:C.primary,color:C.onPrimary,border:'none',borderRadius:R.pill,padding:'15px',...mn,fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 20px rgba(45,96,47,0.3)'}}>
          <Icon name='clipboardCheck' size={17} color={C.onPrimary}/> Copy to text
        </button>
      </div>
    </div>
  )
}
