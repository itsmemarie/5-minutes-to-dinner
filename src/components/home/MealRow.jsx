import { C, mn, R } from '../../lib/theme.js'
import { DAY_LBL, formatAdvance } from '../../lib/dateHelpers.js'
import { sectionShort } from '../../lib/mealSections.js'
import { RETIRED, SECOND_CHANCE } from '../../lib/mealRating.js'
import { Icon } from '../ui/index.js'
import { RatingChips } from './RatingChips.jsx'

const STATUS_TAGS = {
  [SECOND_CHANCE]: { label:'Second chance', color:C.onSecondaryContainerStrong },
  [RETIRED]:       { label:'Retired', color:C.onSurfaceVariant },
}

const stop = e => e.stopPropagation()

// One planned meal on Home. `pressProps` come from useLongPressDrag. Tapping the row
// opens the recipe; the grip, chips and remove button keep their taps to themselves.
export function MealRow({ meal, day, status, rateable, childName, divider, held, pressProps, onOpen, onRate, onAte, onRemove }) {
  const tag = STATUS_TAGS[status]
  const open = meal.recipeId ? onOpen : undefined
  const nameStyle = { ...mn, display:'block', padding:0, border:'none', background:'none', textAlign:'left', fontSize:14, fontWeight:700, lineHeight:1.3, color:C.onSurface, textDecoration:'underline', textDecorationColor:C.outlineVariant, textUnderlineOffset:3, marginBottom:3, overflowWrap:'anywhere' }
  return (
    <div {...pressProps} onClick={open}
      style={{ display:'flex', alignItems:'center', padding:'10px 4px', borderBottom:divider ? `1px solid ${C.outlineVariant}26` : undefined, cursor:open ? 'pointer' : 'default', opacity:held ? 0.45 : 1, transition:'opacity 0.15s', touchAction:'pan-y', userSelect:'none', WebkitUserSelect:'none', WebkitTouchCallout:'none' }}>
      <div role='img' aria-label={`Drag ${meal.name} to another day`} onClick={stop} style={{ width:30, height:44, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', cursor:'grab' }}>
        <Icon name='gripVertical' size={18} color={C.outlineStrong}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        {open ? <button type='button' style={{ ...nameStyle, cursor:'pointer' }}>{meal.name}</button> : <div style={nameStyle}>{meal.name}</div>}
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ ...mn, fontSize:11, color:C.onSurface, opacity:0.55 }}>{sectionShort(meal.section)}</span>
          <span style={{ ...mn, fontSize:11, color:C.onSurface, opacity:0.6 }}>{meal.prep}m</span>
          {meal.advancePrepHours > 0 && (
            <span title={meal.advancePrepNote || undefined} style={{ ...mn, fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:4, color:C.onSecondaryContainer }}>
              <Icon name='alarmClock' size={11} color={C.onSecondaryContainer}/>Start {formatAdvance(meal.advancePrepHours)} ahead
            </span>
          )}
          <span data-no-drag style={{ ...mn, fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3, background:C.primaryFixed, color:C.primary, padding:'2px 7px', borderRadius:R.pill }}>
            <Icon name='utensilsCrossed' size={11} color={C.primary}/>{meal.portion}
          </span>
          {tag && <span style={{ ...mn, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:tag.color }}>{tag.label}</span>}
        </div>
        {rateable && (
          <RatingChips name={meal.name} rating={meal.rating} ate={meal.ate} childName={childName} onRate={onRate} onAte={onAte} style={{ marginTop:1, marginBottom:-5 }}/>
        )}
      </div>
      <button data-no-drag type='button' aria-label={`Remove ${meal.name} from ${DAY_LBL[day]}`} onClick={e => { stop(e); onRemove() }}
        style={{ width:40, height:40, flexShrink:0, border:'none', background:'none', padding:0, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
        <Icon name='x' size={16} color={C.onSurfaceVariant}/>
      </button>
    </div>
  )
}
