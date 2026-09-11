import { useState, useEffect, useRef, useMemo } from 'react'
import {
  fetchRecipes, fetchSettings, saveSettings, savePreferences,
  getOrCreatePlan, fetchWeekPlan, clearPlannedMeals,
  addPlannedMeals, removePlannedMeal, updatePlannedMealPortion, movePlannedMeal,
  fetchShoppingList, saveShoppingList, updateShoppingItem,
  fetchFreezerItems, replaceFreezerItems, addFreezerItem, updateFreezerStock, removeFreezerItem,
  fetchToddlerCookingGuide, saveToddlerCookingGuide,
  fetchUserProfile, saveUserProfile, fetchAllRecipeNutrition, saveRecipeView, fetchRecipesForExport,
} from './supabase.js'
import { callEdgeFn } from './ai.js'
import { computeTargets } from './goalMaths.js'
import { C, ep, mn, R } from './theme.js'
import { TODAY, DAY_LBL, WEEK_START_OPTIONS, weekBounds, uid, emptyWeek, ageBandFromDob, ageBandLabel } from './dateHelpers.js'
import { ALL_SECTION_IDS, enabledSectionIds, sectionLabel, sectionShort, dayMeals } from './mealSections.js'
import { normalisePreferences, migrateLegacyToddlerDob, activeToddlerDob, newChild, COUNTRIES, countryName } from './preferences.js'
import { APP_VERSION_LABEL } from './appVersion.js'
import { useScrollMemory } from './useScrollMemory.js'
import { Spinner, Btn, Icon } from '../components/ui/index.js'
import { OptionListScreen, ChildEditorScreen, FeedbackScreen } from '../components/settings/subscreens.jsx'
import { RecipeScreen } from '../components/RecipeScreen.jsx'
import { HomeScreen } from '../components/HomeScreen.jsx'
import { PlannerScreen } from '../components/PlannerScreen.jsx'
import { DailyPlanScreen } from '../components/DailyPlanScreen.jsx'
import { RecipeSelectionScreen } from '../components/RecipeSelectionScreen.jsx'
import { NutritionScreen } from '../components/NutritionScreen.jsx'
import { ShoppingListScreen } from '../components/ShoppingListScreen.jsx'
import { BatchScreen } from '../components/BatchScreen.jsx'
import { SettingsScreen } from '../components/SettingsScreen.jsx'
import { FreezerScreen } from '../components/FreezerScreen.jsx'
import { ToddlerCookingScreen } from '../components/ToddlerCookingScreen.jsx'

// Header titles for the Settings sub-screens (keyed by `settingsSub.kind`).
const SETTINGS_SUB_TITLE = { weekStart:'Week starts on', country:'Country', child:'Child', feedback:'Feedback & support' }

// Recipe selection view mode. Persisted to app_settings so it follows the user
// across devices, and mirrored to localStorage so the first paint doesn't flash
// the list before Supabase answers. Both accesses can throw (Safari private
// mode), so neither is allowed to take the app down.
const RECIPE_VIEW_KEY = '5mtd.recipeView'
const readStoredRecipeView = () => {
  try {
    const v = localStorage.getItem(RECIPE_VIEW_KEY)
    return v === 'list' || v === 'photos' ? v : null
  } catch { return null }
}
const writeStoredRecipeView = v => { try { localStorage.setItem(RECIPE_VIEW_KEY, v) } catch {} }

// ─── Root App ──────────────────────────────────────────────────────────
export default function App() {
  // Nav
  const [tab,       setTab]      = useState('home')
  const [screen,    setScreen]   = useState(null)
  const [selDay,    setSelDay]   = useState(TODAY)
  const [selSec,    setSelSec]   = useState('main')
  const [batchTab,  setBatchTab] = useState('big')
  const [nutriProf, setNutriProf]= useState('adult')
  // Recipe selection screen state lives here, not in the screen: opening a
  // recipe preview swaps `screen`, which unmounts the screen and would otherwise
  // discard a pending multi-select (and the search term) on the way back.
  const [recipeView,   setRecipeViewSt]  = useState(() => readStoredRecipeView() ?? 'list')
  const [selectedRecipes, setSelectedRecipes] = useState([])
  const [recipeSearch, setRecipeSearch] = useState('')
  const [recipeChip,   setRecipeChip]   = useState('cat')
  const [selRecipeId,      setSelRecipeId]      = useState(null)
  const [recipeDetailPortion, setRecipeDetailPortion] = useState(4)
  // Set when the recipe screen was opened from a planned meal, so changing
  // servings there writes back to the plan instead of being a preview.
  const [recipeDetailMealId, setRecipeDetailMealId] = useState(null)
  const [prevScreen,       setPrevScreen]       = useState(null)
  const [screenBeforeToddler, setScreenBeforeToddler] = useState(null)
  // Settings sub-screen: null, or { kind: 'weekStart'|'country'|'child'|'feedback', childId? }
  const [settingsSub,      setSettingsSub]      = useState(null)

  // Data
  const [loading,     setLoading]     = useState(true)
  const [loadMsg,     setLoadMsg]     = useState('Connecting to Supabase…')
  const [error,       setError]       = useState(null)
  const [recipes,     setRecipes]     = useState([])
  const [freezerItems,setFreezerItems]= useState([])
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
  const [toddlerGuide,       setToddlerGuide]       = useState(null)
  const [toddlerGuideLoading,setToddlerGuideLoading] = useState(false)
  const [toddlerGuideError,  setToddlerGuideError]   = useState(null)
  const [toddlerBand,        setToddlerBand]         = useState(null)
  const [defPort,     setDefPortSt]   = useState(4)
  const [prefs,       setPrefsSt]     = useState(() => normalisePreferences())
  const [goalProfile,      setGoalProfileSt]  = useState(null)
  const [nutritionByRecipe,setNutritionByRecipe] = useState({})
  const goalSaveTimer = useRef(null)
  const goalPendingPatch = useRef({})
  const prefsSaveTimer = useRef(null)
  const prefsPendingPatch = useRef({})
  const loadedWeekOf = useRef(null)     // week the plan on screen was loaded for

  // ── Derived from preferences ─────────────────────────────────────
  // The week (start day, dates, label), the day sections the user has turned
  // on, and the DOB toddler content keys off. Everything downstream reads
  // these rather than the raw preference values.
  const week       = useMemo(() => weekBounds(prefs.weekStartsOn), [prefs.weekStartsOn])
  const sectionIds = useMemo(() => enabledSectionIds(prefs.mealSections), [prefs.mealSections])
  const toddlerDob = activeToddlerDob(prefs)
  const toddlerActivitiesOn = !!toddlerDob && prefs.toddlerActivities
  const toddlerVariationsOn = prefs.toddlerModeEnabled && prefs.toddlerVariations
  const region = countryName(prefs.country)

  // ── Plan loading ─────────────────────────────────────────────────
  // Reads (or creates) the plan for a week and swaps it in. Called at
  // bootstrap and again whenever the week start setting moves the week.
  const loadPlan = async ({ weekOf, days }) => {
    const pid = await getOrCreatePlan(weekOf, days)
    const deRows = await fetchWeekPlan(pid)
    const entryMap = {}, newPlan = emptyWeek()
    deRows.forEach(de => {
      entryMap[de.day_of_week] = de.id
      ;(de.planned_meals || []).forEach(pm => {
        const sec = pm.section
        if (newPlan[de.day_of_week]?.[sec] !== undefined) {
          newPlan[de.day_of_week][sec].push({
            id: pm.id, recipeId: pm.recipe_id, freezerItemId: pm.freezer_item_id, section: sec,
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
    const sl = await fetchShoppingList(pid)
    setPlanId(pid)
    setDayEntryMap(entryMap)
    setPlanState(newPlan)
    setShoppingId(sl?.id ?? null)
    setShopping(sl?.shopping_list_items || [])
  }

  // ── Bootstrap ────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        setLoadMsg('Loading recipes…')
        const [recs, settings, freezer, profile, nutritionMap] = await Promise.all([
          fetchRecipes(), fetchSettings(), fetchFreezerItems(), fetchUserProfile(), fetchAllRecipeNutrition(),
        ])
        setRecipes(recs)
        setFreezerItems(freezer)
        if (settings.defaultPortions) setDefPortSt(settings.defaultPortions)
        // Adopt the saved view only when this device has no local choice yet,
        // so a fresh device inherits it and an existing one isn't overridden.
        if (settings.recipeView && !readStoredRecipeView()) {
          setRecipeViewSt(settings.recipeView)
          writeStoredRecipeView(settings.recipeView)
        }
        // One-time move from the old single toddler_dob to the children list.
        let loadedPrefs = normalisePreferences(settings.preferences)
        const migration = migrateLegacyToddlerDob(loadedPrefs, settings.legacyToddlerDob)
        if (migration) {
          loadedPrefs = normalisePreferences({ ...loadedPrefs, ...migration })
          savePreferences(migration).catch(e => console.error('toddler DOB migration save failed', e))
        }
        setPrefsSt(loadedPrefs)
        setGoalProfileSt(profile)
        setNutritionByRecipe(nutritionMap)

        setLoadMsg('Loading your meal plan…')
        const bootWeek = weekBounds(loadedPrefs.weekStartsOn)
        await loadPlan(bootWeek)
        loadedWeekOf.current = bootWeek.weekOf

        setLoading(false)
      } catch (e) {
        console.error(e)
        setError(e.message)
        setLoading(false)
      }
    })()
  }, [])

  // Changing "Week starts on" moves the week, so the plan on screen has to
  // follow. Skips the bootstrap week, which loadPlan above already handled.
  useEffect(() => {
    if (loading || loadedWeekOf.current === week.weekOf) return
    loadedWeekOf.current = week.weekOf
    loadPlan(week).catch(e => console.error('week reload failed', e))
  }, [week, loading])

  // ── Mutations (optimistic UI + background DB write) ───────────────
  const setPlan = newPlan => setPlanState(newPlan)

  // These three are optimistic: the UI moves immediately and the write follows.
  // The save functions now throw on failure, so each catch is load-bearing —
  // without it a rejected promise from an event handler becomes an unhandled
  // rejection. There is no toast surface here, so a failure is logged and the
  // optimistic value stands until the next reload re-reads the saved one.
  const setDefPort = val => {
    setDefPortSt(val)
    saveSettings(val).catch(e => console.error('default portions save failed', e))
  }

  const setRecipeView = val => {
    setRecipeViewSt(val)
    writeStoredRecipeView(val)
    saveRecipeView(val).catch(e => console.error('recipe view save failed', e))
  }

  // Preferences (Settings) — applied instantly, persisted on a short debounce so
  // a drag-reorder or a run of toggles becomes one write. The patch is
  // normalised so downstream code never sees a half-formed value.
  const setPrefs = patch => {
    setPrefsSt(prev => normalisePreferences({ ...prev, ...patch }))
    prefsPendingPatch.current = { ...prefsPendingPatch.current, ...patch }
    clearTimeout(prefsSaveTimer.current)
    prefsSaveTimer.current = setTimeout(() => {
      const toSave = prefsPendingPatch.current
      prefsPendingPatch.current = {}
      savePreferences(toSave).catch(e => console.error('preferences save failed', e))
    }, 300)
  }

  // Children live inside prefs; these keep the list edits in one place.
  const addChild = ({ name, dob }) => {
    const child = newChild({ name, dob })
    setPrefs({ children: [...prefs.children, child], selectedChildId: prefs.selectedChildId ?? child.id })
    return child
  }
  const updateChild = (id, patch) => setPrefs({ children: prefs.children.map(c => c.id === id ? { ...c, ...patch } : c) })
  const removeChild = id => {
    const children = prefs.children.filter(c => c.id !== id)
    setPrefs({ children, selectedChildId: prefs.selectedChildId === id ? (children[0]?.id ?? null) : prefs.selectedChildId })
  }

  // Keep the age band in sync with the selected child's DOB and drop the cached
  // AI guide, which is keyed by DOB.
  useEffect(() => {
    setToddlerBand(toddlerDob ? ageBandFromDob(toddlerDob) : null)
    setToddlerGuide(null)
  }, [toddlerDob])

  // Goal profile — updates the panel instantly, persists on a short debounce so a
  // quick run of keystrokes (age, weights) doesn't fire a write per character.
  const setGoalProfile = patch => {
    setGoalProfileSt(prev => ({ ...prev, ...patch }))
    goalPendingPatch.current = { ...goalPendingPatch.current, ...patch }
    clearTimeout(goalSaveTimer.current)
    goalSaveTimer.current = setTimeout(() => {
      const toSave = goalPendingPatch.current
      goalPendingPatch.current = {}
      saveUserProfile(toSave)
    }, 500)
  }
  // Scroll position per screen, so Settings (nine sections long) reopens where
  // it was left after a sub-screen. Keyed on the visible screen identity.
  useScrollMemory(screen ? `${screen}:${settingsSub ? settingsSub.kind + (settingsSub.childId || '') : ''}` : `tab:${tab}`)

  const goalTargets = useMemo(
    () => (goalProfile ? computeTargets(goalProfile) : null),
    [goalProfile]
  )

  const removeMeal = async (day, sec, id) => {
    const meal = plan[day][sec].find(m => m.id === id)
    setPlan({ ...plan, [day]: { ...plan[day], [sec]: plan[day][sec].filter(m => m.id !== id) } })
    if (meal?.freezerItemId) {
      setFreezerItems(items => items.map(it => it.id === meal.freezerItemId ? { ...it, in_stock: true } : it))
      updateFreezerStock(meal.freezerItemId, true)
    }
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

  const addFreezerMeals = async itemIds => {
    const sec = selSec, entryId = dayEntryMap[selDay]
    const pos = plan[selDay][sec].length
    const mealsToInsert = itemIds.map((iid, i) => {
      const item = freezerItems.find(x => x.id === iid) || { name: iid }
      return { recipeId: null, freezerItemId: iid, section: sec, name: item.name, prep: 0, active: 0, min: 1, portion: defPort, base: defPort, advancePrepHours: null, advancePrepNote: null, position: pos + i }
    })
    // Optimistic
    const tempMeals = mealsToInsert.map(m => ({ ...m, id: uid() }))
    setPlan({ ...plan, [selDay]: { ...plan[selDay], [sec]: [...plan[selDay][sec], ...tempMeals] } })
    setFreezerItems(items => items.map(it => itemIds.includes(it.id) ? { ...it, in_stock: false } : it))
    setScreen('dailyPlan')
    // DB writes
    updateFreezerStock(itemIds, false)
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
    const mealToInsert = { recipeId: meal.recipeId, freezerItemId: meal.freezerItemId ?? null, section: sec, name: meal.name, prep: meal.prep, active: meal.active, min: r?.min ?? meal.min, portion: meal.portion, base: r?.base ?? meal.portion, advancePrepHours: r?.advancePrepHours ?? meal.advancePrepHours ?? null, advancePrepNote: r?.advancePrepNote ?? meal.advancePrepNote ?? null, position: pos }
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
    const meals = plannedMealsPayload()
    if (!meals.length) { alert('Add some meals to the planner first.'); return }

    // Switch to the List tab so the user sees the loading state
    setTab('list'); setScreen(null)
    setShoppingLoading(true); setShoppingError(null)

    try {
      // Edge function should: fetch ingredients per recipeId, scale by portion,
      // sum across the week, categorise into aisles via Gemini, and return:
      //   { items: [{ name, amount, unit, aisle, notes? }, ...] }
      const result = await callEdgeFn('shopping-list', { meals, weekOf: week.weekOf, region, units: prefs.recipeUnits, measurements: prefs.measurements })
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

  // Every visible planned meal this week, in the shape the shopping-list and
  // nutrition functions take. Meals in sections the user has turned off are
  // kept in the plan but left out, matching what the planner shows.
  const plannedMealsPayload = () => week.days.flatMap(day =>
    dayMeals(plan[day], sectionIds).map(m => ({ day, section: m.section, recipeId: m.recipeId, name: m.name, portion: m.portion }))
  )

  // Settings › Your data › Reset this week's plan. Freezer meals go back in
  // stock, the same as removing them one by one would.
  const resetWeekPlan = async () => {
    const meals = week.days.flatMap(day => dayMeals(plan[day]))
    const freezerIds = meals.map(m => m.freezerItemId).filter(Boolean)
    await clearPlannedMeals(Object.values(dayEntryMap))
    if (freezerIds.length) {
      setFreezerItems(items => items.map(it => freezerIds.includes(it.id) ? { ...it, in_stock: true } : it))
      await updateFreezerStock(freezerIds, true)
    }
    setPlanState(emptyWeek())
  }

  // Settings › Your data › Export all recipes — one JSON file.
  const exportRecipes = async () => {
    const rows = await fetchRecipesForExport()
    const payload = { exportedAt: new Date().toISOString(), app: '5 Minutes to Dinner', version: APP_VERSION_LABEL, recipes: rows }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `5-minutes-to-dinner-recipes-${new Date().toISOString().slice(0, 10)}.json` })
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── AI functions ─────────────────────────────────────────────────
  const analyseNutrition = async () => {
    setNutriLoading(true); setNutriError(null)
    try {
      // Pass recipeId so the edge function can pull ingredients/macros from the recipe row
      // and scale by portion. Defaults: 1 portion/day/adult, 0.5 portion/day/toddler.
      const allMeals = plannedMealsPayload()
      if (!allMeals.length) { setNutriError('Add some meals to the planner first.'); setNutriLoading(false); return }

      const basePayload = { meals: allMeals, weekOf: week.weekOf, region, analysis: 'daily_and_weekly' }

      // The edge function should return per-day breakdown + weekly summary.
      // UI currently renders weekly scores + recommendations; if `daily` is provided
      // it will be available on the response object for future expansion.
      // The toddler analysis only runs when toddler content is on and a child is set.
      const [adultResult, toddlerResult] = await Promise.all([
        callEdgeFn('nutrition', { ...basePayload, profile: 'female_adult', portionsPerDay: 1 }),
        toddlerDob ? callEdgeFn('nutrition', { ...basePayload, profile: 'toddler', portionsPerDay: 0.5, dob: toddlerDob }) : null,
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
      setNutriData({ adult: normalize(adultResult), toddler: toddlerResult ? normalize(toddlerResult) : null })
    } catch(e) {
      setNutriError(e.message)
    } finally {
      setNutriLoading(false)
    }
  }

  const generateBatch = async () => {
    setBatchLoading(true); setBatchError(null)
    try {
      const result = await callEdgeFn('batch-cooking', {
        meals: plan, region,
        ageBandLabel: toddlerActivitiesOn ? ageBandLabel(ageBandFromDob(toddlerDob)) : null,
      })
      setBatchData(result)
    } catch(e) {
      setBatchError(e.message)
    } finally {
      setBatchLoading(false)
    }
  }

  const generateToddlerGuide = async () => {
    setToddlerGuideLoading(true); setToddlerGuideError(null)
    try {
      const result = await callEdgeFn('toddler-cooking', { dob: toddlerDob })
      setToddlerGuide(result)
      saveToddlerCookingGuide(toddlerDob, result)
    } catch(e) {
      setToddlerGuideError(e.message)
    } finally {
      setToddlerGuideLoading(false)
    }
  }

  // ── Nav ─────────────────────────────────────────────────────────
  const openDayPlan   = day => { setSelDay(day); setScreen('dailyPlan') }
  // Entering the picker afresh starts clean; returning from a recipe preview
  // goes through goBack(), which leaves these intact.
  const openAddSec    = (day, sec) => { setSelDay(day); setSelSec(sec); setSelectedRecipes([]); setRecipeSearch(''); setRecipeChip('cat'); setScreen('recipeSelection') }
  const openFreezerManage = () => { setPrevScreen('recipeSelection'); setScreen('freezerManage') }
  const openSettings = () => { setSettingsSub(null); setScreen('settings') }
  // Settings chevron rows. The freezer row reuses the existing freezer screen.
  const openSettingsSub = sub => {
    if (sub.kind === 'freezer') { setPrevScreen('settings'); setScreen('freezerManage'); return }
    setSettingsSub(sub)
  }
  const findPlannedMeal = id => {
    if (!id) return null
    for (const day of week.days) {
      for (const sec of ALL_SECTION_IDS) {
        const meal = plan[day]?.[sec]?.find(x => x.id === id)
        if (meal) return { day, sec, meal }
      }
    }
    return null
  }
  const openRecipeFromSelection = recipeId => { setPrevScreen('recipeSelection'); setSelRecipeId(recipeId); setRecipeDetailMealId(null); setRecipeDetailPortion(defPort); setScreen('recipe') }
  const openRecipeFromHome = (recipeId, portion, mealId=null) => { setPrevScreen(null); setSelRecipeId(recipeId); setRecipeDetailMealId(mealId); setRecipeDetailPortion(portion ?? defPort); setScreen('recipe') }
  const openRecipeFromDailyPlan = (recipeId, portion, mealId=null) => { setPrevScreen('dailyPlan'); setSelRecipeId(recipeId); setRecipeDetailMealId(mealId); setRecipeDetailPortion(portion ?? defPort); setScreen('recipe') }
  // Changing servings on the recipe screen persists to the plan when the recipe
  // was opened from one, so the shopping list and nutrition follow.
  const changeRecipeDetailPortion = async v => {
    const found = findPlannedMeal(recipeDetailMealId)
    const val = Math.max(found?.meal?.min || 1, v)
    setRecipeDetailPortion(val)
    if (found) await updatePortion(found.day, found.sec, recipeDetailMealId, val)
  }
  const openToddlerCooking = (fromRecipe) => {
    setScreenBeforeToddler(fromRecipe ? 'recipe' : null)
    setScreen('toddlerCooking')
    if (!toddlerGuide && !toddlerGuideLoading) {
      setToddlerGuideLoading(true)
      fetchToddlerCookingGuide()
        .then(cached => { if (cached && cached.dob === toddlerDob) setToddlerGuide(cached.content) })
        .catch(() => {})
        .finally(() => setToddlerGuideLoading(false))
    }
  }
  const copyWeekPlan  = () => {
    const lines = [`5 Minutes to Dinner — ${week.label}\n`]
    week.days.forEach(day => {
      const meals = dayMeals(plan[day], sectionIds)
      if (!meals.length) return
      lines.push(DAY_LBL[day])
      meals.forEach(m => {
        lines.push(`• ${m.name} — ${sectionShort(m.section)} (${m.portion} portions)`)
      })
      lines.push('')
    })
    navigator.clipboard.writeText(lines.join('\n'))
  }
  const goBack = () => {
    if (screen === 'settings' && settingsSub) {
      setSettingsSub(null)
    } else if (screen === 'freezerManage' && prevScreen === 'settings') {
      setPrevScreen(null)
      setScreen('settings')
    } else if (screen === 'recipe' && prevScreen === 'recipeSelection') {
      setPrevScreen(null)
      setScreen('recipeSelection')
    } else if (screen === 'recipe' && prevScreen === 'dailyPlan') {
      setPrevScreen(null)
      setScreen('dailyPlan')
    } else if (screen === 'freezerManage' && prevScreen === 'recipeSelection') {
      setPrevScreen(null)
      setScreen('recipeSelection')
    } else if (screen === 'recipeSelection') {
      setScreen('dailyPlan')
    } else if (screen === 'toddlerCooking' && screenBeforeToddler === 'recipe') {
      setScreenBeforeToddler(null)
      setScreen('recipe')
    } else {
      setScreen(null)
    }
  }

  const editingChild = settingsSub?.kind === 'child' ? prefs.children.find(c => c.id === settingsSub.childId) || null : null
  const headerTitle =
    screen === 'settings'        ? (settingsSub ? (settingsSub.kind === 'child' ? (editingChild?.name || 'Add a child') : SETTINGS_SUB_TITLE[settingsSub.kind]) : 'Settings')
    : screen === 'dailyPlan'     ? 'Daily plan'
    : screen === 'recipeSelection' ? `${DAY_LBL[selDay]} | ${sectionLabel(selSec)}`
    : screen === 'nutrition'     ? 'Nutrition insights'
    : screen === 'recipe'        ? 'Recipe details'
    : screen === 'freezerManage' ? 'Freezer'
    : screen === 'toddlerCooking' ? 'Toddler cooking'
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
    if (screen === 'settings') {
      if (settingsSub?.kind === 'weekStart') return <OptionListScreen heading='Week starts on' description='The planner, shopping list and insights all run over this week. Changing it moves the week, so the days shown will change.' options={WEEK_START_OPTIONS.map(o=>({value:o.id,label:o.label}))} value={prefs.weekStartsOn} onSelect={v=>{setPrefs({weekStartsOn:v});setSettingsSub(null)}}/>
      if (settingsSub?.kind === 'country')   return <OptionListScreen heading='Country' description='Sets the ingredient names and shopping aisles the AI uses — courgette, not zucchini.' options={COUNTRIES.map(c=>({value:c.code,label:c.name}))} value={prefs.country} onSelect={v=>{setPrefs({country:v});setSettingsSub(null)}}/>
      if (settingsSub?.kind === 'child')     return <ChildEditorScreen key={settingsSub.childId||'new'} child={editingChild} onChange={patch=>updateChild(settingsSub.childId,patch)} onCreate={c=>{addChild(c);setSettingsSub(null)}} onDelete={()=>{removeChild(settingsSub.childId);setSettingsSub(null)}}/>
      if (settingsSub?.kind === 'feedback')  return <FeedbackScreen versionLabel={APP_VERSION_LABEL}/>
      return <SettingsScreen defPort={defPort} setDefPort={setDefPort} prefs={prefs} setPrefs={setPrefs} goalProfile={goalProfile} goalTargets={goalTargets} setGoalProfile={setGoalProfile} freezerItems={freezerItems} weekLabel={week.label} onOpen={openSettingsSub} onExportRecipes={exportRecipes} onResetWeek={resetWeekPlan}/>
    }
    if (screen === 'freezerManage')   return <FreezerScreen items={freezerItems} onReplace={async names=>setFreezerItems(await replaceFreezerItems(names))} onAddOne={async name=>{const item=await addFreezerItem(name);setFreezerItems(items=>{const i=items.findIndex(x=>x.id===item.id);return i>=0?items.map(x=>x.id===item.id?item:x):[...items,item].sort((a,b)=>a.name.localeCompare(b.name))})}} onToggleStock={async(id,inStock)=>{setFreezerItems(items=>items.map(x=>x.id===id?{...x,in_stock:inStock}:x));await updateFreezerStock(id,inStock)}} onDelete={async id=>{setFreezerItems(items=>items.filter(x=>x.id!==id));await removeFreezerItem(id)}}/>
    if (screen === 'nutrition')       return <NutritionScreen profile={nutriProf} setProfile={setNutriProf} nutriData={nutriData} nutriLoading={nutriLoading} nutriError={nutriError} onAnalyse={analyseNutrition} goalProfile={goalProfile} goalTargets={goalTargets} plan={plan} nutritionByRecipe={nutritionByRecipe} days={week.days} sectionIds={sectionIds} toddlerEnabled={!!toddlerDob}/>
    if (screen === 'dailyPlan')       return <DailyPlanScreen day={selDay} plan={plan} recipes={recipes} updatePortion={updatePortion} removeMeal={removeMeal} onAddToSection={openAddSec} onRecipeOpen={openRecipeFromDailyPlan} onSave={()=>setScreen(null)} goalProfile={goalProfile} goalTargets={goalTargets} nutritionByRecipe={nutritionByRecipe} sectionIds={sectionIds}/>
    if (screen === 'recipeSelection') return <RecipeSelectionScreen day={selDay} section={selSec} plan={plan} recipes={recipes} freezerItems={freezerItems} onAdd={addMeals} onAddFreezer={addFreezerMeals} onManageFreezer={openFreezerManage} onRecipeCreated={r=>setRecipes(prev=>[...prev,r].sort((a,b)=>a.name.localeCompare(b.name)))} onPreview={openRecipeFromSelection} goalProfile={goalProfile} goalTargets={goalTargets} nutritionByRecipe={nutritionByRecipe} recipeView={recipeView} setRecipeView={setRecipeView} search={recipeSearch} setSearch={setRecipeSearch} chip={recipeChip} setChip={setRecipeChip} selected={selectedRecipes} setSelected={setSelectedRecipes} days={week.days} sectionIds={sectionIds}/>
    if (screen === 'recipe')          return <RecipeScreen recipeId={selRecipeId} portion={recipeDetailPortion} onPortionChange={changeRecipeDetailPortion} onAddMeal={()=>addMeals([selRecipeId])} toddlerDob={toddlerActivitiesOn?toddlerDob:null} showToddlerVariations={toddlerVariationsOn} onOpenToddlerCooking={()=>openToddlerCooking(true)} goalProfile={goalProfile} goalTargets={goalTargets} nutritionByRecipe={nutritionByRecipe} day={selDay} plan={plan} sectionIds={sectionIds}/>
    if (screen === 'toddlerCooking')  return <ToddlerCookingScreen guide={toddlerGuide} loading={toddlerGuideLoading} error={toddlerGuideError} activeBand={toddlerBand} setActiveBand={setToddlerBand} currentBand={toddlerDob?ageBandFromDob(toddlerDob):null} onGenerate={generateToddlerGuide}/>
    if (tab === 'home')    return <HomeScreen plan={plan} days={week.days} sectionIds={sectionIds} onDayOpen={openDayPlan} onRecipeOpen={openRecipeFromHome} moveMeal={moveMeal} onCopy={copyWeekPlan} onRecipeCreated={r=>setRecipes(prev=>[...prev,r].sort((a,b)=>a.name.localeCompare(b.name)))}/>
    if (tab === 'planner') return <PlannerScreen plan={plan} days={week.days} sectionIds={sectionIds} weekLabel={week.label} removeMeal={removeMeal} moveMeal={moveMeal} duplicateMeal={duplicateMeal} updatePortion={updatePortion} onDayOpen={openDayPlan} onRecipeOpen={openRecipeFromHome} onNutrition={()=>{ setScreen('nutrition'); if(!nutriData) analyseNutrition() }} onShoppingList={generateShoppingList} goalProfile={goalProfile} goalTargets={goalTargets} nutritionByRecipe={nutritionByRecipe}/>
    if (tab === 'list')    return <ShoppingListScreen shopping={shopping} onToggle={onShoppingToggle} loading={shoppingLoading} error={shoppingError} onRegenerate={generateShoppingList}/>
    if (tab === 'batch')   return <BatchScreen activeTab={batchTab} setActiveTab={setBatchTab} batchData={batchData} batchLoading={batchLoading} batchError={batchError} onGenerate={generateBatch} onOpenToddlerCooking={toddlerActivitiesOn?()=>openToddlerCooking(false):null} showToddler={toddlerActivitiesOn}/>
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
              {error && <div style={{width:6,height:6,borderRadius:R.pill,background:'#ffb4a9'}} title='DB error'/>}
              <button onClick={openSettings} aria-label='Settings' style={{border:'none',background:'rgba(255,255,255,0.16)',borderRadius:R.pill,cursor:'pointer',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name='settings' size={17} color={C.onPrimary}/></button>
            </div>
          )}
        </div>
        <div style={{flex:1,overflowY:'auto',position:'relative',paddingBottom:screen?80:0,display:'flex',flexDirection:'column'}}>
          {renderScreen()}
        </div>
        <div style={{flexShrink:0,position:'sticky',bottom:0,zIndex:20,display:'flex',flexDirection:'column'}}>
          {tab === 'planner' && !screen && (
            <div style={{padding:'10px 20px'}}>
              <button onClick={generateShoppingList} style={{width:'100%',background:C.primary,color:C.onPrimary,border:'none',borderRadius:R.pill,padding:'15px',...mn,fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(45,96,47,0.3)',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
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
