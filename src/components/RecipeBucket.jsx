import { mn, C, CARD } from '../lib/theme.js'
import { RecipeCard } from './RecipeCard.jsx'

export function RecipeBucket({title,items,disabled,selected,onToggle,onPreview,suggestionLabel,nutritionByRecipe}){
  if(!items.length)return null
  return(
    <div style={{marginBottom:16}}>
      <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:8}}>{title}</div>
      <div style={{...CARD,overflow:'hidden'}}>
        {items.map((r,i)=><RecipeCard key={r.id} r={r} disabled={disabled} selected={selected} onToggle={onToggle} onPreview={onPreview} suggestionLabel={suggestionLabel} isLast={i===items.length-1} nutrition={nutritionByRecipe?.[r.id]}/>)}
      </div>
    </div>
  )
}
