import { useMemo, useState } from 'react'
import { C, ep, mn, R } from '../lib/theme.js'
import { DAY_LBL } from '../lib/dateHelpers.js'
import {
  NO_PILLS, POOL_PILLS, START, addedCount, addedToast, deckStep, pickerCaption, pickerDeckCards,
  pillActive, poolTitle, tapPill, waitingInAdd,
} from '../lib/pickerDeck.js'
import { useBackToClose } from '../lib/useBackToClose.js'
import { Btn, Icon, PillBtn } from './ui/index.js'
import { SwipeDeck, useFlyOut } from './SwipeDeck.jsx'

// Chosen once a session, like the home deck's, so Shuffle holds its order.
const SESSION_SEED = Math.floor(Math.random() * 2 ** 32)

// The swipe deck over one picker bucket. It covers the picker (and the tab bar,
// as the home deck does) without leaving it, so the ticked recipes, the search
// and the chip are all still there on the way back.
//
// A Yes ticks the recipe through `setSelected`, the same list the bucket rows
// use. A Not now only skips it for now. Nothing here touches the database.
export function PickerDeck({ pool, items, day, selected, setSelected, showToast, showToddler, recipeProps, onClose }) {
  const [session, setSession] = useState(START)
  const [pills, setPills] = useState(NO_PILLS)
  const { fly, busy, flyThen } = useFlyOut(() => {})
  useBackToClose(true, onClose)

  const deck = useMemo(() => pickerDeckCards(items, { selected, skipped:session.skipped, pills, seed:SESSION_SEED, top:session.top }),
    [items, selected, session, pills])

  // Applies one step, and its tick or untick in the picker.
  const step = action => {
    const out = deckStep(session, action)
    setSession(out.state)
    if (out.select) {
      const next = selected.includes(out.select) ? selected : [...selected, out.select]
      setSelected(next)
      showToast(addedToast(day, next.length))
    }
    if (out.unselect) setSelected(selected.filter(id => id !== out.unselect))
    return out
  }

  const act = (dir, recipe) => {
    if (busy) return
    showToast(null)
    flyThen(recipe, dir, () => { step({ type: dir === 'right' ? 'yes' : 'skip', id: recipe.id }) })
  }
  const undo = () => {
    if (busy || !session.history.length) return
    step({ type:'undo' })
    showToast('Undone')
  }

  const poolPills = POOL_PILLS[pool] || []
  const dayName = DAY_LBL[day] || day

  return (
    <div role='dialog' aria-modal='true' aria-label={poolTitle(pool, day)}
      style={{ position:'fixed', top:0, bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:430, zIndex:30, background:C.white, display:'flex', flexDirection:'column', ...mn }}>
      {/* The app's top bar, as it looks over the home deck. */}
      <div style={{ background:C.primary, padding:'16px 20px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <button onClick={onClose} aria-label='Back to the picker' style={{ border:'none', background:'none', color:C.onPrimary, cursor:'pointer', padding:'2px 8px 2px 0', display:'flex', alignItems:'center' }}><Icon name='back' color={C.onPrimary}/></button>
        <span style={{ ...ep, fontSize:19, letterSpacing:'0.005em', color:C.onPrimary, flex:1 }}>{poolTitle(pool, day)}</span>
        <span style={{ ...mn, fontSize:12, fontWeight:700, color:C.onPrimary, background:'rgba(255,255,255,0.16)', padding:'5px 12px', borderRadius:R.pill, whiteSpace:'nowrap' }}>{addedCount(session)} added</span>
      </div>

      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <div style={{ paddingTop:12, display:'flex', flexDirection:'column', flex:1 }}>
          {poolPills.length > 0 && (
            <div data-deck-filters style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 16px 8px', scrollbarWidth:'none', flexShrink:0 }}>
              {poolPills.map(p => <PillBtn key={p.id} label={p.label} icon={p.icon} iconSize={14} strong active={pillActive(pills, p)} onClick={() => setPills(prev => tapPill(prev, p))}/>)}
            </div>
          )}

          <SwipeDeck deck={deck} caption={pickerCaption(deck.length)} fly={fly} onSwipe={act}
            undo={{ enabled:session.history.length > 0, onClick:undo }}
            yesCaption={`Add to ${dayName}`} addLabel={`Add to ${dayName}`}
            showToddler={showToddler} recipeProps={recipeProps}
            empty={(
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'32px 28px' }}>
                <img src='/dino-logo.png' alt='' style={{ width:88, height:88, objectFit:'contain', marginBottom:14 }}/>
                <div style={{ ...ep, fontSize:21, color:C.onSurface, marginBottom:6 }}>That's everything here</div>
                <div style={{ ...mn, fontSize:14, color:C.onSurfaceVariant, marginBottom:20 }}>{waitingInAdd(selected.length)}</div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
                  <Btn label='Start again' secondary strong small onClick={() => { setSession(START); setPills(NO_PILLS) }}/>
                  <Btn label='Back to picker' small onClick={onClose}/>
                </div>
              </div>
            )}/>
        </div>
      </div>
    </div>
  )
}
