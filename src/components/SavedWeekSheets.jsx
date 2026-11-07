import { useEffect, useState } from 'react'
import { C, ep, mn, R } from '../lib/theme.js'
import { DAY_LBL } from '../lib/dateHelpers.js'
import { sectionShort } from '../lib/mealSections.js'
import { SAVED_WEEK_NAME_MAX, defaultWeekName, mealsByDay } from '../lib/savedWeeks.js'
import { fetchSavedWeeks, deleteSavedWeek } from '../lib/supabase.js'
import { Btn, Icon, Spinner } from './ui/index.js'
import { Sheet } from './ui/Sheet.jsx'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const ErrorLine = ({ children }) => <div role='alert' style={{ ...mn, fontSize:13, color:C.error, lineHeight:1.5, marginBottom:12 }}>{children}</div>

function ActionRow({ icon, title, hint, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...mn, width:'100%', minHeight:64, border:'none', background:'none', padding:'8px 0', display:'flex', alignItems:'center', gap:14, textAlign:'left', opacity:disabled ? 0.45 : 1, cursor:disabled ? 'default' : 'pointer' }}>
      <span style={{ width:44, height:44, flexShrink:0, borderRadius:R.lg, background:C.primaryFixed, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name={icon} size={20} color={C.primary}/></span>
      <span style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
        <span style={{ fontSize:16, fontWeight:700, color:C.onSurface }}>{title}</span>
        <span style={{ fontSize:13, fontWeight:500, color:C.onSurfaceVariant }}>{hint}</span>
      </span>
    </button>
  )
}

// What the planner's ⋯ button opens, for the week on screen. Past weeks are for
// looking back, so they can be saved or copied but not filled or cleared.
// `copyTargets` is [{ offset, title, hint }], the weeks this one can be copied to.
export function WeekActionsSheet({ label, range, hasMeals, canFill, copyTargets, onCopy, onSave, onFill, onClear, onClose }) {
  return (
    <Sheet label='Week actions' radius={28} swipe onClose={onClose} head={
      <div style={{ marginBottom:8 }}>
        <div style={{ ...ep, fontSize:22, color:C.onSurface }}>{label}</div>
        <div style={{ ...mn, fontSize:14, fontWeight:500, color:C.onSurfaceVariant, marginTop:2 }}>{range}</div>
      </div>
    }>
      <ActionRow icon='bookmark' title='Save week' hint='Reuse this plan in a future week' disabled={!hasMeals} onClick={onSave}/>
      {canFill && <ActionRow icon='copy' title='Fill from a saved week' hint='Add a saved plan to this week' onClick={onFill}/>}
      {copyTargets.map(t => <ActionRow key={t.offset} icon='arrowRight' title={t.title} hint={t.hint} disabled={!hasMeals} onClick={() => onCopy(t.offset)}/>)}
      {canFill && <>
        <div style={{ height:1, background:C.outlineVariant, opacity:0.6, margin:'4px 0' }}/>
        <button onClick={onClear} disabled={!hasMeals} style={{ ...mn, width:'100%', minHeight:52, border:'none', background:'none', padding:'4px 0', display:'flex', alignItems:'center', gap:14, fontSize:16, fontWeight:700, color:C.error, opacity:hasMeals ? 1 : 0.45, cursor:hasMeals ? 'pointer' : 'default' }}>
          <span style={{ width:44, display:'flex', justifyContent:'center', flexShrink:0 }}><Icon name='trash' size={20} color={C.error}/></span>Clear week
        </button>
      </>}
    </Sheet>
  )
}

// Names the week on screen and keeps a copy of it. `onSave` is App's
// saveCurrentWeek, which throws if the save fails.
export function SaveWeekSheet({ week, mealCount, onSave, onClose }) {
  const [name, setName] = useState(() => defaultWeekName(week))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const trimmed = name.trim()

  const save = async e => {
    e.preventDefault()
    if (!trimmed || busy) return
    setBusy(true); setError(null)
    try { await onSave(trimmed); onClose() }
    catch (err) { setError(`Couldn't save it: ${err.message}`); setBusy(false) }
  }

  return (
    <Sheet title='Save this week' radius={28} swipe onClose={onClose} busy={busy}>
      <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:14 }}>
        Keeps a copy of {plural(mealCount, 'meal')} from {week.range}. Changing this week later won't change the copy.
      </div>
      <form onSubmit={save}>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={SAVED_WEEK_NAME_MAX} autoFocus aria-label='Name for this saved week'
          style={{ ...mn, width:'100%', boxSizing:'border-box', fontSize:16, fontWeight:600, color:C.onSurface, background:C.surfaceContainerHigh, border:'none', outline:'none', borderRadius:R.md, padding:'12px 14px', marginBottom:14 }}/>
        {error && <ErrorLine>{error}</ErrorLine>}
        <Btn label={busy ? 'Saving…' : 'Save week'} full disabled={!trimmed || busy} onClick={save}/>
      </form>
    </Sheet>
  )
}

// Picks a saved week, shows what's in it, then fills the week on screen. Loads
// its own list, so a problem with saved weeks never gets in the way of the
// Planner. `onFill(saved, mode)` is App's fillWeek, which throws if it fails.
export function FillWeekSheet({ week, mealCount, onFill, onClose }) {
  const [saved, setSaved] = useState(null)     // the list; null while it loads
  const [picked, setPicked] = useState(null)   // the row being looked at
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSavedWeeks()
      .then(rows => { if (!cancelled) setSaved(rows) })
      .catch(e => { if (!cancelled) { setSaved([]); setError(`Couldn't load your saved weeks: ${e.message}`) } })
    return () => { cancelled = true }
  }, [])

  const fill = async mode => {
    setBusy(true); setError(null)
    try { await onFill(picked, mode); onClose() }
    catch (e) { setError(e.message); setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setError(null)
    try {
      await deleteSavedWeek(picked.id)
      setSaved(rows => rows.filter(r => r.id !== picked.id))
      setPicked(null)
    } catch (e) { setError(`Couldn't delete it: ${e.message}`) }
    setConfirmingDelete(false); setBusy(false)
  }
  const back = () => { setPicked(null); setError(null); setConfirmingDelete(false) }

  if (picked) {
    const days = mealsByDay(picked, week.days)
    return (
      <Sheet radius={28} swipe onClose={onClose} busy={busy}>
        <button onClick={back} disabled={busy} style={{ ...mn, display:'flex', alignItems:'center', gap:6, border:'none', background:'none', padding:0, marginBottom:12, fontSize:13, fontWeight:700, color:C.primary, cursor:'pointer' }}>
          <Icon name='back' size={15} color={C.primary}/>All saved weeks
        </button>
        <div style={{ ...ep, fontSize:19, color:C.onSurface, marginBottom:4 }}>{picked.name}</div>
        <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, marginBottom:14 }}>{plural(picked.meals.length, 'meal')} · going into {week.range}</div>
        <div style={{ marginBottom:16 }}>
          {days.map(({ day, meals }) => (
            <div key={day} style={{ marginBottom:10 }}>
              <div style={{ ...mn, fontSize:12, fontWeight:700, color:C.onSurface, marginBottom:2 }}>{DAY_LBL[day]}</div>
              {meals.map((m, i) => (
                <div key={i} style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, lineHeight:1.5 }}>{m.name} <span style={{ opacity:0.7 }}>· {sectionShort(m.section)}</span></div>
              ))}
            </div>
          ))}
        </div>
        {error && <ErrorLine>{error}</ErrorLine>}
        {mealCount === 0 ? (
          <Btn label={busy ? 'Filling…' : `Fill ${week.range}`} full disabled={busy} onClick={() => fill('add')}/>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <Btn label={busy ? 'Filling…' : 'Add to these meals'} full disabled={busy} onClick={() => fill('add')}/>
            <button onClick={() => fill('replace')} disabled={busy} style={{ ...mn, width:'100%', background:'none', border:`1px solid ${C.errorInk}`, borderRadius:R.pill, padding:'12px', fontSize:15, fontWeight:700, color:C.errorInk, cursor:busy ? 'wait' : 'pointer', opacity:busy ? 0.6 : 1 }}>Replace {plural(mealCount, 'meal')}</button>
          </div>
        )}
        {confirmingDelete ? (
          <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.outlineVariant}40` }}>
            <div style={{ ...mn, fontSize:13, color:C.onSurface, marginBottom:10 }}>Delete this saved week? Weeks already filled from it stay as they are.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmingDelete(false)} disabled={busy} style={{ ...mn, flex:1, border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'10px', fontSize:13, fontWeight:700, color:C.onSurface, cursor:'pointer' }}>Keep it</button>
              <button onClick={remove} disabled={busy} style={{ ...mn, flex:1, border:'none', background:C.errorInk, borderRadius:R.pill, padding:'10px', fontSize:13, fontWeight:700, color:'#fff', cursor:busy ? 'wait' : 'pointer', opacity:busy ? 0.7 : 1 }}>{busy ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmingDelete(true)} disabled={busy} style={{ ...mn, display:'block', margin:'14px auto 0', border:'none', background:'none', padding:4, fontSize:12, fontWeight:600, color:C.onSurfaceVariant, textDecoration:'underline', cursor:'pointer' }}>Delete this saved week</button>
        )}
      </Sheet>
    )
  }

  return (
    <Sheet title={`Fill ${week.range}`} radius={28} swipe onClose={onClose}>
      {error && <ErrorLine>{error}</ErrorLine>}
      {saved === null ? <Spinner msg='Loading your saved weeks…'/>
        : saved.length === 0 ? (!error && <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, lineHeight:1.6, padding:'4px 0 8px' }}>Nothing saved yet. Open a week you liked and tap Save week, and it'll be here ready to use.</div>)
        : saved.map(s => (
          <button key={s.id} onClick={() => { setPicked(s); setError(null) }} style={{ ...mn, width:'100%', display:'flex', alignItems:'center', gap:10, textAlign:'left', border:'none', background:C.surfaceContainerHigh, borderRadius:R.md, padding:'12px 14px', marginBottom:8, cursor:'pointer' }}>
            <span style={{ flex:1, minWidth:0 }}>
              <span style={{ display:'block', fontSize:14, fontWeight:700, color:C.onSurface, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
              <span style={{ display:'block', fontSize:12, color:C.onSurfaceVariant, marginTop:2 }}>{plural(s.meals.length, 'meal')}</span>
            </span>
            <Icon name='chevronRight' size={16} color={C.onSurfaceVariant}/>
          </button>
        ))}
    </Sheet>
  )
}
