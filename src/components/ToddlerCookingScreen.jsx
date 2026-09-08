import { C, ep, mn, CARD, R } from '../lib/theme.js'
import { TODDLER_AGE_BANDS } from '../lib/dateHelpers.js'
import { Spinner, Btn, Icon } from './ui/index.js'

export function ToddlerCookingScreen({ guide, loading, error, activeBand, setActiveBand, currentBand, onGenerate }) {
  const tasks = guide?.ageBands?.[activeBand] || []
  // Order the band tabs so "now" comes first, then what's coming next, then earlier stages.
  const curIdx = Math.max(0, TODDLER_AGE_BANDS.findIndex(b => b.id === currentBand))
  const orderedBands = [
    ...TODDLER_AGE_BANDS.slice(curIdx),
    ...TODDLER_AGE_BANDS.slice(0, curIdx),
  ]
  const isNow = activeBand === currentBand
  const isPast = TODDLER_AGE_BANDS.findIndex(b => b.id === activeBand) < curIdx
  return (
    <div style={{padding:'16px 20px 24px'}}>
      <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,margin:'0 0 14px',lineHeight:1.6}}>Age-matched kitchen jobs, from first pours to first cuts, so cooking together happens daily.</p>

      {!guide&&!loading&&<div style={{background:C.primaryFixed,borderRadius:16,padding:'40px 24px',marginBottom:14,textAlign:'center'}}>
        <div style={{width:56,height:56,borderRadius:'50%',background:'rgba(45,96,47,0.10)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}>
          <Icon name='chefHat' size={26} color={C.primary}/>
        </div>
        <div style={{...ep,fontSize:19,color:C.onSurface,marginBottom:8}}>Nothing here yet</div>
        <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:20,lineHeight:1.6,maxWidth:240,marginLeft:'auto',marginRight:'auto'}}>Generate an AI toddler cooking guide, personalised to your toddler's age.</p>
        <Btn label={<><Icon name='sparkles' size={16} color={C.onPrimary}/><span>Generate toddler cooking guide</span></>} onClick={onGenerate}/>
      </div>}

      {loading&&<Spinner msg='Finding age-appropriate tools & tasks…'/>}
      {error&&<div style={{...CARD,padding:16,marginBottom:14,borderLeft:`4px solid ${C.error}`}}><p style={{...mn,fontSize:13,color:C.error,margin:0}}>⚠️ {error}</p></div>}

      {guide&&<>
        <div style={{...CARD,padding:'14px 16px',marginBottom:16,background:C.accent2_100,border:`1px solid ${C.accent2_300}`}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
            <span style={{fontSize:14}}>🧰</span>
            <span style={{...mn,fontSize:10,fontWeight:700,color:C.accent2_700,letterSpacing:'0.07em',textTransform:'uppercase'}}>Tools worth having</span>
          </div>
          {(guide.tools||[]).map((t,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderTop:i>0?`1px solid ${C.accent2_300}40`:'none'}}>
              <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{t.icon||'🔧'}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface}}>{t.name}</div>
                <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5}}>{t.description}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:6,padding:'0 0 12px',overflowX:'auto'}}>
          {orderedBands.map(b=>{
            const active = activeBand===b.id
            const tag = b.id===currentBand ? 'NOW' : (TODDLER_AGE_BANDS.findIndex(x=>x.id===b.id) > curIdx ? 'NEXT' : null)
            return (
              <button key={b.id} onClick={()=>setActiveBand(b.id)} style={{...mn,padding:'8px 14px',borderRadius:R.pill,border:'none',background:active?C.primary:C.secondaryContainer,color:active?C.onPrimary:C.onSecondaryContainer,fontWeight:700,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,display:'flex',alignItems:'center',gap:6}}>
                <span>{b.label}</span>
                {tag&&<span style={{...mn,fontSize:9,fontWeight:800,letterSpacing:'0.06em',color:active?C.onPrimary:C.accent2_700,opacity:active?0.85:1}}>{tag}</span>}
              </button>
            )
          })}
        </div>

        <p style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5,margin:'0 0 12px'}}>
          {isNow ? 'Where your toddler is now — jobs to try together this week.'
            : isPast ? 'An earlier stage — handy if a younger sibling joins in.'
            : 'Coming up — things to get ready for as your toddler grows into them.'}
        </p>

        {tasks.length===0
          ? <div style={{...CARD,padding:16}}><p style={{...mn,fontSize:13,color:C.onSurfaceVariant,margin:0}}>No tasks for this age band yet.</p></div>
          : <div style={{...CARD,padding:0,overflow:'hidden'}}>
              {tasks.map((t,i)=>(
                <div key={i} style={{padding:'12px 16px',borderTop:i>0?`1px solid ${C.outlineVariant}25`:'none',display:'flex',gap:12}}>
                  <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{t.icon||'🍽️'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface,marginBottom:2}}>{t.title}</div>
                    <p style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.6,margin:0,marginBottom:t.needsTool?6:0}}>{t.description}</p>
                    {t.needsTool&&<div style={{...mn,fontSize:11,fontWeight:700,color:C.primary,background:C.primaryFixed,padding:'4px 10px',borderRadius:R.sm,display:'inline-block'}}>Needs: {t.needsTool}</div>}
                  </div>
                </div>
              ))}
            </div>
        }
      </>}
    </div>
  )
}
