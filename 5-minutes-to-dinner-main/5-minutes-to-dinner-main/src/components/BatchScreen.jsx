import { C, ep, mn, CARD, TAG_C } from '../lib/theme.js'
import { Spinner, Btn, Icon } from './ui/index.js'

const TAG_LABEL = { TM6:'THERMOMIX', HOB:'HOB', OVEN:'OVEN', KNIFE:'PREP', NO_COOK:'NO COOK', DONE:'DONE' }

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
    <div style={{padding:'16px 20px 24px'}}>
      <div style={{...ep,fontSize:24,color:C.onSurface,marginBottom:4}}>Batch cooking</div>
      <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,margin:'0 0 14px',lineHeight:1.6}}>An AI-organised prep schedule so the week's cooking happens in focused sessions.</p>
      <div style={{display:'flex',gap:6,padding:'0 0 14px',overflowX:'auto'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{...mn,padding:'8px 14px',borderRadius:99,border:'none',background:activeTab===t.id?C.primary:C.secondaryContainer,color:activeTab===t.id?C.onPrimary:C.onSecondaryContainer,fontWeight:700,fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{t.label}</button>
        ))}
      </div>
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
      <div style={{...CARD,padding:0,overflow:'hidden'}}>
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
                  {step.storage&&<div style={{...mn,fontSize:11,fontWeight:700,color:C.primary,background:C.primaryFixed,padding:'6px 10px',borderRadius:8}}>{step.storage}</div>}
                  {step.warn&&<div style={{...mn,fontSize:11,color:C.onSecondaryContainer,background:C.secondaryContainer,padding:'6px 10px',borderRadius:8,marginTop:4}}>⚠ {step.warn}</div>}
                  {step.safety&&<div style={{...mn,fontSize:11,color:C.error,background:C.errorContainer,padding:'6px 10px',borderRadius:8,marginTop:4}}>🛑 {step.safety}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
