// ─── Date helpers ────────────────────────────────────────────────
export const WD  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
export const toISO = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().split('T')[0] }
export const getMon = (d = new Date()) => { const x = new Date(d), w = x.getDay(); x.setDate(x.getDate() - (w === 0 ? 6 : w - 1)); x.setHours(0,0,0,0); return x }
export const NOW      = new Date()
export const TODAY    = WD[NOW.getDay()]
export const MON      = getMon(NOW)
export const SUN      = new Date(MON); SUN.setDate(SUN.getDate() + 6)
export const WEEK_OF  = toISO(MON)
export const WEEK_LBL = `${MON.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${SUN.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`
export const DAYS     = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
export const DAY_LBL  = {monday:'Monday',tuesday:'Tuesday',wednesday:'Wednesday',thursday:'Thursday',friday:'Friday',saturday:'Saturday',sunday:'Sunday'}

let _uid = Date.now()
export const uid = () => `m${++_uid}`
export const emptyWeek = () => Object.fromEntries(DAYS.map(d => [d, { breakfast:[], main:[], side:[] }]))

// e.g. 4 -> "4h", 24 -> "1d", 1.5 -> "1.5h"
export const formatAdvance = h => {
  const n = Number(h)
  if (n >= 24 && n % 24 === 0) return `${n/24}d`
  return `${Number.isInteger(n) ? n : n.toFixed(1)}h`
}

// ─── Toddler age bands ───────────────────────────────────────────
export const TODDLER_AGE_BANDS = [
  { id:'18-24m', label:'18–24 mo', minMonths:18, maxMonths:24 },
  { id:'2-3y',   label:'2–3 yrs',  minMonths:24, maxMonths:36 },
  { id:'3-4y',   label:'3–4 yrs',  minMonths:36, maxMonths:48 },
  { id:'4-5y',   label:'4–5 yrs',  minMonths:48, maxMonths:60 },
]

export function ageBandFromDob(dobStr, today = new Date()) {
  const dob = new Date(dobStr)
  let months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth())
  if (today.getDate() < dob.getDate()) months -= 1
  const band = TODDLER_AGE_BANDS.find(b => months >= b.minMonths && months < b.maxMonths)
  if (band) return band.id
  return months < TODDLER_AGE_BANDS[0].minMonths ? TODDLER_AGE_BANDS[0].id : TODDLER_AGE_BANDS[TODDLER_AGE_BANDS.length - 1].id
}
