import { useEffect, useState } from 'react'
import { C, ep, mn, CARD, screenTitle, R } from '../lib/theme.js'
import { WEEK_LBL } from '../lib/dateHelpers.js'
import { Spinner, HDivider, Btn, Icon } from './ui/index.js'
import { BuyersEyeSheet } from './BuyersEyeSheet.jsx'
import { matchProduceGuide } from '../lib/supabase.js'

const PRODUCE_AISLES=['FRUIT','VEGETABLES']
const NO_TIPS_KEY='buyersEyeNoTips'

export function ShoppingListScreen({shopping,onToggle,loading,error,onRegenerate}){
  const [copied,setCopied]=useState(false)
  const [guideMap,setGuideMap]=useState({}) // itemId -> uuid | null | 'checking'
  const [noTipsNames,setNoTipsNames]=useState(()=>new Set(JSON.parse(sessionStorage.getItem(NO_TIPS_KEY)||'[]')))
  const [sheetItem,setSheetItem]=useState(null) // {id,name,guideId} | null
  const AISLES=['VEGETABLES','FRUIT','MEAT','FISH','DAIRY','BAKERY','DRY GOODS','PANTRY','FROZEN','OTHER']

  const produceSignature=shopping.filter(s=>PRODUCE_AISLES.includes(s.aisle)).map(s=>`${s.id}:${s.name}`).join('|')
  useEffect(()=>{
    const candidates=shopping.filter(s=>PRODUCE_AISLES.includes(s.aisle)&&guideMap[s.id]===undefined)
    if(!candidates.length)return
    setGuideMap(prev=>({...prev,...Object.fromEntries(candidates.map(c=>[c.id,'checking']))}))
    candidates.forEach(async item=>{
      const id=await matchProduceGuide(item.name).catch(()=>null)
      setGuideMap(prev=>({...prev,[item.id]:id}))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[produceSignature])

  const markNoTips=name=>{
    const key=name.trim().toLowerCase()
    setNoTipsNames(prev=>{
      const next=new Set(prev); next.add(key)
      sessionStorage.setItem(NO_TIPS_KEY,JSON.stringify([...next]))
      return next
    })
  }
  const unc=shopping.filter(s=>!s.checked).length
  // Surface any aisles returned by AI that aren't in the canonical list
  const extra=[...new Set(shopping.map(s=>s.aisle).filter(a=>a&&!AISLES.includes(a)))]
  const orderedAisles=[...AISLES,...extra]
  const copyUnchecked=()=>{
    const groups=orderedAisles.map(aisle=>({aisle,items:shopping.filter(s=>s.aisle===aisle&&!s.checked)})).filter(g=>g.items.length)
    if(!groups.length)return
    const text=groups.map(({aisle,items})=>{
      const heading=aisle.charAt(0)+aisle.slice(1).toLowerCase()
      return `${heading}\n${items.map(item=>`• ${item.name}${item.amount?' — '+item.amount+(item.unit?' '+item.unit:''):''}`).join('\n')}`
    }).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true);setTimeout(()=>setCopied(false),2000)
  }
  return(
    <div style={{padding:'16px 20px 90px'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:4}}>
        <div>
          <div style={{...screenTitle,color:C.onSurface}}>Shopping list</div>
          <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,marginTop:2}}>{WEEK_LBL}</div>
          {!loading&&shopping.length>0&&<div style={{...mn,fontSize:12,color:C.primary,marginTop:2,fontWeight:600}}>{unc} item{unc!==1?'s':''} remaining</div>}
        </div>
        {shopping.length>0&&!loading&&(
          <button onClick={onRegenerate} title='Regenerate' style={{display:'flex',alignItems:'center',gap:8,border:'none',background:C.secondaryContainer,color:C.onSecondaryContainerStrong,borderRadius:R.pill,padding:'7px 14px',...mn,fontWeight:700,fontSize:12,whiteSpace:'nowrap',cursor:'pointer',flexShrink:0}}>
            <Icon name='refreshCw' size={14}/>Generate
          </button>
        )}
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
        <div style={{...CARD,padding:32,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
          <Icon name='cart' size={30} color={C.outlineVariant}/>
          <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,lineHeight:1.6,margin:0}}>No shopping list yet. Plan some meals, then generate.</p>
          <Btn label='✨ Generate Shopping List' onClick={onRegenerate} small/>
        </div>
      ):(
        orderedAisles.map(aisle=>{
          const items=shopping.filter(s=>s.aisle===aisle)
          if(!items.length)return null
          return(
            <div key={aisle} style={{marginBottom:18}}>
              <div style={{...ep,fontSize:16,letterSpacing:'0.06em',color:C.onSurface,marginBottom:8}}>{aisle.charAt(0)+aisle.slice(1).toLowerCase()}</div>
              <div style={{...CARD,padding:0,overflow:'hidden'}}>
                {items.map((item,i)=>(
                  <div key={item.id} onClick={()=>onToggle(item.id)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderBottom:i<items.length-1?`1px solid ${C.outlineVariant}25`:undefined,cursor:'pointer'}}>
                    <div style={{width:22,height:22,borderRadius:R.pill,border:`2px solid ${item.checked?C.tertiary:C.outlineVariant}`,background:item.checked?C.tertiary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {item.checked&&<Icon name='check' size={13} color={C.onPrimary}/>}
                    </div>
                    <span style={{...mn,fontSize:14,flex:1,opacity:item.checked?0.45:1,textDecoration:item.checked?'line-through':'none',color:C.onSurface}}>{item.name}</span>
                    {(item.amount||item.unit)&&<span style={{...mn,fontSize:12,fontWeight:700,opacity:item.checked?0.45:0.6,textDecoration:item.checked?'line-through':'none',color:C.onSurface}}>{item.amount}{item.unit?' '+item.unit:''}</span>}
                    {PRODUCE_AISLES.includes(item.aisle)&&(()=>{
                      const g=guideMap[item.id]
                      if(g===undefined||g==='checking')return null
                      if(g) return(
                        <button onClick={e=>{e.stopPropagation();setSheetItem({id:item.id,name:item.name,guideId:g})}} title="Buyer's Eye" style={{border:'none',background:'transparent',padding:4,display:'flex',cursor:'pointer',flexShrink:0}}>
                          <Icon name='info' size={15} color={C.onSurfaceVariant}/>
                        </button>
                      )
                      if(noTipsNames.has(item.name.trim().toLowerCase()))return null
                      return(
                        <button onClick={e=>{e.stopPropagation();setSheetItem({id:item.id,name:item.name,guideId:null})}} title="Get expert tips" style={{border:'none',background:'transparent',padding:4,display:'flex',cursor:'pointer',flexShrink:0,opacity:0.55}}>
                          <Icon name='sparkles' size={14} color={C.tertiary}/>
                        </button>
                      )
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
      {unc>0&&!loading&&(
        <div style={{position:'sticky',bottom:10,padding:'8px 0'}}>
          <button onClick={copyUnchecked} style={{width:'100%',background:C.primary,color:C.onPrimary,border:'none',borderRadius:R.pill,padding:'15px',...mn,fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(45,96,47,0.3)',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            <Icon name={copied?'check':'clipboardCheck'} size={17} color={C.onPrimary}/>{copied?'Copied':'Copy to text'}
          </button>
        </div>
      )}
      {sheetItem&&(
        <BuyersEyeSheet
          item={sheetItem}
          guideId={sheetItem.guideId}
          onClose={()=>setSheetItem(null)}
          onResolved={(itemId,resolvedGuideId,opts)=>{
            if(opts?.noTips){
              const src=shopping.find(s=>s.id===itemId)
              if(src)markNoTips(src.name)
            }else if(resolvedGuideId){
              setGuideMap(prev=>({...prev,[itemId]:resolvedGuideId}))
            }
          }}
        />
      )}
    </div>
  )
}
