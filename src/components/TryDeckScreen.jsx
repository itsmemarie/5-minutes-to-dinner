import { useEffect, useMemo, useState } from 'react'
import { C, ep, mn, R } from '../lib/theme.js'
import {
  FLY_OUT_MS, SNOOZE_WEEKS, buildDeck, deckCaption, emptyTitle, hiddenCount, keepPatch,
  passOutcome, pickWeek, picksInWeek, removePatch, undoPatch, yesSheet,
} from '../lib/tryDeck.js'
import { Btn, Icon, PillBtn } from './ui/index.js'
import { RecipeScreen } from './RecipeScreen.jsx'
import { TryCard } from './TryCard.jsx'
import { RemoveSheet, YesSheet } from './TryDeckSheets.jsx'

// Chosen once a session, so the deck's order holds until the app is reopened.
const SESSION_SEED = Math.floor(Math.random() * 2 ** 32)

const SAVE_FAILED = "Couldn't save that. Try again."
const HIDDEN_TOAST = `Hidden for ${SNOOZE_WEEKS} weeks`

function RoundButton({ size, label, caption, onClick, disabled, background, border, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:72 }}>
      <button onClick={disabled ? undefined : onClick} aria-label={label} aria-disabled={disabled || undefined}
        style={{ width:size, height:size, borderRadius:R.pill, background, border: border ? `2px solid ${border}` : 'none', display:'flex', alignItems:'center', justifyContent:'center', padding:0, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : '0 2px 6px rgba(24,36,23,0.16)' }}>
        {children}
      </button>
      {caption && <span style={{ ...mn, fontSize:12, fontWeight:600, color:C.onSurfaceVariant }}>{caption}</span>}
    </div>
  )
}

// The recipe, full screen over the deck. An overlay rather than a screen change,
// because leaving the deck would lose its place and its one level of undo.
function RecipePreview({ recipe, onBack, onNotNow, onAdd, ...recipeProps }) {
  const [portion, setPortion] = useState(recipeProps.defPort)
  return (
    <div style={{ position:'fixed', top:0, bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:430, zIndex:50, background:C.white, display:'flex', flexDirection:'column' }}>
      <div style={{ background:C.primary, padding:'16px 20px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <button onClick={onBack} aria-label='Back to the deck' style={{ border:'none', background:'none', cursor:'pointer', padding:'2px 8px 2px 0', display:'flex', alignItems:'center' }}><Icon name='back' color={C.onPrimary}/></button>
        <span style={{ ...ep, fontSize:16, color:C.onPrimary, flex:1 }}>Recipe details</span>
      </div>
      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        <RecipeScreen key={recipe.id} recipeId={recipe.id} portion={portion} onPortionChange={setPortion} toddlerDob={null}
          showToddlerVariations={recipeProps.showToddlerVariations} goalProfile={recipeProps.goalProfile} goalTargets={recipeProps.goalTargets}
          nutritionByRecipe={recipeProps.nutritionByRecipe} sectionIds={recipeProps.sectionIds} onPhotoChange={recipeProps.onPhotoChange} onLinkChange={recipeProps.onLinkChange}/>
      </div>
      <div style={{ display:'flex', gap:10, padding:'12px 20px calc(12px + env(safe-area-inset-bottom))', flexShrink:0, background:C.white, borderTop:`1px solid ${C.outlineVariant}40` }}>
        <Btn label='Not now' secondary strong onClick={onNotNow}/>
        <div style={{ flex:1, minWidth:0 }}><Btn label='Add to this week' full onClick={onAdd}/></div>
      </div>
    </div>
  )
}

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
  const [fly, setFly] = useState(null)           // { id, dir } while a card leaves
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState(null)       // { kind:'yes', sheet } | { kind:'remove', recipe }
  const [undo, setUndo] = useState(null)         // { pick?, before? }
  const [preview, setPreview] = useState(null)
  const [playingId, setPlayingId] = useState(null)
  const [deadVideos, setDeadVideos] = useState(() => new Set())

  const filters = { sides, recent }
  const deck = useMemo(() => buildDeck(recipes, picks, { order, sides, recent, seed:SESSION_SEED }), [recipes, picks, order, sides, recent])
  const current = deck[0]

  // A reel with no still yet gets one the first time its card comes up.
  const needsStill = !!current?.sourcePlatform && !current.videoThumbUrl
  useEffect(() => { if (needsStill) onNeedStill(current.id) }, [current?.id, needsStill])

  // The card leaves first, then the write runs. If it fails the card comes back.
  const flyThen = (recipe, dir, commit) => {
    setBusy(true)
    setFly({ id:recipe.id, dir })
    setTimeout(async () => {
      try {
        await commit()
      } catch (e) {
        console.error('deck action failed', e)
        showToast(SAVE_FAILED)
      }
      setFly(null)
      setBusy(false)
    }, FLY_OUT_MS)
  }

  const saveAndToast = async (recipe, patch, message) => {
    await onDeckState(recipe, patch)
    setUndo({ before:recipe })
    showToast(message)
  }

  const act = (dir, recipe = current) => {
    if (!recipe || busy) return
    showToast(null)
    setPlayingId(null)
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

  const fromPreview = dir => {
    const recipe = preview
    setPreview(null)
    act(dir, recipe)
  }

  return (
    <div style={{ paddingTop:12, display:'flex', flexDirection:'column', flex:1 }}>
      <div data-deck-filters style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 16px 8px', scrollbarWidth:'none', flexShrink:0 }}>
        <PillBtn label='Newest first' icon='arrowDownWideNarrow' iconSize={14} strong active={order === 'newest'} onClick={() => setOrder('newest')}/>
        <PillBtn label='Shuffle' icon='shuffle' iconSize={14} strong active={order === 'shuffle'} onClick={() => setOrder('shuffle')}/>
        <PillBtn label='Last 30 days' icon='calendar' iconSize={14} strong active={recent} onClick={() => setRecent(on => !on)}/>
        <PillBtn label='Sides' icon='salad' iconSize={14} strong active={sides} onClick={() => setSides(on => !on)}/>
      </div>

      {current ? (
        <>
          <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, padding:'0 16px 10px' }}>{deckCaption(deck.length, filters)}</div>
          <div style={{ position:'relative', margin:'0 16px 18px' }}>
            {deck[1] && <TryCard key={`behind-${deck[1].id}`} recipe={deck[1]} behind/>}
            <TryCard key={current.id} recipe={current} showToddler={showToddler} flyOut={fly?.id === current.id ? fly.dir : null}
              playing={playingId === current.id} unavailable={deadVideos.has(current.id)}
              onSwipe={act} onViewRecipe={() => setPreview(current)} onPlay={() => setPlayingId(current.id)} onStopVideo={() => setPlayingId(null)}
              onVideoUnavailable={() => { setPlayingId(null); setDeadVideos(prev => new Set(prev).add(current.id)) }}/>
          </div>
          {/* Sticks to the bottom so the buttons stay reachable on a short screen,
              where the card is taller than the space left for it. */}
          <div style={{ position:'sticky', bottom:0, zIndex:1, marginTop:'auto', background:C.white, display:'flex', alignItems:'flex-start', justifyContent:'center', gap:18, padding:'10px 0 calc(12px + env(safe-area-inset-bottom))' }}>
            <RoundButton size={64} label='Not now' caption='Not now' background={C.white} border={C.accent2_300} onClick={() => act('left')}>
              <Icon name='x' size={28} color={C.accent2_700}/>
            </RoundButton>
            <div style={{ paddingTop:10 }}>
              <RoundButton size={44} label='Undo' disabled={!undo} background={undo ? C.white : C.surfaceContainerHigh} border={undo ? C.outlineVariant : null} onClick={runUndo}>
                <Icon name='rotateCcw' size={20} color={undo ? C.onSurface : C.outlineVariant}/>
              </RoundButton>
            </div>
            <RoundButton size={64} label='Yes' caption='Yes' background={C.primary} onClick={() => act('right')}>
              <Icon name='check' size={30} color={C.onPrimary}/>
            </RoundButton>
          </div>
        </>
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'32px 28px' }}>
          <img src='/dino-logo.png' alt='' style={{ width:88, height:88, objectFit:'contain', marginBottom:14 }}/>
          <div style={{ ...ep, fontSize:21, color:C.onSurface, marginBottom:6 }}>{emptyTitle(filters)}</div>
          <div style={{ ...mn, fontSize:14, color:C.onSurfaceVariant, marginBottom:20 }}>{hiddenCount(recipes, picks, filters)} hidden for later.</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
            <Btn label='Undo last' secondary strong small disabled={!undo} onClick={runUndo}/>
            <Btn label='Back to planner' small onClick={onDone}/>
          </div>
        </div>
      )}

      {preview && <RecipePreview recipe={preview} {...recipeProps} onBack={() => setPreview(null)} onNotNow={() => fromPreview('left')} onAdd={() => fromPreview('right')}/>}
      {sheet?.kind === 'yes' && <YesSheet sheet={sheet.sheet} onDone={onDone} onKeepGoing={() => setSheet(null)}/>}
      {sheet?.kind === 'remove' && <RemoveSheet recipe={sheet.recipe} onKeep={() => keep(sheet.recipe)} onRemove={() => remove(sheet.recipe)} onClose={() => setSheet(null)}/>}
    </div>
  )
}
