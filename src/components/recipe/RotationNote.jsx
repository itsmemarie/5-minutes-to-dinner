import { C, mn, R } from '../../lib/theme.js'
import { RETIRED, SECOND_CHANCE } from '../../lib/mealRating.js'

const heading = { ...mn, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:4 }

// The top of a recipe, when its history matters: the one fix to try on a second
// chance, that same fix kept as a cooking note once it has worked, and a way back
// for a retired recipe.
export function RotationNote({ status, fixNote, onBringBack }) {
  const retired = status === RETIRED
  const chance = status === SECOND_CHANCE
  if (!retired && !fixNote) return null
  const warm = chance || retired
  return (
    <div style={{ background:warm ? C.secondaryContainer : C.primaryFixed, borderRadius:R.md, padding:'12px 14px', marginBottom:16 }}>
      <div style={{ ...heading, color:warm ? C.onSecondaryContainerStrong : C.primary }}>{chance ? 'Your one fix' : retired ? 'Retired' : 'Cooking note'}</div>
      <div style={{ ...mn, fontSize:14, lineHeight:1.5, color:C.onSurface }}>{retired ? "It won't come up when you're choosing meals." : fixNote}</div>
      {retired && onBringBack && <button type='button' onClick={onBringBack} style={{ ...mn, border:'none', background:'none', padding:'8px 0 0', fontSize:13, fontWeight:700, color:C.onSecondaryContainerStrong, textDecoration:'underline', cursor:'pointer' }}>Bring it back</button>}
    </div>
  )
}
