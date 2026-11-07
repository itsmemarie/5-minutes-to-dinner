// ─── "Try something new" swipe deck ───────────────────────────────
// The deck's rules, kept pure so they can be tested without a database or a
// screen. A recipe here is the shape supabase.js › fetchRecipes returns, and a
// pick is a tryout_picks row.
import { addWeeks, weekBounds } from './dateHelpers.js'
import { splitRecipeName } from './recipeParsing.js'

export const SNOOZE_WEEKS = 8
export const REMOVE_ON_PASS = 4        // this pass offers removal instead of a snooze
export const RECENT_DAYS = 30
export const DECK_MEAL_TYPES = { off:'main', on:'side' }   // the Sides filter

export const SWIPE_THRESHOLD = 110     // px
export const TAP_SLOP = 8              // px; less than this is a tap
export const ROTATE_DIVISOR = 18       // dx / this = degrees of tilt
export const FLY_OUT_MS = 240

const DAY_MS = 24 * 60 * 60 * 1000

// ── Weeks ─────────────────────────────────────────────────────────
// Picks follow Europe/London whatever the device's clock says. weekBounds reads a
// Date's local fields, so this builds one whose local fields are London's.
const LONDON_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone:'Europe/London', hourCycle:'h23',
  year:'numeric', month:'numeric', day:'numeric', hour:'numeric', minute:'numeric', second:'numeric',
})
export function londonClock(now = new Date()) {
  const p = Object.fromEntries(LONDON_PARTS.formatToParts(now).map(x => [x.type, Number(x.value)]))
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}
export const pickWeek = (startsOn, now = new Date()) => weekBounds(startsOn, londonClock(now))

// Picks count toward the week they were made in, even when they carry over.
export const picksInWeek = (picks, weekOf) => picks.filter(p => p.week_of === weekOf)

// ── Who's in the deck ─────────────────────────────────────────────
const isDeckType = r => r.mealTypeId === DECK_MEAL_TYPES.off || r.mealTypeId === DECK_MEAL_TYPES.on
export const isSnoozed = (r, now = new Date()) => !!r.snoozedUntil && new Date(r.snoozedUntil) > now
const savedTime = r => new Date(r.savedAt ?? r.createdAt ?? 0).getTime()

// A recipe that's been picked never comes back, unless the pick is undone or
// taken out of the tray. That also stops one recipe filling two tray cards.
function candidates(recipes, picks) {
  const picked = new Set(picks.map(p => p.recipe_id))
  return recipes.filter(r => r.tryOut && isDeckType(r) && !r.archivedAt && !picked.has(r.id))
}

// Everything waiting to be looked at, mains and sides together.
export const waitingRecipes = (recipes, picks, now = new Date()) =>
  candidates(recipes, picks).filter(r => !isSnoozed(r, now))

function matchesFilters(r, { sides, recent }, now) {
  if (r.mealTypeId !== (sides ? DECK_MEAL_TYPES.on : DECK_MEAL_TYPES.off)) return false
  return !recent || savedTime(r) >= now.getTime() - RECENT_DAYS * DAY_MS
}

// Stable for a given id and seed, and spread evenly enough to look random.
export function shuffleKey(id, seed) {
  let h = 0x811c9dc5 ^ (seed >>> 0)
  for (const ch of String(id)) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193)
  return h >>> 0
}

// `order` is 'newest' or 'shuffle'. `seed` is chosen once a session, so ties (91
// recipes share one import timestamp) keep their order while it's open.
export function orderDeck(recipes, { order = 'newest', seed = 0 } = {}) {
  const byShuffle = (a, b) => shuffleKey(a.id, seed) - shuffleKey(b.id, seed)
  return [...recipes].sort(order === 'shuffle' ? byShuffle : (a, b) => savedTime(b) - savedTime(a) || byShuffle(a, b))
}

export function buildDeck(recipes, picks, { order, sides = false, recent = false, seed = 0, now = new Date() } = {}) {
  const eligible = waitingRecipes(recipes, picks, now).filter(r => matchesFilters(r, { sides, recent }, now))
  return orderDeck(eligible, { order, seed })
}

// Snoozed recipes the current filters would otherwise show.
export const hiddenCount = (recipes, picks, { sides = false, recent = false, now = new Date() } = {}) =>
  candidates(recipes, picks).filter(r => isSnoozed(r, now) && matchesFilters(r, { sides, recent }, now)).length

// ── Actions ───────────────────────────────────────────────────────
export const snoozeUntil = (now = new Date()) => addWeeks(now, SNOOZE_WEEKS).toISOString()

// What ✕ does. `ask` means the Remove sheet decides, so nothing is written yet.
export function passOutcome(recipe, now = new Date()) {
  const passes = (recipe.skipCount ?? 0) + 1
  if (passes >= REMOVE_ON_PASS) return { ask:true }
  return { ask:false, patch:{ skipCount:passes, snoozedUntil:snoozeUntil(now) } }
}
export const keepPatch = (now = new Date()) => ({ skipCount:0, snoozedUntil:snoozeUntil(now) })
export const removePatch = (now = new Date()) => ({ archivedAt:now.toISOString() })
export const undoPatch = recipe => ({ skipCount:recipe.skipCount ?? 0, snoozedUntil:recipe.snoozedUntil ?? null, archivedAt:null })

// ── Words ─────────────────────────────────────────────────────────
export const deckName = r => splitRecipeName(r.name).title
export const totalMinutes = r => (r.prep ?? 0) + (r.active ?? 0)

export const savedLabel = r =>
  new Date(r.savedAt ?? r.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', timeZone:'Europe/London' })

export const progressLabel = (picked, target) => (target > 0 ? `${picked}/${target} this week` : `${picked} this week`)
// The shorter form in the deck's header, where the full one wraps the title at 360px.
export const deckProgressLabel = (picked, target) => (target > 0 ? `${picked}/${target}` : `${picked} added`)

export function deckCaption(n, { sides, recent }) {
  const kind = sides ? 'side' : 'main'
  return `${n} ${kind}${n === 1 ? '' : 's'} to look at${recent ? ' · saved in the last 30 days' : ''}`
}

export function emptyTitle({ sides, recent }) {
  if (sides) return 'No more sides for now'
  if (recent) return 'Nothing else from the last 30 days'
  return "You've seen everything for now"
}

// The sheet after a Yes. `picked` includes the one just added.
export function yesSheet(picked, target) {
  if (target === 0) return { kind:'noGoal', title:'Added to this week', segments:null }
  const segments = { total:target, done:Math.min(picked, target) }
  if (picked >= target) return { kind:'reached', title:`That's your ${target} new recipe${target === 1 ? '' : 's'} for this week`, segments }
  return { kind:'below', title:`Added! ${picked} of ${target} new recipes this week`, segments }
}
