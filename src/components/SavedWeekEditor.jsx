import { useEffect, useMemo, useState } from 'react'
import { C, CARD, ep, mn, R } from '../lib/theme.js'
import { DAY_LBL } from '../lib/dateHelpers.js'
import { sectionInfo, sectionLabel, sectionShort } from '../lib/mealSections.js'
import {
  SAVED_WEEK_NAME_MAX, checkSavedName, savedWeekSummary, savedDayMeals,
  moveSavedMeal, removeSavedMeal, setSavedMealPortion, addSavedMeals,
} from '../lib/savedWeeks.js'
import { useAutosave } from '../lib/autosave.js'
import { useLongPressDrag } from '../lib/useLongPressDrag.js'
import { Btn, Icon } from './ui/index.js'
import { Sheet } from './ui/Sheet.jsx'
import { SectionHeading, RowCard, Row, RowValue, FieldBox, fieldInputStyle, SegPill, ConfirmDialog } from './settings/primitives.jsx'
import { ActionRow } from './SavedWeekSheets.jsx'

// ─── Saved-week editor (Settings › Saved weeks › one week) ────────
// Rename a saved week and change its meals. There's no Save button: every change
// is saved as you go (useAutosave), and the status line under the title says how
// that's going. Meals move between days by press-and-hold drag, as on Home.
//
// `onSave(id, patch)` writes { name?, meals? } and returns the saved row. The
// Manage actions (`onDuplicate`, `onReplaceWithCurrent`, `onDelete`) and
// `onUse(saved, weekOffset)` belong to App. Each gets the latest local copy, after
// any change still waiting has been saved.
//
// `current` is { range, mealCount } for this week, and `weekOptions` the weeks
// "Use for a week" offers: [{ offset, label, range, mealCount }].

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const shortDate = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '')
const errorText = { ...mn, fontSize:13, color:C.error, lineHeight:1.5 }

export function SavedWeekEditor({ saved, all, days, sectionIds, recipes, defPort, current, weekOptions, autoFocusName, onSave, onUse, onDuplicate, onReplaceWithCurrent, onDelete }) {
  const [name, setName] = useState(saved.name)
  const [meals, setMeals] = useState(saved.meals || [])
  const [openId, setOpenId] = useState(null)       // the meal row that's expanded
  const [addingTo, setAddingTo] = useState(null)   // the day the add-meal sheet is for
  const [sheet, setSheet] = useState(null)         // 'use' | 'replace' | 'delete' | null
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const autosave = useAutosave(patch => onSave(saved.id, patch))
  const { error: nameError, clash } = checkSavedName(name, all, saved.id)
  const minFor = meal => recipes.find(r => r.id === meal.recipeId)?.min ?? 1

  // Take on a change made elsewhere (Replace with this week's meals), but never
  // over edits that haven't been saved yet.
  useEffect(() => { if (autosave.idle()) setMeals(saved.meals || []) }, [saved.meals])

  const changeMeals = next => { setMeals(next); autosave.queue({ meals: next }) }
  const changeName = value => {
    setName(value)
    const check = checkSavedName(value, all, saved.id)
    if (!check.error && !check.clash && check.name !== saved.name) autosave.queue({ name: check.name })
  }

  const { dragging, overDay, pressProps } = useLongPressDrag({ onDrop: (item, day) => changeMeals(moveSavedMeal(meals, item.mealId, day)) })

  // The Manage actions and Use work from what's saved, so a change still waiting
  // goes first. If it can't be saved, the action waits for the retry.
  const latest = () => ({ ...saved, name: checkSavedName(name, all, saved.id).error ? saved.name : name.trim(), meals })
  const run = async action => {
    setBusy(true); setActionError(null)
    try {
      await autosave.flush()
      if (!autosave.idle()) throw new Error("Your last change isn't saved yet. Try again first.")
      await action(latest())
      setSheet(null)
    } catch (e) { setActionError(e.message) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setActionError(null)
    autosave.discard()
    try { await onDelete(latest()) }
    catch (e) { setActionError(e.message); setBusy(false) }
  }

  const title = name.trim() || saved.name
  const summary = savedWeekSummary({ meals })

  return (
    <div style={{ padding:'20px 20px 40px' }}>
      <div style={{ ...ep, fontSize:22, color:C.onSurface, marginBottom:4, overflowWrap:'anywhere' }}>{title}</div>
      {autosave.status === 'error' ? (
        <div role='alert' style={{ ...errorText, marginBottom:16 }}>
          Couldn't save that change: {autosave.error}{' '}
          <button onClick={autosave.retry} style={{ ...mn, border:'none', background:'none', padding:0, fontSize:13, fontWeight:700, color:C.error, textDecoration:'underline', cursor:'pointer' }}>Try again</button>
        </div>
      ) : (
        <div role='status' style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
          {autosave.status === 'saved' && <Icon name='check' size={13} color={C.primary}/>}
          {autosave.status === 'saved' ? `Saved · ${summary.toLowerCase()}` : 'Saving…'}
        </div>
      )}

      <FieldBox label='Name' emphasise={!!autoFocusName}>
        <input value={name} maxLength={SAVED_WEEK_NAME_MAX} autoFocus={!!autoFocusName} onChange={e => changeName(e.target.value)}
          onFocus={e => autoFocusName && e.target.select()} aria-label='Saved week name' style={{ ...fieldInputStyle, fontSize:14 }}/>
      </FieldBox>
      {(nameError || clash) && (
        <div role='alert' style={{ ...mn, fontSize:12, color:C.errorInk, marginTop:6 }}>
          {nameError || `You already have a saved week called “${clash.name}”. Pick another name.`}
        </div>
      )}

      <div style={{ margin:'18px 0' }}>
        <Btn label='Use for a week' icon='calendar' full disabled={!meals.length} onClick={() => setSheet('use')}/>
      </div>

      <SectionHeading first sub='Tap a meal to change its servings or take it out. Press and hold a meal to drag it onto another day.'>Meals</SectionHeading>
      {days.map(day => {
        const dayMeals = savedDayMeals(meals, day, sectionIds)
        const isTarget = overDay === day && dragging && dragging.fromDay !== day
        return (
          <div key={day} data-day={day} style={{ marginBottom:14, borderRadius:R.md, outline:isTarget ? `2px solid ${C.primary}` : '2px solid transparent', transition:'outline 0.12s' }}>
            <div style={{ ...ep, fontSize:16, color:C.onSurface, marginBottom:6 }}>{DAY_LBL[day]}</div>
            <div style={{ ...CARD, overflow:'hidden' }}>
              {dayMeals.map((meal, i) => (
                <SavedMealRow key={meal.id} meal={meal} first={i === 0} open={openId === meal.id}
                  hiddenSection={!sectionIds.includes(meal.section)} held={dragging?.mealId === meal.id}
                  pressProps={pressProps({ mealId: meal.id, fromDay: day, section: meal.section })}
                  onToggle={() => setOpenId(id => (id === meal.id ? null : meal.id))}
                  onPortion={n => changeMeals(setSavedMealPortion(meals, meal.id, n, minFor(meal)))}
                  onRemove={() => { setOpenId(null); changeMeals(removeSavedMeal(meals, meal.id)) }}/>
              ))}
              <button onClick={() => setAddingTo(day)} style={{ width:'100%', background:'none', border:'none', padding:'11px 14px', textAlign:'left', ...mn, fontSize:13, color:C.primary, fontWeight:700, cursor:'pointer', borderTop:dayMeals.length ? `1px dashed ${C.outlineVariant}60` : 'none' }}>+ Add meal</button>
            </div>
          </div>
        )
      })}

      <SectionHeading>Manage</SectionHeading>
      <RowCard>
        <Row title='Duplicate' sub='Make a copy to change, and keep this one as it is.' onClick={busy ? undefined : () => run(onDuplicate)}><RowValue/></Row>
        <Row divider title="Replace with this week's meals"
          sub={current.mealCount ? `Swaps these for the ${count(current.mealCount, 'meal')} planned for ${current.range}.` : `Nothing planned for ${current.range} yet.`}
          onClick={current.mealCount && !busy ? () => setSheet('replace') : undefined} style={{ opacity:current.mealCount ? 1 : 0.5 }}><RowValue/></Row>
        <Row divider title='Delete saved week' titleWeight={700} titleColor={C.errorInk} sub='Weeks already filled from it stay as they are.'
          onClick={busy ? undefined : () => setSheet('delete')}><RowValue/></Row>
      </RowCard>
      {actionError && !sheet && <div role='alert' style={{ ...errorText, marginTop:10 }}>{actionError}</div>}
      <div style={{ ...mn, fontSize:12, color:C.onSurfaceVariant, marginTop:14 }}>
        Saved {shortDate(saved.created_at)}{saved.updated_at && saved.updated_at !== saved.created_at ? ` · last changed ${shortDate(saved.updated_at)}` : ''}
      </div>

      {autosave.status === 'error' && (
        <div role='alert' style={{ ...mn, position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', width:'min(398px, calc(100% - 32px))', boxSizing:'border-box', zIndex:30, display:'flex', alignItems:'center', gap:10, background:C.onSurface, color:C.onPrimary, borderRadius:R.lg, padding:'10px 14px', fontSize:13, fontWeight:600, boxShadow:'0 4px 18px rgba(0,0,0,0.18)' }}>
          <Icon name='alertTriangle' size={16} color={C.onPrimary}/>
          <span style={{ flex:1 }}>Your last change isn't saved yet.</span>
          <button onClick={autosave.retry} style={{ ...mn, border:'none', background:'none', padding:'4px 0', color:C.onPrimary, fontSize:13, fontWeight:700, textDecoration:'underline', cursor:'pointer' }}>Try again</button>
        </div>
      )}

      {addingTo && (
        <AddMealSheet day={addingTo} sectionIds={sectionIds} recipes={recipes}
          onAdd={(section, picked) => { changeMeals(addSavedMeals(meals, { day: addingTo, section, recipes: picked, defPort })); setAddingTo(null) }}
          onClose={() => setAddingTo(null)}/>
      )}
      {sheet === 'use' && (
        <Sheet title={`Use “${title}”`} radius={28} swipe busy={busy} onClose={() => setSheet(null)}>
          <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:8 }}>Pick a week. You'll choose there whether to add these meals or replace what's planned.</div>
          {weekOptions.map(w => (
            <ActionRow key={w.offset} icon='calendar' title={w.label} disabled={busy}
              hint={`${w.range} · ${w.mealCount ? `${count(w.mealCount, 'meal')} planned` : 'nothing planned yet'}`}
              onClick={() => run(latestSaved => onUse(latestSaved, w.offset))}/>
          ))}
          {actionError && <div role='alert' style={{ ...errorText, marginTop:8 }}>{actionError}</div>}
        </Sheet>
      )}
      {sheet === 'replace' && (
        <ConfirmDialog radius={28} title={`Replace the meals in “${title}”?`} confirmLabel='Replace meals' busy={busy}
          body={`Its ${count(meals.length, 'meal')} become the ${count(current.mealCount, 'meal')} planned for ${current.range}. The name stays.${actionError ? ` ${actionError}` : ''}`}
          onCancel={() => setSheet(null)}
          onConfirm={() => run(async latestSaved => { const row = await onReplaceWithCurrent(latestSaved); setMeals(row.meals) })}/>
      )}
      {sheet === 'delete' && (
        <ConfirmDialog destructive radius={28} title={`Delete “${title}”?`} confirmLabel='Delete' busy={busy}
          body={`Weeks you've already filled from it stay as they are. You'll have a few seconds to undo this.${actionError ? ` ${actionError}` : ''}`}
          onCancel={() => setSheet(null)} onConfirm={remove}/>
      )}
    </div>
  )
}

// One meal in the editor. The header row opens it on a tap and drags it on a
// press and hold (`pressProps` from useLongPressDrag). Open, it shows the servings
// stepper and Take out.
function SavedMealRow({ meal, first, open, held, hiddenSection, pressProps, onToggle, onPortion, onRemove }) {
  return (
    <div style={{ borderTop:first ? undefined : `1px solid ${C.outlineVariant}25`, opacity:held ? 0.45 : 1, transition:'opacity 0.15s' }}>
      <button {...pressProps} onClick={onToggle} aria-expanded={open}
        style={{ ...mn, width:'100%', border:'none', background:'none', textAlign:'left', padding:'11px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', touchAction:'pan-y', userSelect:'none', WebkitUserSelect:'none', WebkitTouchCallout:'none' }}>
        <span style={{ flex:1, minWidth:0 }}>
          <span style={{ display:'block', fontSize:13, fontWeight:600, color:C.onSurface, marginBottom:3 }}>{meal.name}</span>
          <span style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:C.onSurface, opacity:0.55 }}>{sectionShort(meal.section)}{hiddenSection ? ' (turned off)' : ''}</span>
            {meal.freezerItemId && <span style={{ fontSize:11, fontWeight:700, color:C.primary, background:C.primaryFixed, padding:'2px 7px', borderRadius:R.pill }}>Freezer</span>}
            {!meal.recipeId && !meal.freezerItemId && <span style={{ fontSize:11, color:C.onSurfaceVariant }}>Recipe deleted</span>}
            <span style={{ fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3, background:C.primaryFixed, color:C.primary, padding:'2px 7px', borderRadius:R.pill }}>
              <Icon name='utensilsCrossed' size={11} color={C.primary}/>{meal.portion}
            </span>
          </span>
        </span>
        <span style={{ display:'flex', transform:open ? 'rotate(-90deg)' : 'rotate(90deg)', transition:'transform 0.15s' }}><Icon name='chevronRight' size={14} color={C.outlineStrong}/></span>
      </button>
      {open && (
        <div style={{ margin:'0 14px 12px', padding:12, background:C.primaryFixed, borderRadius:R.md, display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ ...mn, fontSize:12, fontWeight:600, color:C.primary, flex:1 }}>Servings</span>
            <button onClick={() => onPortion(meal.portion - 1)} aria-label='Fewer servings' style={stepButton(false)}><Icon name='minus' size={12} color={C.onSurface}/></button>
            <span style={{ ...mn, fontWeight:700, fontSize:14, minWidth:16, textAlign:'center', color:C.primary, fontVariantNumeric:'tabular-nums' }}>{meal.portion}</span>
            <button onClick={() => onPortion(meal.portion + 1)} aria-label='More servings' style={stepButton(true)}><Icon name='plus' size={12} color={C.onPrimary}/></button>
          </div>
          <button onClick={onRemove} style={{ ...mn, alignSelf:'flex-start', display:'flex', alignItems:'center', gap:6, border:'none', background:'none', padding:0, fontSize:13, fontWeight:700, color:C.errorInk, cursor:'pointer' }}>
            <Icon name='trash' size={14} color={C.errorInk}/>Take out of this saved week
          </button>
        </div>
      )}
    </div>
  )
}

const stepButton = filled => ({ width:28, height:28, borderRadius:R.pill, border:filled ? 'none' : `1px solid ${C.outlineVariant}`, background:filled ? C.primary : C.white, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' })

// Pick recipes for one day of a saved week. Without a search it lists the
// section's own category, as the planner's picker does.
function AddMealSheet({ day, sectionIds, recipes, onAdd, onClose }) {
  const [section, setSection] = useState(() => (sectionIds.includes('main') ? 'main' : sectionIds[0]))
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState([])
  const category = sectionInfo(section).category
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (q ? recipes.filter(r => r.name.toLowerCase().includes(q)) : recipes.filter(r => !category || r.cat === category)).slice(0, 80)
  }, [recipes, search, category])
  const toggle = r => setPicked(list => (list.some(x => x.id === r.id) ? list.filter(x => x.id !== r.id) : [...list, r]))

  return (
    <Sheet title={`Add to ${DAY_LBL[day]}`} radius={28} onClose={onClose}>
      {sectionIds.length > 1 && (
        <div style={{ marginBottom:10, overflowX:'auto' }}>
          <SegPill compact options={sectionIds.map(id => ({ value:id, label:sectionShort(id) }))} value={section} onChange={setSection}/>
        </div>
      )}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search all recipes' aria-label='Search recipes'
        style={{ ...mn, width:'100%', boxSizing:'border-box', fontSize:15, color:C.onSurface, background:C.surfaceContainerHigh, border:'none', outline:'none', borderRadius:R.md, padding:'11px 14px', marginBottom:10 }}/>
      <div style={{ maxHeight:'42vh', overflowY:'auto', margin:'0 -4px 14px' }}>
        {shown.length === 0 && <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, padding:'12px 4px' }}>No recipes match.</div>}
        {shown.map(r => {
          const on = picked.some(x => x.id === r.id)
          return (
            <button key={r.id} onClick={() => toggle(r)} aria-pressed={on}
              style={{ ...mn, width:'100%', border:'none', background:on ? C.primaryFixed : 'none', borderRadius:R.md, textAlign:'left', display:'flex', alignItems:'center', gap:10, padding:'9px 8px', cursor:'pointer' }}>
              <span style={{ width:22, height:22, flexShrink:0, borderRadius:R.pill, border:on ? 'none' : `1.5px solid ${C.outlineVariant}`, background:on ? C.primary : C.white, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {on && <Icon name='check' size={13} color={C.onPrimary}/>}
              </span>
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ display:'block', fontSize:14, fontWeight:600, color:C.onSurface }}>{r.name}</span>
                <span style={{ display:'block', fontSize:11, color:C.onSurfaceVariant }}>{r.cat} · {(r.prep ?? 0) + (r.active ?? 0)} min</span>
              </span>
            </button>
          )
        })}
      </div>
      <Btn label={picked.length ? `Add ${count(picked.length, 'meal')} as ${sectionLabel(section).toLowerCase()}` : 'Pick a recipe'} full disabled={!picked.length} onClick={() => onAdd(section, picked)}/>
    </Sheet>
  )
}
