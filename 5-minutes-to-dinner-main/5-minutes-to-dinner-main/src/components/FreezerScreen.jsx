import { useState } from 'react'
import { C, ep, mn, CARD } from '../lib/theme.js'
import { Btn } from './ui/index.js'
import { extractFreezerItems } from '../lib/ai.js'

export function FreezerScreen({items,onReplace,onAddOne,onToggleStock,onDelete}){
  const [pasteText,setPasteText]=useState('')
  const [images,setImages]=useState([])
  const [manualName,setManualName]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState(null)

  const inp=(extra)=>({...mn,width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${C.outlineVariant}`,fontSize:14,background:C.white,outline:'none',boxSizing:'border-box',...extra})

  const handleImageSelect=(e)=>{
    const files=Array.from(e.target.files||[])
    if(!files.length)return
    files.forEach(file=>{
      const reader=new FileReader()
      reader.onload=(ev)=>{
        setImages(p=>[...p,{base64:ev.target.result.split(',')[1],mediaType:file.type,name:file.name}])
      }
      reader.readAsDataURL(file)
    })
    e.target.value=''
  }
  const removeImage=(idx)=>setImages(p=>p.filter((_,i)=>i!==idx))

  const handleReplaceFromText=async()=>{
    if(!pasteText.trim())return
    setBusy(true);setError(null)
    try{
      const names=await extractFreezerItems({text:pasteText})
      if(!names.length){setError('No items found in that text.');return}
      await onReplace(names)
      setPasteText('')
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  const handleReplaceFromImages=async()=>{
    if(!images.length)return
    setBusy(true);setError(null)
    try{
      const names=await extractFreezerItems({images:images.map(({base64,mediaType})=>({base64,mediaType}))})
      if(!names.length){setError('No items found in those photos.');return}
      await onReplace(names)
      setImages([])
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  const handleAddOne=async()=>{
    if(!manualName.trim())return
    setBusy(true);setError(null)
    try{
      await onAddOne(manualName.trim())
      setManualName('')
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  return(
    <div style={{padding:'20px 20px 40px'}}>
      <div style={{...ep,fontSize:26,color:C.onSurface,marginBottom:4}}>Freezer</div>
      <div style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:20,lineHeight:1.5}}>Import a list to use when planning meals. Importing a new list replaces your entire current inventory.</div>

      {error&&<div style={{...mn,fontSize:13,color:C.error,background:C.errorContainer,padding:'10px 14px',borderRadius:10,marginBottom:16}}>{error}</div>}

      <div style={{...CARD,padding:'16px 16px',marginBottom:16}}>
        <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>Paste a list</div>
        <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} placeholder={'One item per line, e.g.\nChicken curry\nBeef mince\nLasagne'} rows={5} style={inp({resize:'vertical',marginBottom:10})} disabled={busy}/>
        <Btn label={busy?'Working…':'Replace with this list'} full onClick={handleReplaceFromText} disabled={busy||!pasteText.trim()}/>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
        <div style={{flex:1,height:1,background:C.outline+'40'}}/>
        <span style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>or</span>
        <div style={{flex:1,height:1,background:C.outline+'40'}}/>
      </div>

      <div style={{...CARD,padding:'16px 16px',marginBottom:20}}>
        <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>Upload a photo</div>
        <label style={{display:'block',border:`2px dashed ${C.outlineVariant}`,borderRadius:10,padding:'14px 16px',textAlign:'center',cursor:busy?'not-allowed':'pointer',background:C.white}}>
          <input type='file' accept='image/*' multiple onChange={handleImageSelect} style={{display:'none'}} disabled={busy}/>
          <div style={{...mn,fontSize:13,color:images.length?C.onSurface:C.onSurfaceVariant}}>{images.length?`Tap to add more photos (${images.length} selected)`:'Tap to choose photo(s) of your freezer list'}</div>
        </label>
        {images.length>0&&(
          <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:10}}>
            {images.map((img,idx)=>(
              <div key={idx} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:8,background:C.white,border:`1px solid ${C.outlineVariant}40`}}>
                <span style={{...mn,fontSize:13,color:C.onSurface,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📷 {img.name}</span>
                <button onClick={()=>removeImage(idx)} disabled={busy} style={{border:'none',background:'none',color:C.error,fontSize:16,cursor:busy?'not-allowed':'pointer',padding:'0 4px',lineHeight:1}}>×</button>
              </div>
            ))}
          </div>
        )}
        {images.length>0&&(
          <div style={{marginTop:10}}>
            <Btn label={busy?'Working…':'Extract & Replace'} full onClick={handleReplaceFromImages} disabled={busy}/>
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <input value={manualName} onChange={e=>setManualName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddOne()} placeholder='Add a single item…' style={{...inp(),flex:1}} disabled={busy}/>
        <Btn label='Add' small onClick={handleAddOne} disabled={busy||!manualName.trim()}/>
      </div>

      <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>Current Inventory ({items.length})</div>
      {items.length===0?(
        <div style={{...CARD,padding:24,textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:8}}>❄</div>
          <div style={{...mn,fontSize:14,color:C.onSurfaceVariant}}>No freezer items yet.</div>
        </div>
      ):items.map(item=>(
        <div key={item.id} style={{...CARD,padding:'10px 14px',display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <span style={{...mn,fontSize:14,color:item.in_stock?C.onSurface:C.onSurfaceVariant,flex:1,textDecorationLine:item.in_stock?'none':'line-through'}}>{item.name}</span>
          <div onClick={()=>onToggleStock(item.id,!item.in_stock)} style={{width:40,height:22,borderRadius:99,background:item.in_stock?C.primary:C.outlineVariant,position:'relative',transition:'background 0.2s',flexShrink:0,cursor:'pointer'}}>
            <div style={{position:'absolute',top:3,left:item.in_stock?21:3,width:16,height:16,borderRadius:99,background:'#fff',transition:'left 0.2s'}}/>
          </div>
          <button onClick={()=>onDelete(item.id)} style={{border:'none',background:'none',color:C.error,fontSize:18,cursor:'pointer',padding:'0 2px',lineHeight:1}}>×</button>
        </div>
      ))}
    </div>
  )
}
