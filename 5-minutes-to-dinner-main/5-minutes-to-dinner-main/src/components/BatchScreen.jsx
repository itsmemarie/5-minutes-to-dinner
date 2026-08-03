import { C, ep, mn, CARD, TAG_C, screenTitle } from '../lib/theme.js'
import { Spinner, Btn, Icon } from './ui/index.js'

const TAG_LABEL = { TM6:'THERMOMIX', HOB:'HOB', OVEN:'OVEN', KNIFE:'PREP', NO_COOK:'NO COOK', DONE:'DONE' }

export function BatchScreen({activeTab,setActiveTab,batchData,batchLoading,batchError,onGenerate}){
  const TABS=[{id:'big',label:'Monday · Big'},{id:'medium',label:'Thursday · Med'},{id:'evenings',label:'Evenings'}]
  const session = batchData?.sessions?.find(s=>s.id===activeTab) || null
  return(
    <div style={{padding:'16px 20px 24px'}}>
      <div style={{...screenTitle,color:C.onSurface,marginBottom:4}}>Batch cooking</div>
      <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,margin:'0 0 14px',lineHeight:1.6}}>An AI-organised prep schedule so the week's cooking happens in focused sessions.</p>
      {batchData&&<div style={{display:'flex',gap:6,padding:'0 0 14px',overflowX:'auto'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{...mn,padding:'8px 14px',borderRadius:99,border:'none',background:activeTab===t.id?C.primary:C.secondaryContainer,color:activeTab===t.id?C.onPrimary:C.onSecondaryContainer,fontWeight:700,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{t.label}</button>
        ))}
      </div>}
      {!batchData&&!batchLoading&&<div style={{background:C.primaryFixed,borderRadius:16,padding:'40px 24px',marginBottom:14,textAlign:'center'}}>
        <div style={{width:56,height:56,borderRadius:'50%',background:'rgba(45,96,47,0.10)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px'}}>
          <Icon name='chefHat' size={26} color={C.primary}/>
        </div>
        <div style={{...ep,fontSize:19,color:C.onSurface,marginBottom:8}}>Nothing prepped yet</div>
        <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:20,lineHeight:1.6,maxWidth:240,marginLeft:'auto',marginRight:'auto'}}>Generate an AI batch cooking schedule from your meal plan.</p>
        <Btn label={<><Icon name='sparkles' size={16} color={C.onPrimary}/><span>Generate batch schedule</span></>} onClick={onGenerate}/>
      </div>}
      {batchLoading&&<Spinner msg='Building your batch cooking schedule…'/>}
      {batchError&&<div style={{...CARD,padding:16,marginBottom:14,borderLeft:`4px solid ${C.error}`}}><p style={{...mn,fontSize:13,color:C.error,margin:0}}>⚠️ {batchError}</p></div>}
      {batchData&&!session&&<div style={{...CARD,padding:16}}><p style={{...mn,fontSize:13,color:C.onSurfaceVariant,margin:0}}>No schedule generated for this session.</p></div>}
      {session&&<div style={{...CARD,padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 16px',background:C.primaryFixed}}>
          <div style={{...ep,fontSize:16,color:C.primary,marginBottom:4}}>{session.label}</div>
          <div style={{...mn,fontSize:12,lineHeight:1.5,color:C.primary}}>{session.groundRule}</div>
        </div>
        {session.overview&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'14px 16px 4px'}}>
            {session.overview.map((o,i)=>(
              <span key={i} style={{...mn,fontSize:11,fontWeight:600,background:C.white,color:C.onSurface,padding:'4px 10px',borderRadius:99,display:'flex',alignItems:'center',gap:5}}>
                <span>{o.e}</span><span>{o.t}</span>
              </span>
            ))}
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column'}}>
          {(session.steps||[]).map((step,i)=>{
            const tc=TAG_C[step.tag]||TAG_C.KNIFE
            return(
              <div key={i} style={{padding:'12px 16px',borderTop:`1px solid ${C.outlineVariant}25`,display:'flex',gap:12}}>
                <div style={{width:40,flexShrink:0,...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,opacity:0.7,paddingTop:2}}>{step.time}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <span style={{...mn,fontSize:10,fontWeight:700,color:tc.tx,letterSpacing:'0.03em'}}>{TAG_LABEL[step.tag]||step.tag}</span>
                    <span style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface}}>{step.title}</span>
                  </div>
                  {(step.chips||[]).length>0&&<div style={{...mn,fontSize:11,fontWeight:600,color:tc.tx,marginBottom:8}}>{(step.chips||[]).join(' · ')}</div>}
                  {step.qty&&<div style={{...mn,fontSize:12,color:C.onSurfaceVariant,marginBottom:6}}>{step.qty}</div>}
                  <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.6,margin:0,marginBottom:step.storage||step.warn||step.safety?8:0}}>{step.body}</p>
                  {step.storage&&<div style={{...mn,fontSize:11,fontWeight:700,color:C.primary,background:C.primaryFixed,padding:'6px 10px',borderRadius:8,display:'flex',alignItems:'center',gap:6}}><Icon name='fridge' size={13} color={C.primary}/><span>{step.storage}</span></div>}
                  {step.warn&&<div style={{...mn,fontSize:11,color:C.onSecondaryContainer,background:C.secondaryContainer,padding:'6px 10px',borderRadius:8,marginTop:4}}>⚠ {step.warn}</div>}
                  {step.safety&&<div style={{...mn,fontSize:11,color:C.error,background:C.errorContainer,padding:'6px 10px',borderRadius:8,marginTop:4}}>🛑 {step.safety}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>}
    </div>
  )
}
