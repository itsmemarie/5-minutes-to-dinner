import { C, ep, mn, CARD } from '../lib/theme.js'
import { Spinner, SecHead, Btn } from './ui/index.js'

const NUTRI = {
  adult:{scores:{gutHealth:74,vitaminMineral:61,inflammation:80,metabolic:67,antioxidant:72,overall:71},
    general:[
      {title:'Increase Dietary Fibre',text:'Adding 30g ground flaxseeds to your morning routine boosts gut microbiome diversity.',type:'warning'},
      {title:'Optimise Iron Absorption',text:'Vitamin C pairing improves absorption from lentils and leafy greens.',type:'critical'},
      {title:'Outstanding Anti-Inflammatory',text:'Excellent omega-3 to omega-6 ratio from this week\'s varied vegetables.',type:'positive'},
    ],meals:[
      {meal:'Main meal',text:'Swap white potato for sweet potato — more Vitamin A and lower GI.',type:'warning'},
      {meal:'Pasta dishes',text:'50% wholegrain pasta doubles fibre without changing the dish perceptibly.',type:'warning'},
      {meal:'Breakfast',text:'Add 1 tbsp chia seeds — easy omega-3 boost.',type:'positive'},
    ]},
  toddler:{scores:{gutHealth:68,vitaminMineral:55,inflammation:75,metabolic:72,antioxidant:65,overall:63},
    general:[
      {title:'Iron Needs Attention',text:'At 0.5x portions, toddler receives ~5.2mg iron vs WHO target of 7-11mg.',type:'critical'},
      {title:'Vitamin D Supplementation',text:'No oily fish this week. Supplementation strongly advised for 18-month-olds.',type:'critical'},
      {title:'Good Early Gut Diversity',text:'Variety of vegetables supports early microbiome development above average.',type:'positive'},
    ],meals:[
      {meal:'Meat dishes',text:'Ensure meat is very soft and flaked. No added salt for toddler portions.',type:'warning'},
      {meal:'Breakfast',text:'Cut small round foods in half to reduce choking risk.',type:'positive'},
      {meal:'Egg dishes',text:'Fully cooked eggs only — no runny yolk for toddlers.',type:'critical'},
    ]},
}

export function NutritionScreen({profile,setProfile,nutriData,nutriLoading,nutriError,onAnalyse}){
  const data = nutriData?.[profile] || NUTRI[profile]
  const metrics=[{key:'gutHealth',label:'Gut Health',icon:'🦠'},{key:'vitaminMineral',label:'Vit & Mineral',icon:'💊'},{key:'inflammation',label:'Anti-Inflam.',icon:'🔥'},{key:'metabolic',label:'Metabolic',icon:'⚡'},{key:'antioxidant',label:'Antioxidant',icon:'🛡️'},{key:'overall',label:'Overall',icon:'❤️'}]
  return(
    <div style={{padding:'0 20px 20px'}}>
      <div style={{display:'flex',background:C.surfaceContainerHigh,borderRadius:99,padding:3,margin:'16px 0'}}>
        {['adult','toddler'].map(p=>(
          <button key={p} onClick={()=>setProfile(p)} style={{...mn,flex:1,padding:'9px',borderRadius:99,border:'none',background:profile===p?C.primary:'transparent',color:profile===p?C.onPrimary:C.onSurfaceVariant,fontWeight:700,fontSize:13,cursor:'pointer',letterSpacing:'0.04em',textTransform:'uppercase'}}>
            {p==='adult'?'👤 Adult':'👶 Toddler'}
          </button>
        ))}
      </div>
      {nutriLoading&&<Spinner msg='Analysing your meal plan with AI…'/>}
      {nutriError&&<div style={{...CARD,padding:16,marginBottom:16,borderLeft:`4px solid ${C.error}`}}><p style={{...mn,fontSize:13,color:C.error,margin:0}}>⚠️ {nutriError}</p></div>}
      {!nutriData&&!nutriLoading&&<div style={{...CARD,padding:20,marginBottom:16,textAlign:'center'}}>
        <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:14,lineHeight:1.6}}>Get AI-powered nutritional insights for your week's meal plan.</p>
        <Btn label='✨ Analyse This Week' onClick={onAnalyse}/>
      </div>}
      <div style={{background:C.primary,borderRadius:16,padding:'24px 20px',textAlign:'center',marginBottom:16}}>
        <div style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.07em',color:'rgba(255,255,255,0.65)',marginBottom:14,textTransform:'uppercase'}}>Overall Weekly Healthiness Score</div>
        <div style={{width:88,height:88,borderRadius:99,border:'4px solid rgba(255,255,255,0.28)',display:'inline-flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginBottom:8}}>
          <div style={{...ep,fontSize:28,fontWeight:700,color:'#fff',lineHeight:1}}>{data.scores.overall}</div>
          <div style={{...mn,fontSize:10,color:'rgba(255,255,255,0.6)'}}>/ 100</div>
        </div>
        <div style={{...mn,fontSize:10,letterSpacing:'0.07em',color:'rgba(255,255,255,0.55)',textTransform:'uppercase'}}>Out of 100</div>
      </div>
      <SecHead text='Core Health Metrics'/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        {metrics.map(m=>(
          <div key={m.key} style={{...CARD,padding:'14px 12px',background:m.key==='overall'?C.primary:C.white}}>
            <div style={{...ep,fontSize:20,fontWeight:700,color:m.key==='overall'?C.onPrimary:C.onSurface}}>{data.scores[m.key]}<span style={{fontSize:12,fontWeight:400,opacity:0.55}}>/100</span></div>
            <div style={{display:'flex',alignItems:'center',gap:4,marginTop:4}}>
              <span style={{fontSize:14}}>{m.icon}</span>
              <span style={{...mn,fontSize:11,fontWeight:600,color:m.key==='overall'?'rgba(255,255,255,0.8)':C.onSurfaceVariant}}>{m.label}</span>
            </div>
          </div>
        ))}
      </div>
      <SecHead text='Recommendations for You'/>
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
        {data.general.map((r,i)=>{
          const bc=r.type==='critical'?C.error:r.type==='positive'?'#1a7a3a':'#c07800'
          return(
            <div key={i} style={{...CARD,padding:'14px 16px',borderLeft:`4px solid ${bc}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{...mn,fontSize:14,fontWeight:700,color:C.onSurface,flex:1}}>{r.title}</span>
                {r.type==='critical'&&<span style={{...mn,fontSize:10,fontWeight:700,background:C.errorContainer,color:C.error,padding:'2px 7px',borderRadius:99,textTransform:'uppercase'}}>Critical</span>}
              </div>
              <p style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.6,margin:0}}>{r.text}</p>
            </div>
          )
        })}
      </div>
      <SecHead text='Ideas for Planned Meals'/>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {data.meals.map((r,i)=>{
          const bc=r.type==='critical'?C.error:r.type==='positive'?'#1a7a3a':'#c07800'
          return(
            <div key={i} style={{...CARD,padding:'14px 16px',borderLeft:`4px solid ${bc}`}}>
              <div style={{...mn,fontSize:12,fontWeight:700,color:C.onSurfaceVariant,marginBottom:4}}>For {r.meal}</div>
              <p style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.6,margin:0}}>{r.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
