import { useEffect, useRef, useState } from 'react'
import { C, ep, mn, CARD, R } from '../lib/theme.js'
import { Spinner, Btn, Icon } from './ui/index.js'
import { callEdgeFn } from '../lib/ai.js'
import { fetchProduceGuide, matchProduceGuide, mergeProduceGuideAliases, insertProduceGuide } from '../lib/supabase.js'

const ROW = (icon, label, value) => value ? (
  <div style={{display:'flex',gap:10,padding:'9px 0',borderTop:`1px solid ${C.outlineVariant}25`}}>
    <span style={{fontSize:15,lineHeight:'20px',flexShrink:0,width:18,textAlign:'center'}}>{icon}</span>
    <div>
      <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{label}</div>
      <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.5,margin:0}}>{value}</p>
    </div>
  </div>
) : null

export function BuyersEyeSheet({item, guideId, onClose, onResolved}){
  const [status,setStatus]=useState('loading') // loading | ready | no-tips | error
  const [guide,setGuide]=useState(null)
  const [retryTick,setRetryTick]=useState(0)
  const [dragY,setDragY]=useState(0)
  const [dragging,setDragging]=useState(false)
  const dragStartY=useRef(0)

  useEffect(()=>{
    let cancelled=false
    setStatus('loading')
    if(guideId){
      fetchProduceGuide(guideId).then(g=>{ if(!cancelled){ setGuide(g); setStatus('ready') } })
        .catch(()=>{ if(!cancelled) setStatus('error') })
      return
    }
    ;(async()=>{
      try{
        const result=await callEdgeFn('buyers-eye',{name:item.name})
        if(cancelled) return
        if(!result.is_fresh_produce){
          setStatus('no-tips')
          onResolved(item.id,null,{noTips:true})
          return
        }
        const existingId=await matchProduceGuide(result.canonical_name)
        let finalGuide
        if(existingId){
          finalGuide=await mergeProduceGuideAliases(existingId,[...(result.aliases||[]),item.name])
        }else{
          try{
            finalGuide=await insertProduceGuide({
              produce_name: result.canonical_name,
              aliases: [...new Set([...(result.aliases||[]),item.name.toLowerCase()])],
              emoji: result.emoji, top_tell: result.top_tell, look: result.look, feel: result.feel,
              smell: result.smell, avoid: result.avoid, ripeness: result.ripeness, storage: result.storage,
              season_uk: result.season_uk,
            })
          }catch(insertErr){
            const raceId=await matchProduceGuide(result.canonical_name)
            if(!raceId) throw insertErr
            finalGuide=await mergeProduceGuideAliases(raceId,result.aliases||[])
          }
        }
        if(cancelled) return
        setGuide(finalGuide)
        setStatus('ready')
        onResolved(item.id,finalGuide.id)
      }catch{
        if(!cancelled) setStatus('error')
      }
    })()
    return ()=>{ cancelled=true }
  },[guideId,item.id,retryTick])

  const onPointerDown=e=>{ dragStartY.current=e.clientY; setDragging(true) }
  const onPointerMove=e=>{ if(dragging) setDragY(Math.max(0,e.clientY-dragStartY.current)) }
  const onPointerUp=()=>{ if(dragY>80) onClose(); else setDragY(0); setDragging(false) }

  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:50,display:'flex',justifyContent:'center',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:430,maxHeight:'80vh',overflowY:'auto',background:C.white,borderRadius:'20px 20px 0 0',padding:'12px 20px 28px',transform:`translateY(${dragY}px)`,transition:dragging?'none':'transform 0.2s'}}>
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} style={{cursor:'grab',paddingBottom:8}}>
          <div style={{width:36,height:4,borderRadius:R.pill,background:C.outlineVariant,margin:'0 auto 14px'}}/>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:status==='ready'?4:14}}>
            <div style={{flex:1}}>
              <div style={{...mn,fontSize:11,fontWeight:700,color:C.tertiary,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>👁 Buyer's Eye</div>
              {status==='ready'&&<div style={{...ep,fontSize:20,color:C.onSurface}}>{guide.emoji?`${guide.emoji} `:''}{guide.produce_name}</div>}
            </div>
            <button onClick={onClose} style={{border:'none',background:C.surfaceContainerHigh,borderRadius:R.pill,padding:6,display:'flex',cursor:'pointer',flexShrink:0}}>
              <Icon name='x' size={16} color={C.onSurfaceVariant}/>
            </button>
          </div>
        </div>

        {status==='loading'&&<Spinner msg='Getting expert tips…'/>}

        {status==='no-tips'&&(
          <div style={{...CARD,padding:24,textAlign:'center'}}>
            <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,lineHeight:1.6,margin:0}}>No selection tips for this one.</p>
          </div>
        )}

        {status==='error'&&(
          <div style={{...CARD,padding:24,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,lineHeight:1.6,margin:0}}>Tips unavailable right now.</p>
            <Btn label='Try again' onClick={()=>setRetryTick(t=>t+1)} secondary small/>
          </div>
        )}

        {status==='ready'&&(
          <>
            <div style={{background:C.secondaryContainer,borderRadius:12,padding:'14px 16px',margin:'10px 0 4px'}}>
              <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSecondaryContainer,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>The tell</div>
              <p style={{...mn,fontSize:15,fontWeight:600,color:'#924b1a',lineHeight:1.45,margin:0}}>{guide.top_tell}</p>
            </div>
            <div>
              {ROW('👀','Look',guide.look)}
              {ROW('✋','Feel',guide.feel)}
              {ROW('👃','Smell',guide.smell)}
              {ROW('🚫','Avoid',guide.avoid)}
              {ROW('🕐','Ripe now or later?',guide.ripeness)}
              {ROW('🧊','Storage',guide.storage)}
            </div>
            {guide.season_uk&&(
              <div style={{marginTop:14,display:'flex'}}>
                <span style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,background:C.surfaceContainerHigh,borderRadius:R.pill,padding:'5px 12px'}}>📅 {guide.season_uk}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
