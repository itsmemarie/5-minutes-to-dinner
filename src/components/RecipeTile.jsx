import { useState } from 'react'
import { C, mn, R } from '../lib/theme.js'
import { Icon } from './ui/Icon.jsx'
import { rowFigure } from '../lib/goalMaths.js'
import { splitRecipeName } from '../lib/recipeParsing.js'

// Photo-view counterpart to RecipeCard. Same select-then-confirm model as the
// list row — the `+` toggles selection, the footer CTA does the actual add —
// but the tap targets are inverted: here the photo *is* the "show me more"
// affordance, so the card body opens the recipe and only the `+` selects.
export function RecipeTile({ r, disabled, selected, onToggle, onPreview, nutrition }) {
  const [failed, setFailed] = useState(false)
  const sel = selected.includes(r.id)
  const portions = Math.max(r.base, r.min)
  const { title, code } = splitRecipeName(r.name)
  const showImg = !!r.imageUrl && !failed

  const openBody = disabled ? undefined : () => (onPreview ? onPreview(r.id) : onToggle(r.id))
  const toggle = e => { e.stopPropagation(); onToggle(r.id) }

  return (
    <div
      onClick={openBody}
      style={{
        borderRadius:12, overflow:'hidden', background:C.white,
        boxShadow: sel
          ? `0 0 0 2px ${C.primary}, 0 1px 3px rgba(24,36,23,0.16)`
          : '0 1px 3px rgba(24,36,23,0.16)',
        display:'flex', flexDirection:'column',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {/* Fixed 4:3 box shared by photo and placeholder, so neither state shifts
          layout. No overflow:hidden here — the `+` deliberately overhangs the
          boundary; the card's own overflow:hidden rounds the image corners. */}
      <div style={{position:'relative',aspectRatio:'4/3',width:'100%',flexShrink:0}}>
        {showImg ? (
          <img
            src={r.imageUrl}
            alt=''
            width={800}
            height={600}
            loading='lazy'
            decoding='async'
            onError={() => setFailed(true)}
            style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',display:'block'}}
          />
        ) : (
          <div style={{
            position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
            background:`repeating-linear-gradient(135deg,${C.placeholderStripeA} 0 6px,${C.placeholderStripeB} 6px 12px)`,
          }}>
            <span style={{fontFamily:'ui-monospace,monospace',fontSize:9,color:C.placeholderInk,letterSpacing:'0.04em'}}>{code}</span>
          </div>
        )}

        <span style={{position:'absolute',top:7,left:7,background:'rgba(24,36,23,0.8)',color:C.onPrimary,...mn,fontSize:10,fontWeight:700,padding:'3px 7px',borderRadius:R.pill,display:'inline-flex',alignItems:'center',gap:3}}>
          <Icon name='clock' size={10} color={C.onPrimary}/>{r.prep}m
        </span>
        <span style={{position:'absolute',top:6,right:7,background:'rgba(255,255,255,0.94)',fontSize:11,lineHeight:1,padding:'4px 5px',borderRadius:R.pill}}>
          {r.diet === 'veg' || r.diet === 'vegan' ? '🌿' : '🐰'}
        </span>

        <button
          onClick={disabled ? undefined : toggle}
          disabled={disabled}
          aria-label={sel ? `Deselect ${title}` : `Select ${title}`}
          aria-pressed={sel}
          style={{
            position:'absolute',bottom:-14,right:8,width:30,height:30,borderRadius:R.pill,
            background: disabled ? C.surfaceContainerHigh : C.primary,
            color: disabled ? C.outline : C.onPrimary,
            border:`2px solid ${C.white}`,padding:0,
            display:'flex',alignItems:'center',justifyContent:'center',
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          {disabled || sel
            ? <Icon name='check' size={16} color={disabled ? C.outline : C.onPrimary}/>
            : <Icon name='plus' size={16} color={C.onPrimary}/>}
          {/* Transparent 44px hit area; no CSS classes here, so no ::before. */}
          {!disabled && <span style={{position:'absolute',top:-7,bottom:-7,left:-7,right:-7}}/>}
        </button>
      </div>

      <div style={{padding:'9px 11px 11px'}}>
        <div style={{...mn,fontSize:12.5,fontWeight:600,color:C.onSurface,lineHeight:1.3,marginBottom:6,paddingRight:24}}>{title}</div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',fontVariantNumeric:'tabular-nums'}}>
          <span style={{...mn,fontSize:10.5,fontWeight:700,display:'inline-flex',alignItems:'center',gap:3,background:C.primaryFixed,color:C.primary,padding:'2px 6px',borderRadius:R.pill}}>
            <Icon name='utensilsCrossed' size={10} color={C.primary}/>{portions}
          </span>
          {r.fun && <span style={{...mn,fontSize:10,fontWeight:700,background:C.secondaryContainer,color:C.onSecondaryContainerStrong,padding:'2px 6px',borderRadius:R.pill}}>F</span>}
          {r.husband && <span style={{...mn,fontSize:10,fontWeight:700,background:C.secondaryContainer,color:C.onSecondaryContainerStrong,padding:'2px 6px',borderRadius:R.pill}}>H</span>}
          {nutrition?.kcal != null && (
            <span style={{...mn,fontSize:10.5,color:C.onSurfaceVariant,width:'100%'}}>{rowFigure(nutrition)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
