import { useState, useEffect } from 'react'
import { fetchRecipeDetails, fetchRecipeNotes, saveRecipeNotes, fetchRecipeToddlerTask, saveRecipeToddlerTask } from '../lib/supabase.js'
import { callEdgeFn } from '../lib/ai.js'
import { C, ep, mn, CARD, R } from '../lib/theme.js'
import { ageBandFromDob, TODDLER_AGE_BANDS } from '../lib/dateHelpers.js'
import { ALL_SECTION_IDS, dayMeals } from '../lib/mealSections.js'
import { parseIngredients, parseIngredientParts, parseSteps } from '../lib/recipeParsing.js'
import { collectQuantities } from '../lib/quantityScaling.js'
import { Spinner, Btn, Icon, NeedMoreIdeasBtn, Stepper, ScaledText } from './ui/index.js'
import { dayNutritionTotals, rowFigure } from '../lib/goalMaths.js'

// toddlerDob is null when toddler activities are off in Settings; that hides the
// activities card and the ideas button. showToddlerVariations gates the recipe's
// own toddler variation notes separately.
export function RecipeScreen({ recipeId, portion, onPortionChange, onAddMeal, toddlerDob, showToddlerVariations = true, onOpenToddlerCooking, goalProfile, goalTargets, nutritionByRecipe={}, day, plan, sectionIds = ALL_SECTION_IDS }) {
  const goalMode = !!goalProfile?.goalModeEnabled && !!goalTargets
  const recipeNutrition = nutritionByRecipe[recipeId]
  const [showGoalSheet, setShowGoalSheet] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [showStd, setShowStd] = useState(false)
  const [showTM, setShowTM] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(true)
  const [notesSaving, setNotesSaving] = useState(false)
  const [toddlerActivities, setToddlerActivities] = useState(null)
  const [toddlerBand, setToddlerBand] = useState(null)
  const [toddlerTaskLoading, setToddlerTaskLoading] = useState(false)
  const [toddlerTaskError, setToddlerTaskError] = useState(null)

  useEffect(() => {
    fetchRecipeDetails(recipeId)
      .then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
    fetchRecipeNotes(recipeId).then(n => { setNotes(n); setNotesSaved(true) })
  }, [recipeId])

  useEffect(() => {
    if (!toddlerDob) return
    const currentBand = ageBandFromDob(toddlerDob)
    const bandLabel = TODDLER_AGE_BANDS.find(b => b.id === currentBand)?.label || currentBand
    setToddlerActivities(null); setToddlerTaskError(null); setToddlerBand(bandLabel)
    ;(async () => {
      try {
        const cached = await fetchRecipeToddlerTask(recipeId)
        if (cached && cached.age_band_id === currentBand) {
          const list = cached.activities?.length
            ? cached.activities
            : (cached.task ? [{ title: '', task: cached.task, needsTool: cached.needs_tool }] : [])
          if (list.length) { setToddlerActivities(list); return }
        }
        const recipe = await fetchRecipeDetails(recipeId)
        setToddlerTaskLoading(true)
        const result = await callEdgeFn('recipe-toddler-task', {
          ageBandLabel: bandLabel,
          recipeName: recipe.name,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions_standard || recipe.instructions_thermomix,
          toddlerVariations: recipe.toddler_variations,
        })
        const list = Array.isArray(result.activities) && result.activities.length
          ? result.activities
          : (result.task ? [{ title: '', task: result.task, needsTool: result.needsTool ?? null }] : [])
        setToddlerActivities(list)
        saveRecipeToddlerTask(recipeId, { dob: toddlerDob, ageBandId: currentBand, ageBandLabel: bandLabel, activities: list })
      } catch (e) {
        setToddlerTaskError(e.message)
      } finally {
        setToddlerTaskLoading(false)
      }
    })()
  }, [recipeId, toddlerDob])

  function handleNotesChange(e) {
    setNotes(e.target.value)
    setNotesSaved(false)
  }

  async function handleNotesSave() {
    setNotesSaving(true)
    await saveRecipeNotes(recipeId, notes)
    setNotesSaving(false)
    setNotesSaved(true)
  }

  if (loading) return <Spinner msg='Loading recipe…'/>
  if (err) return <div style={{padding:20}}><p style={{...mn,color:C.error}}>⚠️ {err}</p></div>
  if (!data) return null

  const base = data.portion_size || 4
  const scale = portion ? portion / base : 1
  const scaledFor = portion || base
  const minPortions = data.min_portions || 1
  const ingSections = parseIngredients(data.ingredients)
  const stdSteps = parseSteps(data.instructions_standard)
  const tmSteps = parseSteps(data.instructions_thermomix)
  // The set of amounts this recipe legitimately owns — the guard that stops
  // times, oven temps and Thermomix speeds being rescaled as if they were food.
  const knownQtys = collectQuantities(data.ingredients)
  const prose = text => <ScaledText text={text} scale={scale} knownQtys={knownQtys}/>
  const scaleBadge = <span style={{...mn,fontSize:11,fontWeight:700,background:C.primaryFixed,color:C.primary,padding:'3px 10px',borderRadius:R.pill}}>Scaled for {scaledFor} portions</span>

  return (
    <>
    <div style={{padding:'20px 20px 40px'}}>
      {data.has_thermomix_version&&(
        <div style={{display:'inline-flex',alignItems:'center',gap:6,background:C.primary,borderRadius:R.pill,padding:'5px 12px',marginBottom:12}}>
          <span style={{fontSize:12}}>⚡</span>
          <span style={{...mn,fontSize:10,fontWeight:700,color:C.onPrimary,letterSpacing:'0.08em'}}>THERMOMIX RECIPE: YES</span>
        </div>
      )}
      <div style={{marginBottom:20}}>
        <div style={{...ep,fontSize:24,color:C.onSurface,lineHeight:1.2}}>{data.name}</div>
      </div>

      {/* Prep / Cook */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        {[['🕒 PREP TIME',data.prep_time_raw||(data.prep_time_minutes?`${data.prep_time_minutes}m`:null)],['🍳 COOK TIME',data.cook_time_raw||(data.cook_time_minutes?`${data.cook_time_minutes}m`:null)]].map(([lbl,val])=>val?(
          <div key={lbl} style={{...CARD,padding:'12px 14px'}}>
            <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:4}}>{lbl}</div>
            <div style={{...mn,fontSize:17,fontWeight:700,color:C.onSurface}}>{val}</div>
          </div>
        ):null)}
      </div>

      {/* Portions */}
      <div style={{...CARD,padding:'12px 14px',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div>
            <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:6}}>PORTIONS</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{...mn,fontSize:15,fontWeight:700,color:C.onSurface}}>{scaledFor} servings</span>
              {scale!==1&&<span style={{...mn,fontSize:11,fontWeight:700,background:C.primaryFixed,color:C.primary,padding:'2px 7px',borderRadius:R.pill}}>{scale.toFixed(1)}x</span>}
            </div>
            <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,marginTop:4}}>Recipe written for {base} · min {minPortions}</div>
          </div>
          {onPortionChange&&<Stepper value={scaledFor} min={minPortions} onChange={onPortionChange}/>}
        </div>
      </div>

      {goalMode&&recipeNutrition?.kcal!=null&&(
        <div onClick={()=>setShowGoalSheet(true)} style={{background:C.primaryFixed,borderRadius:R.md,padding:'12px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
          <span style={{fontSize:16,lineHeight:1}}>🎯</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{...mn,fontSize:13,fontWeight:700,color:C.primary,marginBottom:2}}>Supports your goal</div>
            <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5}}>One portion is about {Math.round(recipeNutrition.kcal/goalTargets.calories*100)}% of today's calories, {Math.round(recipeNutrition.protein_g/goalTargets.protein*100)}% of your protein</div>
          </div>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="m9 18 6-6-6-6"/></svg>
        </div>
      )}

      {/* Storage */}
      {(data.fridge_storage||data.freezer_storage)&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          {data.fridge_storage&&<div style={{...CARD,padding:'12px 14px'}}><div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:4}}>🧊 FRIDGE</div><div style={{...mn,fontSize:12,color:C.onSurface,lineHeight:1.5}}>{data.fridge_storage}</div></div>}
          {data.freezer_storage&&<div style={{...CARD,padding:'12px 14px'}}><div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:4}}>❄️ FREEZER</div><div style={{...mn,fontSize:12,color:C.onSurface,lineHeight:1.5}}>{data.freezer_storage}</div></div>}
        </div>
      )}

      {/* Ingredients */}
      {ingSections.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{...ep,fontSize:18,color:C.onSurface}}>Ingredients</span>
            {scaleBadge}
          </div>
          {ingSections.map((sec,si)=>(
            <div key={si} style={{marginBottom:12}}>
              {sec.title&&<div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>{sec.title}</div>}
              <div style={{...CARD,overflow:'hidden'}}>
                {sec.items.map((item,ii)=>{
                  const {qty,name}=parseIngredientParts(item,scale)
                  return(
                    <div key={ii} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:ii<sec.items.length-1?`1px solid ${C.outlineVariant}20`:undefined,gap:12}}>
                      <span style={{...mn,fontSize:13,color:C.onSurface,flex:1}}>{prose(name||item)}</span>
                      {qty&&<span style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface,whiteSpace:'nowrap'}}>{qty}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preparation Methods */}
      {(stdSteps.length>0||tmSteps.length>0)&&(
        <div style={{marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:12}}>
            <span style={{...ep,fontSize:18,color:C.onSurface}}>Preparation Methods</span>
            {scale!==1&&scaleBadge}
          </div>
          {stdSteps.length>0&&(
            <div style={{...CARD,marginBottom:10,overflow:'hidden'}}>
              <button onClick={()=>setShowStd(s=>!s)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'none',border:'none',cursor:'pointer',borderBottom:showStd?`1px solid ${C.outlineVariant}25`:'none'}}>
                <span style={{...mn,fontSize:14,fontWeight:700,color:C.onSurface}}>Standard Method (No Thermomix)</span>
                <span style={{color:C.onSurfaceVariant,fontSize:16}}>{showStd?'∧':'∨'}</span>
              </button>
              {showStd&&(
                <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:14}}>
                  {stdSteps.map((step,i)=>(
                    <div key={i} style={{display:'flex',gap:12}}>
                      <div style={{width:24,height:24,borderRadius:R.pill,background:C.secondaryContainer,color:C.onSecondaryContainer,...mn,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{step.num}</div>
                      <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0,flex:1}}>{prose(step.text)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tmSteps.length>0&&(
            <div style={{...CARD,overflow:'hidden',background:'#eaf6ea'}}>
              <button onClick={()=>setShowTM(s=>!s)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'none',border:'none',cursor:'pointer',borderBottom:showTM?`1px solid ${C.outlineVariant}25`:'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>⚡</span>
                  <span style={{...mn,fontSize:14,fontWeight:700,color:C.primary}}>Thermomix TM6 Method</span>
                </div>
                <span style={{color:C.onSurfaceVariant,fontSize:16}}>{showTM?'∧':'∨'}</span>
              </button>
              {showTM&&(
                <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:14}}>
                  {tmSteps.map((step,i)=>(
                    <div key={i} style={{display:'flex',gap:12}}>
                      <div style={{width:24,height:24,borderRadius:R.pill,background:C.primary,color:C.onPrimary,...mn,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{step.num}</div>
                      <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0,flex:1}}>{prose(step.text)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* The Extras */}
      {(data.chef_notes||data.husband_variations||(showToddlerVariations&&data.toddler_variations)||(data.side_recommendation&&data.side_recommendation!=='Not Recommended'))&&(
        <div>
          <div style={{...ep,fontSize:18,color:C.onSurface,marginBottom:12}}>The Extras</div>
          {data.chef_notes&&(
            <div style={{...CARD,padding:'14px 16px',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>📖</span><span style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.07em',textTransform:'uppercase'}}>Chef's Notes</span></div>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>{prose(data.chef_notes)}</p>
            </div>
          )}
          {data.husband_variations&&(
            <div style={{...CARD,padding:'14px 16px',marginBottom:10,background:'#fff8f0'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>❤️</span><span style={{...mn,fontSize:10,fontWeight:700,color:'#A86000',letterSpacing:'0.07em',textTransform:'uppercase'}}>Husband Variations</span></div>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>{prose(data.husband_variations)}</p>
            </div>
          )}
          {(showToddlerVariations&&data.toddler_variations)&&(
            <div style={{...CARD,padding:'14px 16px',marginBottom:10,background:'#f0f8ff'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>👶</span><span style={{...mn,fontSize:10,fontWeight:700,color:'#0050A0',letterSpacing:'0.07em',textTransform:'uppercase'}}>Toddler Variations</span></div>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>{prose((showToddlerVariations&&data.toddler_variations))}</p>
            </div>
          )}
          {data.side_recommendation&&data.side_recommendation!=='Not Recommended'&&(
            <div style={{...CARD,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:4}}>Recommended Side</div>
                <div style={{...mn,fontSize:14,fontWeight:600,color:C.onSurface}}>{data.side_recommendation}</div>
              </div>
              <span style={{color:C.primary,fontSize:20}}>›</span>
            </div>
          )}
        </div>
      )}

      {/* Toddler activities */}
      {toddlerDob&&(toddlerActivities||toddlerTaskLoading||toddlerTaskError)&&(
        <div style={{...CARD,padding:'14px 16px',marginBottom:10,marginTop:data.chef_notes||data.husband_variations||(showToddlerVariations&&data.toddler_variations)||(data.side_recommendation&&data.side_recommendation!=='Not Recommended')?0:20,background:C.accent2_100,border:`1px solid ${C.accent2_300}`}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>🧸</span><span style={{...mn,fontSize:10,fontWeight:700,color:C.accent2_700,letterSpacing:'0.07em',textTransform:'uppercase'}}>Cooking with your toddler</span></div>
          {toddlerTaskLoading&&<p style={{...mn,fontSize:13,color:C.onSurfaceVariant,margin:0}}>Finding age-appropriate activities…</p>}
          {toddlerTaskError&&<p style={{...mn,fontSize:13,color:C.error,margin:0}}>⚠️ {toddlerTaskError}</p>}
          {toddlerActivities&&!toddlerTaskLoading&&(<>
            {toddlerBand&&<div style={{display:'inline-block',...mn,fontSize:10,fontWeight:700,color:C.accent2_700,background:C.white,padding:'2px 8px',borderRadius:R.pill,marginBottom:10}}>{toddlerBand.toUpperCase()}</div>}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {toddlerActivities.map((a,i)=>(
                <div key={i} style={{display:'flex',gap:10,paddingTop:i>0?12:0,borderTop:i>0?`1px solid ${C.accent2_300}40`:'none'}}>
                  <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{a.icon||'🍽️'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    {a.title&&<div style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface,marginBottom:2}}>{a.title}</div>}
                    <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.6,margin:0,marginBottom:a.needsTool?6:0}}>{prose(a.task)}</p>
                    {a.needsTool&&<div style={{...mn,fontSize:11,fontWeight:700,color:C.primary,background:C.primaryFixed,padding:'4px 10px',borderRadius:R.sm,display:'inline-block'}}>Needs: {a.needsTool}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>)}
        </div>
      )}

      {toddlerDob&&onOpenToddlerCooking&&(
        <div style={{marginTop:12}}><NeedMoreIdeasBtn onClick={onOpenToddlerCooking}/></div>
      )}

      {/* Cooking Notes */}
      <div style={{marginTop:24}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:18}}>✏️</span>
            <span style={{...ep,fontSize:18,color:C.onSurface}}>My Cooking Notes</span>
          </div>
          {!notesSaved&&(
            <button
              onClick={handleNotesSave}
              disabled={notesSaving}
              style={{...mn,fontSize:12,fontWeight:700,color:C.onPrimary,background:C.primary,border:'none',borderRadius:R.pill,padding:'5px 14px',cursor:'pointer',opacity:notesSaving?0.6:1}}
            >
              {notesSaving?'Saving…':'Save'}
            </button>
          )}
          {notesSaved&&notes&&(
            <span style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>Saved</span>
          )}
        </div>
        <textarea
          value={notes}
          onChange={handleNotesChange}
          onBlur={notesSaved?undefined:handleNotesSave}
          placeholder="Add notes as you cook — tweaks, timings, what worked well…"
          style={{width:'100%',minHeight:120,padding:'12px 14px',borderRadius:12,border:`1.5px solid ${notesSaved?C.outlineVariant:C.primary}`,background:C.surface,...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,resize:'vertical',boxSizing:'border-box',outline:'none',transition:'border-color 0.15s'}}
        />
      </div>

      {onAddMeal&&(
        <div style={{marginTop:24}}>
          <Btn label='+ Add Meal' full onClick={onAddMeal}/>
        </div>
      )}
    </div>

    {showGoalSheet&&goalMode&&recipeNutrition?.kcal!=null&&(()=>{
      const already = day&&plan ? dayNutritionTotals(dayMeals(plan[day], sectionIds), nutritionByRecipe) : null
      const alreadyCal=already?.hasData?already.calories:0, alreadyPro=already?.hasData?already.protein:0, alreadyFib=already?.hasData?already.fibre:0
      const withCal=alreadyCal+recipeNutrition.kcal, withPro=alreadyPro+recipeNutrition.protein_g, withFib=alreadyFib+recipeNutrition.fibre_g
      const toGoCal=Math.max(0,Math.round(goalTargets.calories-withCal)), toGoPro=Math.max(0,Math.round(goalTargets.protein-withPro)), toGoFib=Math.max(0,Math.round(goalTargets.fibre-withFib))
      const pctCal=Math.round(recipeNutrition.kcal/goalTargets.calories*100), pctPro=Math.round(recipeNutrition.protein_g/goalTargets.protein*100), pctFib=Math.round(recipeNutrition.fibre_g/goalTargets.fibre*100)
      return(
        <div onClick={()=>setShowGoalSheet(false)} style={{position:'fixed',inset:0,background:'rgba(24,36,23,0.42)',zIndex:60,display:'flex',justifyContent:'center',alignItems:'flex-end'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:430,maxHeight:'86vh',overflowY:'auto',background:C.white,borderRadius:'16px 16px 0 0',padding:'8px 20px 22px'}}>
            <div style={{width:44,height:4,borderRadius:R.pill,background:C.outlineVariant,margin:'0 auto 16px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <span style={{fontSize:17,lineHeight:1}}>🎯</span>
              <span style={{...ep,fontSize:19,color:C.primary,flex:1}}>Supports your goal</span>
              <button onClick={()=>setShowGoalSheet(false)} style={{border:'none',background:C.primaryFixed,borderRadius:R.pill,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:0}}>
                <Icon name='x' size={15} color={C.onSurfaceVariant}/>
              </button>
            </div>
            <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:10}}>Per portion, one of {scaledFor}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
              {[['calories',Math.round(recipeNutrition.kcal),pctCal],['protein',`${Math.round(recipeNutrition.protein_g)}g`,pctPro],['fibre',`${Math.round(recipeNutrition.fibre_g)}g`,pctFib]].map(([label,val,pct])=>(
                <div key={label} style={{background:C.primaryFixed,borderRadius:R.md,padding:12}}>
                  <div style={{...mn,fontSize:20,fontWeight:700,color:C.onSurface,lineHeight:1.1}}>{val}</div>
                  <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,marginTop:3}}>{label}</div>
                  <div style={{...mn,fontSize:12,fontWeight:700,color:C.primary,marginTop:6}}>{pct}% of day</div>
                </div>
              ))}
            </div>
            <div style={{background:C.surface,borderRadius:R.md,padding:'14px 16px',marginBottom:12}}>
              <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:10}}>Where this leaves your day</div>
              <div style={{display:'flex',flexDirection:'column',gap:9,fontVariantNumeric:'tabular-nums'}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:12}}><span style={{...mn,fontSize:13,color:C.onSurfaceVariant}}>Already planned today</span><span style={{...mn,fontSize:13,fontWeight:700,color:C.onSurfaceVariant}}>{already?.hasData?rowFigure({kcal:alreadyCal,protein_g:alreadyPro,is_estimated:false}):'Nothing yet'}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',gap:12}}><span style={{...mn,fontSize:13,color:C.onSurfaceVariant}}>With one portion of this</span><span style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface}}>{Math.round(withCal)} cal · {Math.round(withPro)}g P</span></div>
                <div style={{display:'flex',justifyContent:'space-between',gap:12,borderTop:`1px solid ${C.outlineVariant}80`,paddingTop:9}}><span style={{...mn,fontSize:13,color:C.onSurfaceVariant}}>Still to go</span><span style={{...mn,fontSize:13,fontWeight:700,color:C.primary}}>{toGoCal.toLocaleString('en-GB')} cal · {toGoPro}g P · {toGoFib}g fibre</span></div>
              </div>
            </div>
            <div style={{background:C.primaryFixed,borderRadius:R.md,padding:'14px 16px',marginBottom:14,display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{fontSize:14,lineHeight:1.4}}>💡</span>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>That leaves {toGoPro}g of protein across the rest of today.</p>
            </div>
            <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,lineHeight:1.6}}>Percentages are against today's targets — {goalTargets.calories.toLocaleString('en-GB')} cal, {goalTargets.protein}g protein, {goalTargets.fibre}g fibre. Change them any time in Settings.</div>
          </div>
        </div>
      )
    })()}
    </>
  )
}
