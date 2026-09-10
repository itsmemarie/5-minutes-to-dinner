import { mn, C, R } from '../lib/theme.js'
import { Icon } from './ui/Icon.jsx'
import { RecipeTile } from './RecipeTile.jsx'

// Photo-view counterpart to RecipeBucket. Deliberately the same prop signature,
// so RecipeSelectionScreen swaps the component and nothing else. The section's
// items go in a grid rather than RecipeBucket's single CARD wrapper.
export function RecipePhotoBucket({ title, items, disabled, selected, onToggle, onPreview, suggestionLabel, nutritionByRecipe }) {
  if (!items.length) return null
  return (
    <div style={{marginBottom:16}}>
      <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:suggestionLabel?6:8}}>{title}</div>
      {/* Shown once per section, not per tile — a ~199px card has no room for it. */}
      {suggestionLabel && (
        <div style={{display:'inline-flex',alignItems:'center',gap:4,background:C.accent2_100,border:`1.5px solid ${C.accent2_300}`,borderRadius:R.pill,padding:'2px 8px',marginBottom:8}}>
          <Icon name='sparkles' size={12} color={C.accent2_600}/>
          <span style={{...mn,fontSize:12,fontWeight:700,color:C.accent2_700,textTransform:'uppercase',letterSpacing:'0.03em'}}>Goes well with {suggestionLabel}</span>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}}>
        {items.map(r => (
          <RecipeTile
            key={r.id}
            r={r}
            disabled={disabled}
            selected={selected}
            onToggle={onToggle}
            onPreview={onPreview}
            nutrition={nutritionByRecipe?.[r.id]}
          />
        ))}
      </div>
    </div>
  )
}
