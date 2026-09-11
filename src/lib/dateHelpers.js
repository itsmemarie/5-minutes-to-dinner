// ─── Date helpers ────────────────────────────────────────────────
import { emptyDay } from './mealSections.js'

export const WD  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
export const toISO = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().split('T')[0] }
export const DAY_LBL  = {monday:'Monday',tuesday:'Tuesday',wednesday:'Wednesday',thursday:'Thursday',friday:'Friday',saturday:'Saturday',sunday:'Sunday'}

// ── Week start (a user setting) ──────────────────────────────────
// The planner week can start on any weekday. `weekBounds` is the single place
// that turns that setting into dates, the ordered day list and the week label;
// the Monday constants below are kept as the default for callers that don't
// carry the setting (tests, one-off scripts).
export const WEEK_START_OPTIONS = [
  { id:'mon', label:'Monday',    dayIndex:1 },
  { id:'tue', label:'Tuesday',   dayIndex:2 },
  { id:'wed', label:'Wednesday', dayIndex:3 },
  { id:'thu', label:'Thursday',  dayIndex:4 },
  { id:'fri', label:'Friday',    dayIndex:5 },
  { id:'sat', label:'Saturday',  dayIndex:6 },
  { id:'sun', label:'Sunday',    dayIndex:0 },
]
const weekStartIndex = id => (WEEK_START_OPTIONS.find(o => o.id === id) || WEEK_START_OPTIONS[0]).dayIndex

// Midnight on the most recent `startsOn` weekday on or before `d`.
export function getWeekStart(startsOn = 'mon', d = new Date()) {
  const x = new Date(d)
  const diff = (x.getDay() - weekStartIndex(startsOn) + 7) % 7
  x.setDate(x.getDate() - diff)
  x.setHours(0,0,0,0)
  return x
}
const fmtShort = d => d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })

export function weekBounds(startsOn = 'mon', now = new Date()) {
  const start = getWeekStart(startsOn, now)
  const end = new Date(start); end.setDate(end.getDate() + 6)
  const first = weekStartIndex(startsOn)
  const days = Array.from({ length: 7 }, (_, i) => WD[(first + i) % 7])
  return { start, end, weekOf: toISO(start), label: `${fmtShort(start)} – ${fmtShort(end)}`, days }
}

// Backwards-compatible Monday-start defaults.
export const getMon = (d = new Date()) => getWeekStart('mon', d)
export const NOW      = new Date()
export const TODAY    = WD[NOW.getDay()]
export const MON      = getMon(NOW)
export const SUN      = new Date(MON); SUN.setDate(SUN.getDate() + 6)
export const WEEK_OF  = toISO(MON)
export const WEEK_LBL = `${fmtShort(MON)} – ${fmtShort(SUN)}`
export const DAYS     = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

let _uid = Date.now()
export const uid = () => `m${++_uid}`
export const emptyWeek = () => Object.fromEntries(WD.map(d => [d, emptyDay()]))

// e.g. 4 -> "4h", 24 -> "1d", 1.5 -> "1.5h"
export const formatAdvance = h => {
  const n = Number(h)
  if (n >= 24 && n % 24 === 0) return `${n/24}d`
  return `${Number.isInteger(n) ? n : n.toFixed(1)}h`
}

// ─── Ages ────────────────────────────────────────────────────────
// Whole months between a YYYY-MM-DD date of birth and today.
export function ageInMonths(dobStr, today = new Date()) {
  const dob = new Date(dobStr)
  if (Number.isNaN(dob.getTime())) return null
  let months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth())
  if (today.getDate() < dob.getDate()) months -= 1
  return Math.max(0, months)
}

// "23 months" under two, then "4 yrs 5 mo" (or "4 yrs" on the birthday month).
export function formatAge(dobStr, today = new Date()) {
  const months = ageInMonths(dobStr, today)
  if (months == null) return ''
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`
  const y = Math.floor(months / 12), m = months % 12
  return m ? `${y} yrs ${m} mo` : `${y} yrs`
}

// ─── Toddler age bands ───────────────────────────────────────────
export const TODDLER_AGE_BANDS = [
  { id:'18-24m', label:'18–24 mo', minMonths:18, maxMonths:24 },
  { id:'2-3y',   label:'2–3 yrs',  minMonths:24, maxMonths:36 },
  { id:'3-4y',   label:'3–4 yrs',  minMonths:36, maxMonths:48 },
  { id:'4-5y',   label:'4–5 yrs',  minMonths:48, maxMonths:60 },
]

export function ageBandFromDob(dobStr, today = new Date()) {
  const months = ageInMonths(dobStr, today) ?? 0
  const band = TODDLER_AGE_BANDS.find(b => months >= b.minMonths && months < b.maxMonths)
  if (band) return band.id
  return months < TODDLER_AGE_BANDS[0].minMonths ? TODDLER_AGE_BANDS[0].id : TODDLER_AGE_BANDS[TODDLER_AGE_BANDS.length - 1].id
}

export const ageBandLabel = bandId => TODDLER_AGE_BANDS.find(b => b.id === bandId)?.label || null
