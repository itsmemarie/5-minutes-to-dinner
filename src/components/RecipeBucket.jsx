import { useId } from 'react'
import { CARD } from '../lib/theme.js'
import { RecipeCard } from './RecipeCard.jsx'
import { BucketHeader } from './BucketHeader.jsx'

// `count` defaults to the bucket's length. `collapsed` keeps the header and hides
// the rows.
export function RecipeBucket({title,subtitle,count,action,collapsed,items,disabled,selected,onToggle,onPreview,suggestionLabel,nutritionByRecipe}){
  const headId=useId()
  if(!items.length)return null
  return(
    <section aria-labelledby={headId} style={{marginBottom:28}}>
      <BucketHeader id={headId} title={title} count={count??items.length} subtitle={subtitle} action={action}/>
      {!collapsed&&(
        <div style={{...CARD,overflow:'hidden'}}>
          {items.map((r,i)=><RecipeCard key={r.id} r={r} disabled={disabled} selected={selected} onToggle={onToggle} onPreview={onPreview} suggestionLabel={suggestionLabel} isLast={i===items.length-1} nutrition={nutritionByRecipe?.[r.id]}/>)}
        </div>
      )}
    </section>
  )
}
