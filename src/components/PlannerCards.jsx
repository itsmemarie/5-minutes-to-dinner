import { C, mn, R } from '../lib/theme.js'
import { Icon } from './ui/index.js'

const PEACH_CARD = { background:C.secondaryContainer, borderRadius:20, marginBottom:18 }
const TILES = [
  { key:'overall', label:'Overall' },
  { key:'gutHealth', label:'Gut health' },
  { key:'vitaminMineral', label:'Vitamins' },
]

function CardButton({ children, disabled, ariaLabel, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} aria-busy={disabled}
      style={{ ...mn, flexShrink:0, minWidth:92, minHeight:44, padding:'0 14px', border:'none', borderRadius:22, background:C.onSecondaryContainerStrong, color:C.white, fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', cursor:disabled ? 'wait' : 'pointer' }}>
      {children}
    </button>
  )
}

// The week's AI scores, worked out on the spot, under the stepper. `nutrition` is
// { scores, stale, loading, error }: `scores` are the adult scores out of 100, and
// `stale` means the meals have changed since. The full picture stays on the
// Nutrition insights screen, which `onOpen` opens: from the scores once there are
// some, and from the heading in goal mode, whose figures need no calculating.
export function NutritionCard({ title, basis, nutrition, goalMode, onCalculate, onOpen }) {
  const { scores, stale, loading, error } = nutrition
  const heading = (
    <>
      <span style={{ width:36, height:36, flexShrink:0, borderRadius:12, background:C.peachIcon, display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name='barChart3' size={18} color={C.onSecondaryContainerStrong}/></span>
      <span style={{ display:'flex', flexDirection:'column', minWidth:0, textAlign:'left' }}>
        <span style={{ fontSize:16, fontWeight:700, color:C.onSurface }}>{title}</span>
        <span style={{ fontSize:13, fontWeight:500, color:C.onPeachMuted }}>{basis}</span>
      </span>
    </>
  )
  const headingStyle = { ...mn, flex:1, minWidth:0, display:'flex', alignItems:'center', gap:10 }
  const Tiles = scores ? 'button' : 'div'
  return (
    <section aria-label={title} style={{ ...PEACH_CARD, ...mn, padding:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:12 }}>
        {goalMode
          ? <button onClick={onOpen} aria-label={`${title}. Open goal and nutrition insights`} style={{ ...headingStyle, border:'none', background:'none', padding:0, cursor:'pointer' }}>{heading}</button>
          : <div style={headingStyle}>{heading}</div>}
        {loading
          ? <CardButton disabled ariaLabel='Calculating'><span style={{ width:16, height:16, boxSizing:'border-box', border:'2px solid rgba(255,255,255,0.35)', borderTopColor:C.white, borderRadius:'50%', animation:'sp 0.9s linear infinite' }}/></CardButton>
          : !scores ? <CardButton onClick={onCalculate}>Calculate</CardButton>
          : stale ? <CardButton onClick={onCalculate}>Recalculate</CardButton>
          : <CardButton onClick={onOpen}>Details</CardButton>}
      </div>
      <Tiles {...(scores ? { onClick:onOpen, 'aria-label':'See the full nutrition insights' } : null)}
        style={{ ...mn, width:'100%', display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:8, border:'none', background:'none', padding:0, textAlign:'left', cursor:scores ? 'pointer' : undefined }}>
        {TILES.map(t => (
          <span key={t.key} style={{ background:C.white, borderRadius:R.lg, padding:10, display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
            <span style={{ fontSize:12, fontWeight:600, color:C.onPeachMuted }}>{t.label}</span>
            <span style={{ fontSize:18, fontWeight:700, color:C.onSurface, fontVariantNumeric:'tabular-nums' }}>
              {scores?.[t.key] ?? '—'}{scores?.[t.key] != null && <span style={{ fontSize:12, fontWeight:600, color:C.onPeachMuted }}>/100</span>}
            </span>
          </span>
        ))}
      </Tiles>
      {error && <div role='alert' style={{ fontSize:12, color:C.error, lineHeight:1.5, marginTop:10 }}>{error}</div>}
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    </section>
  )
}

// Stands in for the nutrition card when the week has no meals. Past weeks are for
// looking back, so they aren't offered a fill.
export function EmptyWeekCard({ onFill }) {
  return (
    <section style={{ ...PEACH_CARD, ...mn, padding:16 }}>
      <div style={{ fontSize:16, fontWeight:700, color:C.onSurface }}>{onFill ? 'Nothing planned yet' : 'Nothing planned'}</div>
      <div style={{ fontSize:14, fontWeight:500, color:C.onPeachMuted, marginTop:2 }}>{onFill ? "Start from a week you've saved, or plan day by day." : 'No meals were planned for this week.'}</div>
      {onFill && <button onClick={onFill} style={{ ...mn, width:'100%', height:48, marginTop:12, border:'none', borderRadius:24, background:C.primary, color:C.onPrimary, fontSize:15, fontWeight:700, cursor:'pointer' }}>Fill from a saved week</button>}
    </section>
  )
}
