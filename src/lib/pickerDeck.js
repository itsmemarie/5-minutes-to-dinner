// ─── Swipe deck, picker mode ──────────────────────────────────────
// The picker opens the swipe deck on one bucket's recipes. A Yes ticks the recipe
// in the picker, as tapping its row would. A Not now only skips it for this
// session. Nothing here writes to the database: snoozing a favourite from the
// picker would hide it everywhere for weeks.
import { DAY_LBL } from './dateHelpers.js'
import { RECENT_DAYS, orderDeck, totalMinutes } from './tryDeck.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const POOLS = ['defaults', 'tested', 'tryNew', 'orderOut']

export function poolTitle(pool) {
  return { defaults:'Defaults', tested:'Tested & approved', tryNew:'Try something new', orderOut:'Order out' }[pool]
}

// ── Defaults: placeholders stand for real recipes ─────────────────
// A day's defaults can include placeholders ("Pasta", "Poke Bowl") that only
// name a kind of meal. Help me pick swipes the real recipes behind them instead.
// Until recipes have categories, membership comes from names: a recipe belongs
// when its name has every word of the placeholder's, counting a word's family
// (spaghetti and orzo are pasta, a platter is a board). If nothing has them all,
// the last word decides, so "Poke Bowl" means bowls.
const FAMILIES = [
  [/^pastas?$/, /\b(pastas?|spaghetti|penne|fusilli|tagliatelle|linguine|orzo|tortellini|ravioli|lasagnes?|lasagnas?|macaroni|rigatoni|carbonara|bolognese|bolognaise|pappardelle|farfalle|trofie)\b/i],
  [/^lentils?$/, /\b(lentils?|dal|dahl|daal)\b/i],
  [/^soups?$/, /\b(soups?|dal|dahl|daal|broth)\b/i],
  [/^(bowls?|poke)$/, /\b(bowls?|poke)\b/i],
  [/^(boards?|platters?|charcuterie)$/, /\b(boards?|platters?|charcuterie|grazing)\b/i],
]
const STOP = new Set(['and', 'with', 'the', 'of', 'a', 'an', 'or', 'in', 'on'])
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const familyOf = word => FAMILIES.find(([key]) => key.test(word))?.[1] ?? new RegExp(`\\b${escape(word)}s?\\b`, 'i')
const nameWords = name => name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1 && !STOP.has(w))

export function placeholderMembers(placeholder, pool) {
  const words = nameWords(placeholder.name)
  if (!words.length) return []
  const real = pool.filter(r => !r.placeholder && r.id !== placeholder.id)
  const all = real.filter(r => words.every(w => familyOf(w).test(r.name)))
  if (all.length || words.length === 1) return all
  const head = familyOf(words[words.length - 1])
  return real.filter(r => head.test(r.name))
}

// The defaults deck: each default in the bucket's order, a placeholder swapped
// for its recipes. `pool` is every recipe that can go on this day.
export function defaultsDeckItems(defaults, pool) {
  const seen = new Set()
  const out = []
  for (const d of defaults) {
    for (const r of d.placeholder ? placeholderMembers(d, pool) : [d]) {
      if (!seen.has(r.id)) { seen.add(r.id); out.push(r) }
    }
  }
  return out
}

// The filter pills each pool offers. An `order` pill changes the order (tap it
// again for the bucket's own order); a `filter` pill narrows the deck. Order out
// would split into Takeaway / Restaurant, but no recipe records which, and
// Defaults waits for categories.
export const POOL_PILLS = {
  defaults: [],
  tested: [
    { id:'shuffle', label:'Shuffle', icon:'shuffle', kind:'order' },
    { id:'husband', label:'Husband approved', icon:'heart', kind:'filter' },
    { id:'quickest', label:'Quickest first', icon:'clock', kind:'order' },
  ],
  tryNew: [
    { id:'newest', label:'Newest first', icon:'arrowDownWideNarrow', kind:'order' },
    { id:'shuffle', label:'Shuffle', icon:'shuffle', kind:'order' },
    { id:'recent', label:'Last 30 days', icon:'calendar', kind:'filter' },
  ],
  orderOut: [],
}

// Pill state is { order: null | 'newest' | 'shuffle' | 'quickest', filters: Set }.
export const NO_PILLS = { order:null, filters:[] }
export function tapPill(pills, pill) {
  if (pill.kind === 'order') return { ...pills, order: pills.order === pill.id ? null : pill.id }
  const on = pills.filters.includes(pill.id)
  return { ...pills, filters: on ? pills.filters.filter(f => f !== pill.id) : [...pills.filters, pill.id] }
}
export const pillActive = (pills, pill) => (pill.kind === 'order' ? pills.order === pill.id : pills.filters.includes(pill.id))

const savedTime = r => new Date(r.savedAt ?? r.createdAt ?? 0).getTime()

// The cards still to show, top first. `items` is the bucket, in its order.
// Anything already ticked or skipped is out. `top` is a card just brought back by
// Undo, which goes back on top whatever the order.
export function pickerDeckCards(items, { selected = [], skipped = [], pills = NO_PILLS, seed = 0, top = null, now = new Date() } = {}) {
  const gone = new Set([...selected, ...skipped])
  let list = items.filter(r => !gone.has(r.id))
  if (pills.filters.includes('husband')) list = list.filter(r => r.husband)
  if (pills.filters.includes('recent')) list = list.filter(r => savedTime(r) >= now.getTime() - RECENT_DAYS * DAY_MS)
  if (pills.order === 'newest' || pills.order === 'shuffle') list = orderDeck(list, { order: pills.order, seed })
  else if (pills.order === 'quickest') list = [...list].sort((a, b) => totalMinutes(a) - totalMinutes(b))
  const i = top == null ? -1 : list.findIndex(r => r.id === top)
  return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list
}

// ── Session state ────────────────────────────────────────────────
// { skipped: ids, history: [{ id, yes }], top: id | null }. Each step returns the
// next state, plus `select` or `unselect` for the picker's ticked list.
export const START = { skipped:[], history:[], top:null }

export function deckStep(state, action) {
  switch (action.type) {
    case 'yes':
      return { state: { ...state, history: [...state.history, { id: action.id, yes: true }], top: null }, select: action.id }
    case 'skip':
      return { state: { ...state, skipped: [...state.skipped, action.id], history: [...state.history, { id: action.id, yes: false }], top: null } }
    case 'undo': {
      const last = state.history[state.history.length - 1]
      if (!last) return { state }
      const next = { skipped: last.yes ? state.skipped : state.skipped.filter(id => id !== last.id), history: state.history.slice(0, -1), top: last.id }
      return last.yes ? { state: next, unselect: last.id } : { state: next }
    }
    case 'restart':
      return { state: START }
    default:
      return { state }
  }
}

export const addedCount = state => state.history.filter(h => h.yes).length

export const pickerCaption = n => `${n} recipe${n === 1 ? '' : 's'} to look at`
export const waitingInAdd = n => (n === 0 ? 'Nothing is selected yet.' : `${n} recipe${n === 1 ? ' is' : 's are'} waiting in Add Selected.`)
export const addedToast = (day, n) => `Added to ${DAY_LBL[day] || day} · ${n} selected`
