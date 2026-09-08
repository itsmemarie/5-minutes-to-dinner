import { C, mn, R } from '../lib/theme.js'
import { Icon } from './ui/Icon.jsx'
import { rowFigure } from '../lib/goalMaths.js'

export function RecipeCard({r,disabled,selected,onToggle,onPreview,suggestionLabel,isLast,nutrition}){
  const sel=selected.includes(r.id)
  const portions=Math.max(r.base,r.min)
  return(
    <div onClick={disabled?undefined:()=>onToggle(r.id)} style={{padding:'11px 14px',borderBottom:isLast?undefined:`1px solid ${C.outlineVariant}26`,display:'flex',alignItems:'center',cursor:disabled?'default':'pointer',opacity:disabled?0.55:1}}>
      <div style={{flex:1,minWidth:0}}>
        {suggestionLabel&&(
          <div style={{display:'inline-flex',alignItems:'center',gap:4,background:C.accent2_100,border:`1.5px solid ${C.accent2_300}`,borderRadius:R.pill,padding:'2px 8px',marginBottom:6}}>
            <Icon name='sparkles' size={12} color={C.accent2_600}/>
            <span style={{...mn,fontSize:12,fontWeight:700,color:C.accent2_700,textTransform:'uppercase',letterSpacing:'0.03em'}}>Goes well with {suggestionLabel}</span>
          </div>
        )}
        <div
          onClick={onPreview?e=>{e.stopPropagation();onPreview(r.id)}:undefined}
          style={{...mn,fontSize:13,fontWeight:600,color:C.onSurface,marginBottom:3,textDecoration:onPreview?'underline':'none',textDecorationColor:C.outlineVariant,cursor:onPreview?'pointer':'default',display:'inline-block'}}
        >{r.name}</div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{...mn,fontSize:11,color:C.onSurface,opacity:0.6}}>{r.prep}m</span>
          <span style={{fontSize:12,lineHeight:1}}>{r.diet==='veg'||r.diet==='vegan'?'🌿':'🐰'}</span>
          {r.fun&&<span style={{...mn,fontSize:10,fontWeight:700,background:C.secondaryContainer,color:C.onSecondaryContainerStrong,padding:'2px 7px',borderRadius:R.pill}}>F</span>}
          {r.husband&&<span style={{...mn,fontSize:10,fontWeight:700,background:C.secondaryContainer,color:C.onSecondaryContainerStrong,padding:'2px 7px',borderRadius:R.pill}}>H</span>}
          <span style={{...mn,fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',gap:3,background:C.primaryFixed,color:C.primary,padding:'2px 7px',borderRadius:R.pill}}>
            <Icon name='utensilsCrossed' size={11} color={C.primary}/>{portions}
            <span style={{display:'flex',transform:'rotate(90deg)'}}><Icon name='chevronRight' size={10} color={C.primary}/></span>
          </span>
          {nutrition?.kcal!=null&&(
            <span style={{...mn,fontSize:11,color:C.onSurfaceVariant,fontVariantNumeric:'tabular-nums',borderLeft:`1px solid ${C.outlineVariant}`,paddingLeft:10}}>{rowFigure(nutrition)}</span>
          )}
        </div>
      </div>
      <div style={{width:26,height:26,borderRadius:R.pill,border:`2px solid ${disabled?C.outlineVariant:sel?C.primary:C.outlineVariant}`,background:disabled?C.surfaceContainerHigh:sel?C.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginLeft:10,color:disabled?C.outline:C.onPrimary}}>
        {disabled||sel?<Icon name='check' size={14} color={disabled?C.outline:C.onPrimary}/>:<Icon name='plus' size={14} color={C.outline}/>}
      </div>
    </div>
  )
}
