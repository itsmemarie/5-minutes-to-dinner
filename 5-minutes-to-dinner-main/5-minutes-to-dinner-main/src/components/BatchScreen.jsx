import { C, ep, mn, CARD, TAG_C } from '../lib/theme.js'
import { Spinner, Btn } from './ui/index.js'

const BATCH = {
  big:{label:'Monday · 2 hrs',groundRule:'Monday prep is used by Wednesday/Thursday — nothing stored beyond Day 3.',
    overview:[{e:'🥩',t:'Batch protein base (4p)'},{e:'🥣',t:'Overnight Oats (2 jars)'},{e:'🧅',t:'Aromatic Base'},{e:'🥦',t:'Roast veg tray'}],
    steps:[
      {time:'0:00',tag:'OVEN',title:'Preheat Oven',full:false,chips:['200°C Fan'],qty:null,body:'Set oven to 200°C Fan. Pre-warm tray.',storage:null,warn:null,safety:null},
      {time:'0:05',tag:'TM6',title:'Chop Aromatics',full:false,chips:['5s','Speed 5'],qty:'300g Onions, 4 Garlic Cloves',body:'Pulse aromatics. Reserve in bowls. No bowl wash.',storage:null,warn:'Process all aromatics in one pass.',safety:null},
      {time:'0:20',tag:'TM6',title:'Protein Sauce',full:true,chips:['15m','Varoma','Speed 1'],qty:'400g Mince, spices, aromatics',body:'Cook fully.',storage:'📦 FRIDGE: 3 DAYS (EAT BY WED)',warn:null,safety:null},
      {time:'0:35',tag:'OVEN',title:'Roast Vegetables',full:false,chips:['35m','200°C Fan'],qty:'Carrots, Courgettes, Pepper',body:'Toss with olive oil. Roast 35 min, toss at halfway.',storage:'📦 FRIDGE: 3 DAYS',warn:null,safety:null},
      {time:'1:10',tag:'NO_COOK',title:'Overnight Oats',full:false,chips:[],qty:'100g Oats, 200ml Oat Milk',body:'Layer into 2 jars. Seal and refrigerate.',storage:'📅 MAX 2 DAYS AHEAD',warn:null,safety:null},
      {time:'1:50',tag:'DONE',title:'Session Complete',full:false,chips:[],qty:null,body:'Label all containers with eat-by dates.',storage:null,warn:null,safety:null},
    ]},
  medium:{label:'Thursday · 1 hr',groundRule:'Thursday prep consumed by Saturday.',
    overview:[{e:'🍗',t:'Chicken marinade'},{e:'🥗',t:'Salad dressing'},{e:'🫙',t:'Stir-fry veg'}],
    steps:[
      {time:'0:00',tag:'KNIFE',title:'Slice Chicken',full:false,chips:[],qty:'500g Chicken Breast',body:'Slice into thin strips.',storage:null,warn:null,safety:'Wash hands and board immediately after handling raw chicken.'},
      {time:'0:15',tag:'NO_COOK',title:'Marinade',full:false,chips:[],qty:'2 tbsp Soy, 1 tbsp Sesame Oil',body:'Coat chicken. Cover and refrigerate.',storage:'📦 FRIDGE: 2 DAYS',warn:null,safety:null},
      {time:'0:30',tag:'KNIFE',title:'Prep Veg',full:false,chips:[],qty:'2 Peppers, 200g Broccoli',body:'Cut into even pieces. Bag separately.',storage:'📦 FRIDGE: 3 DAYS',warn:null,safety:null},
      {time:'0:50',tag:'NO_COOK',title:'Salad Dressing',full:false,chips:[],qty:'3 tbsp Olive Oil, 1 tbsp Lemon',body:'Shake jar. Dress leaves at serving only.',storage:'📦 FRIDGE: 5 DAYS',warn:null,safety:null},
    ]},
  evenings:{label:'Weekday Evenings',groundRule:'Heat-and-assemble only. Max 40 min active per evening.',overview:null,
    steps:[
      {time:'Mon',tag:'HOB',title:'Main + Side',full:false,chips:['20m active'],qty:null,body:'Reheat protein on low. Prepare side.',storage:'20 min total',warn:null,safety:null},
      {time:'Tue',tag:'HOB',title:'Pasta Night',full:false,chips:['25m active'],qty:null,body:'Boil pasta 9 min. Combine with sauce.',storage:'25 min total',warn:null,safety:null},
      {time:'Wed',tag:'HOB',title:'Batch Reheat',full:false,chips:['15m active'],qty:null,body:'Reheat from Monday batch.',storage:'15 min total',warn:null,safety:null},
      {time:'Thu',tag:'HOB',title:'Soup Night',full:false,chips:['10m active'],qty:null,body:'Reheat soup. Toast sourdough.',storage:'10 min total',warn:null,safety:null},
      {time:'Fri',tag:'HOB',title:'Stir-fry',full:false,chips:['15m active'],qty:null,body:'Hot wok. Chicken 6m. Veg 5m. Fresh rice.',storage:'15 min total',warn:'Always cook rice fresh.',safety:null},
    ]},
}

export function BatchScreen({activeTab,setActiveTab,batchData,batchLoading,batchError,onGenerate}){
  const TABS=[{id:'big',label:'Monday · Big'},{id:'medium',label:'Thursday · Med'},{id:'evenings',label:'Evenings'}]
  const rawSession = batchData ? batchData.sessions?.find(s=>s.id===activeTab) : null
  const session = rawSession || BATCH[activeTab]
  return(
    <div style={{padding:'0 20px 24px'}}>
      <div style={{display:'flex',gap:6,padding:'14px 0 12px',overflowX:'auto'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{...mn,padding:'8px 14px',borderRadius:99,border:'none',background:activeTab===t.id?C.primary:C.secondaryContainer,color:activeTab===t.id?C.onPrimary:C.onSecondaryContainer,fontWeight:700,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{t.label}</button>
        ))}
      </div>
      {!batchData&&!batchLoading&&<div style={{...CARD,padding:20,marginBottom:14,textAlign:'center'}}>
        <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:14,lineHeight:1.6}}>Generate an AI batch cooking schedule from your meal plan.</p>
        <Btn label='✨ Generate Batch Schedule' onClick={onGenerate}/>
      </div>}
      {batchLoading&&<Spinner msg='Building your batch cooking schedule…'/>}
      {batchError&&<div style={{...CARD,padding:16,marginBottom:14,borderLeft:`4px solid ${C.error}`}}><p style={{...mn,fontSize:13,color:C.error,margin:0}}>⚠️ {batchError}</p></div>}
      <div style={{background:C.secondaryContainer,borderRadius:12,padding:'10px 14px',display:'flex',gap:8,marginBottom:14}}>
        <span style={{flexShrink:0}}>ℹ</span>
        <span style={{...mn,fontSize:12,color:C.onSecondaryContainer,fontStyle:'italic',lineHeight:1.5}}>{session.groundRule}</span>
      </div>
      {session.overview&&(
        <div style={{...CARD,padding:'14px 16px',marginBottom:16}}>
          <div style={{...ep,fontSize:15,color:C.onSurface,marginBottom:10}}>✓ Session Overview</div>
          {session.overview.map((o,i)=><div key={i} style={{...mn,fontSize:13,color:C.onSurfaceVariant,padding:'4px 0',display:'flex',gap:8}}><span>{o.e}</span><span>{o.t}</span></div>)}
        </div>
      )}
      <div style={{position:'relative',paddingLeft:52}}>
        <div style={{position:'absolute',left:18,top:8,bottom:8,width:2,background:C.outlineVariant,borderRadius:2}}/>
        {(session.steps||[]).map((step,i)=>{
          const tc=TAG_C[step.tag]||TAG_C.KNIFE
          return(
            <div key={i} style={{position:'relative',marginBottom:16}}>
              <div style={{position:'absolute',left:-39,top:14,width:14,height:14,borderRadius:99,background:tc.bg,border:`2px solid ${tc.bd}`}}/>
              <div style={{position:'absolute',left:-52,top:11,...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,textAlign:'right',width:34}}>{step.time}</div>
              <div style={{...CARD,padding:'12px 14px'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
                  <span style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface,flex:1}}>{step.title}</span>
                  <span style={{...mn,fontSize:10,fontWeight:700,background:tc.bg,color:tc.tx,border:`1px solid ${tc.bd}`,padding:'2px 8px',borderRadius:99,flexShrink:0}}>{step.tag}</span>
                </div>
                {step.full&&<div style={{...mn,fontSize:11,fontWeight:700,background:C.primary,color:C.onPrimary,padding:'3px 10px',borderRadius:99,display:'inline-block',marginBottom:8}}>COMPLETE TM6 DISH</div>}
                {(step.chips||[]).length>0&&<div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>{(step.chips||[]).map((c,j)=><span key={j} style={{...mn,fontSize:10,fontWeight:600,background:tc.bg,color:tc.tx,padding:'2px 8px',borderRadius:99}}>{c}</span>)}</div>}
                {step.qty&&<div style={{...mn,fontSize:11,color:C.onSurface,marginBottom:6}}><strong>Qty:</strong> {step.qty}</div>}
                <p style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.6,margin:0,marginBottom:step.storage||step.warn||step.safety?8:0}}>{step.body}</p>
                {step.storage&&<div style={{...mn,fontSize:11,fontWeight:600,background:'#f0fff4',color:'#1a7a3a',padding:'6px 10px',borderRadius:8,border:'1px solid #7fd4a0'}}>{step.storage}</div>}
                {step.warn&&<div style={{...mn,fontSize:11,background:'#fffbea',color:'#8a6200',padding:'6px 10px',borderRadius:8,border:'1px solid #f5c842',marginTop:4}}>⚠ {step.warn}</div>}
                {step.safety&&<div style={{...mn,fontSize:11,background:C.errorContainer,color:C.error,padding:'6px 10px',borderRadius:8,marginTop:4}}>🛑 {step.safety}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
