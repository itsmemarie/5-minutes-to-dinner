import { useEffect, useMemo, useState } from 'react'
import { C, ep, mn, CARD, R } from '../lib/theme.js'
import { fetchRecipeIngredients } from '../lib/supabase.js'
import { groupShoppingByRecipe } from '../lib/shoppingByRecipe.js'
import { Spinner, Icon } from './ui/index.js'

const ROW_DIVIDER=`1px solid ${C.outlineVariant}25`

export function Tick({checked}){
  return(
    <div style={{width:22,height:22,borderRadius:R.pill,border:`2px solid ${checked?C.tertiary:C.outlineVariant}`,background:checked?C.tertiary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      {checked&&<Icon name='check' size={13} color={C.onPrimary}/>}
    </div>
  )
}

function RecipeLine({line,divider,onToggle}){
  const {name,qty,items}=line
  const onList=items.length>0
  const checked=onList&&items.every(i=>i.checked)
  // Ticks live on the list items. One line can stand for several when the list
  // repeats a name; they move together, so only the ones out of step flip.
  const toggle=()=>items.filter(i=>!!i.checked===checked).forEach(i=>onToggle(i.id))
  const strike={opacity:checked?0.45:1,textDecoration:checked?'line-through':'none'}
  return(
    <div onClick={onList?toggle:undefined} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderBottom:divider?ROW_DIVIDER:undefined,cursor:onList?'pointer':undefined}}>
      {onList?<Tick checked={checked}/>:<div style={{width:22,height:22,borderRadius:R.pill,border:`2px dashed ${C.outlineVariant}`,flexShrink:0,boxSizing:'border-box'}}/>}
      <span style={{...mn,fontSize:14,flex:1,color:onList?C.onSurface:C.onSurfaceVariant,...strike}}>{name}</span>
      {qty&&<span style={{...mn,fontSize:12,fontWeight:700,textAlign:'right',color:onList?C.onSurface:C.onSurfaceVariant,...strike,opacity:checked?0.45:0.6}}>{qty}</span>}
    </div>
  )
}

function Heading({children,aside}){
  return(
    <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12,marginBottom:8}}>
      <div style={{...ep,fontSize:16,letterSpacing:'0.06em',color:C.onSurface}}>{children}</div>
      {aside&&<div style={{...mn,fontSize:11,color:C.onSurfaceVariant,flexShrink:0}}>{aside}</div>}
    </div>
  )
}

// The week's list seen recipe by recipe. `portions` is the planned portions per
// recipe in plan order; list items no recipe claims come back through `renderItem`,
// so nothing on the list disappears in this view.
export function ShoppingByRecipe({portions,shopping,onToggle,renderItem}){
  const [recipes,setRecipes]=useState(null)
  const [error,setError]=useState(null)
  const idsKey=[...portions.keys()].join('|')
  const portionsKey=[...portions].join('|')
  useEffect(()=>{
    let stale=false
    setError(null)
    fetchRecipeIngredients([...portions.keys()])
      .then(rows=>{if(!stale)setRecipes(rows)})
      .catch(e=>{if(!stale)setError(e.message)})
    return()=>{stale=true}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[idsKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view=useMemo(()=>recipes&&groupShoppingByRecipe(recipes,portions,shopping),[recipes,portionsKey,shopping])

  if(error)return(
    <div style={{...CARD,padding:16,marginBottom:14,borderLeft:`4px solid ${C.error}`}}>
      <p style={{...mn,fontSize:13,color:C.error,margin:0,lineHeight:1.6}}>⚠️ Couldn't load your recipes: {error}</p>
    </div>
  )
  if(!view)return <Spinner msg='Matching your list to your recipes…'/>

  const {groups,others}=view
  const someMissing=groups.some(g=>g.lines.some(l=>!l.items.length))
  return(
    <>
      {(!groups.length||someMissing)&&(
        <p style={{...mn,fontSize:11,lineHeight:1.5,color:C.onSurfaceVariant,margin:'0 0 12px'}}>
          {groups.length?"Dashed items aren't on your list.":'No recipes are planned this week.'}
        </p>
      )}
      {groups.map(g=>(
        <div key={g.id} style={{marginBottom:18}}>
          <Heading aside={`${g.portions} portion${g.portions!==1?'s':''}`}>{g.title}</Heading>
          <div style={{...CARD,padding:0,overflow:'hidden'}}>
            {g.lines.length?g.lines.map((line,i)=>(
              <RecipeLine key={line.name} line={line} divider={i<g.lines.length-1} onToggle={onToggle}/>
            )):(
              <div style={{...mn,fontSize:13,color:C.onSurfaceVariant,padding:'12px 14px'}}>No ingredients saved for this recipe.</div>
            )}
          </div>
        </div>
      ))}
      {others.length>0&&(
        <div style={{marginBottom:18}}>
          <Heading>Other items</Heading>
          <div style={{...CARD,padding:0,overflow:'hidden'}}>
            {others.map((item,i)=>renderItem(item,i<others.length-1))}
          </div>
        </div>
      )}
    </>
  )
}
