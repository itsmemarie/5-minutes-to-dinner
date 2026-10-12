import { useEffect, useRef, useState } from 'react'
import { createRecipe, uploadRecipePhoto } from '../lib/supabase.js'
import { ImageCropper } from './ui/ImageCropper.jsx'
import { isFullFrame } from '../lib/imageMath.js'
import { extractRecipe, completeRecipe, reviewRecipe, generateRecipe, isAiLimit } from '../lib/ai.js'
import { preparePhotoItems, prepareRecipePhoto } from '../lib/imageHelpers.js'
import {
  EMPTY_RECIPE, FIELD_LABELS, mergeAiFields, missingFields, recipeForAi, recipeForReview, hasRecipeContent,
} from '../lib/recipeDraft.js'
import { applySuggestion } from '../lib/reviewSuggestions.js'
import { C, ep, mn, CARD, R } from '../lib/theme.js'
import { Btn } from './ui/index.js'
import { Icon } from './ui/Icon.jsx'
import { PhotoPicker, photoItem } from './PhotoPicker.jsx'
import { ReviewPanel } from './recipe/ReviewPanel.jsx'
import { InstallHint } from './InstallHint.jsx'

const MEAL_TYPES = [
  { value: 'main',      label: 'Mains' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'side',      label: 'Sides & snacks' },
  { value: 'entree',    label: 'Starters' },
  { value: 'dessert',   label: 'Desserts' },
]
const ALL_DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_SHORT = {monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun'}

// Where a field's value came from (see recipeDraft.js). Shown next to its label.
const PROV_TAG = {
  source: { label: 'From source',       fg: C.primary,                    bg: C.primaryFixed },
  ai:     { label: 'Added by AI',       fg: C.onSecondaryContainerStrong, bg: C.secondaryContainer },
  review: { label: 'Changed in review', fg: '#0050A0',                    bg: '#EEF4FF' },
}
const ORIGIN_BANNER = {
  'page-data': "Read word for word from the page's recipe data. No AI was used. Check it, then save, or use the optional AI help below.",
  ai:          'Transcribed by AI exactly as written. Nothing was added or corrected, so check it against the source.',
  generated:   'Created by AI from your description. Check it carefully before saving.',
}

// Recipe workflow (see also the edge functions of the same names):
//   1. Extract  — reading a link, photo or pasted text runs straight away: a 1:1
//                 transcription, nothing added.
//   2. Complete — optional button: fills only empty fields, each marked "Added by AI".
//   3. Review   — optional button: an expert's separate suggestions, each applied
//                 or skipped by the user.
// Manual entry is always available and never needs AI.
//
// aiContext: { equipment, region, units, measurements, children } — the
//   household details steps 2 and 3 take into account.
// initialSource: { url?, text?, files? } — content shared into the app.
export function NewRecipeForm({ defaultMealType, onSave, onCancel, aiContext, initialSource }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [f, setF] = useState(() => ({ ...EMPTY_RECIPE, meal_type_id: defaultMealType || 'main' }))
  const [prov, setProv] = useState({})          // field → 'source' | 'ai' | 'review'
  const [touched, setTouched] = useState({})    // fields the user has typed in
  const [origin, setOrigin] = useState(null)    // 'page-data' | 'ai' | 'generated'

  const [aiMode, setAiMode] = useState(!!initialSource)
  const [url, setUrl] = useState(initialSource?.url || '')
  const [pasted, setPasted] = useState(initialSource?.text || '')
  const [photos, setPhotos] = useState(() => (initialSource?.files || []).map(photoItem))
  const [grayscale, setGrayscale] = useState(true)
  const [dish, setDish] = useState(null)          // { file, crop }: the finished dish, kept as the recipe's picture
  const [dishCropping, setDishCropping] = useState(null)   // { file, crop } being cropped, not yet accepted
  const [dishUrl, setDishUrl] = useState(null)    // preview of the cropped result
  useEffect(() => {
    if (!dish) { setDishUrl(null); return undefined }
    let live = true
    prepareRecipePhoto(dish.file, { crop: dish.crop }).then(p => { if (live) setDishUrl(`data:${p.mediaType};base64,${p.base64}`) }).catch(() => { if (live) setDishUrl(null) })
    return () => { live = false }
  }, [dish])
  const dishInput = useRef(null)
  const savedId = useRef(null)                    // set once the row exists, so a retry after a photo failure doesn't create it twice
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(null)        // which AI action is running
  const [aiError, setAiError] = useState(null)  // { where: 'source'|'tools', message, limit }
  const [completed, setCompleted] = useState(null)  // fields step 2 added
  const [review, setReview] = useState(null)        // { suggestions: [{…, status}], warnings }

  // AI calls take seconds and the user can keep typing: results merge into
  // the latest draft, not the one the call started from.
  const latest = useRef({ f, prov, touched })
  latest.current = { f, prov, touched }

  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setTouched(t => (t[k] ? t : { ...t, [k]: true })) }
  const toggleDay = d => set('weekdays', f.weekdays.includes(d) ? f.weekdays.filter(x => x !== d) : [...f.weekdays, d])
  const tagFields = (keys, tag) => setProv(p => ({ ...p, ...Object.fromEntries(keys.map(k => [k, tag])) }))

  const fail = (where, e) => {
    const limit = isAiLimit(e)
    // Out of AI: drop back to the form so the user can carry on by hand.
    if (limit && where === 'source') setAiMode(false)
    setAiError({ where, message: e.message, limit })
  }

  // ── Step 1: extract ────────────────────────────────────────────
  const applyResult = (data, tag, originKind) => {
    const { fields, changed } = mergeAiFields(latest.current.f, data)
    setF(fields)
    tagFields(changed, tag)
    setOrigin(originKind)
    setCompleted(null)
    setReview(null)
    setAiMode(false)
  }

  const runExtract = async kind => {
    setBusy(kind); setAiError(null)
    try {
      const payload = kind === 'url' ? { url: url.trim() }
        : kind === 'text' ? { text: pasted.trim() }
        : { images: await preparePhotoItems(photos, { grayscale }) }
      const data = await extractRecipe(payload)
      applyResult(data, 'source', data.origin === 'page-data' ? 'page-data' : 'ai')
    } catch (e) {
      fail('source', e)
    } finally {
      setBusy(null)
    }
  }

  const runGenerate = async () => {
    setBusy('generate'); setAiError(null)
    try {
      applyResult(await generateRecipe({ description: description.trim(), context: aiContext }), 'ai', 'generated')
    } catch (e) {
      fail('source', e)
    } finally {
      setBusy(null)
    }
  }

  // Shared into the app: a link or a pasted recipe is read straight away (step
  // 1 is automatic); photos wait so they can be cropped first. A short line of
  // text is most likely just the recipe's title.
  const autoRan = useRef(false)
  useEffect(() => {
    if (!initialSource || autoRan.current) return
    autoRan.current = true
    if (initialSource.files?.length) return
    if (initialSource.url) { runExtract('url'); return }
    const text = (initialSource.text || '').trim()
    if (text.length > 80 || text.includes('\n')) runExtract('text')
    else if (text) { setF(p => ({ ...p, name: text })); tagFields(['name'], 'source'); setAiMode(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Step 2: complete ───────────────────────────────────────────
  const runComplete = async () => {
    const { f: cur, prov: p, touched: t } = latest.current
    const missing = missingFields(cur, p, t)
    if (!missing.length) { setCompleted([]); return }
    setBusy('complete'); setAiError(null)
    try {
      const { fields: added } = await completeRecipe({ recipe: recipeForAi(cur, p, t), missing, context: aiContext })
      const now = latest.current
      const { fields, changed } = mergeAiFields(now.f, added, { onlyEmpty: true, prov: now.prov, touched: now.touched })
      setF(fields)
      tagFields(changed, 'ai')
      setCompleted(changed)
    } catch (e) {
      fail('tools', e)
    } finally {
      setBusy(null)
    }
  }

  // ── Step 3: expert review ──────────────────────────────────────
  const runReview = async () => {
    setBusy('review'); setAiError(null)
    try {
      const r = await reviewRecipe({ recipe: recipeForReview(latest.current.f), context: aiContext })
      setReview({ suggestions: (r.suggestions || []).map(s => ({ ...s, status: 'pending' })), warnings: r.warnings || [] })
    } catch (e) {
      fail('tools', e)
    } finally {
      setBusy(null)
    }
  }

  const decide = (id, approve) => {
    const s = review?.suggestions.find(x => x.id === id)
    if (!s) return
    let status = 'skipped', reason
    if (approve) {
      const r = applySuggestion(latest.current.f, s)
      if (r.ok) { setF(r.fields); tagFields([s.field], 'review'); status = 'applied' }
      else { status = 'failed'; reason = r.reason }
    }
    setReview(rv => ({ ...rv, suggestions: rv.suggestions.map(x => (x.id === id ? { ...x, status, reason } : x)) }))
  }

  // ── Save ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!f.name.trim()) return
    setSaving(true); setSaveError(null)
    try {
      const num = v => (v === '' || v == null ? null : Number(v))
      const dbFields = {
        name: f.name.trim(),
        meal_type_id: f.meal_type_id,
        prep_time_minutes: num(f.prep_time_minutes),
        cook_time_minutes: num(f.cook_time_minutes),
        advance_prep_hours: num(f.advance_prep_hours),
        advance_prep_note: f.advance_prep_note || null,
        portion_size: Number(f.portion_size) || 4,
        min_portions: Number(f.min_portions) || 1,
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
      const newId = savedId.current || await createRecipe(dbFields)
      savedId.current = newId
      // The photo needs the recipe's id, so it goes up after the row exists. If it
      // fails, the recipe is kept and the form stays open for a retry or a skip.
      let image = {}
      if (dish) {
        try {
          image = await uploadRecipePhoto(newId, await prepareRecipePhoto(dish.file, { crop: dish.crop }))
        } catch (e) {
          setSaveError(`${e.message} The recipe itself is saved. Try the photo again, or remove it and save.`)
          return
        }
      }
      const catMap = { breakfast: 'Breakfast', main: 'Mains', side: 'Sides', entree: 'Starters', dessert: 'Desserts' }
      onSave({
        id: newId,
        name: dbFields.name,
        cat: catMap[f.meal_type_id] || 'Mains',
        prep: dbFields.prep_time_minutes ?? 0,
        active: dbFields.cook_time_minutes ?? 0,
        advancePrepHours: dbFields.advance_prep_hours,
        advancePrepNote: dbFields.advance_prep_note,
        base: dbFields.portion_size,
        min: dbFields.min_portions,
        diet: f.diet,
        tryOut: f.try_out,
        orderOut: f.order_out,
        defaultDays: f.weekdays,
        fun: f.fun_recipe,
        husband: f.husband_approved,
        imagePath: image.imagePath || null,
        imageUrl: image.imageUrl || null,
        imageCredit: null,
      })
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Layout helpers ─────────────────────────────────────────────
  const inp = (extra, key) => ({
    ...mn, width: '100%', padding: '10px 12px', borderRadius: R.md,
    border: `1px solid ${C.outlineVariant}`, fontSize: 14,
    background: prov[key] === 'ai' ? '#fffaf5' : C.white, outline: 'none', boxSizing: 'border-box',
    ...(prov[key] === 'ai' ? { borderColor: C.accent2_300 } : prov[key] === 'review' ? { borderColor: '#90C0F5' } : {}),
    ...extra,
  })
  const label = (text, key) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
      <span style={{ ...mn, fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{text}</span>
      {key && prov[key] && (
        <span style={{ ...mn, fontSize: 10, fontWeight: 700, color: PROV_TAG[prov[key]].fg, background: PROV_TAG[prov[key]].bg, borderRadius: R.pill, padding: '1px 7px' }}>
          {PROV_TAG[prov[key]].label}{touched[key] ? ' · edited' : ''}
        </span>
      )}
    </div>
  )
  const row = (text, content, key) => (
    <div style={{ marginBottom: 14 }}>
      {label(text, key)}
      {content}
    </div>
  )
  const toggle = (key, text) => (
    <div onClick={() => set(key, !f[key])} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${C.outlineVariant}30`, cursor: 'pointer' }}>
      <span style={{ ...mn, fontSize: 14, color: C.onSurface }}>{text}</span>
      <div style={{ width: 40, height: 22, borderRadius: R.pill, background: f[key] ? C.primary : C.outlineVariant, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: f[key] ? 21 : 3, width: 16, height: 16, borderRadius: R.pill, background: '#fff', transition: 'left 0.2s' }}/>
      </div>
    </div>
  )
  const capLabel = { ...mn, fontSize: 11, fontWeight: 700, color: C.onSurface, opacity: 0.6, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }
  const orLine = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
      <div style={{ flex: 1, height: 1, background: C.outline + '40' }}/>
      <span style={{ ...mn, fontSize: 11, color: C.onSurfaceVariant }}>or</span>
      <div style={{ flex: 1, height: 1, background: C.outline + '40' }}/>
    </div>
  )
  const errorNote = where => aiError?.where === where && (
    <div role='alert' style={{ ...mn, fontSize: 13, color: aiError.limit ? C.onSecondaryContainerStrong : C.error, background: aiError.limit ? C.secondaryContainer : C.errorContainer, padding: '8px 12px', borderRadius: R.sm, marginBottom: 12, lineHeight: 1.5 }}>
      {aiError.message}
    </div>
  )
  const anyBusy = !!busy || saving
  const busyText = { url: 'Reading the page…', text: 'Reading the recipe…', photos: 'Reading your photos…', generate: 'Creating a recipe…' }[busy]
  const showTools = !aiMode && (hasRecipeContent(f) || f.name.trim())

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: C.white, overflowY: 'auto', maxWidth: 430, margin: '0 auto' }}>
      <div style={{ background: C.white, borderBottom: `1px solid ${C.outlineVariant}25`, padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onCancel} aria-label='Close' style={{ border: 'none', background: 'none', color: C.primary, cursor: 'pointer', padding: '2px 8px 2px 0' }}><Icon name='x' size={20} color={C.primary}/></button>
        <span style={{ ...ep, fontSize: 16, color: C.onSurface, flex: 1 }}>New recipe</span>
        <Btn label={saving ? 'Saving…' : 'Save'} small onClick={handleSave} disabled={saving || !f.name.trim()}/>
      </div>

      <div style={{ padding: '20px 20px 120px' }}>
        <div style={{ display: 'flex', background: C.outlineVariant + '30', borderRadius: R.md, padding: 3, marginBottom: 20 }}>
          <button onClick={() => setAiMode(false)} style={{ flex: 1, padding: '8px', borderRadius: R.sm, border: 'none', background: !aiMode ? C.white : 'transparent', color: !aiMode ? C.primary : C.onSurfaceVariant, ...mn, fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: !aiMode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>Manual</button>
          <button onClick={() => setAiMode(true)} style={{ flex: 1, padding: '8px', borderRadius: R.sm, border: 'none', background: aiMode ? C.white : 'transparent', color: aiMode ? C.primary : C.onSurfaceVariant, ...mn, fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: aiMode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>✨ AI Assist</button>
        </div>

        {aiMode && (
          <div style={{ background: C.primaryFixed, borderRadius: R.lg, padding: '18px 16px', marginBottom: 20 }}>
            <div style={{ ...mn, fontSize: 12, color: C.onSurface, opacity: 0.75, marginBottom: 14, lineHeight: 1.5 }}>The recipe is read exactly as written, with nothing added. You check it, then the optional AI help can fill gaps or give an expert review.</div>
            {errorNote('source')}

            <div style={capLabel}>Recipe link</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && url.trim() && !anyBusy && runExtract('url')} placeholder='https://...' inputMode='url' style={{ ...inp(), flex: 1 }} disabled={anyBusy}/>
              <Btn label={busy === 'url' ? '…' : 'Read'} small onClick={() => runExtract('url')} disabled={anyBusy || !url.trim()}/>
            </div>

            {orLine}
            <div style={capLabel}>Photo of a recipe</div>
            <PhotoPicker items={photos} onChange={setPhotos} disabled={anyBusy} grayscale={grayscale} onGrayscaleChange={setGrayscale}
              emptyLabel='Tap to choose photos — up to 3 pages'/>
            {photos.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                <Btn label={busy === 'photos' ? '…' : photos.length > 1 ? 'Read photos' : 'Read photo'} small onClick={() => runExtract('photos')} disabled={anyBusy}/>
              </div>
            )}

            {orLine}
            <div style={capLabel}>Paste the recipe text</div>
            <textarea value={pasted} onChange={e => setPasted(e.target.value)} placeholder='Paste ingredients and method from anywhere: a message, a note, a caption…' rows={3} disabled={anyBusy} style={inp({ resize: 'vertical', lineHeight: 1.5 })}/>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <Btn label={busy === 'text' ? '…' : 'Read text'} small onClick={() => runExtract('text')} disabled={anyBusy || !pasted.trim()}/>
            </div>

            {orLine}
            <div style={capLabel}>Or describe what you want</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={"e.g. A quick vegetarian pasta using what's in my fridge, kid-friendly"} rows={3} disabled={anyBusy} style={inp({ resize: 'vertical', lineHeight: 1.5 })}/>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <Btn label={busy === 'generate' ? '…' : 'Create recipe'} small onClick={runGenerate} disabled={anyBusy || !description.trim()}/>
            </div>

            {busyText && <div role='status' style={{ ...mn, fontSize: 13, color: C.onSurfaceVariant, textAlign: 'center', padding: '12px 0 4px' }}>{busyText}</div>}
            <div style={{ marginTop: 16 }}><InstallHint/></div>
          </div>
        )}

        {!aiMode && origin && (
          <div style={{ ...mn, fontSize: 12, lineHeight: 1.5, color: C.onSurface, background: origin === 'generated' ? C.secondaryContainer : C.primaryFixed, borderRadius: R.md, padding: '10px 12px', marginBottom: 14 }}>
            {ORIGIN_BANNER[origin]}
          </div>
        )}

        {!aiMode && errorNote('source')}

        {showTools && (
          <div style={{ ...CARD, padding: '14px 14px', marginBottom: 18, background: C.surface }}>
            <div style={{ ...mn, fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Optional AI help</div>
            {errorNote('tools')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={runComplete} disabled={anyBusy || !f.ingredients.trim()} style={toolBtn(anyBusy || !f.ingredients.trim())}>
                <Icon name='wand' size={16} color={C.primary}/>
                <span style={{ ...mn, fontSize: 13, fontWeight: 700, color: C.onSurface }}>{busy === 'complete' ? 'Filling in…' : 'Fill in the gaps'}</span>
                <span style={{ ...mn, fontSize: 11, color: C.onSurfaceVariant, lineHeight: 1.4 }}>Adds missing details. Each is marked “Added by AI”.</span>
              </button>
              <button onClick={runReview} disabled={anyBusy || !hasRecipeContent(f)} style={toolBtn(anyBusy || !hasRecipeContent(f))}>
                <Icon name='chefHat' size={16} color={C.primary}/>
                <span style={{ ...mn, fontSize: 13, fontWeight: 700, color: C.onSurface }}>{busy === 'review' ? 'Reviewing…' : 'Expert review'}</span>
                <span style={{ ...mn, fontSize: 11, color: C.onSurfaceVariant, lineHeight: 1.4 }}>Spots mistakes and suggests fixes you approve one by one.</span>
              </button>
            </div>
            {!f.ingredients.trim() && <div style={{ ...mn, fontSize: 11, color: C.onSurfaceVariant, marginTop: 8 }}>Add the ingredients to use “Fill in the gaps”.</div>}
            {completed && (
              <div style={{ ...mn, fontSize: 12, color: C.onSurface, marginTop: 10, lineHeight: 1.5 }}>
                {completed.length
                  ? <>Added {completed.length} field{completed.length === 1 ? '' : 's'}: {completed.map(k => FIELD_LABELS[k]).join(', ')}. Look for “Added by AI” below.</>
                  : 'Nothing to fill in. Every field already has a value.'}
              </div>
            )}
            {review && <ReviewPanel review={review} onDecide={decide} onClose={() => setReview(null)}/>}
          </div>
        )}

        {saveError && <div style={{ ...mn, fontSize: 13, color: C.error, background: C.errorContainer, padding: '10px 14px', borderRadius: R.md, marginBottom: 16 }}>{saveError}</div>}

        {row('Photo of the dish',
          <div>
            <input ref={dishInput} type='file' accept='image/*' style={{ display: 'none' }}
              onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file?.type?.startsWith('image/')) setDishCropping({ file, crop: null }) }}/>
            {dish ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 96, height: 72, borderRadius: R.md, overflow: 'hidden', background: C.surfaceContainerHigh, flexShrink: 0 }}>
                  {dishUrl && <img src={dishUrl} alt='Dish' style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Btn label='Crop' small onClick={() => setDishCropping(dish)} disabled={anyBusy}/>
                  <button onClick={() => dishInput.current?.click()} disabled={anyBusy} style={{ ...mn, border: `1px solid ${C.outlineVariant}`, background: 'none', borderRadius: R.pill, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: C.primary, cursor: anyBusy ? 'not-allowed' : 'pointer' }}>Change</button>
                  <button onClick={() => setDish(null)} disabled={anyBusy} style={{ ...mn, border: `1px solid ${C.outlineVariant}`, background: 'none', borderRadius: R.pill, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: C.error, cursor: anyBusy ? 'not-allowed' : 'pointer' }}>Remove</button>
                </div>
              </div>
            ) : (
              <>
                <button onClick={() => dishInput.current?.click()} disabled={anyBusy}
                  style={{ ...mn, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `2px dashed ${C.outlineVariant}`, borderRadius: R.md, padding: '14px 16px', background: C.white, fontSize: 13, color: C.onSurfaceVariant, cursor: anyBusy ? 'not-allowed' : 'pointer' }}>
                  <Icon name='camera' size={16} color={C.onSurfaceVariant}/>Add a photo (optional)
                </button>
                {photos.length > 0 && (
                  <button onClick={() => setDishCropping({ file: photos[0].file, crop: null })} style={{ ...mn, border: 'none', background: 'none', padding: '8px 0 0', fontSize: 12, fontWeight: 700, color: C.primary, cursor: 'pointer' }}>Use the photo I read the recipe from</button>
                )}
              </>
            )}
          </div>
        )}

        {dishCropping && (
          <ImageCropper file={dishCropping.file} initial={dishCropping.crop} title='Crop the photo'
            hint='Drag the box to frame the dish. The photo is shown wide, so a landscape crop fits best.'
            onCancel={() => setDishCropping(null)}
            onDone={crop => { setDish({ file: dishCropping.file, crop: isFullFrame(crop) ? null : crop }); setDishCropping(null) }}/>
        )}

        {row('Recipe Name *',
          <input value={f.name} onChange={e => set('name', e.target.value)} placeholder='e.g. Chicken Stir-Fry' style={inp({ border: `1.5px solid ${f.name.trim() ? C.primary : C.outlineVariant}` }, 'name')}/>, 'name'
        )}

        {row('Category',
          <select value={f.meal_type_id} onChange={e => set('meal_type_id', e.target.value)} style={inp(undefined, 'meal_type_id')}>
            {MEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>, 'meal_type_id'
        )}

        {row('Diet',
          <div style={{ display: 'flex', gap: 8 }}>
            {[['omni','🐰 Omni'],['veg','🌿 Veg'],['vegan','🌿 Vegan']].map(([v,l]) => (
              <button key={v} onClick={() => set('diet', v)} style={{ ...mn, flex: 1, padding: '8px 4px', borderRadius: R.md, border: `1.5px solid ${f.diet === v ? C.primary : C.outlineVariant}`, background: f.diet === v ? C.primary : C.white, color: f.diet === v ? C.onPrimary : C.onSurface, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>, 'diet'
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            {label('Prep (mins)', 'prep_time_minutes')}
            <input type='number' min='0' value={f.prep_time_minutes} onChange={e => set('prep_time_minutes', e.target.value)} placeholder='0' style={inp(undefined, 'prep_time_minutes')}/>
          </div>
          <div style={{ flex: 1 }}>
            {label('Cook (mins)', 'cook_time_minutes')}
            <input type='number' min='0' value={f.cook_time_minutes} onChange={e => set('cook_time_minutes', e.target.value)} placeholder='0' style={inp(undefined, 'cook_time_minutes')}/>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: '0 0 110px' }}>
            {label('Advance Prep (hrs)', 'advance_prep_hours')}
            <input type='number' min='0' step='0.5' value={f.advance_prep_hours} onChange={e => set('advance_prep_hours', e.target.value)} placeholder='0' style={inp(undefined, 'advance_prep_hours')}/>
          </div>
          <div style={{ flex: 1 }}>
            {label('Advance Prep Note', 'advance_prep_note')}
            <input value={f.advance_prep_note} onChange={e => set('advance_prep_note', e.target.value)} placeholder='e.g. Marinate chicken 4h' style={inp(undefined, 'advance_prep_note')}/>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            {label('Base Portions', 'portion_size')}
            <input type='number' min='1' value={f.portion_size} onChange={e => set('portion_size', Math.max(1, Number(e.target.value)))} style={inp(undefined, 'portion_size')}/>
          </div>
          <div style={{ flex: 1 }}>
            {label('Min Portions', 'min_portions')}
            <input type='number' min='1' value={f.min_portions} onChange={e => set('min_portions', Math.max(1, Number(e.target.value)))} style={inp(undefined, 'min_portions')}/>
          </div>
        </div>

        {row('Default Days',
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_DAYS.map(d => (
              <button key={d} onClick={() => toggleDay(d)} style={{ ...mn, padding: '6px 10px', borderRadius: R.pill, border: `1.5px solid ${f.weekdays.includes(d) ? C.primary : C.outlineVariant}`, background: f.weekdays.includes(d) ? C.primary : C.white, color: f.weekdays.includes(d) ? C.onPrimary : C.onSurface, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{DAY_SHORT[d]}</button>
            ))}
          </div>
        )}

        <div style={{ ...CARD, padding: '4px 14px', marginBottom: 16 }}>
          {toggle('try_out', 'Try Out recipe')}
          {toggle('order_out', 'Order Out')}
          {toggle('fun_recipe', 'Fun Recipe (F)')}
          {toggle('husband_approved', 'Husband Approved (H)')}
          {toggle('has_thermomix_version', 'Has Thermomix version')}
        </div>

        {row('Ingredients',
          <textarea value={f.ingredients} onChange={e => set('ingredients', e.target.value)} placeholder={'[Section Name]\n- 200g ingredient\n- 1 tbsp something'} rows={5} style={inp({ resize: 'vertical', lineHeight: 1.5 }, 'ingredients')}/>, 'ingredients'
        )}
        {row('Instructions (Standard)',
          <textarea value={f.instructions_standard} onChange={e => set('instructions_standard', e.target.value)} placeholder='1. Step one&#10;2. Step two' rows={5} style={inp({ resize: 'vertical', lineHeight: 1.5 }, 'instructions_standard')}/>, 'instructions_standard'
        )}
        {row('Instructions (Thermomix)',
          <textarea value={f.instructions_thermomix} onChange={e => set('instructions_thermomix', e.target.value)} placeholder='1. Step one&#10;2. Step two' rows={4} style={inp({ resize: 'vertical', lineHeight: 1.5 }, 'instructions_thermomix')}/>, 'instructions_thermomix'
        )}
        {row('Fridge Storage',
          <input value={f.fridge_storage} onChange={e => set('fridge_storage', e.target.value)} placeholder='e.g. 3 days' style={inp(undefined, 'fridge_storage')}/>, 'fridge_storage'
        )}
        {row('Freezer Storage',
          <input value={f.freezer_storage} onChange={e => set('freezer_storage', e.target.value)} placeholder='e.g. Up to 3 months' style={inp(undefined, 'freezer_storage')}/>, 'freezer_storage'
        )}
        {row('Chef Notes',
          <textarea value={f.chef_notes} onChange={e => set('chef_notes', e.target.value)} rows={3} style={inp({ resize: 'vertical', lineHeight: 1.5 }, 'chef_notes')}/>, 'chef_notes'
        )}
        {row('Husband Variations',
          <textarea value={f.husband_variations} onChange={e => set('husband_variations', e.target.value)} rows={2} style={inp({ resize: 'vertical', lineHeight: 1.5 }, 'husband_variations')}/>, 'husband_variations'
        )}
        {row('Toddler Variations',
          <textarea value={f.toddler_variations} onChange={e => set('toddler_variations', e.target.value)} rows={2} style={inp({ resize: 'vertical', lineHeight: 1.5 }, 'toddler_variations')}/>, 'toddler_variations'
        )}
        {row('Side Recommendation',
          <input value={f.side_recommendation} onChange={e => set('side_recommendation', e.target.value)} placeholder='e.g. Rice or salad' style={inp(undefined, 'side_recommendation')}/>, 'side_recommendation'
        )}
      </div>
    </div>
  )
}

const toolBtn = disabled => ({
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, textAlign: 'left',
  border: `1px solid ${C.outlineVariant}`, background: C.white, borderRadius: R.md, padding: '10px 12px',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
})
