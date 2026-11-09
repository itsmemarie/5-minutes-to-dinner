import { useEffect, useState } from 'react'
import { C, ep, mn, R } from '../lib/theme.js'
import { FLY_OUT_MS } from '../lib/tryDeck.js'
import { Btn, Icon } from './ui/index.js'
import { RecipeScreen } from './RecipeScreen.jsx'
import { TryCard } from './TryCard.jsx'

// The card leaves first, then `commit` runs. If it throws, `onError` hears about
// it and the card comes back. `busy` is true from the swipe until the commit ends.
export function useFlyOut(onError) {
  const [fly, setFly] = useState(null)           // { id, dir } while a card leaves
  const [busy, setBusy] = useState(false)
  const flyThen = (recipe, dir, commit) => {
    setBusy(true)
    setFly({ id:recipe.id, dir })
    setTimeout(async () => {
      try {
        await commit()
      } catch (e) {
        console.error('deck action failed', e)
        onError(e)
      }
      setFly(null)
      setBusy(false)
    }, FLY_OUT_MS)
  }
  return { fly, busy, setBusy, flyThen }
}

function RoundButton({ size, label, caption, onClick, disabled, background, border, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:caption && caption.length > 8 ? 96 : 72 }}>
      <button onClick={disabled ? undefined : onClick} aria-label={label} aria-disabled={disabled || undefined}
        style={{ width:size, height:size, borderRadius:R.pill, background, border: border ? `2px solid ${border}` : 'none', display:'flex', alignItems:'center', justifyContent:'center', padding:0, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : '0 2px 6px rgba(24,36,23,0.16)' }}>
        {children}
      </button>
      {caption && <span style={{ ...mn, fontSize:12, fontWeight:600, color:C.onSurfaceVariant, whiteSpace:'nowrap' }}>{caption}</span>}
    </div>
  )
}

// The recipe, full screen over the deck. An overlay rather than a screen change,
// because leaving the deck would lose its place and its undo.
function RecipePreview({ recipe, addLabel, onBack, onNotNow, onAdd, ...recipeProps }) {
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
        <div style={{ flex:1, minWidth:0 }}><Btn label={addLabel} full onClick={onAdd}/></div>
      </div>
    </div>
  )
}

// The card stack and its Not now / Undo / Yes buttons. It only shows and reports:
// `onSwipe(dir, recipe)` decides what a swipe means ('left' is Not now, 'right'
// is Yes), and `fly` (from useFlyOut) sends the top card off. `empty` shows when
// `deck` runs out. The home deck and the picker's deck both use it.
export function SwipeDeck({ deck, caption, fly, onSwipe, undo, yesCaption = 'Yes', addLabel = 'Add to this week', showToddler, onNeedStill, recipeProps, empty }) {
  const [preview, setPreview] = useState(null)
  const [playingId, setPlayingId] = useState(null)
  const [deadVideos, setDeadVideos] = useState(() => new Set())
  const current = deck[0]

  // A reel with no still yet gets one the first time its card comes up.
  const needsStill = !!onNeedStill && !!current?.sourcePlatform && !current.videoThumbUrl
  useEffect(() => { if (needsStill) onNeedStill(current.id) }, [current?.id, needsStill])

  const swipe = (dir, recipe = current) => {
    if (!recipe) return
    setPlayingId(null)
    onSwipe(dir, recipe)
  }
  const fromPreview = dir => {
    const recipe = preview
    setPreview(null)
    swipe(dir, recipe)
  }

  return (
    <>
      {current ? (
        <>
          <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, padding:'0 16px 10px' }}>{caption}</div>
          <div style={{ position:'relative', margin:'0 16px 18px' }}>
            {deck[1] && <TryCard key={`behind-${deck[1].id}`} recipe={deck[1]} behind/>}
            <TryCard key={current.id} recipe={current} showToddler={showToddler} flyOut={fly?.id === current.id ? fly.dir : null}
              playing={playingId === current.id} unavailable={deadVideos.has(current.id)}
              onSwipe={dir => swipe(dir)} onViewRecipe={() => setPreview(current)} onPlay={() => setPlayingId(current.id)} onStopVideo={() => setPlayingId(null)}
              onVideoUnavailable={() => { setPlayingId(null); setDeadVideos(prev => new Set(prev).add(current.id)) }}/>
          </div>
          {/* Sticks to the bottom so the buttons stay reachable on a short screen,
              where the card is taller than the space left for it. */}
          <div style={{ position:'sticky', bottom:0, zIndex:1, marginTop:'auto', background:C.white, display:'flex', alignItems:'flex-start', justifyContent:'center', gap:18, padding:'10px 0 calc(12px + env(safe-area-inset-bottom))' }}>
            <RoundButton size={64} label='Not now' caption='Not now' background={C.white} border={C.accent2_300} onClick={() => swipe('left')}>
              <Icon name='x' size={28} color={C.accent2_700}/>
            </RoundButton>
            <div style={{ paddingTop:10 }}>
              <RoundButton size={44} label='Undo' disabled={!undo.enabled} background={undo.enabled ? C.white : C.surfaceContainerHigh} border={undo.enabled ? C.outlineVariant : null} onClick={undo.onClick}>
                <Icon name='rotateCcw' size={20} color={undo.enabled ? C.onSurface : C.outlineVariant}/>
              </RoundButton>
            </div>
            <RoundButton size={64} label={yesCaption} caption={yesCaption} background={C.primary} onClick={() => swipe('right')}>
              <Icon name='check' size={30} color={C.onPrimary}/>
            </RoundButton>
          </div>
        </>
      ) : empty}

      {preview && <RecipePreview recipe={preview} addLabel={addLabel} {...recipeProps} onBack={() => setPreview(null)} onNotNow={() => fromPreview('left')} onAdd={() => fromPreview('right')}/>}
    </>
  )
}
