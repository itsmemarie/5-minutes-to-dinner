import { C } from '../../lib/theme.js'
import { ChipMenu } from './ChipMenu.jsx'

const UNSET = { background:C.white, color:C.onSurfaceVariant, borderColor:C.outlineVariant }
const WARM = { background:C.secondaryContainer, color:C.onSecondaryContainerStrong, borderColor:C.accent2_300 }
const filled = background => ({ background, color:C.onPrimary, borderColor:background })

const RATING_LOOKS = {
  loved: { ...filled(C.primary), icon:'heart', label:'Loved' },
  okay:  { ...WARM, icon:'meh', label:'Okay' },
  bad:   { ...filled(C.errorInk), icon:'thumbsDown', label:'Bad' },
}
const RATING_ITEMS = [
  { value:'loved', label:'Loved', icon:'heart', iconColor:C.primary },
  { value:'okay',  label:'Okay',  icon:'meh', iconColor:C.onSecondaryContainerStrong },
  { value:'bad',   label:'Bad',   icon:'thumbsDown', iconColor:C.errorInk, labelColor:C.errorInk },
]
const ATE_LOOKS = {
  all:  { background:C.primaryFixed, color:C.primary, borderColor:C.primary },
  some: WARM,
  none: filled(C.onSurfaceVariant),
}
const ATE_ITEMS = [{ value:'all', label:'All of it' }, { value:'some', label:'Some' }, { value:'none', label:'None' }]

// "How was it?" and, when a child is selected in Settings, "Did <child> eat it?".
// Home shows them on each meal and the recipe screen under the title. `name` is the
// dish, for screen readers.
export function RatingChips({ name, rating, ate, childName, onRate, onAte, style }) {
  return (
    <div data-no-drag onClick={e => e.stopPropagation()} style={{ display:'flex', flexWrap:'wrap', columnGap:6, ...style }}>
      <ChipMenu label={`How was ${name}?`} look={RATING_LOOKS[rating] ?? { ...UNSET, label:'How was it?' }} items={RATING_ITEMS} value={rating} onPick={onRate}/>
      {childName && (
        <ChipMenu label={`Did ${childName} eat ${name}?`} look={ate ? { ...ATE_LOOKS[ate], label:`${childName} ate ${ate}` } : { ...UNSET, label:`Did ${childName} eat it?` }} items={ATE_ITEMS} value={ate} onPick={onAte}/>
      )}
    </div>
  )
}
