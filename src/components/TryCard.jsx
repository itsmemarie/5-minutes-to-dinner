import { useRef, useState } from 'react'
import { C, ep, mn, R } from '../lib/theme.js'
import { FLY_OUT_MS, ROTATE_DIVISOR, SWIPE_THRESHOLD, TAP_SLOP, deckName, savedLabel, totalMinutes } from '../lib/tryDeck.js'
import { Icon } from './ui/index.js'

const PLATFORM = { instagram:'Instagram', tiktok:'TikTok' }
const MEDIA_HEIGHT = 300
const onPhoto = `${C.onSurface}cc`

const Chip = ({ icon, children, style }) => (
  <span style={{ ...mn, display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:C.onSurfaceVariant, whiteSpace:'nowrap', ...style }}>
    {icon && <Icon name={icon} size={13} color={C.onSurfaceVariant}/>}
    {children}
  </span>
)

const PhotoChip = ({ style, children }) => (
  <span style={{ ...mn, position:'absolute', top:10, fontSize:11, fontWeight:700, color:C.onPrimary, background:onPhoto, borderRadius:R.pill, padding:'4px 9px', ...style }}>{children}</span>
)

const Stamp = ({ text, color, opacity, style }) => (
  <span aria-hidden style={{ ...mn, position:'absolute', top:56, fontSize:22, fontWeight:700, letterSpacing:'0.04em', color, background:C.white, border:`3px solid ${color}`, borderRadius:R.sm, padding:'4px 10px', opacity, pointerEvents:'none', ...style }}>{text}</span>
)

function Media({ recipe, dx, flyOut }) {
  // The reel's still, then the recipe photo, then stripes, each if the last fails.
  const sources = [recipe.videoThumbUrl, recipe.imageUrl].filter(Boolean)
  const [failed, setFailed] = useState(0)
  const src = sources[failed]
  const reel = PLATFORM[recipe.sourcePlatform]
  const strength = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD)
  const yes = flyOut === 'right' ? 1 : dx > 0 ? strength : 0
  const no = flyOut === 'left' ? 1 : dx < 0 ? strength : 0

  return (
    <div style={{ position:'relative', height:MEDIA_HEIGHT, flexShrink:0, background:`repeating-linear-gradient(135deg,${C.placeholderStripeA} 0 6px,${C.placeholderStripeB} 6px 12px)` }}>
      {src && <img src={src} alt='' draggable={false} decoding='async' onError={() => setFailed(n => n + 1)} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
      {reel && <PhotoChip style={{ left:10 }}>{reel} reel</PhotoChip>}
      {recipe.skipCount > 0 && <PhotoChip style={{ right:10 }}>Passed {recipe.skipCount}×</PhotoChip>}
      {reel && (
        <a href={recipe.sourceUrl} target='_blank' rel='noopener noreferrer' aria-label={`Open in ${reel}`} draggable={false}
          style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:68, height:68, borderRadius:R.pill, background:onPhoto, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon name='play' size={30} color={C.onPrimary}/>
        </a>
      )}
      <Stamp text='YES' color={C.primary} opacity={yes} style={{ left:16, transform:'rotate(-12deg)' }}/>
      <Stamp text='NOT NOW' color={C.onSecondaryContainerStrong} opacity={no} style={{ right:16, transform:'rotate(12deg)' }}/>
    </div>
  )
}

function Body({ recipe, showToddler, onViewRecipe }) {
  const reel = PLATFORM[recipe.sourcePlatform]
  return (
    <div style={{ padding:'14px 16px 16px' }}>
      <div style={{ ...ep, fontSize:21, lineHeight:1.2, color:C.onSurface, marginBottom:6 }}>{deckName(recipe)}</div>
      <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, marginBottom:12 }}>
        {reel
          ? <a href={recipe.sourceUrl} target='_blank' rel='noopener noreferrer' draggable={false} style={{ color:C.onSurfaceVariant }}>{recipe.sourceAuthor ? `@${recipe.sourceAuthor} · ` : ''}Open in {reel}</a>
          : 'No reel linked yet'}
      </div>
      <button onClick={onViewRecipe} style={{ ...mn, display:'inline-flex', alignItems:'center', gap:6, background:'none', border:`1px solid ${C.primary}`, color:C.primary, borderRadius:R.pill, padding:'7px 14px', fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:12 }}>
        <Icon name='bookOpen' size={14} color={C.primary}/>View recipe
      </button>
      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'6px 12px' }}>
        <Chip icon='clock'>{totalMinutes(recipe)} min</Chip>
        {showToddler && recipe.toddlerFriendly && <Chip>Toddler-friendly</Chip>}
        {recipe.advancePrepHours > 0 && <Chip icon='alarmClock'>Start {recipe.advancePrepHours}h ahead</Chip>}
        <Chip style={{ marginLeft:'auto' }}>Saved {savedLabel(recipe)}</Chip>
      </div>
    </div>
  )
}

// One card. `behind` is the next card peeking out under the top one, which only
// looks the part. On the top card, `flyOut` ('left' | 'right') sends it off
// screen, and `onSwipe` reports a drag that went far enough. `locked` stops
// swiping while a video plays.
//
// The pointer is only captured after TAP_SLOP, so anything inside the card still
// gets its clicks. touch-action: pan-y leaves vertical drags to the page, so short
// screens can still scroll past the card.
export function TryCard({ recipe, behind, flyOut, locked, showToddler, onSwipe, onViewRecipe }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef(null)
  const swallowClick = useRef(false)

  const down = e => {
    swallowClick.current = false
    if (locked || flyOut || e.button > 0) return
    gesture.current = { id:e.pointerId, x:e.clientX, y:e.clientY, dragging:false }
  }
  const move = e => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const mx = e.clientX - g.x, my = e.clientY - g.y
    if (!g.dragging) {
      if (Math.hypot(mx, my) < TAP_SLOP) return
      if (Math.abs(my) > Math.abs(mx)) { gesture.current = null; return }   // a scroll
      g.dragging = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setDx(mx)
  }
  const up = e => {
    const g = gesture.current
    gesture.current = null
    if (!g?.dragging) return
    swallowClick.current = true
    setDragging(false)
    setDx(0)
    const mx = e.clientX - g.x
    if (Math.abs(mx) >= SWIPE_THRESHOLD) onSwipe(mx > 0 ? 'right' : 'left')
  }
  const cancel = () => { gesture.current = null; setDragging(false); setDx(0) }
  const clickCapture = e => {
    if (!swallowClick.current) return
    swallowClick.current = false
    e.preventDefault(); e.stopPropagation()
  }

  if (behind) {
    return (
      <div aria-hidden style={{ position:'absolute', inset:0, overflow:'hidden', background:C.white, borderRadius:16, boxShadow:'0 1px 3px rgba(24,36,23,0.16)', transform:'translateY(10px) scale(0.95)', transformOrigin:'center bottom', pointerEvents:'none' }}>
        <Media recipe={recipe} dx={0}/>
      </div>
    )
  }

  const transform = flyOut
    ? `translateX(${flyOut === 'right' ? 140 : -140}%) rotate(${flyOut === 'right' ? 18 : -18}deg)`
    : `translateX(${dx}px) rotate(${dx / ROTATE_DIVISOR}deg)`

  return (
    <div data-try-card onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onClickCapture={clickCapture}
      style={{ position:'relative', overflow:'hidden', background:C.white, borderRadius:16, boxShadow:'0 2px 8px rgba(24,36,23,0.18)', transform, transition: dragging ? 'none' : `transform ${FLY_OUT_MS}ms ease-out`, touchAction:'pan-y', userSelect:'none', WebkitUserSelect:'none', cursor: locked ? 'default' : dragging ? 'grabbing' : 'grab' }}>
      <Media recipe={recipe} dx={dx} flyOut={flyOut}/>
      <Body recipe={recipe} showToddler={showToddler} onViewRecipe={onViewRecipe}/>
    </div>
  )
}
