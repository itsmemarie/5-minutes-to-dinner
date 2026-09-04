import { useState } from 'react'
import { C, mn, CARD, R } from '../lib/theme.js'
import { Spinner, SecHead, Icon } from './ui/index.js'

const METRIC_INFO = {
  gutHealth:'How much fibre, variety of veg, and gut-friendly foods (like yoghurt, beans, wholegrains) are in the week\'s meals.',
  vitaminMineral:'Whether the week\'s meals cover key vitamins and minerals (iron, vitamin C, calcium, etc.) against recommended daily targets for the profile.',
  inflammation:'The balance of "good" fats (like omega-3 from fish, nuts, olive oil) versus processed or fried foods that can cause inflammation.',
  metabolic:'How balanced meals are across carbs, protein and fat, and how likely they are to cause big blood sugar swings.',
  antioxidant:'How many colourful fruits and vegetables (which are rich in antioxidants) appear across the week.',
  overall:'A combined average of the five scores above, giving one quick snapshot of how balanced the week\'s meals are.',
}
const METHODOLOGY_TEXT = "Each day you've planned is checked against standard UK nutrition guidelines for the selected profile (adult or toddler), and the weekly score shown is the average across all the days you've planned that week."

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
  const [showInfo,setShowInfo] = useState(false)
  const data = nutriData?.[profile] || NUTRI[profile]
  const metrics=[{key:'gutHealth',label:'Gut Health',icon:'🦠'},{key:'vitaminMineral',label:'Vit & Mineral',icon:'💊'},{key:'inflammation',label:'Anti-Inflam.',icon:'🔥'},{key:'metabolic',label:'Metabolic',icon:'⚡'},{key:'antioxidant',label:'Antioxidant',icon:'🛡️'},{key:'overall',label:'Overall',icon:'❤️'}]
  return(
    <div style={{padding:'0 20px 20px'}}>
      <div style={{display:'flex',background:C.surfaceContainerHigh,borderRadius:R.pill,padding:3,margin:'16px 0'}}>
        {['adult','toddler'].map(p=>(
          <button key={p} onClick={()=>setProfile(p)} style={{...mn,flex:1,padding:'9px',borderRadius:R.pill,border:'none',background:profile===p?C.primary:'transparent',color:profile===p?C.onPrimary:C.onSurfaceVariant,fontWeight:700,fontSize:13,cursor:'pointer',letterSpacing:'0.04em',textTransform:'uppercase'}}>
            {p==='adult'?'👤 Adult':'👶 Toddler'}
          </button>
        ))}
      </div>
      {nutriLoading&&<Spinner msg='Analysing your meal plan with AI…'/>}
      {nutriError&&<div style={{...CARD,padding:16,marginBottom:16,borderLeft:`4px solid ${C.error}`}}><p style={{...mn,fontSize:13,color:C.error,margin:0}}>⚠️ {nutriError}</p></div>}
      {!nutriData&&!nutriLoading&&<div style={{...CARD,padding:20,marginBottom:16,textAlign:'center'}}>
        <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:14,lineHeight:1.6}}>Get AI-powered nutritional insights for your week's meal plan.</p>
        <button onClick={onAnalyse} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'none',background:C.secondaryContainer,color:'#924b1a',borderRadius:R.pill,padding:'7px 14px',...mn,fontWeight:700,fontSize:12,whiteSpace:'nowrap',cursor:'pointer'}}>
          <Icon name='sparkles' size={14}/>Analyse This Week
        </button>
      </div>}
      <div style={{background:C.primary,borderRadius:R.md,padding:'24px 20px',textAlign:'center',marginBottom:16}}>
        <div style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.07em',color:'rgba(255,255,255,0.65)',marginBottom:14,textTransform:'uppercase'}}>Overall Weekly Healthiness Score</div>
        <div style={{width:88,height:88,borderRadius:R.pill,border:'4px solid rgba(255,255,255,0.28)',display:'inline-flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginBottom:8}}>
          <div style={{...mn,fontWeight:700,fontSize:28,color:'#fff',lineHeight:1}}>{data.scores.overall}</div>
          <div style={{...mn,fontSize:10,color:'rgba(255,255,255,0.6)'}}>/ 100</div>
        </div>
        <div style={{...mn,fontSize:10,letterSpacing:'0.07em',color:'rgba(255,255,255,0.55)',textTransform:'uppercase'}}>Out of 100</div>
      </div>
      <SecHead text='Core Health Metrics'/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        {metrics.map(m=>(
          <div key={m.key} style={{...CARD,padding:'14px 12px',background:m.key==='overall'?C.primary:C.white}}>
            <div style={{...mn,fontWeight:700,fontSize:20,color:m.key==='overall'?C.onPrimary:C.onSurface}}>{data.scores[m.key]}<span style={{...mn,fontSize:12,opacity:0.55}}>/100</span></div>
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
                {r.type==='critical'&&<span style={{...mn,fontSize:10,fontWeight:700,background:C.errorContainer,color:C.error,padding:'2px 7px',borderRadius:R.pill,textTransform:'uppercase'}}>Critical</span>}
              </div>
              <p style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.6,margin:0}}>{r.text}</p>
            </div>
          )
        })}
      </div>
      <SecHead text='Ideas for Planned Meals'/>
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
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
      <SecHead text='Understanding Your Scores'/>
      <div style={{...CARD,padding:20,textAlign:'center'}}>
        <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:14,lineHeight:1.6}}>Curious what these numbers actually mean? See a simple breakdown of what each score looks at and how it's worked out.</p>
        <button onClick={()=>setShowInfo(true)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'none',background:C.secondaryContainer,color:'#924b1a',borderRadius:R.pill,padding:'7px 14px',...mn,fontWeight:700,fontSize:12,whiteSpace:'nowrap',cursor:'pointer'}}>
          <Icon name='info' size={14}/>How Are These Calculated?
        </button>
      </div>
      {showInfo&&(
        <div onClick={()=>setShowInfo(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:50,display:'flex',justifyContent:'center',alignItems:'flex-end'}}>
          <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:430,maxHeight:'80vh',overflowY:'auto',background:C.white,borderRadius:'20px 20px 0 0',padding:'20px 20px 28px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <span style={{...mn,fontSize:16,fontWeight:700,color:C.onSurface,flex:1}}>How Your Scores Work</span>
              <button onClick={()=>setShowInfo(false)} style={{border:'none',background:C.surfaceContainerHigh,borderRadius:R.pill,padding:6,display:'flex',cursor:'pointer'}}>
                <Icon name='x' size={16} color={C.onSurfaceVariant}/>
              </button>
            </div>
            <p style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.6,marginBottom:16}}>{METHODOLOGY_TEXT}</p>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {metrics.map(m=>(
                <div key={m.key} style={{display:'flex',gap:10}}>
                  <span style={{fontSize:18,lineHeight:1.4}}>{m.icon}</span>
                  <div>
                    <div style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface,marginBottom:2}}>{m.label}</div>
                    <p style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.6,margin:0}}>{METRIC_INFO[m.key]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
