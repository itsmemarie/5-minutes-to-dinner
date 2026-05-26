import { useState, useEffect, useMemo } from 'react'
import {
  fetchRecipes, fetchSettings, saveSettings,
  getOrCreatePlan, fetchWeekPlan,
  addPlannedMeals, removePlannedMeal, updatePlannedMealPortion,
  fetchRatings, upsertRating,
  fetchShoppingList, saveShoppingList, updateShoppingItem,
  fetchRecipeDetails,
} from './supabase.js'


// ─── Edge Function URLs ───────────────────────────────────────────
const SUPA_URL = 'https://chcjytxvpvhzdgvwllss.supabase.co/functions/v1'
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoY2p5dHh2cHZoemRndndsbHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzYxMDQsImV4cCI6MjA5MzE1MjEwNH0.BxAHDZYTBNj5L5KKrNU0HLEKYYXK2Jffv3ejnL1YUkg'

async function callEdgeFn(name, body) {
  const r = await fetch(`${SUPA_URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON },
    body: JSON.stringify(body),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error)
  return d
}

// ─── Date helpers ────────────────────────────────────────────────
const WD  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const toISO = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().split('T')[0] }
const getMon = (d = new Date()) => { const x = new Date(d), w = x.getDay(); x.setDate(x.getDate() - (w === 0 ? 6 : w - 1)); x.setHours(0,0,0,0); return x }
const NOW      = new Date()
const TODAY    = WD[NOW.getDay()]
const YEST     = WD[new Date(NOW - 86400000).getDay()]
const MON      = getMon(NOW)
const SUN      = new Date(MON); SUN.setDate(SUN.getDate() + 6)
const WEEK_OF  = toISO(MON)
const WEEK_LBL = `${MON.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – ${SUN.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`
const DAYS     = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LBL  = {monday:'Monday',tuesday:'Tuesday',wednesday:'Wednesday',thursday:'Thursday',friday:'Friday',saturday:'Saturday',sunday:'Sunday'}

let _uid = Date.now()
const uid = () => `m${++_uid}`
const emptyWeek = () => Object.fromEntries(DAYS.map(d => [d, { breakfast:[], main:[], side:[] }]))

// ─── Design tokens ────────────────────────────────────────────────
const C = {
  primary:'#004440', onPrimary:'#fff', primaryFixed:'#b1eee8',
  secondaryContainer:'#dae4e4', onSecondaryContainer:'#5c6666',
  tertiary:'#573400', tertiaryFixed:'#ffddb9', onTertiaryFixed:'#2b1700',
  error:'#ba1a1a', errorContainer:'#ffdad6',
  surface:'#f9f9f9', white:'#fff', surfaceContainerHigh:'#e8e8e7',
  onSurface:'#1a1c1c', onSurfaceVariant:'#3f4947',
  outline:'#707977', outlineVariant:'#bfc8c7',
}
const ep = {fontFamily:"'Epilogue',sans-serif"}
const mn = {fontFamily:"'Manrope',sans-serif"}
const CARD = {background:'#fff',borderRadius:16,boxShadow:'0 2px 20px rgba(0,68,64,0.06)'}
const TAG_C = {
  TM6:{bg:'#FFF5E0',tx:'#A86000',bd:'#F5C842'}, HOB:{bg:'#EEF4FF',tx:'#0050A0',bd:'#90C0F5'},
  OVEN:{bg:'#FFF0EE',tx:'#B83000',bd:'#F5A090'}, KNIFE:{bg:'#F4F4F0',tx:'#444',bd:'#CCCCCC'},
  NO_COOK:{bg:'#F0FFF4',tx:'#1A7A3A',bd:'#7FD4A0'}, DONE:{bg:'#1C1C1A',tx:'#F5F0E8',bd:'#1C1C1A'},
}

// ─── Static data ──────────────────────────────────────────────────
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

// ─── Shared UI primitives ──────────────────────────────────────────
function TodayTag(){return <span style={{...mn,background:C.tertiaryFixed,color:C.onTertiaryFixed,fontSize:9,fontWeight:700,letterSpacing:'0.08em',padding:'3px 8px',borderRadius:99,textTransform:'uppercase',whiteSpace:'nowrap',flexShrink:0}}>TODAY'S PLAN</span>}
function PillBtn({label,active,onClick}){return <button onClick={onClick} style={{...mn,background:active?C.primary:C.secondaryContainer,color:active?C.onPrimary:C.onSecondaryContainer,border:'none',borderRadius:99,padding:'7px 14px',fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{label}</button>}
function Btn({label,full,onClick,disabled,secondary,small}){return <button onClick={disabled?undefined:onClick} style={{...mn,background:disabled?C.surfaceContainerHigh:secondary?C.secondaryContainer:C.primary,color:disabled?C.outline:secondary?C.onSecondaryContainer:C.onPrimary,border:'none',borderRadius:12,padding:small?'9px 16px':'13px 20px',fontSize:small?13:15,fontWeight:700,cursor:disabled?'not-allowed':'pointer',width:full?'100%':undefined,opacity:disabled?0.72:1}}>{label}</button>}
function Stepper({value,min,onChange}){return(
  <div style={{display:'flex',alignItems:'center',gap:6,background:C.surfaceContainerHigh,borderRadius:99,padding:'4px 6px'}}>
    <button onClick={()=>value>min&&onChange(value-1)} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.outlineVariant}`,background:C.white,color:value<=min?C.outlineVariant:C.onSurface,cursor:value<=min?'default':'pointer',fontSize:18,lineHeight:1,flexShrink:0}}>−</button>
    <span style={{...ep,fontSize:17,fontWeight:700,color:C.primary,minWidth:20,textAlign:'center'}}>{value}</span>
    <button onClick={()=>onChange(value+1)} style={{width:28,height:28,borderRadius:6,background:C.primary,color:'#fff',border:'none',cursor:'pointer',fontSize:18,lineHeight:1,flexShrink:0}}>+</button>
  </div>
)}
function RatingRow({mealId,ratings,onRate}){
  const cur=ratings[mealId]
  const btns=[{k:'bad',icon:'😞',label:'Bad',ac:C.error},{k:'okay',icon:'😐',label:'Okay',ac:C.tertiary},{k:'loved',icon:'😊',label:'Loved',ac:C.primary}]
  return(
    <div style={{display:'flex',gap:14,marginTop:6}}>
      {btns.map(b=>(
        <button key={b.k} onClick={()=>onRate(b.k)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,border:'none',background:'none',cursor:'pointer',opacity:cur&&cur!==b.k?0.38:1,filter:cur&&cur!==b.k?'grayscale(1)':'none',padding:0}}>
          <span style={{fontSize:20}}>{b.icon}</span>
          <span style={{...mn,fontSize:10,fontWeight:cur===b.k?700:500,color:cur===b.k?b.ac:C.onSurfaceVariant,letterSpacing:'0.04em',textTransform:'uppercase'}}>{b.label}</span>
        </button>
      ))}
    </div>
  )
}
function CapLabel({text}){return <span style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.06em',color:C.onSurfaceVariant,textTransform:'uppercase'}}>{text}</span>}
function SecHead({text}){return <div style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.07em',color:C.onSurfaceVariant,marginBottom:10,textTransform:'uppercase'}}>{text}</div>}
function HDivider(){return <div style={{height:1,background:`${C.outlineVariant}50`,margin:'10px 0'}}/>}
function Spinner({msg='Loading…'}){return(
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,gap:14,padding:40,minHeight:200}}>
    <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    <div style={{width:36,height:36,border:`3px solid ${C.secondaryContainer}`,borderTop:`3px solid ${C.primary}`,borderRadius:'50%',animation:'sp 0.9s linear infinite'}}/>
    <span style={{...mn,fontSize:13,color:C.onSurfaceVariant}}>{msg}</span>
  </div>
)}

// ─── Recipe helpers ───────────────────────────────────────────────
function parseIngredients(text) {
  if (!text) return []
  const sections = []
  let cur = { title: null, items: [] }
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim()
    if (!t) continue
    const m = t.match(/^\[(.+)\]$/)
    if (m) { if (cur.items.length || cur.title) sections.push(cur); cur = { title: m[1], items: [] } }
    else if (t.startsWith('- ')) cur.items.push(t.slice(2))
  }
  if (cur.items.length || cur.title) sections.push(cur)
  return sections
}

function parseIngredientParts(text, scale) {
  const m = text.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)\s*(g|kg|ml|l|cl|tsp|tbsp|oz|lb|cups?|pints?|tins?|bags?|bunches?|pinch(?:es)?|slices?|cloves?|pieces?|sprigs?|sheets?|drops?)?\s+(.+)$/i)
  if (!m) return { qty: null, name: text }
  const num = parseFloat(m[1]), unit = m[2] || '', name = m[3]
  const s = Math.round(num * scale * 10) / 10
  const d = s % 1 === 0 ? String(Math.round(s)) : s.toFixed(1)
  return { qty: unit ? `${d}${unit}` : d, name }
}

function parseSteps(text) {
  if (!text) return []
  const steps = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    const m = t.match(/^(\d+)\.\s+(.+)/)
    if (m) steps.push({ num: m[1], text: m[2] })
    else if (steps.length && t) steps[steps.length - 1].text += ' ' + t
  }
  return steps
}

// ─── Recipe Screen ─────────────────────────────────────────────────
function RecipeScreen({ recipeId, portion }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [showStd, setShowStd] = useState(false)
  const [showTM, setShowTM] = useState(false)

  useEffect(() => {
    fetchRecipeDetails(recipeId)
      .then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }, [recipeId])

  if (loading) return <Spinner msg='Loading recipe…'/>
  if (err) return <div style={{padding:20}}><p style={{...mn,color:C.error}}>⚠️ {err}</p></div>
  if (!data) return null

  const base = data.portion_size || 4
  const scale = portion ? portion / base : 1
  const scaledFor = portion || base
  const ingSections = parseIngredients(data.ingredients)
  const stdSteps = parseSteps(data.instructions_standard)
  const tmSteps = parseSteps(data.instructions_thermomix)

  return (
    <div style={{padding:'0 20px 40px'}}>
      {data.has_thermomix_version&&(
        <div style={{display:'inline-flex',alignItems:'center',gap:6,background:C.primary,borderRadius:99,padding:'5px 12px',marginTop:16,marginBottom:12}}>
          <span style={{fontSize:12}}>⚡</span>
          <span style={{...mn,fontSize:10,fontWeight:700,color:C.onPrimary,letterSpacing:'0.08em'}}>THERMOMIX RECIPE: YES</span>
        </div>
      )}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,gap:12}}>
        <div style={{...ep,fontSize:24,fontWeight:700,color:C.onSurface,flex:1,lineHeight:1.2}}>{data.name}</div>
        <span style={{fontSize:22,marginTop:2}}>🔖</span>
      </div>

      {/* Prep / Cook */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        {[['🕒 PREP TIME',data.prep_time_raw||(data.prep_time_minutes?`${data.prep_time_minutes}m`:null)],['🍳 COOK TIME',data.cook_time_raw||(data.cook_time_minutes?`${data.cook_time_minutes}m`:null)]].map(([lbl,val])=>val?(
          <div key={lbl} style={{...CARD,padding:'12px 14px'}}>
            <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:4}}>{lbl}</div>
            <div style={{...ep,fontSize:17,fontWeight:700,color:C.onSurface}}>{val}</div>
          </div>
        ):null)}
      </div>

      {/* Portions */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        <div style={{...CARD,padding:'12px 14px'}}>
          <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:6}}>SAVED PORTIONS</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{...ep,fontSize:15,fontWeight:700,color:C.onSurface}}>{scaledFor} servings</span>
            {scale!==1&&<span style={{...mn,fontSize:11,fontWeight:700,background:C.primaryFixed,color:C.primary,padding:'2px 7px',borderRadius:99}}>{scale.toFixed(1)}x</span>}
          </div>
        </div>
        <div style={{...CARD,padding:'12px 14px'}}>
          <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:6}}>MIN. PORTIONS</div>
          <span style={{...ep,fontSize:15,fontWeight:700,color:C.onSurface}}>{data.min_portions||1} servings</span>
        </div>
      </div>

      {/* Storage */}
      {(data.fridge_storage||data.freezer_storage)&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          {data.fridge_storage&&<div style={{...CARD,padding:'12px 14px'}}><div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:4}}>🧊 FRIDGE</div><div style={{...mn,fontSize:12,color:C.onSurface,lineHeight:1.5}}>{data.fridge_storage}</div></div>}
          {data.freezer_storage&&<div style={{...CARD,padding:'12px 14px'}}><div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',marginBottom:4}}>❄️ FREEZER</div><div style={{...mn,fontSize:12,color:C.onSurface,lineHeight:1.5}}>{data.freezer_storage}</div></div>}
        </div>
      )}

      {/* Ingredients */}
      {ingSections.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <span style={{...ep,fontSize:18,fontWeight:700,color:C.onSurface}}>Ingredients</span>
            <span style={{...mn,fontSize:11,fontWeight:700,background:C.primaryFixed,color:C.primary,padding:'3px 10px',borderRadius:99}}>Scaled for {scaledFor} portions</span>
          </div>
          {ingSections.map((sec,si)=>(
            <div key={si} style={{marginBottom:12}}>
              {sec.title&&<div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>{sec.title}</div>}
              <div style={{...CARD,overflow:'hidden'}}>
                {sec.items.map((item,ii)=>{
                  const {qty,name}=parseIngredientParts(item,scale)
                  return(
                    <div key={ii} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:ii<sec.items.length-1?`1px solid ${C.outlineVariant}20`:undefined,gap:12}}>
                      <span style={{...mn,fontSize:13,color:C.onSurface,flex:1}}>{name||item}</span>
                      {qty&&<span style={{...mn,fontSize:13,fontWeight:700,color:C.onSurface,whiteSpace:'nowrap'}}>{qty}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preparation Methods */}
      {(stdSteps.length>0||tmSteps.length>0)&&(
        <div style={{marginBottom:20}}>
          <div style={{...ep,fontSize:18,fontWeight:700,color:C.onSurface,marginBottom:12}}>Preparation Methods</div>
          {stdSteps.length>0&&(
            <div style={{...CARD,marginBottom:10,overflow:'hidden'}}>
              <button onClick={()=>setShowStd(s=>!s)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'none',border:'none',cursor:'pointer',borderBottom:showStd?`1px solid ${C.outlineVariant}25`:'none'}}>
                <span style={{...mn,fontSize:14,fontWeight:700,color:C.onSurface}}>Standard Method (No Thermomix)</span>
                <span style={{color:C.onSurfaceVariant,fontSize:16}}>{showStd?'∧':'∨'}</span>
              </button>
              {showStd&&(
                <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:14}}>
                  {stdSteps.map((step,i)=>(
                    <div key={i} style={{display:'flex',gap:12}}>
                      <div style={{width:24,height:24,borderRadius:99,background:C.secondaryContainer,color:C.primary,...mn,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{step.num}</div>
                      <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0,flex:1}}>{step.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tmSteps.length>0&&(
            <div style={{...CARD,overflow:'hidden',background:'#f0fffe'}}>
              <button onClick={()=>setShowTM(s=>!s)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'none',border:'none',cursor:'pointer',borderBottom:showTM?`1px solid ${C.outlineVariant}25`:'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>⚡</span>
                  <span style={{...mn,fontSize:14,fontWeight:700,color:C.primary}}>Thermomix TM6 Method</span>
                </div>
                <span style={{color:C.onSurfaceVariant,fontSize:16}}>{showTM?'∧':'∨'}</span>
              </button>
              {showTM&&(
                <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:14}}>
                  {tmSteps.map((step,i)=>(
                    <div key={i} style={{display:'flex',gap:12}}>
                      <div style={{width:24,height:24,borderRadius:99,background:C.primary,color:C.onPrimary,...mn,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>{step.num}</div>
                      <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0,flex:1}}>{step.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* The Extras */}
      {(data.chef_notes||data.husband_variations||data.toddler_variations||(data.side_recommendation&&data.side_recommendation!=='Not Recommended'))&&(
        <div>
          <div style={{...ep,fontSize:18,fontWeight:700,color:C.onSurface,marginBottom:12}}>The Extras</div>
          {data.chef_notes&&(
            <div style={{...CARD,padding:'14px 16px',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>📖</span><span style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.07em',textTransform:'uppercase'}}>Chef's Notes</span></div>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>{data.chef_notes}</p>
            </div>
          )}
          {data.husband_variations&&(
            <div style={{...CARD,padding:'14px 16px',marginBottom:10,background:'#fff8f0'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>❤️</span><span style={{...mn,fontSize:10,fontWeight:700,color:'#A86000',letterSpacing:'0.07em',textTransform:'uppercase'}}>Husband Variations</span></div>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>{data.husband_variations}</p>
            </div>
          )}
          {data.toddler_variations&&(
            <div style={{...CARD,padding:'14px 16px',marginBottom:10,background:'#f0f8ff'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><span style={{fontSize:14}}>👶</span><span style={{...mn,fontSize:10,fontWeight:700,color:'#0050A0',letterSpacing:'0.07em',textTransform:'uppercase'}}>Toddler Variations</span></div>
              <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>{data.toddler_variations}</p>
            </div>
          )}
          {data.side_recommendation&&data.side_recommendation!=='Not Recommended'&&(
            <div style={{...CARD,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:4}}>Recommended Side</div>
                <div style={{...mn,fontSize:14,fontWeight:600,color:C.onSurface}}>{data.side_recommendation}</div>
              </div>
              <span style={{color:C.primary,fontSize:20}}>›</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Home ──────────────────────────────────────────────────────────
function HomeScreen({plan,ratings,onRate,onPlanToday,onOpenRecipe,onCopy}){
  const tm=[...plan[TODAY].breakfast,...plan[TODAY].main,...plan[TODAY].side]
  const ym=[...plan[YEST].breakfast,...plan[YEST].main,...plan[YEST].side]
  const todayIdx=DAYS.indexOf(TODAY)
  const restDays=DAYS.slice(todayIdx+1).filter(d=>[...plan[d].breakfast,...plan[d].main,...plan[d].side].length>0)
  const [copied,setCopied]=useState(false)
  const handleCopy=()=>{onCopy();setCopied(true);setTimeout(()=>setCopied(false),2000)}
  return(
    <div style={{padding:'16px 20px 20px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <div style={{...ep,fontSize:22,fontWeight:700,color:C.onSurface}}>Today's Plan</div>
        <button onClick={handleCopy} style={{...mn,background:copied?'#f0fff4':C.secondaryContainer,color:copied?'#1a7a3a':C.primary,border:'none',borderRadius:99,padding:'6px 12px',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.2s'}}>
          {copied?'✓ Copied':'📋 Copy week'}
        </button>
      </div>
      {tm.length===0?(
        <div style={{...CARD,padding:24,textAlign:'center'}}>
          <div style={{fontSize:30,marginBottom:10}}>🍽</div>
          <p style={{...mn,fontSize:13,color:C.onSurfaceVariant,lineHeight:1.6,marginBottom:14}}>Nothing planned for today yet.</p>
          <Btn label='Plan today' onClick={onPlanToday} secondary small/>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:24}}>
          {tm.map(m=>(
            <div key={m.id} onClick={()=>onOpenRecipe(m.recipeId,m.portion)} style={{...CARD,padding:'14px 16px',cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:8}}>
                <span style={{...ep,fontSize:18,fontWeight:700,color:C.onSurface}}>{m.name}</span>
                <TodayTag/>
              </div>
              <HDivider/>
              <div style={{display:'flex',gap:20}}>
                <span style={{...mn,fontSize:12,color:C.onSurfaceVariant}}>🕒 Prep: {m.prep}m</span>
                <span style={{...mn,fontSize:12,color:C.onSurfaceVariant}}>🍳 Active: {m.active}m</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {ym.length>0&&(
        <>
          <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:12}}>
            <span style={{...ep,fontSize:20,fontWeight:700,color:C.primary}}>How was it?</span>
            <span style={{...mn,fontSize:12,color:C.onSurfaceVariant}}>Yesterday</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
            {ym.map(m=>(
              <div key={m.id} style={{...CARD,padding:'14px 16px'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:42,height:42,borderRadius:10,background:C.surfaceContainerHigh,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🍴</div>
                  <div style={{flex:1}}>
                    <div style={{...mn,fontSize:14,fontWeight:600,color:C.onSurface}}>{m.name}</div>
                    <RatingRow mealId={m.id} ratings={ratings} onRate={r=>onRate(m.id,r)}/>
                  </div>
                  <span style={{color:C.outlineVariant,fontSize:18}}>›</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {restDays.length>0&&(
        <>
          <div style={{...ep,fontSize:20,fontWeight:700,color:C.onSurface,marginBottom:14}}>Rest of the Week</div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {restDays.map(day=>{
              const meals=[...plan[day].breakfast,...plan[day].main,...plan[day].side]
              return(
                <div key={day}>
                  <div style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.07em',color:C.onSurfaceVariant,textTransform:'uppercase',marginBottom:6}}>{DAY_LBL[day]}</div>
                  <div style={{...CARD,overflow:'hidden'}}>
                    {meals.map((m,i)=>(
                      <div key={m.id} onClick={()=>onOpenRecipe(m.recipeId,m.portion)} style={{padding:'10px 14px',borderBottom:i<meals.length-1?`1px solid ${C.outlineVariant}25`:undefined,display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                        <div style={{flex:1}}>
                          <div style={{...mn,fontSize:13,fontWeight:600,color:C.onSurface}}>{m.name}</div>
                          <div style={{display:'flex',gap:8,marginTop:2}}>
                            <CapLabel text={m.section==='breakfast'?'Breakfast':m.section==='main'?'Main':'Side'}/>
                            <span style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>🕒 {m.prep}m</span>
                          </div>
                        </div>
                        <span style={{color:C.outlineVariant,fontSize:16}}>›</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Planner ────────────────────────────────────────────────────────
function PlannerScreen({plan,removeMeal,onDayOpen,onNutrition,onShoppingList}){
  return(
    <div style={{padding:'0 20px 20px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 0 12px'}}>
        <div style={{...ep,fontSize:22,fontWeight:700,color:C.onSurface}}>Weekly Planner</div>
        <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,background:C.surfaceContainerHigh,padding:'5px 10px',borderRadius:99}}>{WEEK_LBL} ▾</div>
      </div>
      <button onClick={onNutrition} style={{width:'100%',background:C.secondaryContainer,color:C.primary,border:'none',borderRadius:12,padding:'13px',...mn,fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        📊 Calculate Nutritional Insights
      </button>
      {DAYS.map(day=>{
        const meals=[...plan[day].breakfast,...plan[day].main,...plan[day].side]
        const isToday=day===TODAY
        return(
          <div key={day} style={{marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{...ep,fontSize:16,fontWeight:700,color:isToday?C.primary:C.onSurface}}>{DAY_LBL[day]}</span>
              {isToday&&<span style={{...mn,fontSize:10,fontWeight:700,background:C.primary,color:C.onPrimary,padding:'2px 7px',borderRadius:99}}>TODAY</span>}
            </div>
            {meals.length===0?(
              <div style={{...CARD,padding:22,display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                <span style={{fontSize:26,opacity:0.3}}>🍽</span>
                <span style={{...mn,fontSize:12,color:C.outlineVariant,fontStyle:'italic'}}>"So you're going hungry."</span>
                <button onClick={()=>onDayOpen(day)} style={{...mn,background:'none',border:`1px solid ${C.primary}`,color:C.primary,borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:700,cursor:'pointer',marginTop:4}}>+ Plan Meals</button>
              </div>
            ):(
              <div style={{...CARD,overflow:'hidden'}}>
                {meals.map((m,i)=>(
                  <div key={m.id} onClick={()=>onDayOpen(day)} style={{padding:'10px 14px',borderBottom:i<meals.length-1?`1px solid ${C.outlineVariant}25`:undefined,display:'flex',alignItems:'center',cursor:'pointer'}}>
                    <div style={{flex:1}}>
                      <div style={{...mn,fontSize:13,fontWeight:600,color:C.onSurface}}>{m.name}</div>
                      <div style={{display:'flex',gap:8,marginTop:2}}>
                        <CapLabel text={m.section==='breakfast'?'Breakfast':m.section==='main'?'Main':'Side'}/>
                        <span style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>🕒 {m.prep}m</span>
                        {m.portion!==4&&<span style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>👥 {m.portion}</span>}
                      </div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();removeMeal(day,m.section,m.id)}} style={{border:'none',background:'none',color:C.outlineVariant,cursor:'pointer',fontSize:14,padding:'0 0 0 10px'}}>✕</button>
                  </div>
                ))}
                <button onClick={()=>onDayOpen(day)} style={{width:'100%',background:'none',border:'none',padding:'10px 14px',textAlign:'left',...mn,fontSize:13,color:C.primary,fontWeight:600,cursor:'pointer',borderTop:`1px dashed ${C.outlineVariant}60`}}>＋ Add Meal</button>
              </div>
            )}
          </div>
        )
      })}
      <div style={{position:'sticky',bottom:10,padding:'8px 0'}}>
        <button onClick={onShoppingList} style={{width:'100%',background:C.primary,color:C.onPrimary,border:'none',borderRadius:12,padding:'14px',...mn,fontSize:14,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(0,68,64,0.3)'}}>
          🛒 Generate Shopping List
        </button>
      </div>
    </div>
  )
}

// ─── Daily Plan ─────────────────────────────────────────────────────
function DailyPlanScreen({day,plan,updatePortion,removeMeal,onAddToSection,onSave}){
  const [saved,setSaved]=useState(false)
  const secs=[{key:'breakfast',label:'Breakfast'},{key:'main',label:'Main Meal'},{key:'side',label:'Side Dish'}]
  const go=()=>{setSaved(true);setTimeout(()=>{setSaved(false);onSave()},1000)}
  return(
    <div style={{padding:'0 20px'}}>
      <div style={{...ep,fontSize:24,fontWeight:700,color:C.onSurface,padding:'16px 0 12px'}}>{DAY_LBL[day]}</div>
      {secs.map(s=>(
        <div key={s.key} style={{marginBottom:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{...ep,fontSize:15,fontWeight:700,color:C.onSurface}}>{s.label}</span>
            <button onClick={()=>onAddToSection(day,s.key)} style={{...mn,background:'none',border:'none',color:C.primary,fontWeight:700,fontSize:13,cursor:'pointer'}}>＋ Add</button>
          </div>
          {plan[day][s.key].length===0?(
            <div onClick={()=>onAddToSection(day,s.key)} style={{border:`2px dashed ${C.outlineVariant}`,borderRadius:16,padding:20,display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer'}}>
              <span style={{fontSize:22,color:C.outlineVariant}}>⊕</span>
              <span style={{...mn,fontSize:13,color:C.outlineVariant}}>Tap to add {s.label.toLowerCase()}</span>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {plan[day][s.key].map(m=>(
                <div key={m.id} style={{...CARD,padding:'14px 14px 10px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
                    <span style={{...mn,fontSize:14,fontWeight:600,color:C.onSurface,flex:1,marginRight:8}}>{m.name}</span>
                    <button onClick={()=>removeMeal(day,s.key,m.id)} style={{border:'none',background:'none',color:C.error,cursor:'pointer',fontSize:16,padding:0}}>🗑</button>
                  </div>
                  <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,marginBottom:10}}>🕒 {m.prep}m prep</div>
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <Stepper value={m.portion} min={m.min} onChange={v=>updatePortion(day,s.key,m.id,v)}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div style={{height:80}}/>
      <div style={{position:'fixed',bottom:64,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,padding:'10px 20px',background:C.surface,borderTop:`1px solid ${C.outlineVariant}30`}}>
        {saved
          ?<div style={{...mn,textAlign:'center',fontSize:14,fontWeight:700,color:'#1a7a3a',padding:'13px',background:'#f0fff4',borderRadius:12}}>✓ Saved!</div>
          :<Btn label='✓  Save Day' full onClick={go}/>}
      </div>
    </div>
  )
}

// ─── Recipe Card + Bucket ───────────────────────────────────────────
function RecipeCard({r,disabled,selected,onToggle}){
  const sel=selected.includes(r.id)
  return(
    <div onClick={disabled?undefined:()=>onToggle(r.id)} style={{...CARD,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:disabled?'default':'pointer',opacity:disabled?0.55:1,marginBottom:8}}>
      <div style={{flex:1}}>
        <div style={{...mn,fontSize:14,fontWeight:600,color:C.onSurface,marginBottom:4}}>{r.name}</div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <CapLabel text={`${Math.max(r.base,r.min)}p`}/>
          <span style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>🕒 {r.prep}m prep</span>
          <span style={{fontSize:13}}>{r.diet==='veg'||r.diet==='vegan'?'🌿':'🐰'}</span>
          {r.hasSides&&<span style={{fontSize:12}}>🍽</span>}
          {r.fun&&<span style={{...mn,fontSize:10,background:C.secondaryContainer,color:C.onSecondaryContainer,padding:'1px 6px',borderRadius:99,fontWeight:700}}>F</span>}
          {r.husband&&<span style={{...mn,fontSize:10,background:C.primaryFixed,color:C.primary,padding:'1px 6px',borderRadius:99,fontWeight:700}}>H</span>}
        </div>
      </div>
      <div style={{width:30,height:30,borderRadius:99,border:`2px solid ${disabled?C.outlineVariant:sel?C.primary:C.outlineVariant}`,background:disabled?C.surfaceContainerHigh:sel?C.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:disabled?C.outline:sel?C.onPrimary:C.outline,fontSize:14,fontWeight:700}}>
        {disabled?'✓':sel?'✓':'+'}
      </div>
    </div>
  )
}
function RecipeBucket({title,items,disabled,selected,onToggle}){
  if(!items.length)return null
  return(
    <div style={{marginBottom:16}}>
      <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:8}}>{title}</div>
      {items.map(r=><RecipeCard key={r.id} r={r} disabled={disabled} selected={selected} onToggle={onToggle}/>)}
    </div>
  )
}

// ─── Recipe Selection ────────────────────────────────────────────────
function RecipeSelectionScreen({day,section,plan,recipes,onAdd}){
  const [search,setSearch]=useState('')
  const [chip,setChip]=useState('cat')
  const [selected,setSelected]=useState([])
  const catName=section==='breakfast'?'Breakfast':section==='main'?'Mains':'Sides'

  // Recipes already on the *current* day (any section) — prevent duplicates on the same day
  const currentDayIds=useMemo(()=>[...plan[day].breakfast,...plan[day].main,...plan[day].side].map(m=>m.recipeId),[plan,day])

  // Recipes planned on *other* days this week — surface as "Already Planned This Week" (selectable for leftovers)
  const otherDaysIds=useMemo(()=>{
    const ids=new Set()
    DAYS.forEach(d=>{
      if(d===day)return
      ;['breakfast','main','side'].forEach(sec=>plan[d][sec].forEach(m=>ids.add(m.recipeId)))
    })
    return [...ids]
  },[plan,day])

  const filtered=useMemo(()=>{
    let list=recipes.filter(r=>r.cat===catName)
    if(search)list=list.filter(r=>r.name.toLowerCase().includes(search.toLowerCase()))
    return list
  },[catName,search,recipes])

  // Drop recipes already on this day (any section) — they shouldn't appear at all
  const available=filtered.filter(r=>!currentDayIds.includes(r.id))

  // Bucket order requested: Already Planned This Week → Default → Try Out → Order Out → Other
  const alreadyWeek=available.filter(r=>otherDaysIds.includes(r.id))
  const rest=available.filter(r=>!otherDaysIds.includes(r.id))
  const defaults=rest.filter(r=>(r.defaultDays||[]).includes(day)&&!r.tryOut&&!r.orderOut)
  const tryOut=rest.filter(r=>r.tryOut&&!r.orderOut)
  const orderOut=rest.filter(r=>r.orderOut)
  const other=rest.filter(r=>!(r.defaultDays||[]).includes(day)&&!r.tryOut&&!r.orderOut)

  const toggle=rid=>setSelected(s=>s.includes(rid)?s.filter(x=>x!==rid):[...s,rid])
  return(
    <div style={{display:'flex',flexDirection:'column',minHeight:'100%'}}>
      <div style={{flex:1,padding:'12px 20px 120px'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='🔍 Search meals…' style={{width:'100%',padding:'10px 14px',borderRadius:12,border:`1px solid ${C.outlineVariant}`,fontSize:14,...mn,background:C.white,outline:'none',marginBottom:12}}/>
        <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto',paddingBottom:4}}>
          <PillBtn label={catName} active={chip==='cat'} onClick={()=>setChip('cat')}/>
          <PillBtn label='❄ Freezer' active={chip==='freezer'} onClick={()=>setChip('freezer')}/>
          <PillBtn label='⊟ Filter' active={false} onClick={()=>{}}/>
        </div>
        {chip==='freezer'?(
          <div style={{...CARD,padding:24,textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>❄</div>
            <div style={{...mn,fontSize:14,color:C.onSurfaceVariant}}>No freezer items for this week.</div>
          </div>
        ):(
          <>
            <RecipeBucket title='Already Planned This Week' items={alreadyWeek} disabled={false} selected={selected} onToggle={toggle}/>
            <RecipeBucket title='Default' items={defaults} disabled={false} selected={selected} onToggle={toggle}/>
            <RecipeBucket title='Try Out' items={tryOut} disabled={false} selected={selected} onToggle={toggle}/>
            <RecipeBucket title='Order Out' items={orderOut} disabled={false} selected={selected} onToggle={toggle}/>
            <RecipeBucket title='Other Meals' items={other} disabled={false} selected={selected} onToggle={toggle}/>
          </>
        )}
      </div>
      <div style={{position:'fixed',bottom:64,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,padding:'10px 20px',background:C.surface,borderTop:`1px solid ${C.outlineVariant}30`}}>
        <Btn label={selected.length?`Add Selected (${selected.length})`:'Select recipes above'} full onClick={()=>{onAdd(selected);setSelected([])}} disabled={selected.length===0}/>
      </div>
    </div>
  )
}

// ─── Nutrition ────────────────────────────────────────────────────────
function NutritionScreen({profile,setProfile,nutriData,nutriLoading,nutriError,onAnalyse}){
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

// ─── Shopping List ────────────────────────────────────────────────────
function ShoppingListScreen({shopping,onToggle,loading,error,onRegenerate}){
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

// ─── Batch ────────────────────────────────────────────────────────────
function BatchScreen({activeTab,setActiveTab,batchData,batchLoading,batchError,onGenerate}){
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
          <div style={{...ep,fontSize:15,fontWeight:700,color:C.onSurface,marginBottom:10}}>✓ Session Overview</div>
          {session.overview.map((o,i)=><div key={i} style={{...mn,fontSize:13,color:C.onSurfaceVariant,padding:'4px 0',display:'flex',gap:8}}><span>{o.e}</span><span>{o.t}</span></div>)}
        </div>
      )}
      <div style={{position:'relative',paddingLeft:52}}>
        <div style={{position:'absolute',left:18,top:8,bottom:8,width:2,background:C.outlineVariant,borderRadius:2}}/>
        {session.steps.map((step,i)=>{
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
                {step.chips.length>0&&<div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>{step.chips.map((c,j)=><span key={j} style={{...mn,fontSize:10,fontWeight:600,background:tc.bg,color:tc.tx,padding:'2px 8px',borderRadius:99}}>{c}</span>)}</div>}
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

// ─── Settings ─────────────────────────────────────────────────────────
function SettingsScreen({defPort,setDefPort}){
  return(
    <div style={{padding:'20px 20px 40px'}}>
      <div style={{...ep,fontSize:26,fontWeight:700,color:C.onSurface,marginBottom:4}}>Settings</div>
      <div style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:20}}>Customise your culinary experience</div>
      <div style={{...CARD}}>
        <div style={{background:C.secondaryContainer,borderRadius:'16px 16px 0 0',padding:'12px 16px',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:18}}>🍴</span>
          <span style={{...ep,fontSize:16,fontWeight:700,color:C.primary}}>Meal Planning Defaults</span>
        </div>
        <div style={{padding:'28px 20px',textAlign:'center'}}>
          <div style={{...ep,fontSize:16,fontWeight:700,color:C.onSurface,marginBottom:6}}>Default Portion Size</div>
          <div style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:24,lineHeight:1.5}}>Base for scaling all recipes in your planner.</div>
          <div style={{display:'inline-flex',alignItems:'center',gap:12,background:C.surfaceContainerHigh,borderRadius:99,padding:'12px 20px'}}>
            <button onClick={()=>defPort>1&&setDefPort(defPort-1)} style={{width:36,height:36,borderRadius:8,border:`1px solid ${C.outlineVariant}`,background:C.white,color:defPort<=1?C.outlineVariant:C.onSurface,cursor:defPort<=1?'default':'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
            <div style={{textAlign:'center',minWidth:50}}>
              <div style={{...ep,fontSize:28,fontWeight:700,color:C.primary,lineHeight:1}}>{defPort}</div>
              <div style={{...mn,fontSize:10,fontWeight:700,letterSpacing:'0.07em',color:C.onSurfaceVariant,marginTop:2}}>SERVINGS</div>
            </div>
            <button onClick={()=>setDefPort(defPort+1)} style={{width:36,height:36,borderRadius:8,background:C.primary,color:'#fff',border:'none',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
          </div>
        </div>
      </div>
      <div style={{marginTop:20,...CARD,padding:16}}>
        <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.05em',marginBottom:12,textTransform:'uppercase'}}>Connected to Supabase</div>
        {[['Project','5 Minutes to Dinner'],['Region','eu-west-1'],['Recipes','Live from your database'],['Plan data','Saved in real time'],['Ratings','Persisted per meal instance']].map(([k,v])=>(
          <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.outlineVariant}30`,gap:12}}>
            <span style={{...mn,fontSize:12,color:C.onSurfaceVariant,flexShrink:0}}>{k}</span>
            <span style={{...mn,fontSize:12,fontWeight:600,color:C.onSurface,textAlign:'right'}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Root App ──────────────────────────────────────────────────────────
export default function App() {
  // Nav
  const [tab,       setTab]      = useState('home')
  const [screen,    setScreen]   = useState(null)
  const [selDay,    setSelDay]   = useState(TODAY)
  const [selSec,    setSelSec]   = useState('main')
  const [batchTab,  setBatchTab] = useState('big')
  const [nutriProf, setNutriProf]= useState('adult')
  const [selRecipeId,      setSelRecipeId]      = useState(null)
  const [recipeDetailPortion, setRecipeDetailPortion] = useState(4)

  // Data
  const [loading,     setLoading]     = useState(true)
  const [loadMsg,     setLoadMsg]     = useState('Connecting to Supabase…')
  const [error,       setError]       = useState(null)
  const [recipes,     setRecipes]     = useState([])
  const [planId,      setPlanId]      = useState(null)
  const [dayEntryMap, setDayEntryMap] = useState({})
  const [plan,        setPlanState]   = useState(emptyWeek)
  const [ratings,     setRatings]     = useState({})
  const [shopping,    setShopping]    = useState([])
  const [shoppingId,  setShoppingId]  = useState(null)
  const [shoppingLoading,setShoppingLoading]=useState(false)
  const [shoppingError,  setShoppingError]  =useState(null)
  const [nutriData,   setNutriData]   = useState(null)
  const [nutriLoading,setNutriLoading]= useState(false)
  const [nutriError,  setNutriError]  = useState(null)
  const [batchData,   setBatchData]   = useState(null)
  const [batchLoading,setBatchLoading]= useState(false)
  const [batchError,  setBatchError]  = useState(null)
  const [defPort,     setDefPortSt]   = useState(4)

  // ── Bootstrap ────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        setLoadMsg('Loading recipes…')
        const [recs, settings] = await Promise.all([fetchRecipes(), fetchSettings()])
        setRecipes(recs)
        if (settings?.default_portions) setDefPortSt(settings.default_portions)

        setLoadMsg('Loading your meal plan…')
        const pid = await getOrCreatePlan(WEEK_OF)
        setPlanId(pid)

        const deRows = await fetchWeekPlan(pid)
        const entryMap = {}, newPlan = emptyWeek()
        deRows.forEach(de => {
          entryMap[de.day_of_week] = de.id
          ;(de.planned_meals || []).forEach(pm => {
            const sec = pm.section
            if (newPlan[de.day_of_week]?.[sec] !== undefined) {
              newPlan[de.day_of_week][sec].push({
                id: pm.id, recipeId: pm.recipe_id, section: sec,
                portion: pm.portion, name: pm.name_snapshot,
                prep: pm.prep_time_snapshot || 0,
                active: pm.cook_time_snapshot || 0,
                hasSides: false, min: 1,
              })
            }
          })
        })
        setDayEntryMap(entryMap)
        setPlanState(newPlan)

        // Ratings for yesterday
        const yestMealIds = [...newPlan[YEST].breakfast, ...newPlan[YEST].main, ...newPlan[YEST].side].map(m => m.id)
        if (yestMealIds.length) {
          const ratingRows = await fetchRatings(yestMealIds)
          const rm = {}; ratingRows.forEach(r => { rm[r.planned_meal_id] = r.rating })
          setRatings(rm)
        }

        // Shopping list
        const sl = await fetchShoppingList(pid)
        if (sl) { setShoppingId(sl.id); setShopping(sl.shopping_list_items || []) }

        setLoading(false)
      } catch (e) {
        console.error(e)
        setError(e.message)
        setLoading(false)
      }
    })()
  }, [])

  // ── Mutations (optimistic UI + background DB write) ───────────────
  const setPlan = newPlan => setPlanState(newPlan)

  const setDefPort = async val => {
    setDefPortSt(val)
    await saveSettings(val)
  }

  const removeMeal = async (day, sec, id) => {
    setPlan({ ...plan, [day]: { ...plan[day], [sec]: plan[day][sec].filter(m => m.id !== id) } })
    await removePlannedMeal(id)
  }

  const updatePortion = async (day, sec, id, val) => {
    const m = plan[day][sec].find(x => x.id === id)
    const v = Math.max(m?.min || 1, val)
    setPlan({ ...plan, [day]: { ...plan[day], [sec]: plan[day][sec].map(x => x.id === id ? { ...x, portion: v } : x) } })
    await updatePlannedMealPortion(id, v)
  }

  const addMeals = async rids => {
    const sec = selSec, entryId = dayEntryMap[selDay]
    const pos = plan[selDay][sec].length
    const mealsToInsert = rids.map((rid, i) => {
      const r = recipes.find(x => x.id === rid) || { name: rid, prep: 0, active: 0, hasSides: false, min: 1, base: defPort }
      return { recipeId: rid, section: sec, name: r.name, prep: r.prep, active: r.active, hasSides: r.hasSides, min: r.min, portion: defPort, base: r.base, position: pos + i }
    })
    // Optimistic
    const tempMeals = mealsToInsert.map(m => ({ ...m, id: uid() }))
    setPlan({ ...plan, [selDay]: { ...plan[selDay], [sec]: [...plan[selDay][sec], ...tempMeals] } })
    if (tempMeals.find(m => m.hasSides && sec === 'main')) { setSelSec('side') } else { setScreen('dailyPlan') }
    // DB write — replace temp IDs with real ones
    const created = await addPlannedMeals(entryId, mealsToInsert)
    if (created) {
      setPlanState(prev => {
        const updated = { ...prev, [selDay]: { ...prev[selDay], [sec]: [...prev[selDay][sec]] } }
        tempMeals.forEach((tm, i) => {
          const idx = updated[selDay][sec].findIndex(x => x.id === tm.id)
          if (idx >= 0 && created[i]) updated[selDay][sec][idx] = { ...updated[selDay][sec][idx], id: created[i].id }
        })
        return updated
      })
    }
  }

  const onRate = async (mealId, rating) => {
    setRatings(r => ({ ...r, [mealId]: rating }))
    await upsertRating(mealId, rating)
  }

  const onShoppingToggle = async id => {
    const item = shopping.find(x => x.id === id)
    const checked = !item?.checked
    setShopping(s => s.map(x => x.id === id ? { ...x, checked } : x))
    await updateShoppingItem(id, checked)
  }

  const generateShoppingList = async () => {
    // Build the full meals payload — recipeId lets the edge function look up
    // ingredients and scale by portion / recipe base.
    const meals = []
    DAYS.forEach(day => {
      ;['breakfast','main','side'].forEach(sec => {
        plan[day][sec].forEach(m => meals.push({
          day, section: sec,
          recipeId: m.recipeId,
          name: m.name,
          portion: m.portion,
        }))
      })
    })
    if (!meals.length) { alert('Add some meals to the planner first.'); return }

    // Switch to the List tab so the user sees the loading state
    setTab('list'); setScreen(null)
    setShoppingLoading(true); setShoppingError(null)

    try {
      // Edge function should: fetch ingredients per recipeId, scale by portion,
      // sum across the week, categorise into aisles via Gemini, and return:
      //   { items: [{ name, amount, unit, aisle, notes? }, ...] }
      const result = await callEdgeFn('shopping-list', { meals, weekOf: WEEK_OF, region: 'UK' })
      const items = (result.items || []).map(it => ({
        name: it.name,
        amount: it.amount ?? '',
        unit: it.unit ?? '',
        aisle: (it.aisle || 'OTHER').toUpperCase(),
        checked: false,
      }))
      setShopping(items.map((it, i) => ({ ...it, id: `tmp-${i}` })))
      const sid = await saveShoppingList(planId, items)
      setShoppingId(sid)
      const sl = await fetchShoppingList(planId)
      if (sl) setShopping(sl.shopping_list_items || [])
    } catch (e) {
      setShoppingError(e.message)
    } finally {
      setShoppingLoading(false)
    }
  }

  // ── AI functions ─────────────────────────────────────────────────
  // Toddler DOB used for age-appropriate nutritional guidelines
  const TODDLER_DOB = '2024-09-27'

  const analyseNutrition = async () => {
    setNutriLoading(true); setNutriError(null)
    try {
      // Pass recipeId so the edge function can pull ingredients/macros from the recipe row
      // and scale by portion. Defaults: 1 portion/day/adult, 0.5 portion/day/toddler.
      const allMeals = []
      DAYS.forEach(day => {
        ;['breakfast','main','side'].forEach(sec => {
          plan[day][sec].forEach(m => allMeals.push({
            day, section: sec,
            recipeId: m.recipeId,
            name: m.name,
            portion: m.portion,
          }))
        })
      })
      if (!allMeals.length) { setNutriError('Add some meals to the planner first.'); setNutriLoading(false); return }

      const basePayload = { meals: allMeals, weekOf: WEEK_OF, region: 'UK', analysis: 'daily_and_weekly' }

      // The edge function should return per-day breakdown + weekly summary.
      // UI currently renders weekly scores + recommendations; if `daily` is provided
      // it will be available on the response object for future expansion.
      const [adultResult, toddlerResult] = await Promise.all([
        callEdgeFn('nutrition', { ...basePayload, profile: 'female_adult', portionsPerDay: 1 }),
        callEdgeFn('nutrition', { ...basePayload, profile: 'toddler',      portionsPerDay: 0.5, dob: TODDLER_DOB }),
      ])
      const normalize = r => ({
        scores: r.scores,
        general: r.generalRecommendations || r.general || [],
        meals: (r.mealRecommendations || r.meals || []).map(x => ({
          meal: x.forMeal || x.meal || '',
          text: x.text,
          type: x.type,
        })),
      })
      setNutriData({ adult: normalize(adultResult), toddler: normalize(toddlerResult) })
    } catch(e) {
      setNutriError(e.message)
    } finally {
      setNutriLoading(false)
    }
  }

  const generateBatch = async () => {
    setBatchLoading(true); setBatchError(null)
    try {
      const result = await callEdgeFn('batch-cooking', { meals: plan })
      setBatchData(result)
    } catch(e) {
      setBatchError(e.message)
    } finally {
      setBatchLoading(false)
    }
  }

  // ── Nav ─────────────────────────────────────────────────────────
  const openDayPlan   = day => { setSelDay(day); setScreen('dailyPlan') }
  const openAddSec    = (day, sec) => { setSelDay(day); setSelSec(sec); setScreen('recipeSelection') }
  const openRecipe    = (recipeId, portion) => { setSelRecipeId(recipeId); setRecipeDetailPortion(portion || 4); setScreen('recipe') }
  const copyWeekPlan  = () => {
    const lines = [`5 Minutes to Dinner — ${WEEK_LBL}\n`]
    DAYS.forEach(day => {
      const meals = [...plan[day].breakfast, ...plan[day].main, ...plan[day].side]
      if (!meals.length) return
      lines.push(DAY_LBL[day])
      meals.forEach(m => {
        const sec = m.section === 'breakfast' ? 'Breakfast' : m.section === 'main' ? 'Main' : 'Side'
        lines.push(`• ${m.name} — ${sec} (${m.portion} portions)`)
      })
      lines.push('')
    })
    navigator.clipboard.writeText(lines.join('\n'))
  }
  const goBack = () => screen === 'recipeSelection' ? setScreen('dailyPlan') : setScreen(null)

  const headerTitle =
    screen === 'settings'        ? 'Settings'
    : screen === 'dailyPlan'     ? 'Daily Plan'
    : screen === 'recipeSelection' ? `${DAY_LBL[selDay]} | ${selSec === 'breakfast' ? 'Breakfast' : selSec === 'main' ? 'Mains' : 'Sides'}`
    : screen === 'nutrition'     ? 'Nutrition Insights'
    : screen === 'recipe'        ? 'Recipe Details'
    : '5 Minutes to Dinner'

  const NAV = [{id:'home',icon:'🏠',label:'Home'},{id:'planner',icon:'📅',label:'Planner'},{id:'list',icon:'🛒',label:'List'},{id:'batch',icon:'🍲',label:'Batch Cooking'}]

  const renderScreen = () => {
    if (loading) return <Spinner msg={loadMsg}/>
    if (error) return (
      <div style={{padding:32,textAlign:'center'}}>
        <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
        <div style={{...ep,fontSize:16,fontWeight:700,color:C.error,marginBottom:8}}>Couldn't connect</div>
        <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.6,marginBottom:20}}>{error}</div>
        <Btn label='Retry' onClick={()=>window.location.reload()} secondary/>
      </div>
    )
    if (screen === 'settings')        return <SettingsScreen defPort={defPort} setDefPort={setDefPort}/>
    if (screen === 'nutrition')       return <NutritionScreen profile={nutriProf} setProfile={setNutriProf} nutriData={nutriData} nutriLoading={nutriLoading} nutriError={nutriError} onAnalyse={analyseNutrition}/>
    if (screen === 'dailyPlan')       return <DailyPlanScreen day={selDay} plan={plan} updatePortion={updatePortion} removeMeal={removeMeal} onAddToSection={openAddSec} onSave={()=>setScreen(null)}/>
    if (screen === 'recipeSelection') return <RecipeSelectionScreen day={selDay} section={selSec} plan={plan} recipes={recipes} onAdd={addMeals}/>
    if (screen === 'recipe')          return <RecipeScreen recipeId={selRecipeId} portion={recipeDetailPortion}/>
    if (tab === 'home')    return <HomeScreen plan={plan} ratings={ratings} onRate={onRate} onPlanToday={()=>openDayPlan(TODAY)} onOpenRecipe={openRecipe} onCopy={copyWeekPlan}/>
    if (tab === 'planner') return <PlannerScreen plan={plan} removeMeal={removeMeal} onDayOpen={openDayPlan} onNutrition={()=>{ setScreen('nutrition'); if(!nutriData) analyseNutrition() }} onShoppingList={generateShoppingList}/>
    if (tab === 'list')    return <ShoppingListScreen shopping={shopping} onToggle={onShoppingToggle} loading={shoppingLoading} error={shoppingError} onRegenerate={generateShoppingList}/>
    if (tab === 'batch')   return <BatchScreen activeTab={batchTab} setActiveTab={setBatchTab} batchData={batchData} batchLoading={batchLoading} batchError={batchError} onGenerate={generateBatch}/>
  }

  return (
    <div style={{display:'flex',justifyContent:'center',background:'#cdd5d4',minHeight:'100vh'}}>
      <div style={{width:'100%',maxWidth:430,background:C.surface,display:'flex',flexDirection:'column',minHeight:'100vh',position:'relative',...mn}}>
        <div style={{background:C.white,borderBottom:`1px solid ${C.outlineVariant}25`,padding:'11px 20px',display:'flex',alignItems:'center',gap:10,flexShrink:0,position:'sticky',top:0,zIndex:20}}>
          {screen
            ? <button onClick={goBack} style={{border:'none',background:'none',color:C.primary,fontSize:22,cursor:'pointer',padding:'2px 8px 2px 0',display:'flex',alignItems:'center'}}>←</button>
            : <div style={{width:32,height:32,background:C.primary,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{...ep,fontSize:11,fontWeight:700,color:C.onPrimary,letterSpacing:'-0.02em'}}>5M</span></div>
          }
          <span style={{...ep,fontSize:screen?16:17,fontWeight:700,color:screen?C.onSurface:C.primary,flex:1}}>{headerTitle}</span>
          {!loading && !screen && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:6,height:6,borderRadius:99,background:error?'#ba1a1a':'#1a7a3a'}} title={error?'DB error':'Connected to Supabase'}/>
              <button onClick={()=>setScreen('settings')} style={{border:'none',background:'none',color:C.onSurfaceVariant,fontSize:18,cursor:'pointer',padding:4}}>⚙</button>
            </div>
          )}
        </div>
        <div style={{flex:1,overflowY:'auto',position:'relative',paddingBottom:screen?80:0,display:'flex',flexDirection:'column'}}>
          {renderScreen()}
        </div>
        {screen !== 'settings' && (
          <div style={{background:C.white,borderTop:`1px solid ${C.outlineVariant}30`,display:'flex',padding:'8px 0 14px',flexShrink:0,position:'sticky',bottom:0,zIndex:20}}>
            {NAV.map(t => {
              const active = tab === t.id && !screen
              return (
                <button key={t.id} onClick={()=>{setTab(t.id);setScreen(null)}} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,border:'none',background:'none',color:active?C.primary:C.onSurfaceVariant,cursor:'pointer',padding:'4px 2px'}}>
                  <span style={{fontSize:active?22:19}}>{t.icon}</span>
                  <span style={{...mn,fontSize:10,fontWeight:active?700:500}}>{t.label}</span>
                  {active && <div style={{width:18,height:2,background:C.primary,borderRadius:2}}/>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
