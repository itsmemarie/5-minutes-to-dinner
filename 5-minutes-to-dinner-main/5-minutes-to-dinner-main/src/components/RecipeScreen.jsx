import { useState, useEffect } from 'react'
import { fetchRecipeDetails, fetchRecipeNotes, saveRecipeNotes, fetchRecipeToddlerTask, saveRecipeToddlerTask } from '../lib/supabase.js'
import { callEdgeFn } from '../lib/ai.js'
import { C, ep, mn, CARD } from '../lib/theme.js'
import { ageBandFromDob, TODDLER_AGE_BANDS } from '../lib/dateHelpers.js'
import { parseIngredients, parseIngredientParts, parseSteps } from '../lib/recipeParsing.js'
import { Spinner, Btn } from './ui/index.js'

export function RecipeScreen({ recipeId, portion, onAddMeal, toddlerDob, onOpenToddlerCooking }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [showStd, setShowStd] = useState(false)
  const [showTM, setShowTM] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(true)
  const [notesSaving, setNotesSaving] = useState(false)
  const [toddlerTask, setToddlerTask] = useState(null)
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
    setToddlerTask(null); setToddlerTaskError(null)
    ;(async () => {
      try {
        const cached = await fetchRecipeToddlerTask(recipeId)
        if (cached && cached.age_band_id === currentBand) { setToddlerTask(cached); return }
        const recipe = await fetchRecipeDetails(recipeId)
        setToddlerTaskLoading(true)
        const bandLabel = TODDLER_AGE_BANDS.find(b => b.id === currentBand)?.label || currentBand
        const result = await callEdgeFn('recipe-toddler-task', {
          ageBandLabel: bandLabel,
          recipeName: recipe.name,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions_standard || recipe.instructions_thermomix,
          toddlerVariations: recipe.toddler_variations,
        })
        const saved = { dob: toddlerDob, age_band_id: currentBand, age_band_label: bandLabel, task: result.task, needs_tool: result.needsTool ?? null }
        setToddlerTask(saved)
        saveRecipeToddlerTask(recipeId, { dob: toddlerDob, ageBandId: currentBand, ageBandLabel: bandLabel, task: result.task, needsTool: result.needsTool })
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
  const ingSections = parseIngredients(data.ingredients)
  const stdSteps = parseSteps(data.instructions_standard)
  const tmSteps = parseSteps(data.instructions_thermomix)

  return (
    <div style={{padding:'20px 20px 40px'}}>
      {data.has_thermomix_version&&(
        <div style={{display:'inline-flex',alignItems:'center',gap:6,background:C.primary,borderRadius:99,padding:'5px 12px',marginBottom:12}}>
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
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        <div style={{...CARD,padding:'12px 14px'}}>
          <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:6}}>SAVED PORTIONS</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{...mn,fontSize:15,fontWeight:700,color:C.onSurface}}>{scaledFor} servings</span>
            {scale!==1&&<span style={{...mn,fontSize:11,fontWeight:700,background:C.primaryFixed,color:C.primary,padding:'2px 7px',borderRadius:99}}>{scale.toFixed(1)}x</span>}
          </div>
        </div>
        <div style={{...CARD,padding:'12px 14px'}}>
          <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:6}}>MIN. PORTIONS</div>
          <span style={{...mn,fontSize:15,fontWeight:700,color:C.onSurface}}>{data.min_portions||1} servings</span>
        </div>
      </div>

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
            <span style={{...mn,fontSize:11,fontWeight:700,background:C.primaryFixed,color:C.primary,padding:'3px 10px',borderRadius:99}}>Scaled for {scaledFor} portions</span>
          </div>
          {ingSections.map((sec,si)=>(
            <div key={si} style={{marginBottom:12}}>
              {sec.title&&<div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>{sec.title}</div>}
              <div style={{...CARD,overflow:'hidden'}}>
                {sec.items.map((item,ii)=>{
                  const {qty,name}=parseIngredientParts(item,scale)
                  return(
                    <div key={ii} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:ii<sec.items.length-1?`1px solid ${C.outlineVariant}20`:undefined,gap:12}}>
                      <span style={{...mn,fontSize:13,color:C.onSurface,flex:1}}>{name||item}</span>
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
          <div style={{...ep,fontSize:18,color:C.onSurface,marginBottom:12}}>Preparation Methods</div>
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
                      <div style={{width:24,height:24,borderRadius:99,background:C.secondaryContainer,color:C.onSecondaryContainer,...mn,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{step.num}</div>
                      <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0,flex:1}}>{step.text}</p>
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
                      <div style={{width:24,height:24,borderRadius:99,background:C.primary,color:C.onPrimary,...mn,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{step.num}</div>
                      <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0,flex:1}}>{step.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* The Extras */}
      {(data.chef_notes||data.husband_variations||data.toddler_variations||(data.side_recommendation&&data.side_recommendation!=='Not Recommended'))&&(
        <div>
          <div style={{...ep,fontSize:18,color:C.onSurface,marginBottom:12}}>The Extras</div>
          {data.chef_notes&&(
            <div style={{...CARD,padding:'14px 16px',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>📖</span><span style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.07em',textTransform:'uppercase'}}>Chef's Notes</span></div>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>{data.chef_notes}</p>
            </div>
          )}
          {data.husband_variations&&(
            <div style={{...CARD,padding:'14px 16px',marginBottom:10,background:'#fff8f0'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>❤️</span><span style={{...mn,fontSize:10,fontWeight:700,color:'#A86000',letterSpacing:'0.07em',textTransform:'uppercase'}}>Husband Variations</span></div>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>{data.husband_variations}</p>
            </div>
          )}
          {data.toddler_variations&&(
            <div style={{...CARD,padding:'14px 16px',marginBottom:10,background:'#f0f8ff'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>👶</span><span style={{...mn,fontSize:10,fontWeight:700,color:'#0050A0',letterSpacing:'0.07em',textTransform:'uppercase'}}>Toddler Variations</span></div>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>{data.toddler_variations}</p>
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

      {/* Toddler preferences */}
      {toddlerDob&&(toddlerTask||toddlerTaskLoading||toddlerTaskError)&&(
        <div style={{...CARD,padding:'14px 16px',marginBottom:10,marginTop:data.chef_notes||data.husband_variations||data.toddler_variations||(data.side_recommendation&&data.side_recommendation!=='Not Recommended')?0:20,background:C.accent2_100,border:`1px solid ${C.accent2_300}`}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>🧸</span><span style={{...mn,fontSize:10,fontWeight:700,color:C.accent2_700,letterSpacing:'0.07em',textTransform:'uppercase'}}>Toddler Preferences</span></div>
          {toddlerTaskLoading&&<p style={{...mn,fontSize:13,color:C.onSurfaceVariant,margin:0}}>Finding an age-appropriate task…</p>}
          {toddlerTaskError&&<p style={{...mn,fontSize:13,color:C.error,margin:0}}>⚠️ {toddlerTaskError}</p>}
          {toddlerTask&&!toddlerTaskLoading&&(<>
            <div style={{display:'inline-block',...mn,fontSize:10,fontWeight:700,color:C.accent2_700,background:C.white,padding:'2px 8px',borderRadius:99,marginBottom:8}}>{(toddlerTask.age_band_label||'').toUpperCase()}</div>
            <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0,marginBottom:toddlerTask.needs_tool?8:0}}>{toddlerTask.task}</p>
            {toddlerTask.needs_tool&&<div style={{...mn,fontSize:11,fontWeight:700,color:C.primary,background:C.primaryFixed,padding:'4px 10px',borderRadius:8,display:'inline-block',marginBottom:8}}>Needs: {toddlerTask.needs_tool}</div>}
            {onOpenToddlerCooking&&<div><button onClick={onOpenToddlerCooking} style={{...mn,fontSize:12,fontWeight:700,color:C.primary,background:'none',border:'none',padding:0,cursor:'pointer'}}>More toddler activities →</button></div>}
          </>)}
        </div>
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
              style={{...mn,fontSize:12,fontWeight:700,color:C.onPrimary,background:C.primary,border:'none',borderRadius:99,padding:'5px 14px',cursor:'pointer',opacity:notesSaving?0.6:1}}
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
  )
}
