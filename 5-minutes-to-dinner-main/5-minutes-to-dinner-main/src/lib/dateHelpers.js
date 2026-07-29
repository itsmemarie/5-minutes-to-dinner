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
