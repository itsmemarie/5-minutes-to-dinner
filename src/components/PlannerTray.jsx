import { useState } from 'react'
import { C, CARD, ep, mn, R } from '../lib/theme.js'
import { DAY_LBL } from '../lib/dateHelpers.js'
import { deckName, totalMinutes, waitingLabel } from '../lib/tryDeck.js'
import { CapLabel, Icon } from './ui/index.js'

const TYPE_LABEL = { main:'Main', side:'Side' }

// The way into the swipe deck, under the planner's nutrition card.
export function TryEntryCard({ waiting, pill, onOpen }) {
  return (
    <button onClick={onOpen} style={{ width:'100%', display:'flex', alignItems:'center', gap:12, background:C.primary, color:C.onPrimary, border:'none', borderRadius:R.lg, padding:'14px 16px', marginBottom:14, cursor:'pointer', textAlign:'left' }}>
      <Icon name='sparkles' size={22} color={C.onPrimary}/>
      <span style={{ flex:1, minWidth:0 }}>
        <span style={{ ...ep, display:'block', fontSize:19, lineHeight:1.15, color:C.onPrimary }}>Try something new</span>
        <span style={{ ...mn, display:'block', fontSize:12, marginTop:3, color:C.onPrimary, opacity:0.85 }}>{waitingLabel(waiting)}</span>
      </span>
      <span style={{ ...mn, flexShrink:0, fontSize:12, fontWeight:700, color:C.onPrimary, background:'rgba(255,255,255,0.16)', padding:'5px 10px', borderRadius:R.pill, whiteSpace:'nowrap' }}>{pill}</span>
    </button>
  )
}

function Thumb({ recipe }) {
  const [failed, setFailed] = useState(false)
  const src = !failed && (recipe.videoThumbUrl || recipe.imageUrl)
  const box = { width:40, height:40, borderRadius:R.sm, flexShrink:0 }
  return src
    ? <img src={src} alt='' draggable={false} onError={() => setFailed(true)} style={{ ...box, objectFit:'cover', display:'block' }}/>
    : <span style={{ ...box, background:`repeating-linear-gradient(135deg,${C.placeholderStripeA} 0 6px,${C.placeholderStripeB} 6px 12px)` }}/>
}

const metaLine = recipe => `${TYPE_LABEL[recipe.mealTypeId] ?? 'Main'} · ${totalMinutes(recipe)}m`

function TrayCard({ item, dragging, dragHandlers, onRemove }) {
  const { recipe } = item
  return (
    <div {...dragHandlers} style={{ ...CARD, display:'flex', alignItems:'center', gap:10, padding:'8px 10px', touchAction:'none', userSelect:'none', WebkitUserSelect:'none', cursor:'grab', opacity:dragging ? 0.35 : 1, transition:'opacity 0.12s' }}>
      <Icon name='gripVertical' size={18} color={C.outlineStrong}/>
      <Thumb recipe={recipe}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ ...mn, fontSize:13, fontWeight:600, color:C.onSurface, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{deckName(recipe)}</div>
        <div style={{ ...mn, fontSize:11, color:C.onSurfaceVariant, marginTop:2 }}>{metaLine(recipe)}</div>
      </div>
      {/* Stops the press here, so a tap on the ✕ can't start a drag. */}
      <button onPointerDown={e => e.stopPropagation()} onClick={() => onRemove(item)} aria-label={`Remove ${deckName(recipe)} from this list`}
        style={{ width:26, height:26, flexShrink:0, border:'none', background:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon name='x' size={14} color={C.outlineVariant}/>
      </button>
    </div>
  )
}

// Picks waiting for a day. Dragging one onto a day is the only way to schedule it.
export function PlannerTray({ items, drag, handlers, onRemove }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ marginBottom:8 }}><CapLabel text='New this week · drag onto a day'/></div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {items.map(item => (
          <TrayCard key={item.pick.id} item={item} dragging={drag?.item.pick.id === item.pick.id} dragHandlers={handlers(item)} onRemove={onRemove}/>
        ))}
      </div>
    </div>
  )
}

// Follows the finger. pointer-events: none, or it would be what the hit test finds.
export function DragGhost({ drag }) {
  if (!drag) return null
  return (
    <div style={{ ...CARD, position:'fixed', left:drag.x, top:drag.y, transform:'translate(-50%,-115%) rotate(-2deg)', zIndex:100, width:210, padding:'8px 10px', display:'flex', alignItems:'center', gap:8, boxShadow:'0 6px 18px rgba(24,36,23,0.28)', pointerEvents:'none' }}>
      <Thumb recipe={drag.item.recipe}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ ...mn, fontSize:12, fontWeight:600, color:C.onSurface, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{deckName(drag.item.recipe)}</div>
        {drag.day && <div style={{ ...mn, fontSize:11, fontWeight:700, color:C.primary, marginTop:2 }}>Drop on {DAY_LBL[drag.day]}</div>}
      </div>
    </div>
  )
}
