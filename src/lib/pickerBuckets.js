// ─── Recipe picker buckets ────────────────────────────────────────
// Which bucket each recipe lands in on the picker, and the order the buckets
// show in. Pure, so the order can be tested without a screen.
import { DAY_LBL } from './dateHelpers.js'

// Off until the picker's swipe deck ships, so the buttons stay hidden.
export const PICKER_SWIPE = false

// What a day's defaults are called in the subtitle, per meal section.
const SECTION_NOUN = { breakfast:'breakfasts', lunch:'lunches', main:'mains', dinner:'dinners', side:'sides', dessert:'desserts', drinks:'drinks' }

// `available` is every recipe that can still go on this day, Suggested ones
// already taken out. `otherDayIds` holds recipes planned on the week's other days.
//
// Precedence: planned this week, then Default (it wins over Try / Order out),
// then Order out (it wins over Try), then Try, then everything else.
// Render order: Suggested → Already planned → {Day} defaults → Tested & approved
// → Try something new → Order out. `swipe` names the deck pool a bucket opens,
// and `pick` marks the one whose button reads Help me pick.
export function pickerBuckets({ suggested = [], available, otherDayIds, day, section }) {
  const planned = new Set(otherDayIds)
  const isDefault = r => (r.defaultDays || []).includes(day)
  const alreadyWeek = available.filter(r => planned.has(r.id))
  const rest = available.filter(r => !planned.has(r.id))
  const defaults = rest.filter(isDefault)
  const notDefault = rest.filter(r => !isDefault(r))
  const dayName = DAY_LBL[day] || day
  return [
    { key:'suggested',   title:'Suggested',                 subtitle:null,                                                       items:suggested },
    { key:'alreadyWeek', title:'Already planned this week', subtitle:'Cook once, eat twice: handy for leftovers',                items:alreadyWeek },
    { key:'defaults',    title:`${dayName} defaults`,       subtitle:`Your usual ${dayName} ${SECTION_NOUN[section] || 'meals'}`, items:defaults, swipe:'defaults', pick:true },
    { key:'tested',      title:'Tested & approved',         subtitle:"Meals you've cooked and kept",                             items:notDefault.filter(r => !r.tryOut && !r.orderOut), swipe:'tested' },
    { key:'tryNew',      title:'Try something new',         subtitle:"Recipes you've saved to try",                              items:notDefault.filter(r => r.tryOut && !r.orderOut), swipe:'tryNew' },
    { key:'orderOut',    title:'Order out',                 subtitle:'Takeaway and restaurant nights',                           items:notDefault.filter(r => r.orderOut), swipe:'orderOut' },
  ]
}

// A collapsed bucket's subtitle: the names it hides.
export const collapsedSubtitle = items => items.map(r => r.name).join(', ')
