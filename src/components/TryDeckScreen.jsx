import { useMemo, useState } from 'react'
import { C, ep, mn } from '../lib/theme.js'
import {
  SNOOZE_WEEKS, buildDeck, deckCaption, emptyTitle, hiddenCount, keepPatch,
  passOutcome, pickWeek, picksInWeek, removePatch, undoPatch, yesSheet,
} from '../lib/tryDeck.js'
import { Btn, PillBtn } from './ui/index.js'
import { SwipeDeck, useFlyOut } from './SwipeDeck.jsx'
import { RemoveSheet, YesSheet } from './TryDeckSheets.jsx'

// Chosen once a session, so the deck's order holds until the app is reopened.
const SESSION_SEED = Math.floor(Math.random() * 2 ** 32)

const SAVE_FAILED = "Couldn't save that. Try again."
const HIDDEN_TOAST = `Hidden for ${SNOOZE_WEEKS} weeks`

// One card at a time from the try-out recipes. A Yes adds a pick for this week
// and a Not now snoozes the recipe; neither asks for a day, because the planner's
// tray does that. See tryDeck.js for the rules.
//
// `onPick(recipe, weekOf)` resolves to the new pick, `onRemovePick(pick)` undoes
// one, and `onDeckState(recipe, patch)` saves skips, snoozes and archiving. All
// three reject on failure, and the card then stays where it was.
export function TryDeckScreen({ recipes, picks, weekStartsOn, target, showToddler, onPick, onRemovePick, onDeckState, onNeedStill, onDone, showToast, recipeProps }) {
  const [order, setOrder] = useState('newest')
  const [recent, setRecent] = useState(false)
  const [sides, setSides] = useState(false)
  const { fly, busy, setBusy, flyThen } = useFlyOut(() => showToast(SAVE_FAILED))
  const [sheet, setSheet] = useState(null)       // { kind:'yes', sheet } | { kind:'remove', recipe }
  const [undo, setUndo] = useState(null)         // { pick?, before? }

  const filters = { sides, recent }
  const deck = useMemo(() => buildDeck(recipes, picks, { order, sides, recent, seed:SESSION_SEED }), [recipes, picks, order, sides, recent])

  const saveAndToast = async (recipe, patch, message) => {
    await onDeckState(recipe, patch)
    setUndo({ before:recipe })
    showToast(message)
  }

  const act = (dir, recipe) => {
    if (!recipe || busy) return
    showToast(null)
    if (dir === 'left') {
      const outcome = passOutcome(recipe)
      if (outcome.ask) setSheet({ kind:'remove', recipe })
      else flyThen(recipe, 'left', () => saveAndToast(recipe, outcome.patch, HIDDEN_TOAST))
      return
    }
    flyThen(recipe, 'right', async () => {
      const week = pickWeek(weekStartsOn)
      const pick = await onPick(recipe, week.weekOf)
      setUndo({ pick })
      setSheet({ kind:'yes', sheet:yesSheet(picksInWeek(picks, week.weekOf).length + 1, target) })
    })
  }

  const keep = recipe => {
    setSheet(null)
    flyThen(recipe, 'left', () => saveAndToast(recipe, keepPatch(), `Kept · hidden for ${SNOOZE_WEEKS} weeks`))
  }
  const remove = recipe => {
    setSheet(null)
    flyThen(recipe, 'left', () => saveAndToast(recipe, removePatch(), 'Removed from your recipes'))
  }

  const runUndo = async () => {
    if (!undo || busy) return
    setBusy(true)
    try {
      if (undo.pick) await onRemovePick(undo.pick)
      if (undo.before) await onDeckState(undo.before, undoPatch(undo.before))
      setUndo(null)
      showToast('Undone')
    } catch (e) {
      console.error('undo failed', e)
      showToast(SAVE_FAILED)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ paddingTop:12, display:'flex', flexDirection:'column', flex:1 }}>
      <div data-deck-filters style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 16px 8px', scrollbarWidth:'none', flexShrink:0 }}>
        <PillBtn label='Newest first' icon='arrowDownWideNarrow' iconSize={14} strong active={order === 'newest'} onClick={() => setOrder('newest')}/>
        <PillBtn label='Shuffle' icon='shuffle' iconSize={14} strong active={order === 'shuffle'} onClick={() => setOrder('shuffle')}/>
        <PillBtn label='Last 30 days' icon='calendar' iconSize={14} strong active={recent} onClick={() => setRecent(on => !on)}/>
        <PillBtn label='Sides' icon='salad' iconSize={14} strong active={sides} onClick={() => setSides(on => !on)}/>
      </div>

      <SwipeDeck deck={deck} caption={deckCaption(deck.length, filters)} fly={fly} onSwipe={act} undo={{ enabled:!!undo, onClick:runUndo }}
        showToddler={showToddler} onNeedStill={onNeedStill} recipeProps={recipeProps}
        empty={(
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'32px 28px' }}>
            <img src='/dino-logo.png' alt='' style={{ width:88, height:88, objectFit:'contain', marginBottom:14 }}/>
            <div style={{ ...ep, fontSize:21, color:C.onSurface, marginBottom:6 }}>{emptyTitle(filters)}</div>
            <div style={{ ...mn, fontSize:14, color:C.onSurfaceVariant, marginBottom:20 }}>{hiddenCount(recipes, picks, filters)} hidden for later.</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
              <Btn label='Undo last' secondary strong small disabled={!undo} onClick={runUndo}/>
              <Btn label='Back to planner' small onClick={onDone}/>
            </div>
          </div>
        )}/>

      {sheet?.kind === 'yes' && <YesSheet sheet={sheet.sheet} onDone={onDone} onKeepGoing={() => setSheet(null)}/>}
      {sheet?.kind === 'remove' && <RemoveSheet recipe={sheet.recipe} onKeep={() => keep(sheet.recipe)} onRemove={() => remove(sheet.recipe)} onClose={() => setSheet(null)}/>}
    </div>
  )
}
