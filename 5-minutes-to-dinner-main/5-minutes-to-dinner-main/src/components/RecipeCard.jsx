import { C, mn, CARD } from '../lib/theme.js'
import { CapLabel } from './ui/index.js'
import { Icon } from './ui/Icon.jsx'

export function RecipeCard({r,disabled,selected,onToggle,onPreview,suggestionLabel}){
  const sel=selected.includes(r.id)
  return(
    <div onClick={disabled?undefined:()=>onToggle(r.id)} style={{...CARD,background:C.surfaceContainerHigh,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:disabled?'default':'pointer',opacity:disabled?0.55:1,marginBottom:8}}>
      <div style={{flex:1}}>
        {suggestionLabel&&(
          <div style={{display:'inline-flex',alignItems:'center',gap:4,background:C.accent2_100,border:`1.5px solid ${C.accent2_300}`,borderRadius:999,padding:'2px 8px',marginBottom:6}}>
            <Icon name='sparkles' size={12} color={C.accent2_600}/>
            <span style={{...mn,fontSize:12,fontWeight:700,color:C.accent2_700,textTransform:'uppercase',letterSpacing:'0.03em'}}>Goes well with {suggestionLabel}</span>
          </div>
        )}
        <div
          onClick={onPreview?e=>{e.stopPropagation();onPreview(r.id)}:undefined}
          style={{...mn,fontSize:14,fontWeight:600,color:onPreview?C.primary:C.onSurface,marginBottom:4,textDecorationLine:onPreview?'underline':'none',textDecorationStyle:'dotted',cursor:onPreview?'pointer':'default',display:'inline-block'}}
        >{r.name}</div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <CapLabel text={`${Math.max(r.base,r.min)}p`}/>
          <span style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>🕒 {r.prep} m prep</span>
          <span style={{fontSize:13}}>{r.diet==='veg'||r.diet==='vegan'?'🌿':'🐰'}</span>
          {r.fun&&<span style={{...mn,fontSize:10,background:C.secondaryContainer,color:C.onSecondaryContainer,padding:'1px 6px',borderRadius:99,fontWeight:700}}>F</span>}
          {r.husband&&<span style={{...mn,fontSize:10,background:C.secondaryContainer,color:C.onSecondaryContainer,padding:'1px 6px',borderRadius:99,fontWeight:700}}>H</span>}
        </div>
      </div>
      <div style={{width:30,height:30,borderRadius:99,border:`2px solid ${disabled?C.outlineVariant:sel?C.primary:C.outlineVariant}`,background:disabled?C.surfaceContainerHigh:sel?C.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:disabled?C.outline:sel?C.onPrimary:C.outline,fontSize:14,fontWeight:700}}>
        {disabled?'✓':sel?'✓':'+'}
      </div>
    </div>
  )
}
