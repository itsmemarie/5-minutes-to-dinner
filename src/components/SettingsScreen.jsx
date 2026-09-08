import { C, ep, mn, CARD, R } from '../lib/theme.js'
import { ageBandFromDob, TODDLER_AGE_BANDS } from '../lib/dateHelpers.js'
import { Stepper } from './ui/Stepper.jsx'
import {
  PACES, ACTIVITY, CALORIE_FLOOR,
  formatWeightKg, formatHeightCm, formatCalorieBand, etaLine,
  kgToLb, lbToKg, cmToFtIn, ftInToCm,
} from '../lib/goalMaths.js'

// ── Small local primitives, shared only within this screen ──────────
function Switch({ on, onClick }) {
  return (
    <div onClick={onClick} style={{width:46,height:27,borderRadius:R.pill,background:on?C.primary:C.outlineVariant,padding:3,display:'flex',alignItems:'center',justifyContent:on?'flex-end':'flex-start',flexShrink:0,cursor:'pointer',transition:'background 0.15s'}}>
      <div style={{width:21,height:21,borderRadius:R.pill,background:'#fff'}}/>
    </div>
  )
}
function SegPill({ options, value, onChange, upper }) {
  return (
    <div style={{display:'flex',background:C.surfaceContainerHigh,borderRadius:R.pill,padding:3}}>
      {options.map(o=>(
        <button key={o.value} onClick={()=>onChange(o.value)} style={{flex:1,padding:o.small?'8px 4px':9,borderRadius:R.pill,border:'none',background:value===o.value?C.primary:'transparent',color:value===o.value?C.onPrimary:C.onSurfaceVariant,...mn,fontWeight:700,fontSize:o.small?11:12,letterSpacing:'0.04em',textTransform:upper?'uppercase':undefined,cursor:'pointer'}}>{o.label}</button>
      ))}
    </div>
  )
}
function FieldBox({ label, children, emphasise }) {
  return (
    <div>
      <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:5}}>{label}</div>
      <div style={{border:`${emphasise?1.5:1}px solid ${emphasise?C.primary:C.outlineVariant}`,borderRadius:R.md,padding:'10px 12px',display:'flex',alignItems:'baseline',gap:5}}>
        {children}
      </div>
    </div>
  )
}
const numInputStyle = { ...mn, border:'none', outline:'none', background:'none', fontWeight:700, fontSize:15, width:'100%', padding:0 }

export function SettingsScreen({defPort,setDefPort,toddlerDob,setToddlerDob,goalProfile,goalTargets,setGoalProfile}){
  const toddlerBandLabel = toddlerDob ? (TODDLER_AGE_BANDS.find(b => b.id === ageBandFromDob(toddlerDob))?.label || null) : null
  const gp = goalProfile
  const goalMode = !!gp?.goalModeEnabled
  const units = gp?.units ?? 'metric'
  const imperial = units === 'imperial'

  return(
    <div style={{padding:'20px 20px 40px'}}>
      <div style={{...ep,fontSize:26,color:C.onSurface,marginBottom:4}}>Settings</div>
      <div style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:20}}>Customise your culinary experience</div>
      <div style={{...CARD}}>
        <div style={{background:C.secondaryContainer,borderRadius:`${R.md}px ${R.md}px 0 0`,padding:'12px 16px',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:18}}>🍴</span>
          <span style={{...ep,fontSize:16,color:C.onSecondaryContainer}}>Meal Planning Defaults</span>
        </div>
        <div style={{padding:'28px 20px',textAlign:'center'}}>
          <div style={{...ep,fontSize:16,color:C.onSurface,marginBottom:6}}>Default Portion Size</div>
          <div style={{...mn,fontSize:13,color:C.onSurfaceVariant,marginBottom:24,lineHeight:1.5}}>Base for scaling all recipes in your planner.</div>
          <Stepper size="lg" caption="SERVINGS" value={defPort} min={1} onChange={setDefPort} />
        </div>
      </div>

      {/* ── Toddler ──────────────────────────────────────────────── */}
      <div style={{marginTop:22,...CARD}}>
        <div style={{background:C.secondaryContainer,borderRadius:`${R.md}px ${R.md}px 0 0`,padding:'12px 16px',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:18}}>🧸</span>
          <span style={{...ep,fontSize:16,color:C.onSecondaryContainer}}>Toddler</span>
        </div>
        <div style={{padding:'20px'}}>
          <FieldBox label="Birthday">
            <input
              type="date"
              value={toddlerDob || ''}
              max={new Date().toISOString().split('T')[0]}
              onChange={e=>e.target.value&&setToddlerDob(e.target.value)}
              style={{...numInputStyle,fontSize:14}}
            />
          </FieldBox>
          <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5,marginTop:10}}>
            {toddlerBandLabel
              ? <>Currently <strong style={{color:C.onSurface}}>{toddlerBandLabel}</strong> — toddler cooking activities across the app match this age.</>
              : 'Set a birthday to get age-appropriate toddler cooking activities on recipes and batch cooking.'}
          </div>
        </div>
      </div>

      {/* ── Weight & nutrition goals ─────────────────────────────── */}
      <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.05em',textTransform:'uppercase',margin:'22px 0 8px'}}>Weight &amp; nutrition goals</div>
      <div style={{...CARD}}>
        <div style={{padding:16,display:'flex',alignItems:'flex-start',gap:14}}>
          <div style={{flex:1}}>
            <div style={{...mn,fontSize:14,fontWeight:700,color:C.onSurface,marginBottom:3}}>Show goal figures in the app</div>
            <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,lineHeight:1.5}}>Planner, daily plan, recipe pages and insights. Off keeps every screen clean.</div>
          </div>
          <Switch on={goalMode} onClick={()=>gp&&setGoalProfile({goalModeEnabled:!goalMode})}/>
        </div>

        {goalMode && gp && goalTargets && (
          <div style={{borderTop:`1px solid ${C.outlineVariant}59`,padding:16,display:'flex',flexDirection:'column',gap:16}}>

            {/* Lose / Gain */}
            <SegPill options={[{value:'lose',label:'Lose weight'},{value:'gain',label:'Gain weight'}]} value={gp.direction} onChange={v=>setGoalProfile({direction:v})} upper/>

            {/* About you + units */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.05em',textTransform:'uppercase'}}>About you</div>
              <div style={{display:'flex',background:C.surfaceContainerHigh,borderRadius:R.pill,padding:2}}>
                {[['metric','KG / CM'],['imperial','LB / FT']].map(([v,l])=>(
                  <span key={v} onClick={()=>setGoalProfile({units:v})} style={{padding:'5px 12px',borderRadius:R.pill,background:units===v?C.primary:'transparent',color:units===v?C.onPrimary:C.onSurfaceVariant,...mn,fontSize:11,fontWeight:700,letterSpacing:'0.04em',cursor:'pointer'}}>{l}</span>
                ))}
              </div>
            </div>

            {/* Sex */}
            <SegPill options={[{value:'female',label:'Female'},{value:'male',label:'Male'}]} value={gp.sex} onChange={v=>setGoalProfile({sex:v})} upper/>

            {/* Four fields */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <FieldBox label="Age">
                <input type="number" style={numInputStyle} value={gp.age} onChange={e=>setGoalProfile({age:Math.max(1,Number(e.target.value)||0)})}/>
                <span style={{...mn,fontSize:12,fontWeight:600,color:C.onSurfaceVariant,whiteSpace:'nowrap'}}>years</span>
              </FieldBox>

              <FieldBox label="Height">
                {imperial ? (()=>{ const t=Math.round(gp.heightCm/2.54); const ft=Math.floor(t/12), inch=t%12; return(<>
                  <input type="number" style={{...numInputStyle,width:28}} value={ft} onChange={e=>setGoalProfile({heightCm:ftInToCm(Number(e.target.value)||0,inch)})}/>
                  <span style={{...mn,fontSize:12,fontWeight:600,color:C.onSurfaceVariant}}>'</span>
                  <input type="number" style={{...numInputStyle,width:28}} value={inch} onChange={e=>setGoalProfile({heightCm:ftInToCm(ft,Number(e.target.value)||0)})}/>
                  <span style={{...mn,fontSize:12,fontWeight:600,color:C.onSurfaceVariant}}>"</span>
                </>) })() : (<>
                  <input type="number" style={numInputStyle} value={Math.round(gp.heightCm)} onChange={e=>setGoalProfile({heightCm:Number(e.target.value)||0})}/>
                  <span style={{...mn,fontSize:12,fontWeight:600,color:C.onSurfaceVariant}}>cm</span>
                </>)}
              </FieldBox>

              <FieldBox label="Current weight">
                {imperial ? (<>
                  <input type="number" style={numInputStyle} value={kgToLb(gp.weightKg)} onChange={e=>setGoalProfile({weightKg:lbToKg(Number(e.target.value)||0)})}/>
                  <span style={{...mn,fontSize:12,fontWeight:600,color:C.onSurfaceVariant}}>lb</span>
                </>) : (<>
                  <input type="number" step="0.1" style={numInputStyle} value={gp.weightKg} onChange={e=>setGoalProfile({weightKg:Number(e.target.value)||0})}/>
                  <span style={{...mn,fontSize:12,fontWeight:600,color:C.onSurfaceVariant}}>kg</span>
                </>)}
              </FieldBox>

              <FieldBox label="Goal weight" emphasise>
                {imperial ? (<>
                  <input type="number" style={{...numInputStyle,color:C.primary}} value={kgToLb(gp.goalWeightKg)} onChange={e=>setGoalProfile({goalWeightKg:lbToKg(Number(e.target.value)||0)})}/>
                  <span style={{...mn,fontSize:12,fontWeight:600,color:C.primary}}>lb</span>
                </>) : (<>
                  <input type="number" step="0.1" style={{...numInputStyle,color:C.primary}} value={gp.goalWeightKg} onChange={e=>setGoalProfile({goalWeightKg:Number(e.target.value)||0})}/>
                  <span style={{...mn,fontSize:12,fontWeight:600,color:C.primary}}>kg</span>
                </>)}
              </FieldBox>
            </div>

            {/* Activity level */}
            <div>
              <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>Activity level</div>
              <SegPill options={[
                {value:'sedentary',label:'Sedentary',small:true},{value:'light',label:'Light',small:true},
                {value:'moderate',label:'Moderate',small:true},{value:'very',label:'Very',small:true},
              ]} value={gp.activityLevel} onChange={v=>setGoalProfile({activityLevel:v})}/>
              <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,marginTop:6,lineHeight:1.5}}>{ACTIVITY[gp.activityLevel]?.explainer}</div>
            </div>

            {/* Pace */}
            <div>
              <div style={{...mn,fontSize:10,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>How fast do you want to {gp.direction==='gain'?'gain':'lose'}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {Object.entries(PACES).map(([key,p])=>{
                  const sel = gp.pace===key
                  return (
                    <div key={key} onClick={()=>setGoalProfile({pace:key})} style={{border:`${sel?1.5:1}px solid ${sel?C.primary:C.outlineVariant}`,background:sel?C.primaryFixed:'transparent',borderRadius:R.md,padding:'9px 12px',cursor:'pointer'}}>
                      <div style={{...mn,fontSize:13,fontWeight:700,color:sel?C.primary:C.onSurface}}>{p.label}</div>
                      <div style={{...mn,fontSize:11,color:sel?C.primary:C.onSurfaceVariant,opacity:sel?0.75:1}}>{p.kgPerWeek} kg / week</div>
                    </div>
                  )
                })}
              </div>
              {goalTargets.paceCaution && (
                <div style={{display:'flex',gap:7,alignItems:'flex-start',marginTop:8}}>
                  <span style={{width:6,height:6,borderRadius:R.pill,background:C.tertiary,flexShrink:0,marginTop:5}}/>
                  <div style={{...mn,fontSize:11,color:'#924b1a',lineHeight:1.5}}>1 kg a week is aggressive. Most guidance caps sustained loss at 0.5–0.75 kg a week, and this pace leaves little room for protein and fibre in a day.</div>
                </div>
              )}
            </div>

            {/* Daily targets panel */}
            <div style={{background:C.primaryFixed,borderRadius:R.md,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:10,marginBottom:12}}>
                <div style={{...mn,fontSize:11,fontWeight:700,color:C.primary,letterSpacing:'0.06em',textTransform:'uppercase'}}>Your daily targets</div>
                <div style={{...mn,fontSize:11,color:C.onSurfaceVariant}}>Updates as you edit</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <div style={{...mn,fontSize:22,fontWeight:700,color:C.onSurface,lineHeight:1.1}}>{goalTargets.calories.toLocaleString('en-GB')}</div>
                  <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,marginTop:2}}>calories · band {formatCalorieBand(goalTargets.calorieBandLow,goalTargets.calorieBandHigh)}</div>
                </div>
                <div>
                  <div style={{...mn,fontSize:22,fontWeight:700,color:C.onSurface,lineHeight:1.1}}>{goalTargets.protein}g</div>
                  <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,marginTop:2}}>protein</div>
                </div>
                <div>
                  <div style={{...mn,fontSize:22,fontWeight:700,color:C.onSurface,lineHeight:1.1}}>{goalTargets.fibre}g</div>
                  <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,marginTop:2}}>fibre</div>
                </div>
                <div>
                  <div style={{...mn,fontSize:22,fontWeight:700,color:C.onSurface,lineHeight:1.1}}>{goalTargets.wholeFoodPct}%</div>
                  <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,marginTop:2}}>whole-food calories</div>
                </div>
              </div>
              {goalTargets.floorHit && (
                <div style={{display:'flex',gap:7,alignItems:'flex-start',marginTop:12}}>
                  <span style={{width:6,height:6,borderRadius:R.pill,background:C.tertiary,flexShrink:0,marginTop:5}}/>
                  <div style={{...mn,fontSize:11,color:'#924b1a',lineHeight:1.5}}>Keep at {CALORIE_FLOOR.toLocaleString('en-GB')} kcal — it's the lowest we recommend.</div>
                </div>
              )}
              <div style={{borderTop:`1px solid ${C.outlineVariant}80`,marginTop:14,paddingTop:12,...mn,fontSize:12,color:C.onSurface,lineHeight:1.6}}>{etaLine(goalTargets,gp)}</div>
              <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,lineHeight:1.6,marginTop:8}}>Calories from the Mifflin-St Jeor equation times your activity factor, less 7,700 kcal per kilo. Protein at {goalTargets.proteinPerKg.toFixed(1)} g per kilo of body weight, fibre at 14 g per 1,000 kcal (Dietary Guidelines for Americans).</div>
            </div>
          </div>
        )}
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
