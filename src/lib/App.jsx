import { useState, useEffect, useRef, useMemo } from 'react'
import {
  fetchRecipes, fetchSettings, saveSettings, savePreferences,
  getOrCreatePlan, fetchWeekPlan, clearPlannedMeals,
  addPlannedMeals, removePlannedMeal, updatePlannedMealPortion, movePlannedMeal,
  insertWeekMeals, removePlannedMeals, fetchWeekMealCounts, saveWeek, fetchExistingRecipeIds,
  fetchShoppingList, saveShoppingList, updateShoppingItem,
  fetchFreezerItems, replaceFreezerItems, addFreezerItem, updateFreezerStock, removeFreezerItem,
  fetchToddlerCookingGuide, saveToddlerCookingGuide,
  fetchUserProfile, saveUserProfile, fetchAllRecipeNutrition, saveRecipeView, fetchRecipesForExport,
  getSession, onAuthChange, addShoppingItem, removeShoppingItem, fetchRecipeIngredients,
  fetchTryoutPicks, addTryoutPick, removeTryoutPick, linkPickToMeal, saveRecipeDeckState, refreshReelThumbnail,
} from './supabase.js'
import { callEdgeFn, fetchAiConfig, onAiLimit } from './ai.js'
import { computeTargets } from './goalMaths.js'
import { C, ep, mn, R } from './theme.js'
import { TODAY, DAY_LBL, WEEK_START_OPTIONS, weekBounds, addWeeks, dayDateLabel, weekStripItems, uid, emptyWeek, ageBandFromDob, ageBandLabel, formatAge } from './dateHelpers.js'
import { ALL_SECTION_IDS, enabledSectionIds, sectionLabel, sectionShort, dayMeals } from './mealSections.js'
import { normalisePreferences, migrateLegacyToddlerDob, activeToddlerDob, newChild, COUNTRIES, RECIPE_LANGUAGES, countryName, equipmentLabels } from './preferences.js'
import { buildBasicShoppingList, guessAisle } from './basicShoppingList.js'
import { snapshotWeek, buildFill, fillNotice, savedRecipeIds } from './savedWeeks.js'
import { deckProgressLabel, dropSection, pickWeek, pickedMealIds, picksInWeek, plannedMealFrom, progressLabel, trayItems, waitingRecipes } from './tryDeck.js'
import { reelPlatform } from './reels.js'
import { consumePwaShare } from './share/pwaShareInbox.js'
import { onIncomingShare, clearIncomingShare } from './share/handleIncomingShare.js'
import { APP_VERSION_LABEL } from './appVersion.js'
import { useScrollMemory } from './useScrollMemory.js'
import { Spinner, Btn, Icon, WeekBanner, Toast } from '../components/ui/index.js'
import { OptionListScreen, ChildEditorScreen, FeedbackScreen } from '../components/settings/subscreens.jsx'
import { GeminiKeyScreen, SignInScreen, EquipmentScreen, InstallScreen, OwnerModelsScreen } from '../components/settings/aiScreens.jsx'
import { NewRecipeForm } from '../components/NewRecipeForm.jsx'
import { ShareSheet } from '../components/ShareSheet.jsx'
import { AiLimitSheet } from '../components/AiLimitSheet.jsx'
import { Sheet } from '../components/ui/Sheet.jsx'
import { RecipeScreen } from '../components/RecipeScreen.jsx'
import { HomeScreen } from '../components/HomeScreen.jsx'
import { PlannerScreen } from '../components/PlannerScreen.jsx'
import { TryDeckScreen } from '../components/TryDeckScreen.jsx'
import { DailyPlanScreen } from '../components/DailyPlanScreen.jsx'
import { RecipeSelectionScreen } from '../components/RecipeSelectionScreen.jsx'
import { NutritionScreen } from '../components/NutritionScreen.jsx'
import { ShoppingListScreen } from '../components/ShoppingListScreen.jsx'
import { BatchScreen } from '../components/BatchScreen.jsx'
import { SettingsScreen } from '../components/SettingsScreen.jsx'
import { FreezerScreen } from '../components/FreezerScreen.jsx'
import { ToddlerCookingScreen } from '../components/ToddlerCookingScreen.jsx'

// Header titles for the Settings sub-screens (keyed by `settingsSub.kind`).
const SETTINGS_SUB_TITLE = {
  weekStart:'Week starts on', country:'Country', recipeLanguage:'Recipe language', child:'Child', feedback:'Feedback & support',
  geminiKey:'Free Google AI key', signIn:'Account', equipment:'Kitchen equipment', aiModels:'AI models', install:'Install the app',
}

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

const byName = (a, b) => a.name.localeCompare(b.name)
const TOAST_MS = 2400

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
  const [shoppingLoadingMsg,setShoppingLoadingMsg]=useState(null)
  const [shoppingError,  setShoppingError]  =useState(null)
  const [shoppingNotice, setShoppingNotice] =useState(null)
  // Accounts & AI access. `aiConfig.isOwner` is the server's verdict (ai-config
  // checks the verified email against OWNER_EMAIL); it only decides what
  // Settings shows — every owner action is re-checked server-side.
  const [session,   setSession]   = useState(null)
  const [aiConfig,  setAiConfig]  = useState(null)
  const [aiNotice,  setAiNotice]  = useState(null)   // { code, message } from the fallback chain
  // Shared into the app (see lib/share): the chooser sheet, the recipe form
  // opened with the shared content, or the freezer screen pre-loaded with it.
  const [incomingShare, setIncomingShare] = useState(null)
  const [shareRecipe,   setShareRecipe]   = useState(null)
  const [freezerShare,  setFreezerShare]  = useState(null)
  const [shareError,    setShareError]    = useState(null)
  // AI results are kept per week (weekOf → result), or one week's analysis would
  // show on another.
  const [nutriByWeek, setNutriByWeek] = useState({})
  const [nutriLoading,setNutriLoading]= useState(false)
  const [nutriError,  setNutriError]  = useState(null)
  const [batchByWeek, setBatchByWeek] = useState({})
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
  const loadSeq = useRef(0)             // numbers plan loads, so only the newest lands
  // The selected week, in whole weeks from this one. The plan, shopping list and
  // everything built on them follow it. Home and Settings always mean this week,
  // and past weeks are for looking back, so goTab and openSettings bring it back.
  const [weekOffset,    setWeekOffset]    = useState(0)
  const [planLoading,   setPlanLoading]   = useState(false)
  const [weekLoadError, setWeekLoadError] = useState(null)
  const [weekMealCounts,setWeekMealCounts]= useState({})
  const [plannerNotice, setPlannerNotice] = useState(null)
  // Every swipe-deck pick from every week (see tryDeck.js).
  const [tryoutPicks,   setTryoutPicks]   = useState([])
  const [toast,         setToast]         = useState(null)
  const toastTimer = useRef(null)
  const stillsAsked = useRef(new Set())   // recipes reel-thumbnail has been asked about

  // ── Derived from preferences ─────────────────────────────────────
  // The week (start day, dates, label), the day sections the user has turned
  // on, and the DOB toddler content keys off. Everything downstream reads
  // these rather than the raw preference values.
  const week       = useMemo(() => weekBounds(prefs.weekStartsOn, addWeeks(new Date(), weekOffset)), [prefs.weekStartsOn, weekOffset])
  const isThisWeek = weekOffset === 0
  const isPastWeek = weekOffset < 0
  const sectionIds = useMemo(() => enabledSectionIds(prefs.mealSections), [prefs.mealSections])
  const nutriData  = nutriByWeek[week.weekOf] ?? null
  const batchData  = batchByWeek[week.weekOf] ?? null
  const stripWeeks = useMemo(() => weekStripItems(prefs.weekStartsOn, weekMealCounts), [prefs.weekStartsOn, weekMealCounts])
  const toddlerDob = activeToddlerDob(prefs)
  const toddlerActivitiesOn = !!toddlerDob && prefs.toddlerActivities
  const toddlerVariationsOn = prefs.toddlerModeEnabled && prefs.toddlerVariations
  const region = countryName(prefs.country)
  // The household details the recipe AI steps and the batch planner take into
  // account. Only ages leave the device, never names or birth dates.
  const aiContext = useMemo(() => ({
    equipment: equipmentLabels(prefs.kitchenEquipment),
    region,
    units: prefs.recipeUnits,
    measurements: prefs.measurements,
    children: prefs.toddlerModeEnabled ? prefs.children.map(c => formatAge(c.dob)).filter(Boolean) : [],
    language: prefs.recipeLanguage,
    translate: prefs.recipeTranslate,
  }), [prefs.kitchenEquipment, region, prefs.recipeUnits, prefs.measurements, prefs.toddlerModeEnabled, prefs.children, prefs.recipeLanguage, prefs.recipeTranslate])

  // ── Plan loading ─────────────────────────────────────────────────
  // Reads (or creates) the plan for a week and swaps it in. Called at bootstrap
  // and again whenever the selected week or the week start setting moves the week.
  // Only the newest call lands: tapping through weeks quickly could otherwise
  // leave an older week's dayEntryMap in place, and edits would go to that week.
  // Returns false if a newer call took over.
  const loadPlan = async ({ weekOf, days }) => {
    const seq = ++loadSeq.current
    const superseded = () => seq !== loadSeq.current
    try {
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
              base: pm.base_portion_snapshot ?? undefined,
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
      if (superseded()) return false
      setPlanId(pid)
      setDayEntryMap(entryMap)
      setPlanState(newPlan)
      setShoppingId(sl?.id ?? null)
      setShopping(sl?.shopping_list_items || [])
      return true
    } catch (e) {
      if (superseded()) return false
      throw e
    }
  }

  // loadPlan with the loading and retry states the screens show. While either
  // is up the days aren't on screen, so nothing can be edited against a plan
  // that isn't the one the week label says.
  const showWeek = async w => {
    setPlanLoading(true); setWeekLoadError(null)
    try {
      if (await loadPlan(w)) setPlanLoading(false)
    } catch (e) {
      console.error('week load failed', e)
      setWeekLoadError(e.message); setPlanLoading(false)
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        setLoadMsg('Loading recipes…')
        const [recs, settings, freezer, profile, nutritionMap, picks] = await Promise.all([
          fetchRecipes(), fetchSettings(), fetchFreezerItems(), fetchUserProfile(), fetchAllRecipeNutrition(), fetchTryoutPicks(),
        ])
        setRecipes(recs)
        setTryoutPicks(picks)
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

  // ── Session & AI access ──────────────────────────────────────────
  useEffect(() => {
    getSession().then(setSession).catch(() => {})
    const sub = onAuthChange(setSession)
    return () => sub.unsubscribe()
  }, [])

  // Re-asked whenever the signed-in user changes: is this the owner?
  const sessionUserId = session?.user?.id ?? null
  useEffect(() => {
    let cancelled = false
    fetchAiConfig()
      .then(cfg => { if (!cancelled) setAiConfig(cfg) })
      .catch(e => { if (!cancelled) { setAiConfig(null); console.error('ai-config failed', e) } })
    return () => { cancelled = true }
  }, [sessionUserId])

  useEffect(() => onAiLimit(n => setAiNotice({ ...n, id: Date.now() })), [])

  // ── Shares ───────────────────────────────────────────────────────
  // A link goes straight to the recipe form (reading it is step 1); text and
  // photos ask whether they're a recipe or a freezer list.
  useEffect(() => {
    consumePwaShare().catch(e => setShareError(e.message))
    return onIncomingShare(share => {
      clearIncomingShare()
      if (share.kind === 'url') { setIncomingShare(null); setShareRecipe({ url: share.url, text: share.text }) }
      else setIncomingShare(share)
    })
  }, [])

  const routeShare = destination => {
    const share = incomingShare
    setIncomingShare(null)
    if (!share) return
    if (destination === 'recipe') {
      setShareRecipe({ url: share.url, text: share.text || share.title, files: share.files })
    } else {
      setFreezerShare({ text: share.text || share.title, files: share.files, receivedAt: share.receivedAt })
      setPrevScreen(null)
      setScreen('freezerManage')
    }
  }

  // Picking a week, or changing "Week starts on", moves the week, so the plan on
  // screen has to follow. Skips the bootstrap week, which loadPlan above already
  // handled. Messages about the last week don't carry over.
  useEffect(() => {
    if (loading || loadedWeekOf.current === week.weekOf) return
    loadedWeekOf.current = week.weekOf
    setNutriError(null); setBatchError(null); setShoppingError(null); setShoppingNotice(null); setPlannerNotice(null)
    showWeek(week)
  }, [week, loading])

  // The week strip's dots. Read again as the week changes, so edits to the week
  // just left are picked up; the week on screen is worked out live below.
  useEffect(() => {
    if (loading) return
    fetchWeekMealCounts().then(setWeekMealCounts).catch(e => console.error('week counts failed', e))
  }, [loading, week.weekOf])

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
    // Tidying up a past week doesn't put anything back: that meal was probably eaten.
    if (meal?.freezerItemId && !isPastWeek) {
      setFreezerItems(items => items.map(it => it.id === meal.freezerItemId ? { ...it, in_stock: true } : it))
      updateFreezerStock(meal.freezerItemId, true)
    }
    await removePlannedMeal(id)
    // The database has unlinked its pick, if any, which puts it back in the tray.
    setTryoutPicks(prev => prev.map(p => p.planned_meal_id === id ? { ...p, planned_meal_id: null } : p))
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
    setShoppingLoading(true); setShoppingError(null); setShoppingNotice(null)
    // The list is saved to the week it was made for; it's only shown if that's
    // still the week on screen.
    const before = shopping
    const forWeek = week.weekOf
    const stillOnWeek = () => loadedWeekOf.current === forWeek

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
      if (stillOnWeek()) setShopping(items.map((it, i) => ({ ...it, id: `tmp-${i}` })))
      const sid = await saveShoppingList(planId, items)
      if (stillOnWeek()) setShoppingId(sid)
      const sl = await fetchShoppingList(planId)
      if (sl && stillOnWeek()) setShopping(sl.shopping_list_items || [])
    } catch (e) {
      if (stillOnWeek()) { setShopping(before); setShoppingError(e.message) }
    } finally {
      setShoppingLoading(false)
    }
  }

  // Manual mode for the shopping list: the planned recipes' own ingredients,
  // scaled and grouped without any AI (basicShoppingList.js).
  const buildBasicList = async () => {
    const portions = plannedPortions()
    if (!portions.size) { alert('Add some meals to the planner first.'); return }
    setTab('list'); setScreen(null)
    setShoppingLoading(true); setShoppingLoadingMsg('Making a basic list from your recipes…'); setShoppingError(null); setShoppingNotice(null)
    const before = shopping
    const forWeek = week.weekOf
    const stillOnWeek = () => loadedWeekOf.current === forWeek
    try {
      const rows = await fetchRecipeIngredients([...portions.keys()])
      const { items, missing } = buildBasicShoppingList(rows, portions)
      const toSave = items.map(it => ({ ...it, checked: false }))
      if (stillOnWeek()) setShopping(toSave.map((it, i) => ({ ...it, id: `tmp-${i}` })))
      const sid = await saveShoppingList(planId, toSave)
      if (stillOnWeek()) setShoppingId(sid)
      const sl = await fetchShoppingList(planId)
      if (sl && stillOnWeek()) setShopping(sl.shopping_list_items || [])
      if (stillOnWeek()) setShoppingNotice(`Basic list, made without AI. Amounts from different recipes are listed side by side rather than added up, and aisles are a best guess.${missing.length ? ` No ingredients saved for: ${missing.join(', ')}.` : ''}`)
    } catch (e) {
      if (stillOnWeek()) { setShopping(before); setShoppingError(e.message) }
    } finally {
      setShoppingLoading(false); setShoppingLoadingMsg(null)
    }
  }

  const addShoppingItemByHand = async name => {
    try {
      const { listId, item } = await addShoppingItem(planId, { name, amount: '', unit: '', aisle: guessAisle(name) })
      setShoppingId(listId)
      setShopping(s => [...s, item])
    } catch (e) {
      setShoppingNotice(`Couldn't add “${name}”: ${e.message}`)
    }
  }

  const removeShoppingItemByHand = async id => {
    const before = shopping
    setShopping(s => s.filter(x => x.id !== id))
    if (String(id).startsWith('tmp-')) return
    try { await removeShoppingItem(id) }
    catch (e) { setShopping(before); setShoppingNotice(`Couldn't remove that item: ${e.message}`) }
  }

  // Every visible planned meal this week, in the shape the shopping-list and
  // nutrition functions take. Meals in sections the user has turned off are
  // kept in the plan but left out, matching what the planner shows.
  const plannedMealsPayload = () => week.days.flatMap(day =>
    dayMeals(plan[day], sectionIds).map(m => ({ day, section: m.section, recipeId: m.recipeId, name: m.name, portion: m.portion }))
  )

  // Total portions of each planned recipe this week, in plan order.
  const plannedPortions = () => {
    const portions = new Map()
    plannedMealsPayload().filter(m => m.recipeId).forEach(m => portions.set(m.recipeId, (portions.get(m.recipeId) ?? 0) + (m.portion ?? defPort)))
    return portions
  }

  // Settings › Your data › Reset this week's plan. Freezer meals go back in
  // stock, the same as removing them one by one would.
  const resetWeekPlan = async () => {
    // Opening Settings returns to this week, but until that has landed the plan
    // in memory is still whichever week was selected. Never clear that one.
    if (planLoading || weekLoadError) { alert("This week hasn't finished loading. Try again in a moment."); return }
    const meals = week.days.flatMap(day => dayMeals(plan[day]))
    const freezerIds = meals.map(m => m.freezerItemId).filter(Boolean)
    await clearPlannedMeals(Object.values(dayEntryMap))
    if (freezerIds.length) {
      setFreezerItems(items => items.map(it => freezerIds.includes(it.id) ? { ...it, in_stock: true } : it))
      await updateFreezerStock(freezerIds, true)
    }
    setPlanState(emptyWeek())
    refreshPicks()
  }

  // Planner › Save week. Keeps a copy of the week on screen as it looks now.
  const saveCurrentWeek = async name => {
    await saveWeek(name, snapshotWeek(plan, week.days, sectionIds))
    setPlannerNotice(`Saved “${name}”. It'll be under Fill from saved, ready for any week.`)
  }

  // Planner › Fill from saved. New meals go in before old ones come out, so a
  // failure can leave a week with too many meals but never with none. The insert
  // is one statement, so it either all happens or none of it does.
  const fillWeek = async (saved, mode) => {
    const existingRecipeIds = await fetchExistingRecipeIds(savedRecipeIds(saved))
    const fill = buildFill(saved, { plan, days: week.days, sectionIds, mode, recipes, freezerItems, existingRecipeIds, defPort })
    await insertWeekMeals(fill.meals.map(m => ({ ...m, dayEntryId: dayEntryMap[m.day] })))

    let clearError = null
    try { await removePlannedMeals(fill.replacedIds) } catch (e) { clearError = e }

    // Freezer stock follows what actually happened above.
    const taken = fill.takenFreezerIds
    const released = clearError ? [] : fill.releasedFreezerIds.filter(id => !taken.includes(id))
    if (taken.length || released.length) {
      setFreezerItems(items => items.map(it =>
        taken.includes(it.id) ? { ...it, in_stock: false }
        : released.includes(it.id) ? { ...it, in_stock: true }
        : it))
      if (taken.length) updateFreezerStock(taken, false)
      if (released.length) updateFreezerStock(released, true)
    }

    // Any analysis of the old meals no longer applies.
    const { weekOf } = week
    setNutriByWeek(({ [weekOf]: _, ...rest }) => rest)
    setBatchByWeek(({ [weekOf]: _, ...rest }) => rest)

    // Read it back rather than patching state: this gives real ids and the saved
    // order, and shows what's there even if clearing the old meals failed.
    await showWeek(week)
    refreshPicks()
    if (clearError) throw new Error(`The saved meals went in, but the old ones couldn't be cleared, so the week has both: ${clearError.message}`)
    setPlannerNotice(fillNotice(fill))
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
    const { weekOf } = week
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
      setNutriByWeek(prev => ({ ...prev, [weekOf]: { adult: normalize(adultResult), toddler: toddlerResult ? normalize(toddlerResult) : null } }))
    } catch(e) {
      setNutriError(e.message)
    } finally {
      setNutriLoading(false)
    }
  }

  const generateBatch = async () => {
    const { weekOf } = week
    setBatchLoading(true); setBatchError(null)
    try {
      const result = await callEdgeFn('batch-cooking', {
        meals: plan, region, equipment: aiContext.equipment,
        ageBandLabel: toddlerActivitiesOn ? ageBandLabel(ageBandFromDob(toddlerDob)) : null,
      })
      setBatchByWeek(prev => ({ ...prev, [weekOf]: result }))
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

  // ── Swipe deck ──────────────────────────────────────────────────
  const showToast = message => {
    clearTimeout(toastTimer.current)
    setToast(message)
    if (message) toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  const pickRecipe = async (recipe, weekOf) => {
    const pick = await addTryoutPick(recipe.id, weekOf)
    setTryoutPicks(prev => [...prev, pick])
    return pick
  }
  const removePick = async pick => {
    await removeTryoutPick(pick.id)
    setTryoutPicks(prev => prev.filter(p => p.id !== pick.id))
  }
  // Archiving takes a recipe out of the list every screen reads, and undoing
  // that puts it back.
  const saveDeckState = async (recipe, patch) => {
    await saveRecipeDeckState(recipe.id, patch)
    const next = { ...recipe, ...patch }
    setRecipes(prev => {
      const others = prev.filter(r => r.id !== recipe.id)
      return next.archivedAt ? others : [...others, next].sort(byName)
    })
  }
  const closeDeck = () => { setTab('planner'); setScreen(null) }

  // At most once a session per link: a post with no picture would otherwise be
  // asked about every time its card came up.
  const fetchReelStill = async id => {
    if (stillsAsked.current.has(id)) return
    stillsAsked.current.add(id)
    const found = await refreshReelThumbnail(id)
    if (found) setRecipes(prev => prev.map(r => r.id === id ? { ...r, ...found } : r))
  }

  // Mirrors what the database trigger does when a recipe's link changes.
  const reelLinkChanged = (id, url) => {
    const platform = reelPlatform(url)
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, sourceUrl: url, sourcePlatform: platform, sourceAuthor: null, videoThumbUrl: null } : r))
    stillsAsked.current.delete(id)
    if (platform) fetchReelStill(id)
  }

  // After clearing meals in bulk, some picks may have gone back to the tray.
  const refreshPicks = () => fetchTryoutPicks().then(setTryoutPicks).catch(e => console.error('picks refresh failed', e))

  // Planner tray: a pick dropped on a day becomes a planned meal. The meal goes in
  // first, so a failure can't leave a pick pointing at nothing; if linking fails,
  // the meal comes back out and the card returns to the tray.
  const dropPick = async (pick, day) => {
    const recipe = recipes.find(r => r.id === pick.recipe_id)
    const entryId = dayEntryMap[day]
    if (!recipe || !entryId) return
    const section = dropSection(recipe, sectionIds)
    const meal = plannedMealFrom(recipe, section, plan[day][section].length, defPort)
    const tempId = uid()
    const setPickMeal = mealId => setTryoutPicks(prev => prev.map(p => p.id === pick.id ? { ...p, planned_meal_id: mealId } : p))
    const swapMeal = change => setPlanState(prev => ({ ...prev, [day]: { ...prev[day], [section]: change(prev[day][section]) } }))

    swapMeal(meals => [...meals, { ...meal, id: tempId }])
    setPickMeal(tempId)
    let createdId = null
    try {
      const [created] = await addPlannedMeals(entryId, [meal])
      createdId = created.id
      await linkPickToMeal(pick.id, createdId)
      swapMeal(meals => meals.map(m => m.id === tempId ? { ...m, id: createdId } : m))
      setPickMeal(createdId)
      showToast(`Added to ${DAY_LBL[day]}`)
    } catch (e) {
      console.error('tray drop failed', e)
      if (createdId) removePlannedMeal(createdId).catch(err => console.error('tray drop cleanup failed', err))
      swapMeal(meals => meals.filter(m => m.id !== tempId))
      setPickMeal(null)
      showToast("Couldn't add that. Try again.")
    }
  }

  const removeFromTray = async ({ pick }) => {
    try { await removePick(pick) }
    catch (e) { console.error('tray remove failed', e); showToast("Couldn't remove that. Try again.") }
  }

  // ── Nav ─────────────────────────────────────────────────────────
  const openDayPlan   = day => { setSelDay(day); setScreen('dailyPlan') }
  // Entering the picker afresh starts clean; returning from a recipe preview
  // goes through goBack(), which leaves these intact.
  const openAddSec    = (day, sec) => { setSelDay(day); setSelSec(sec); setSelectedRecipes([]); setRecipeSearch(''); setRecipeChip('cat'); setScreen('recipeSelection') }
  const openFreezerManage = () => { setPrevScreen('recipeSelection'); setScreen('freezerManage') }
  const openSettings = () => { setSettingsSub(null); setWeekOffset(0); setScreen('settings') }
  // Home is always today, and a past week only stays selected on the Planner. A
  // future week carries on to Shopping and Batch, so it can be shopped for and
  // prepped ahead; WeekBanner says so.
  const goTab = id => {
    setTab(id); setScreen(null)
    if (id === 'home' || (id !== 'planner' && isPastWeek)) setWeekOffset(0)
  }
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
    if (screen === 'freezerManage') setFreezerShare(null)
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
    : screen === 'tryDeck'       ? 'Try something new'
    : '5 Minutes to Dinner'

  // The deck and its pill always mean this week, whichever week is selected.
  const picksThisWeek = picksInWeek(tryoutPicks, pickWeek(prefs.weekStartsOn).weekOf).length
  const picksPill = progressLabel(picksThisWeek, prefs.tryoutWeeklyTarget)
  const deckPill = deckProgressLabel(picksThisWeek, prefs.tryoutWeeklyTarget)
  const onDeck = screen === 'tryDeck'
  const tryouts = {
    waiting: waitingRecipes(recipes, tryoutPicks).length,
    pill: picksPill,
    onOpen: () => setScreen('tryDeck'),
    tray: trayItems(tryoutPicks, recipes),
    newMealIds: pickedMealIds(tryoutPicks),
    onDrop: dropPick,
    onRemove: removeFromTray,
  }

  const NAV = [{id:'home',icon:'home',label:'Home'},{id:'planner',icon:'calendar',label:'Planner'},{id:'list',icon:'cart',label:'Shopping'},{id:'batch',icon:'chefHat',label:'Batch'}]

  // Shown in place of a week's content until it has loaded.
  // The ref check covers the one render between picking a week and the effect
  // that loads it, when the label has moved but the meals are the old week's.
  const weekLoadState = (planLoading || loadedWeekOf.current !== week.weekOf) ? <Spinner msg='Loading that week…'/>
    : weekLoadError ? (
      <div style={{padding:'24px 20px',textAlign:'center'}}>
        <div style={{...mn,fontSize:13,color:C.error,lineHeight:1.6,marginBottom:14}}>Couldn't load that week: {weekLoadError}</div>
        <Btn label='Try again' onClick={()=>showWeek(week)} secondary small/>
      </div>
    ) : null

  // Which weeks the strip offers. The week on screen uses what's in memory, so
  // its dot follows edits straight away.
  const visibleMealCount = week.days.flatMap(day => dayMeals(plan[day], sectionIds)).length
  const weekStrip = stripWeeks
    .map(w =>w.weekOf === week.weekOf && !weekLoadState ? { ...w, hasMeals: visibleMealCount > 0 } : w)

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
      if (settingsSub?.kind === 'recipeLanguage') return <OptionListScreen heading='Recipe language' description='When Fill in the gaps finds a recipe in another language, it can translate it into this one.' options={RECIPE_LANGUAGES.map(l=>({value:l.code,label:l.name}))} value={prefs.recipeLanguage} onSelect={v=>{setPrefs({recipeLanguage:v});setSettingsSub(null)}}/>
      if (settingsSub?.kind === 'child')     return <ChildEditorScreen key={settingsSub.childId||'new'} child={editingChild} onChange={patch=>updateChild(settingsSub.childId,patch)} onCreate={c=>{addChild(c);setSettingsSub(null)}} onDelete={()=>{removeChild(settingsSub.childId);setSettingsSub(null)}}/>
      if (settingsSub?.kind === 'feedback')  return <FeedbackScreen versionLabel={APP_VERSION_LABEL}/>
      if (settingsSub?.kind === 'geminiKey') return <GeminiKeyScreen/>
      if (settingsSub?.kind === 'signIn')    return <SignInScreen session={session} isOwner={!!aiConfig?.isOwner} onDone={()=>setSettingsSub(null)}/>
      if (settingsSub?.kind === 'equipment') return <EquipmentScreen value={prefs.kitchenEquipment} onChange={kitchenEquipment=>setPrefs({kitchenEquipment})}/>
      if (settingsSub?.kind === 'install')   return <InstallScreen/>
      if (settingsSub?.kind === 'aiModels')  return <OwnerModelsScreen config={aiConfig} onConfigChange={setAiConfig}/>
      return <SettingsScreen defPort={defPort} setDefPort={setDefPort} prefs={prefs} setPrefs={setPrefs} goalProfile={goalProfile} goalTargets={goalTargets} setGoalProfile={setGoalProfile} freezerItems={freezerItems} weekLabel={week.label} session={session} isOwner={!!aiConfig?.isOwner} onOpen={openSettingsSub} onExportRecipes={exportRecipes} onResetWeek={resetWeekPlan} onRecipeRestored={r=>setRecipes(prev=>[...prev,r].sort((a,b)=>a.name.localeCompare(b.name)))}/>
    }
    if (screen === 'freezerManage')   return <FreezerScreen key={freezerShare?.receivedAt ?? 'freezer'} initialShare={freezerShare} items={freezerItems} onReplace={async names=>setFreezerItems(await replaceFreezerItems(names))} onAddOne={async name=>{const item=await addFreezerItem(name);setFreezerItems(items=>{const i=items.findIndex(x=>x.id===item.id);return i>=0?items.map(x=>x.id===item.id?item:x):[...items,item].sort((a,b)=>a.name.localeCompare(b.name))})}} onToggleStock={async(id,inStock)=>{setFreezerItems(items=>items.map(x=>x.id===id?{...x,in_stock:inStock}:x));await updateFreezerStock(id,inStock)}} onDelete={async id=>{setFreezerItems(items=>items.filter(x=>x.id!==id));await removeFreezerItem(id)}}/>
    if (screen === 'nutrition')       return <>{!isThisWeek&&<WeekBanner label={week.label}/>}<NutritionScreen profile={nutriProf} setProfile={setNutriProf} nutriData={nutriData} nutriLoading={nutriLoading} nutriError={nutriError} onAnalyse={analyseNutrition} goalProfile={goalProfile} goalTargets={goalTargets} plan={plan} nutritionByRecipe={nutritionByRecipe} days={week.days} sectionIds={sectionIds} toddlerEnabled={!!toddlerDob} otherWeekLabel={isThisWeek?null:week.shortLabel}/></>
    if (screen === 'dailyPlan')       return <DailyPlanScreen day={selDay} dateLabel={isThisWeek?null:dayDateLabel(week,selDay)} plan={plan} recipes={recipes} updatePortion={updatePortion} removeMeal={removeMeal} onAddToSection={openAddSec} onRecipeOpen={openRecipeFromDailyPlan} onSave={()=>setScreen(null)} goalProfile={goalProfile} goalTargets={goalTargets} nutritionByRecipe={nutritionByRecipe} sectionIds={sectionIds}/>
    if (screen === 'recipeSelection') return <RecipeSelectionScreen day={selDay} section={selSec} plan={plan} recipes={recipes} freezerItems={freezerItems} onAdd={addMeals} onAddFreezer={addFreezerMeals} onManageFreezer={openFreezerManage} onRecipeCreated={r=>setRecipes(prev=>[...prev,r].sort((a,b)=>a.name.localeCompare(b.name)))} onPreview={openRecipeFromSelection} goalProfile={goalProfile} goalTargets={goalTargets} nutritionByRecipe={nutritionByRecipe} recipeView={recipeView} setRecipeView={setRecipeView} search={recipeSearch} setSearch={setRecipeSearch} chip={recipeChip} setChip={setRecipeChip} selected={selectedRecipes} setSelected={setSelectedRecipes} days={week.days} sectionIds={sectionIds} aiContext={aiContext}/>
    if (screen === 'recipe')          return <RecipeScreen recipeId={selRecipeId} portion={recipeDetailPortion} onPortionChange={changeRecipeDetailPortion} onAddMeal={()=>addMeals([selRecipeId])} toddlerDob={toddlerActivitiesOn?toddlerDob:null} showToddlerVariations={toddlerVariationsOn} onOpenToddlerCooking={()=>openToddlerCooking(true)} goalProfile={goalProfile} goalTargets={goalTargets} nutritionByRecipe={nutritionByRecipe} day={selDay} plan={plan} sectionIds={sectionIds} onPhotoChange={(id,img)=>setRecipes(prev=>prev.map(r=>r.id===id?{...r,...img}:r))} onLinkChange={reelLinkChanged}/>
    if (screen === 'tryDeck')         return <TryDeckScreen recipes={recipes} picks={tryoutPicks} weekStartsOn={prefs.weekStartsOn} target={prefs.tryoutWeeklyTarget} showToddler={prefs.toddlerModeEnabled} onPick={pickRecipe} onRemovePick={removePick} onDeckState={saveDeckState} onNeedStill={fetchReelStill} onDone={closeDeck} showToast={showToast} recipeProps={{ defPort, showToddlerVariations:toddlerVariationsOn, goalProfile, goalTargets, nutritionByRecipe, sectionIds, onPhotoChange:(id,img)=>setRecipes(prev=>prev.map(r=>r.id===id?{...r,...img}:r)), onLinkChange:reelLinkChanged }}/>
    if (screen === 'toddlerCooking')  return <ToddlerCookingScreen guide={toddlerGuide} loading={toddlerGuideLoading} error={toddlerGuideError} activeBand={toddlerBand} setActiveBand={setToddlerBand} currentBand={toddlerDob?ageBandFromDob(toddlerDob):null} onGenerate={generateToddlerGuide}/>
    if (tab !== 'planner' && weekLoadState) return weekLoadState
    if (tab === 'home')    return <HomeScreen plan={plan} days={week.days} sectionIds={sectionIds} onDayOpen={openDayPlan} onRecipeOpen={openRecipeFromHome} moveMeal={moveMeal} onCopy={copyWeekPlan} onRecipeCreated={r=>setRecipes(prev=>[...prev,r].sort((a,b)=>a.name.localeCompare(b.name)))} aiContext={aiContext}/>
    if (tab === 'planner') return <PlannerScreen plan={plan} week={week} weekOffset={weekOffset} weekStrip={weekStrip} onSelectWeek={setWeekOffset} onSaveWeek={saveCurrentWeek} onFillWeek={fillWeek} notice={plannerNotice} onDismissNotice={()=>setPlannerNotice(null)} loadState={weekLoadState} sectionIds={sectionIds} removeMeal={removeMeal} moveMeal={moveMeal} duplicateMeal={duplicateMeal} updatePortion={updatePortion} onDayOpen={openDayPlan} onRecipeOpen={openRecipeFromHome} onNutrition={()=>{ setScreen('nutrition'); if(!nutriData) analyseNutrition() }} onShoppingList={generateShoppingList} goalProfile={goalProfile} goalTargets={goalTargets} nutritionByRecipe={nutritionByRecipe} tryouts={tryouts}/>
    const weekBanner = !isThisWeek && <WeekBanner label={week.label} onBack={()=>setWeekOffset(0)}/>
    if (tab === 'list')    return <>{weekBanner}<ShoppingListScreen shopping={shopping} weekLabel={week.label} onToggle={onShoppingToggle} loading={shoppingLoading} loadingMsg={shoppingLoadingMsg} error={shoppingError} notice={shoppingNotice} onRegenerate={generateShoppingList} onBuildBasic={buildBasicList} onAddItem={addShoppingItemByHand} onRemoveItem={removeShoppingItemByHand} plannedPortions={plannedPortions()}/></>
    if (tab === 'batch')   return <>{weekBanner}<BatchScreen activeTab={batchTab} setActiveTab={setBatchTab} batchData={batchData} batchLoading={batchLoading} batchError={batchError} onGenerate={generateBatch} onOpenToddlerCooking={toddlerActivitiesOn?()=>openToddlerCooking(false):null} showToddler={toddlerActivitiesOn}/></>
  }

  return (
    <div style={{display:'flex',justifyContent:'center',background:'#dbe6d8',minHeight:'100vh'}}>
      <div style={{width:'100%',maxWidth:430,background:C.white,display:'flex',flexDirection:'column',minHeight:'100vh',position:'relative',...mn}}>
        <div data-top-bar style={{background:C.primary,padding:'16px 20px',display:'flex',alignItems:'center',gap:10,flexShrink:0,position:'sticky',top:0,zIndex:20}}>
          {screen
            ? <button onClick={goBack} style={{border:'none',background:'none',color:C.onPrimary,cursor:'pointer',padding:'2px 8px 2px 0',display:'flex',alignItems:'center'}}><Icon name='back' color={C.onPrimary}/></button>
            : <img src='/dino-logo.png' alt='' style={{width:30,height:30,objectFit:'contain',flexShrink:0}}/>
          }
          <span style={{...ep,fontSize:onDeck?19:screen?16:18,letterSpacing:'0.005em',color:C.onPrimary,flex:1}}>{headerTitle}</span>
          {onDeck && <span style={{...mn,fontSize:12,fontWeight:700,color:C.onPrimary,background:'rgba(255,255,255,0.16)',padding:'5px 12px',borderRadius:R.pill,whiteSpace:'nowrap'}}>{deckPill}</span>}
          {!loading && !screen && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {error && <div style={{width:6,height:6,borderRadius:R.pill,background:'#ffb4a9'}} title='DB error'/>}
              <button onClick={openSettings} aria-label='Settings' style={{border:'none',background:'rgba(255,255,255,0.16)',borderRadius:R.pill,cursor:'pointer',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name='settings' size={17} color={C.onPrimary}/></button>
            </div>
          )}
        </div>
        <div style={{flex:1,overflowY:'auto',position:'relative',paddingBottom:screen&&!onDeck?80:0,display:'flex',flexDirection:'column'}}>
          {renderScreen()}
        </div>
        <div data-bottom-bar style={{flexShrink:0,position:'sticky',bottom:0,zIndex:20,display:'flex',flexDirection:'column'}}>
          {tab === 'planner' && !screen && !isPastWeek && !weekLoadState && (
            <div style={{padding:'10px 20px'}}>
              <button onClick={generateShoppingList} style={{width:'100%',background:C.primary,color:C.onPrimary,border:'none',borderRadius:R.pill,padding:'15px',...mn,fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(45,96,47,0.3)',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <Icon name='cart' size={17} color={C.onPrimary}/>Generate shopping list
              </button>
            </div>
          )}
          {screen !== 'settings' && !onDeck && (
            <div style={{background:C.primaryFixed,borderTop:`1px solid ${C.outlineVariant}30`,display:'flex',padding:'8px 0 14px'}}>
              {NAV.map(t => {
                const active = tab === t.id && !screen
                return (
                  <button key={t.id} onClick={()=>goTab(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,border:'none',background:'none',color:active?C.primary:C.onSurfaceVariant,cursor:'pointer',padding:'4px 2px'}}>
                    <Icon name={t.icon} size={active?22:20}/>
                    <span style={{...mn,fontSize:10,fontWeight:active?700:500}}>{t.label}</span>
                    {active && <div style={{width:18,height:2,background:C.primary,borderRadius:2}}/>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {!loading && !error && incomingShare && (
          <ShareSheet share={incomingShare} onChoose={routeShare} onDismiss={() => setIncomingShare(null)}/>
        )}
        {!loading && !error && shareRecipe && (
          <NewRecipeForm key={shareRecipe.url || shareRecipe.text || 'shared'} defaultMealType='main' aiContext={aiContext} initialSource={shareRecipe}
            onSave={r => { setRecipes(prev => [...prev, r].sort((a, b) => a.name.localeCompare(b.name))); setShareRecipe(null) }}
            onCancel={() => setShareRecipe(null)}/>
        )}
        {shareError && (
          <Sheet title="That share didn't come through" onClose={() => setShareError(null)}>
            <div style={{ ...mn, fontSize:14, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:18 }}>{shareError}</div>
            <Btn label='OK' full onClick={() => setShareError(null)}/>
          </Sheet>
        )}
        {aiNotice && <AiLimitSheet key={aiNotice.id} notice={aiNotice} onClose={() => setAiNotice(null)}/>}
        <Toast message={toast}/>
      </div>
    </div>
  )
}
