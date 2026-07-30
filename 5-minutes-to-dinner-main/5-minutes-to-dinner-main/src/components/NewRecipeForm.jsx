import { useState } from 'react'
import { createRecipe } from '../lib/supabase.js'
import { extractRecipe } from '../lib/ai.js'
import { C, ep, mn, CARD } from '../lib/theme.js'
import { Btn } from './ui/index.js'

const MEAL_TYPES = [
  { value: 'main',      label: 'Mains' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'side',      label: 'Sides' },
  { value: 'entree',    label: 'Starters' },
  { value: 'dessert',   label: 'Desserts' },
]
const ALL_DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_SHORT = {monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun'}

export function NewRecipeForm({ defaultMealType, onSave, onCancel }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [aiMode, setAiMode] = useState(false)
  const [aiUrl, setAiUrl] = useState('')
  const [aiImageBase64, setAiImageBase64] = useState(null)
  const [aiImageName, setAiImageName] = useState('')
  const [aiImageMediaType, setAiImageMediaType] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [f, setF] = useState({
    name: '',
    meal_type_id: defaultMealType || 'main',
    diet: 'omni',
    prep_time_minutes: '',
    cook_time_minutes: '',
    portion_size: 4,
    min_portions: 1,
    should_have_side: false,
    try_out: false,
    order_out: false,
    fun_recipe: false,
    husband_approved: false,
    has_thermomix_version: false,
    weekdays: [],
    ingredients: '',
    instructions_standard: '',
    instructions_thermomix: '',
    fridge_storage: '',
    freezer_storage: '',
    chef_notes: '',
    husband_variations: '',
    toddler_variations: '',
    side_recommendation: '',
  })

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const toggleDay = d => set('weekdays', f.weekdays.includes(d) ? f.weekdays.filter(x => x !== d) : [...f.weekdays, d])

  const applyAiResult = (data) => {
    setF(p => ({
      ...p,
      name: data.name || p.name,
      meal_type_id: data.meal_type_id || p.meal_type_id,
      diet: data.diet || p.diet,
      prep_time_minutes: data.prep_time_minutes != null ? data.prep_time_minutes : p.prep_time_minutes,
      cook_time_minutes: data.cook_time_minutes != null ? data.cook_time_minutes : p.cook_time_minutes,
      portion_size: data.portion_size ?? p.portion_size,
      min_portions: data.min_portions ?? p.min_portions,
      should_have_side: data.should_have_side ?? p.should_have_side,
      has_thermomix_version: data.has_thermomix_version ?? p.has_thermomix_version,
      ingredients: data.ingredients || p.ingredients,
      instructions_standard: data.instructions_standard || p.instructions_standard,
      instructions_thermomix: data.instructions_thermomix || p.instructions_thermomix,
      fridge_storage: data.fridge_storage || p.fridge_storage,
      freezer_storage: data.freezer_storage || p.freezer_storage,
      chef_notes: data.chef_notes || p.chef_notes,
      husband_variations: data.husband_variations || p.husband_variations,
      toddler_variations: data.toddler_variations || p.toddler_variations,
      side_recommendation: data.side_recommendation || p.side_recommendation,
    }))
    setAiMode(false)
  }

  const handleAiFromUrl = async () => {
    if (!aiUrl.trim()) return
    setAiLoading(true); setAiError(null)
    try {
      const data = await extractRecipe({ url: aiUrl.trim() })
      applyAiResult(data)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAiImageBase64(ev.target.result.split(',')[1])
      setAiImageMediaType(file.type)
      setAiImageName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const handleAiFromImage = async () => {
    if (!aiImageBase64) return
    setAiLoading(true); setAiError(null)
    try {
      const data = await extractRecipe({ imageBase64: aiImageBase64, mediaType: aiImageMediaType })
      applyAiResult(data)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    if (!f.name.trim()) return
    setSaving(true); setSaveError(null)
    try {
      const dbFields = {
        name: f.name.trim(),
        meal_type_id: f.meal_type_id,
        prep_time_minutes: f.prep_time_minutes === '' ? null : Number(f.prep_time_minutes),
        cook_time_minutes: f.cook_time_minutes === '' ? null : Number(f.cook_time_minutes),
        portion_size: f.portion_size,
        min_portions: f.min_portions,
        should_have_side: f.should_have_side,
        try_out: f.try_out,
        order_out: f.order_out,
        fun_recipe: f.fun_recipe,
        husband_approved: f.husband_approved,
        has_thermomix_version: f.has_thermomix_version,
        weekdays: f.weekdays,
        ingredients: f.ingredients || null,
        instructions_standard: f.instructions_standard || null,
        instructions_thermomix: f.instructions_thermomix || null,
        fridge_storage: f.fridge_storage || null,
        freezer_storage: f.freezer_storage || null,
        chef_notes: f.chef_notes || null,
        husband_variations: f.husband_variations || null,
        toddler_variations: f.toddler_variations || null,
        side_recommendation: f.side_recommendation || null,
        diet: f.diet,
      }
      const newId = await createRecipe(dbFields)
      const catMap = { breakfast: 'Breakfast', main: 'Mains', side: 'Sides', entree: 'Starters', dessert: 'Desserts' }
      onSave({
        id: newId,
        name: f.name.trim(),
        cat: catMap[f.meal_type_id] || 'Mains',
        prep: f.prep_time_minutes === '' ? 0 : Number(f.prep_time_minutes),
        active: f.cook_time_minutes === '' ? 0 : Number(f.cook_time_minutes),
        base: f.portion_size,
        min: f.min_portions,
        diet: f.diet,
        hasSides: f.should_have_side,
        tryOut: f.try_out,
        orderOut: f.order_out,
        defaultDays: f.weekdays,
        fun: f.fun_recipe,
        husband: f.husband_approved,
      })
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = (extra) => ({
    ...mn, width: '100%', padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${C.outlineVariant}`, fontSize: 14,
    background: C.white, outline: 'none', boxSizing: 'border-box', ...extra,
  })
  const row = (label, content) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ ...mn, fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      {content}
    </div>
  )
  const toggle = (key, label) => (
    <div onClick={() => set(key, !f[key])} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${C.outlineVariant}30`, cursor: 'pointer' }}>
      <span style={{ ...mn, fontSize: 14, color: C.onSurface }}>{label}</span>
      <div style={{ width: 40, height: 22, borderRadius: 99, background: f[key] ? C.primary : C.outlineVariant, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: f[key] ? 21 : 3, width: 16, height: 16, borderRadius: 99, background: '#fff', transition: 'left 0.2s' }}/>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: C.white, overflowY: 'auto', maxWidth: 430, margin: '0 auto' }}>
      <div style={{ background: C.white, borderBottom: `1px solid ${C.outlineVariant}25`, padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onCancel} style={{ border: 'none', background: 'none', color: C.primary, fontSize: 22, cursor: 'pointer', padding: '2px 8px 2px 0' }}>←</button>
        <span style={{ ...ep, fontSize: 16, color: C.onSurface, flex: 1 }}>New Recipe</span>
        <Btn label={saving ? 'Saving…' : 'Save'} small onClick={handleSave} disabled={saving || !f.name.trim()}/>
      </div>

      <div style={{ padding: '20px 20px 120px' }}>
        <div style={{ display: 'flex', background: C.outlineVariant + '30', borderRadius: 10, padding: 3, marginBottom: 20 }}>
          <button onClick={() => setAiMode(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: !aiMode ? C.white : 'transparent', color: !aiMode ? C.primary : C.onSurfaceVariant, ...mn, fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: !aiMode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>Manual</button>
          <button onClick={() => setAiMode(true)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: aiMode ? C.white : 'transparent', color: aiMode ? C.primary : C.onSurfaceVariant, ...mn, fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: aiMode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>✨ AI Assist</button>
        </div>

        {aiMode && (
          <div style={{ background: C.primaryFixed, borderRadius: 14, padding: '18px 16px', marginBottom: 20 }}>
            <div style={{ ...mn, fontSize: 12, color: C.onSurface, opacity: 0.7, marginBottom: 14 }}>AI will extract the recipe and fill in all fields — you can review and edit everything before saving.</div>
            {aiError && <div style={{ ...mn, fontSize: 13, color: C.error, background: C.errorContainer, padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>{aiError}</div>}

            <div style={{ ...mn, fontSize: 11, fontWeight: 700, color: C.onSurface, opacity: 0.6, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Recipe URL</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <input value={aiUrl} onChange={e => setAiUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiFromUrl()} placeholder='https://...' style={{ ...inp(), flex: 1 }} disabled={aiLoading}/>
              <Btn label={aiLoading ? '…' : 'Extract'} small onClick={handleAiFromUrl} disabled={aiLoading || !aiUrl.trim()}/>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: C.outline + '40' }}/>
              <span style={{ ...mn, fontSize: 11, color: C.onSurfaceVariant }}>or</span>
              <div style={{ flex: 1, height: 1, background: C.outline + '40' }}/>
            </div>

            <div style={{ ...mn, fontSize: 11, fontWeight: 700, color: C.onSurface, opacity: 0.6, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Upload Photo</div>
            <label style={{ display: 'block', border: `2px dashed ${C.outlineVariant}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center', cursor: aiLoading ? 'not-allowed' : 'pointer', background: C.white }}>
              <input type='file' accept='image/*' onChange={handleImageSelect} style={{ display: 'none' }} disabled={aiLoading}/>
              <div style={{ ...mn, fontSize: 13, color: aiImageName ? C.onSurface : C.onSurfaceVariant }}>{aiImageName ? `📷 ${aiImageName}` : 'Tap to choose a photo'}</div>
            </label>
            {aiImageName && !aiLoading && (
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                <Btn label='Extract from photo' small onClick={handleAiFromImage}/>
              </div>
            )}
            {aiLoading && <div style={{ ...mn, fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center', padding: '10px 0 4px' }}>Extracting recipe…</div>}
          </div>
        )}

        {saveError && <div style={{ ...mn, fontSize: 13, color: C.error, background: C.errorContainer, padding: '10px 14px', borderRadius: 10, marginBottom: 16 }}>{saveError}</div>}

        {row('Recipe Name *',
          <input value={f.name} onChange={e => set('name', e.target.value)} placeholder='e.g. Chicken Stir-Fry' style={inp({ border: `1.5px solid ${f.name.trim() ? C.primary : C.outlineVariant}` })}/>
        )}

        {row('Category',
          <select value={f.meal_type_id} onChange={e => set('meal_type_id', e.target.value)} style={inp()}>
            {MEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}

        {row('Diet',
          <div style={{ display: 'flex', gap: 8 }}>
            {[['omni','🐰 Omni'],['veg','🌿 Veg'],['vegan','🌿 Vegan']].map(([v,l]) => (
              <button key={v} onClick={() => set('diet', v)} style={{ ...mn, flex: 1, padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${f.diet === v ? C.primary : C.outlineVariant}`, background: f.diet === v ? C.primary : C.white, color: f.diet === v ? C.onPrimary : C.onSurface, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...mn, fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Prep (mins)</div>
            <input type='number' min='0' value={f.prep_time_minutes} onChange={e => set('prep_time_minutes', e.target.value)} placeholder='0' style={inp()}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ ...mn, fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Cook (mins)</div>
            <input type='number' min='0' value={f.cook_time_minutes} onChange={e => set('cook_time_minutes', e.target.value)} placeholder='0' style={inp()}/>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...mn, fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Base Portions</div>
            <input type='number' min='1' value={f.portion_size} onChange={e => set('portion_size', Math.max(1, Number(e.target.value)))} style={inp()}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ ...mn, fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Min Portions</div>
            <input type='number' min='1' value={f.min_portions} onChange={e => set('min_portions', Math.max(1, Number(e.target.value)))} style={inp()}/>
          </div>
        </div>

        {row('Default Days',
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_DAYS.map(d => (
              <button key={d} onClick={() => toggleDay(d)} style={{ ...mn, padding: '6px 10px', borderRadius: 99, border: `1.5px solid ${f.weekdays.includes(d) ? C.primary : C.outlineVariant}`, background: f.weekdays.includes(d) ? C.primary : C.white, color: f.weekdays.includes(d) ? C.onPrimary : C.onSurface, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{DAY_SHORT[d]}</button>
            ))}
          </div>
        )}

        <div style={{ ...CARD, padding: '4px 14px', marginBottom: 16 }}>
          {toggle('should_have_side', '🍽 Should have a side')}
          {toggle('try_out', 'Try Out recipe')}
          {toggle('order_out', 'Order Out')}
          {toggle('fun_recipe', 'Fun Recipe (F)')}
          {toggle('husband_approved', 'Husband Approved (H)')}
          {toggle('has_thermomix_version', 'Has Thermomix version')}
        </div>

        {row('Ingredients',
          <textarea value={f.ingredients} onChange={e => set('ingredients', e.target.value)} placeholder={'[Section Name]\n- 200g ingredient\n- 1 tbsp something'} rows={5} style={inp({ resize: 'vertical', lineHeight: 1.5 })}/>
        )}
        {row('Instructions (Standard)',
          <textarea value={f.instructions_standard} onChange={e => set('instructions_standard', e.target.value)} placeholder='1. Step one&#10;2. Step two' rows={5} style={inp({ resize: 'vertical', lineHeight: 1.5 })}/>
        )}
        {row('Instructions (Thermomix)',
          <textarea value={f.instructions_thermomix} onChange={e => set('instructions_thermomix', e.target.value)} placeholder='1. Step one&#10;2. Step two' rows={4} style={inp({ resize: 'vertical', lineHeight: 1.5 })}/>
        )}
        {row('Fridge Storage',
          <input value={f.fridge_storage} onChange={e => set('fridge_storage', e.target.value)} placeholder='e.g. 3 days' style={inp()}/>
        )}
        {row('Freezer Storage',
          <input value={f.freezer_storage} onChange={e => set('freezer_storage', e.target.value)} placeholder='e.g. Up to 3 months' style={inp()}/>
        )}
        {row('Chef Notes',
          <textarea value={f.chef_notes} onChange={e => set('chef_notes', e.target.value)} rows={3} style={inp({ resize: 'vertical', lineHeight: 1.5 })}/>
        )}
        {row('Husband Variations',
          <textarea value={f.husband_variations} onChange={e => set('husband_variations', e.target.value)} rows={2} style={inp({ resize: 'vertical', lineHeight: 1.5 })}/>
        )}
        {row('Toddler Variations',
          <textarea value={f.toddler_variations} onChange={e => set('toddler_variations', e.target.value)} rows={2} style={inp({ resize: 'vertical', lineHeight: 1.5 })}/>
        )}
        {row('Side Recommendation',
          <input value={f.side_recommendation} onChange={e => set('side_recommendation', e.target.value)} placeholder='e.g. Rice or salad' style={inp()}/>
        )}
      </div>
    </div>
  )
}
