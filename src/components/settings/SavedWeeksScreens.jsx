import { useState } from 'react'
import { C, CARD, ep, mn, R } from '../../lib/theme.js'
import { savedWeekSummary, savedWeekPreview } from '../../lib/savedWeeks.js'
import { Btn, Icon, Spinner } from '../ui/index.js'
import { Sheet } from '../ui/Sheet.jsx'
import { ActionRow } from '../SavedWeekSheets.jsx'
import { RowCard, Row, RowValue } from './primitives.jsx'

// ─── Settings › Saved weeks ───────────────────────────────────────
// The row on the main Settings screen, and the list it opens. Each saved week
// opens in SavedWeekEditor.

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const shortDate = iso => (iso ? new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '')

// `savedCount` is null while the list loads.
export function SavedWeeksRow({ savedCount, onOpen }) {
  return (
    <RowCard>
      <Row title='Saved weeks' sub='Reuse a week you liked: fill any week from it, or add it to what you have.' onClick={onOpen}>
        <RowValue>{savedCount == null ? '…' : savedCount === 0 ? 'None' : `${savedCount} saved`}</RowValue>
      </Row>
    </RowCard>
  )
}

// `saved` is the list, most recently changed first, or null while it loads.
// `current` is { range, mealCount } for this week. `onCreate('current' | 'empty')`
// makes a saved week and opens it; it throws if that fails.
export function SavedWeeksScreen({ saved, loadError, onRetry, days, current, onOpen, onCreate }) {
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const create = async from => {
    setBusy(true); setError(null)
    try { await onCreate(from); setCreating(false) }
    catch (e) { setError(`Couldn't make it: ${e.message}`) }
    finally { setBusy(false) }
  }

  return (
    <div style={{ padding:'20px 20px 40px' }}>
      <div style={{ ...ep, fontSize:22, color:C.onSurface, marginBottom:4 }}>Saved weeks</div>
      <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:16 }}>
        Weeks you've kept to use again. Open one to rename it or change its meals, or use it to fill a week in the planner.
      </div>
      <div style={{ marginBottom:18 }}>
        <Btn label='New saved week' icon='plus' full onClick={() => setCreating(true)}/>
      </div>

      {loadError ? (
        <div style={{ ...CARD, padding:'18px 16px', textAlign:'center' }}>
          <div role='alert' style={{ ...mn, fontSize:13, color:C.error, lineHeight:1.5, marginBottom:12 }}>Couldn't load your saved weeks: {loadError}</div>
          <Btn label='Try again' secondary small onClick={onRetry}/>
        </div>
      ) : saved === null ? (
        <Spinner msg='Loading your saved weeks…'/>
      ) : saved.length === 0 ? (
        <div style={{ ...CARD, padding:'26px 18px', display:'flex', flexDirection:'column', alignItems:'center', gap:8, textAlign:'center' }}>
          <Icon name='bookmark' size={26} color={C.outlineVariant}/>
          <div style={{ ...mn, fontSize:14, fontWeight:700, color:C.onSurface }}>Nothing saved yet</div>
          <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, lineHeight:1.6 }}>Plan a week you like, then tap ⋯ › Save week in the planner. Or start one here.</div>
        </div>
      ) : saved.map(s => (
        <button key={s.id} onClick={() => onOpen(s.id)}
          style={{ ...CARD, ...mn, width:'100%', border:'none', textAlign:'left', display:'flex', alignItems:'center', gap:12, padding:'14px 14px 14px 16px', marginBottom:10, cursor:'pointer' }}>
          <span style={{ width:40, height:40, flexShrink:0, borderRadius:R.lg, background:C.primaryFixed, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon name='calendar' size={18} color={C.primary}/>
          </span>
          <span style={{ flex:1, minWidth:0 }}>
            <span style={{ display:'block', fontSize:15, fontWeight:700, color:C.onSurface, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
            <span style={{ display:'block', fontSize:12, color:C.onSurfaceVariant, marginTop:2 }}>{savedWeekSummary(s)} · edited {shortDate(s.updated_at || s.created_at)}</span>
            {s.meals.length > 0 && <span style={{ display:'block', fontSize:12, color:C.onSurfaceVariant, opacity:0.8, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{savedWeekPreview(s, days)}</span>}
          </span>
          <Icon name='chevronRight' size={16} color={C.outlineStrong} strokeWidth={2.5}/>
        </button>
      ))}

      {creating && (
        <Sheet title='New saved week' radius={28} swipe busy={busy} onClose={() => setCreating(false)}>
          <ActionRow icon='copy' title="Start from this week's plan" disabled={busy || !current.mealCount}
            hint={current.mealCount ? `${count(current.mealCount, 'meal')} from ${current.range}` : `Nothing planned for ${current.range} yet`}
            onClick={() => create('current')}/>
          <ActionRow icon='plus' title='Start with an empty week' hint='Add meals day by day' disabled={busy} onClick={() => create('empty')}/>
          {error && <div role='alert' style={{ ...mn, fontSize:13, color:C.error, marginTop:8 }}>{error}</div>}
        </Sheet>
      )}
    </div>
  )
}
