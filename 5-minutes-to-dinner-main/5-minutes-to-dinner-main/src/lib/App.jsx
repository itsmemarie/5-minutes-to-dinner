import { useState, useEffect } from 'react'
import {
  fetchRecipes, fetchSettings, saveSettings,
  getOrCreatePlan, fetchWeekPlan,
  addPlannedMeals, removePlannedMeal, updatePlannedMealPortion, movePlannedMeal,
  fetchShoppingList, saveShoppingList, updateShoppingItem,
} from './supabase.js'
import { callEdgeFn } from './ai.js'
import { C, ep, mn } from './theme.js'
import { TODAY, DAYS, DAY_LBL, WEEK_OF, WEEK_LBL, uid, emptyWeek } from './dateHelpers.js'
import { Spinner, Btn, Icon } from '../components/ui/index.js'
import { RecipeScreen } from '../components/RecipeScreen.jsx'
import { HomeScreen } from '../components/HomeScreen.jsx'
import { PlannerScreen } from '../components/PlannerScreen.jsx'
import { DailyPlanScreen } from '../components/DailyPlanScreen.jsx'
import { RecipeSelectionScreen } from '../components/RecipeSelectionScreen.jsx'
import { NutritionScreen } from '../components/NutritionScreen.jsx'
import { ShoppingListScreen } from '../components/ShoppingListScreen.jsx'
import { BatchScreen } from '../components/BatchScreen.jsx'
import { SettingsScreen } from '../components/SettingsScreen.jsx'

// ─── Root App ──────────────────────────────────────────────────────────
export default function App() {
  // Nav
  const [tab,       setTab]      = useState('home')
  const [screen,    setScreen]   = useState(null)
  const [selDay,    setSelDay]   = useState(TODAY)
  const [selSec,    setSelSec]   = useState('main')
  const [batchTab,  setBatchTab] = useState('big')
  const [nutriProf, setNutriProf]= useState('adult')
  const [selRecipeId,      setSelRecipeId]      = useState(null)
  const [recipeDetailPortion, setRecipeDetailPortion] = useState(4)
  const [prevScreen,       setPrevScreen]       = useState(null)

  // Data
  const [loading,     setLoading]     = useState(true)
  const [loadMsg,     setLoadMsg]     = useState('Connecting to Supabase…')
  const [error,       setError]       = useState(null)
  const [recipes,     setRecipes]     = useState([])
  const [planId,      setPlanId]      = useState(null)
  const [dayEntryMap, setDayEntryMap] = useState({})
  const [plan,        setPlanState]   = useState(emptyWeek)
  const [shopping,    setShopping]    = useState([])
  const [shoppingId,  setShoppingId]  = useState(null)
  const [shoppingLoading,setShoppingLoading]=useState(false)
  const [shoppingError,  setShoppingError]  =useState(null)
  const [nutriData,   setNutriData]   = useState(null)
  const [nutriLoading,setNutriLoading]= useState(false)
  const [nutriError,  setNutriError]  = useState(null)
  const [batchData,   setBatchData]   = useState(null)
  const [batchLoading,setBatchLoading]= useState(false)
  const [batchError,  setBatchError]  = useState(null)
  const [defPort,     setDefPortSt]   = useState(4)

  // ── Bootstrap ────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        setLoadMsg('Loading recipes…')
        const [recs, settings] = await Promise.all([fetchRecipes(), fetchSettings()])
        setRecipes(recs)
        if (settings?.default_portions) setDefPortSt(settings.default_portions)

        setLoadMsg('Loading your meal plan…')
        const pid = await getOrCreatePlan(WEEK_OF)
        setPlanId(pid)

        const deRows = await fetchWeekPlan(pid)
        const entryMap = {}, newPlan = emptyWeek()
        deRows.forEach(de => {
          entryMap[de.day_of_week] = de.id
          ;(de.planned_meals || []).forEach(pm => {
            const sec = pm.section
            if (newPlan[de.day_of_week]?.[sec] !== undefined) {
              newPlan[de.day_of_week][sec].push({
                id: pm.id, recipeId: pm.recipe_id, section: sec,
                portion: pm.portion, name: pm.name_snapshot,
                prep: pm.prep_time_snapshot || 0,
                active: pm.cook_time_snapshot || 0,
                min: 1,
                advancePrepHours: pm.advance_prep_hours_snapshot != null ? Number(pm.advance_prep_hours_snapshot) : null,
                advancePrepNote:  pm.advance_prep_note_snapshot || null,
              })
            }
          })
        })
        setDayEntryMap(entryMap)
        setPlanState(newPlan)

        // Shopping list
        const sl = await fetchShoppingList(pid)
        if (sl) { setShoppingId(sl.id); setShopping(sl.shopping_list_items || []) }

        setLoading(false)
      } catch (e) {
        console.error(e)
        setError(e.message)
        setLoading(false)
      }
    })()
  }, [])

  // ── Mutations (optimistic UI + background DB write) ───────────────
  const setPlan = newPlan => setPlanState(newPlan)

  const setDefPort = async val => {
    setDefPortSt(val)
    await saveSettings(val)
  }

  const removeMeal = async (day, sec, id) => {
    setPlan({ ...plan, [day]: { ...plan[day], [sec]: plan[day][sec].filter(m => m.id !== id) } })
    await removePlannedMeal(id)
  }

  const moveMeal = async (fromDay, toDay, mealId, section) => {
    if (fromDay === toDay) return
    const meal = plan[fromDay][section].find(m => m.id === mealId)
    if (!meal) return
    const before = plan
    setPlan({
      ...plan,
      [fromDay]: { ...plan[fromDay], [section]: plan[fromDay][section].filter(m => m.id !== mealId) },
      [toDay]:   { ...plan[toDay],   [section]: [...plan[toDay][section], meal] },
    })
    try {
      await movePlannedMeal(mealId, dayEntryMap[toDay])
    } catch (e) {
      setPlan(before)
      console.error('moveMeal failed:', e.message)
    }
  }

  const updatePortion = async (day, sec, id, val) => {
    const m = plan[day][sec].find(x => x.id === id)
    const v = Math.max(m?.min || 1, val)
    setPlan({ ...plan, [day]: { ...plan[day], [sec]: plan[day][sec].map(x => x.id === id ? { ...x, portion: v } : x) } })
    await updatePlannedMealPortion(id, v)
  }

  const addMeals = async rids => {
    const sec = selSec, entryId = dayEntryMap[selDay]
    const pos = plan[selDay][sec].length
    const mealsToInsert = rids.map((rid, i) => {
      const r = recipes.find(x => x.id === rid) || { name: rid, prep: 0, active: 0, min: 1, base: defPort, advancePrepHours: null, advancePrepNote: null }
      return { recipeId: rid, section: sec, name: r.name, prep: r.prep, active: r.active, min: r.min, portion: defPort, base: r.base, advancePrepHours: r.advancePrepHours ?? null, advancePrepNote: r.advancePrepNote ?? null, position: pos + i }
    })
    // Optimistic
    const tempMeals = mealsToInsert.map(m => ({ ...m, id: uid() }))
    setPlan({ ...plan, [selDay]: { ...plan[selDay], [sec]: [...plan[selDay][sec], ...tempMeals] } })
    setScreen('dailyPlan')
    // DB write — replace temp IDs with real ones
    const created = await addPlannedMeals(entryId, mealsToInsert)
    if (created) {
      setPlanState(prev => {
        const updated = { ...prev, [selDay]: { ...prev[selDay], [sec]: [...prev[selDay][sec]] } }
        tempMeals.forEach((tm, i) => {
          const idx = updated[selDay][sec].findIndex(x => x.id === tm.id)
          if (idx >= 0 && created[i]) updated[selDay][sec][idx] = { ...updated[selDay][sec][idx], id: created[i].id }
        })
        return updated
      })
    }
  }

  const duplicateMeal = async (day, sec, id) => {
    const meal = plan[day][sec].find(m => m.id === id)
    if (!meal) return
    const entryId = dayEntryMap[day]
    const pos = plan[day][sec].length
    const r = recipes.find(x => x.id === meal.recipeId)
    const mealToInsert = { recipeId: meal.recipeId, section: sec, name: meal.name, prep: meal.prep, active: meal.active, min: r?.min ?? meal.min, portion: meal.portion, base: r?.base ?? meal.portion, advancePrepHours: r?.advancePrepHours ?? meal.advancePrepHours ?? null, advancePrepNote: r?.advancePrepNote ?? meal.advancePrepNote ?? null, position: pos }
    // Optimistic
    const tempMeal = { ...mealToInsert, id: uid() }
    setPlan({ ...plan, [day]: { ...plan[day], [sec]: [...plan[day][sec], tempMeal] } })
    // DB write — replace temp ID with real one
    const created = await addPlannedMeals(entryId, [mealToInsert])
    if (created?.[0]) {
      setPlanState(prev => {
        const updated = { ...prev, [day]: { ...prev[day], [sec]: [...prev[day][sec]] } }
        const idx = updated[day][sec].findIndex(x => x.id === tempMeal.id)
        if (idx >= 0) updated[day][sec][idx] = { ...updated[day][sec][idx], id: created[0].id }
        return updated
      })
    }
  }

  const onShoppingToggle = async id => {
    const item = shopping.find(x => x.id === id)
    const checked = !item?.checked
    setShopping(s => s.map(x => x.id === id ? { ...x, checked } : x))
    await updateShoppingItem(id, checked)
  }

  const generateShoppingList = async () => {
    // Build the full meals payload — recipeId lets the edge function look up
    // ingredients and scale by portion / recipe base.
    const meals = []
    DAYS.forEach(day => {
      ;['breakfast','main','side'].forEach(sec => {
        plan[day][sec].forEach(m => meals.push({
          day, section: sec,
          recipeId: m.recipeId,
          name: m.name,
          portion: m.portion,
        }))
      })
    })
    if (!meals.length) { alert('Add some meals to the planner first.'); return }

    // Switch to the List tab so the user sees the loading state
    setTab('list'); setScreen(null)
    setShoppingLoading(true); setShoppingError(null)

    try {
      // Edge function should: fetch ingredients per recipeId, scale by portion,
      // sum across the week, categorise into aisles via Gemini, and return:
      //   { items: [{ name, amount, unit, aisle, notes? }, ...] }
      const result = await callEdgeFn('shopping-list', { meals, weekOf: WEEK_OF, region: 'UK' })
      const items = (result.items || []).map(it => ({
        name: it.name,
        amount: it.amount ?? '',
        unit: it.unit ?? '',
        aisle: (it.aisle || 'OTHER').toUpperCase(),
        checked: false,
      }))
      setShopping(items.map((it, i) => ({ ...it, id: `tmp-${i}` })))
      const sid = await saveShoppingList(planId, items)
      setShoppingId(sid)
      const sl = await fetchShoppingList(planId)
      if (sl) setShopping(sl.shopping_list_items || [])
    } catch (e) {
      setShoppingError(e.message)
    } finally {
      setShoppingLoading(false)
    }
  }

  // ── AI functions ─────────────────────────────────────────────────
  // Toddler DOB used for age-appropriate nutritional guidelines
  const TODDLER_DOB = '2024-09-27'

  const analyseNutrition = async () => {
    setNutriLoading(true); setNutriError(null)
    try {
      // Pass recipeId so the edge function can pull ingredients/macros from the recipe row
      // and scale by portion. Defaults: 1 portion/day/adult, 0.5 portion/day/toddler.
      const allMeals = []
      DAYS.forEach(day => {
        ;['breakfast','main','side'].forEach(sec => {
          plan[day][sec].forEach(m => allMeals.push({
            day, section: sec,
            recipeId: m.recipeId,
            name: m.name,
            portion: m.portion,
          }))
        })
      })
      if (!allMeals.length) { setNutriError('Add some meals to the planner first.'); setNutriLoading(false); return }

      const basePayload = { meals: allMeals, weekOf: WEEK_OF, region: 'UK', analysis: 'daily_and_weekly' }

      // The edge function should return per-day breakdown + weekly summary.
      // UI currently renders weekly scores + recommendations; if `daily` is provided
      // it will be available on the response object for future expansion.
      const [adultResult, toddlerResult] = await Promise.all([
        callEdgeFn('nutrition', { ...basePayload, profile: 'female_adult', portionsPerDay: 1 }),
        callEdgeFn('nutrition', { ...basePayload, profile: 'toddler',      portionsPerDay: 0.5, dob: TODDLER_DOB }),
      ])
      const normalize = r => ({
        scores: r.scores,
        general: r.generalRecommendations || r.general || [],
        meals: (r.mealRecommendations || r.meals || []).map(x => ({
          meal: x.forMeal || x.meal || '',
          text: x.text,
          type: x.type,
        })),
      })
      setNutriData({ adult: normalize(adultResult), toddler: normalize(toddlerResult) })
    } catch(e) {
      setNutriError(e.message)
    } finally {
      setNutriLoading(false)
    }
  }

  const generateBatch = async () => {
    setBatchLoading(true); setBatchError(null)
    try {
      const result = await callEdgeFn('batch-cooking', { meals: plan })
      setBatchData(result)
    } catch(e) {
      setBatchError(e.message)
    } finally {
      setBatchLoading(false)
    }
  }

  // ── Nav ─────────────────────────────────────────────────────────
  const openDayPlan   = day => { setSelDay(day); setScreen('dailyPlan') }
  const openAddSec    = (day, sec) => { setSelDay(day); setSelSec(sec); setScreen('recipeSelection') }
  const openRecipeFromSelection = recipeId => { setPrevScreen('recipeSelection'); setSelRecipeId(recipeId); setRecipeDetailPortion(4); setScreen('recipe') }
  const openRecipeFromHome = (recipeId, portion) => { setPrevScreen(null); setSelRecipeId(recipeId); setRecipeDetailPortion(portion ?? 4); setScreen('recipe') }
  const copyWeekPlan  = () => {
    const lines = [`5 Minutes to Dinner — ${WEEK_LBL}\n`]
    DAYS.forEach(day => {
      const meals = [...plan[day].breakfast, ...plan[day].main, ...plan[day].side]
      if (!meals.length) return
      lines.push(DAY_LBL[day])
      meals.forEach(m => {
        const sec = m.section === 'breakfast' ? 'Breakfast' : m.section === 'main' ? 'Main' : 'Side'
        lines.push(`• ${m.name} — ${sec} (${m.portion} portions)`)
      })
      lines.push('')
    })
    navigator.clipboard.writeText(lines.join('\n'))
  }
  const goBack = () => {
    if (screen === 'recipe' && prevScreen === 'recipeSelection') {
      setPrevScreen(null)
      setScreen('recipeSelection')
    } else if (screen === 'recipeSelection') {
      setScreen('dailyPlan')
    } else {
      setScreen(null)
    }
  }

  const headerTitle =
    screen === 'settings'        ? 'Settings'
    : screen === 'dailyPlan'     ? 'Daily Plan'
    : screen === 'recipeSelection' ? `${DAY_LBL[selDay]} | ${selSec === 'breakfast' ? 'Breakfast' : selSec === 'main' ? 'Main Meal' : 'Side Dish'}`
    : screen === 'nutrition'     ? 'Nutrition Insights'
    : screen === 'recipe'        ? 'Recipe Details'
    : '5 Minutes to Dinner'

  const NAV = [{id:'home',icon:'home',label:'Home'},{id:'planner',icon:'calendar',label:'Planner'},{id:'list',icon:'cart',label:'Shopping'},{id:'batch',icon:'chefHat',label:'Batch'}]

  const renderScreen = () => {
    if (loading) return <Spinner msg={loadMsg}/>
    if (error) return (
      <div style={{padding:32,textAlign:'center'}}>
        <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
        <div style={{...ep,fontSize:16,color:C.error,marginBottom:8}}>Couldn't connect</div>
        <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.6,marginBottom:20}}>{error}</div>
        <Btn label='Retry' onClick={()=>window.location.reload()} secondary/>
      </div>
    )
    if (screen === 'settings')        return <SettingsScreen defPort={defPort} setDefPort={setDefPort}/>
    if (screen === 'nutrition')       return <NutritionScreen profile={nutriProf} setProfile={setNutriProf} nutriData={nutriData} nutriLoading={nutriLoading} nutriError={nutriError} onAnalyse={analyseNutrition}/>
    if (screen === 'dailyPlan')       return <DailyPlanScreen day={selDay} plan={plan} recipes={recipes} updatePortion={updatePortion} removeMeal={removeMeal} onAddToSection={openAddSec} onSave={()=>setScreen(null)}/>
    if (screen === 'recipeSelection') return <RecipeSelectionScreen day={selDay} section={selSec} plan={plan} recipes={recipes} onAdd={addMeals} onRecipeCreated={r=>setRecipes(prev=>[...prev,r].sort((a,b)=>a.name.localeCompare(b.name)))} onPreview={openRecipeFromSelection}/>
    if (screen === 'recipe')          return <RecipeScreen recipeId={selRecipeId} portion={recipeDetailPortion}/>
    if (tab === 'home')    return <HomeScreen plan={plan} onDayOpen={openDayPlan} onRecipeOpen={openRecipeFromHome} moveMeal={moveMeal} onCopy={copyWeekPlan} onRecipeCreated={r=>setRecipes(prev=>[...prev,r].sort((a,b)=>a.name.localeCompare(b.name)))}/>
    if (tab === 'planner') return <PlannerScreen plan={plan} removeMeal={removeMeal} moveMeal={moveMeal} duplicateMeal={duplicateMeal} updatePortion={updatePortion} onDayOpen={openDayPlan} onNutrition={()=>{ setScreen('nutrition'); if(!nutriData) analyseNutrition() }} onShoppingList={generateShoppingList}/>
    if (tab === 'list')    return <ShoppingListScreen shopping={shopping} onToggle={onShoppingToggle} loading={shoppingLoading} error={shoppingError} onRegenerate={generateShoppingList}/>
    if (tab === 'batch')   return <BatchScreen activeTab={batchTab} setActiveTab={setBatchTab} batchData={batchData} batchLoading={batchLoading} batchError={batchError} onGenerate={generateBatch}/>
  }

  return (
    <div style={{display:'flex',justifyContent:'center',background:'#dbe6d8',minHeight:'100vh'}}>
      <div style={{width:'100%',maxWidth:430,background:C.white,display:'flex',flexDirection:'column',minHeight:'100vh',position:'relative',...mn}}>
        <div style={{background:C.primary,padding:'16px 20px',display:'flex',alignItems:'center',gap:10,flexShrink:0,position:'sticky',top:0,zIndex:20}}>
          {screen
            ? <button onClick={goBack} style={{border:'none',background:'none',color:C.onPrimary,cursor:'pointer',padding:'2px 8px 2px 0',display:'flex',alignItems:'center'}}><Icon name='back' color={C.onPrimary}/></button>
            : <img src='/dino-logo.png' alt='' style={{width:30,height:30,objectFit:'contain',flexShrink:0}}/>
          }
          <span style={{...ep,fontSize:screen?16:18,letterSpacing:'0.005em',color:C.onPrimary,flex:1}}>{headerTitle}</span>
          {!loading && !screen && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {error && <div style={{width:6,height:6,borderRadius:99,background:'#ffb4a9'}} title='DB error'/>}
              <button onClick={()=>setScreen('settings')} style={{border:'none',background:'rgba(255,255,255,0.16)',borderRadius:99,cursor:'pointer',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name='settings' size={17} color={C.onPrimary}/></button>
            </div>
          )}
        </div>
        <div style={{flex:1,overflowY:'auto',position:'relative',paddingBottom:screen?80:0,display:'flex',flexDirection:'column'}}>
          {renderScreen()}
        </div>
        <div style={{flexShrink:0,position:'sticky',bottom:0,zIndex:20,display:'flex',flexDirection:'column'}}>
          {tab === 'planner' && !screen && (
            <div style={{padding:'10px 20px'}}>
              <button onClick={generateShoppingList} style={{width:'100%',background:C.primary,color:C.onPrimary,border:'none',borderRadius:99,padding:'15px',...mn,fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(45,96,47,0.3)',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <Icon name='cart' size={17} color={C.onPrimary}/>Generate shopping list
              </button>
            </div>
          )}
          {screen !== 'settings' && (
            <div style={{background:C.primaryFixed,borderTop:`1px solid ${C.outlineVariant}30`,display:'flex',padding:'8px 0 14px'}}>
              {NAV.map(t => {
                const active = tab === t.id && !screen
                return (
                  <button key={t.id} onClick={()=>{setTab(t.id);setScreen(null)}} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,border:'none',background:'none',color:active?C.primary:C.onSurfaceVariant,cursor:'pointer',padding:'4px 2px'}}>
                    <Icon name={t.icon} size={active?22:20}/>
                    <span style={{...mn,fontSize:10,fontWeight:active?700:500}}>{t.label}</span>
                    {active && <div style={{width:18,height:2,background:C.primary,borderRadius:2}}/>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
