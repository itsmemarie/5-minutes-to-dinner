import { C, ep, mn, CARD } from '../lib/theme.js'
import { WEEK_LBL } from '../lib/dateHelpers.js'
import { Spinner, HDivider, Btn } from './ui/index.js'

export function ShoppingListScreen({shopping,onToggle,loading,error,onRegenerate}){
  const AISLES=['VEGETABLES','FRUIT','MEAT','FISH','DAIRY','BAKERY','DRY GOODS','PANTRY','FROZEN','OTHER']
  const unc=shopping.filter(s=>!s.checked).length
  // Surface any aisles returned by AI that aren't in the canonical list
  const extra=[...new Set(shopping.map(s=>s.aisle).filter(a=>a&&!AISLES.includes(a)))]
  const orderedAisles=[...AISLES,...extra]
  const copyUnchecked=()=>{
    const items=orderedAisles.flatMap(aisle=>shopping.filter(s=>s.aisle===aisle&&!s.checked))
    if(!items.length)return
    navigator.clipboard.writeText(items.map(item=>`• ${item.name}${item.amount?' — '+item.amount+(item.unit?' '+item.unit:''):''}`).join('\n'))
  }
  return(
    <div style={{padding:'16px 20px 20px'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
        <div>
          <div style={{...ep,fontSize:22,fontWeight:700,color:C.onSurface}}>Shopping List</div>
          <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,marginTop:2}}>{WEEK_LBL}</div>
          {!loading&&shopping.length>0&&<div style={{...mn,fontSize:12,color:C.primary,marginTop:2,fontWeight:600}}>{unc} item{unc!==1?'s':''} remaining</div>}
        </div>
        {shopping.length>0&&!loading&&<div style={{display:'flex',gap:8,alignItems:'center'}}>
          {unc>0&&<button onClick={copyUnchecked} style={{...mn,background:C.secondaryContainer,color:C.primary,border:'none',borderRadius:99,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>Copy list</button>}
          <button onClick={onRegenerate} style={{...mn,background:C.secondaryContainer,color:C.primary,border:'none',borderRadius:99,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>✨ Regenerate</button>
        </div>}
      </div>
      <HDivider/>
      {loading?(
        <Spinner msg='Building your shopping list with AI…'/>
      ):error?(
        <div style={{...CARD,padding:16,marginBottom:14,borderLeft:`4px solid ${C.error}`}}>
          <p style={{...mn,fontSize:13,color:C.error,margin:'0 0 12px',lineHeight:1.6}}>⚠️ {error}</p>
          <Btn label='Try Again' onClick={onRegenerate} secondary small/>
        </div>
      ):shopping.length===0?(
        <div style={{...CARD,padding:32,textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:12}}>🛒</div>
          <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,lineHeight:1.6,marginBottom:14}}>No shopping list yet. Plan some meals, then generate.</p>
          <Btn label='✨ Generate Shopping List' onClick={onRegenerate} small/>
        </div>
      ):(
        orderedAisles.map(aisle=>{
          const items=shopping.filter(s=>s.aisle===aisle)
          if(!items.length)return null
          return(
            <div key={aisle} style={{marginBottom:16}}>
              <div style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.07em',color:C.onSurfaceVariant,marginBottom:8,textTransform:'uppercase',borderBottom:`1px solid ${C.outlineVariant}40`,paddingBottom:6}}>{aisle}</div>
              {items.map(item=>(
                <div key={item.id} onClick={()=>onToggle(item.id)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 4px',borderBottom:`1px solid ${C.outlineVariant}20`,cursor:'pointer'}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${item.checked?C.primary:C.outlineVariant}`,background:item.checked?C.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:C.onPrimary,fontSize:12}}>
                    {item.checked&&'✓'}
                  </div>
                  <span style={{...mn,fontSize:14,flex:1,color:item.checked?C.outlineVariant:C.onSurface,textDecoration:item.checked?'line-through':'none'}}>{item.name}</span>
                  {(item.amount||item.unit)&&<span style={{...mn,fontSize:13,fontWeight:600,color:item.checked?C.outlineVariant:C.primary,background:item.checked?C.surfaceContainerHigh:C.secondaryContainer,padding:'3px 10px',borderRadius:99,textDecoration:item.checked?'line-through':'none'}}>{item.amount}{item.unit?' '+item.unit:''}</span>}
                </div>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
