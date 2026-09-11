import { C, mn, R } from '../../lib/theme.js'
import {
  PACES, ACTIVITY, CALORIE_FLOOR,
  formatCalorieBand, etaLine,
  kgToLb, lbToKg, ftInToCm,
} from '../../lib/goalMaths.js'
import { SectionHeading, RowCard, Row, Switch, SegPill, FieldBox, fieldInputStyle, SECTION_DIVIDER } from './primitives.jsx'

// ─── Weight & nutrition goals ─────────────────────────────────────
// Behaviour and maths are specified in design_handoff_weight_goal/README.md.
// Only the shell changed in the settings rebuild: a section heading above the
// card and the master row in the shared row style. Everything below the
// master toggle is as shipped, including the Lose / Gain pill.
export function GoalSection({ goalProfile: gp, goalTargets, setGoalProfile }) {
  const goalMode = !!gp?.goalModeEnabled
  const units = gp?.units ?? 'metric'
  const imperial = units === 'imperial'
  const unitLabel = { ...mn, fontSize:12, fontWeight:600, color:C.onSurfaceVariant }

  return (
    <>
      <SectionHeading>Weight &amp; nutrition goals</SectionHeading>
      <RowCard flush>
        <div style={{ padding:'4px 14px' }}>
          <Row gap={14} title='Show goal figures in the app' sub='Planner, daily plan, recipe pages and insights. Off keeps every screen clean.'>
            <Switch size='md' on={goalMode} onClick={() => gp && setGoalProfile({ goalModeEnabled: !goalMode })}/>
          </Row>
        </div>

        {goalMode && gp && goalTargets && (
          <div style={{ borderTop:`1px solid ${SECTION_DIVIDER}`, padding:16, display:'flex', flexDirection:'column', gap:16 }}>

            {/* Lose / Gain */}
            <SegPill options={[{ value:'lose', label:'Lose weight' }, { value:'gain', label:'Gain weight' }]} value={gp.direction} onChange={v => setGoalProfile({ direction:v })} upper/>

            {/* About you + units */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div style={{ ...mn, fontSize:11, fontWeight:700, color:C.onSurfaceVariant, letterSpacing:'0.05em', textTransform:'uppercase' }}>About you</div>
              <SegPill compact options={[{ value:'metric', label:'KG / CM' }, { value:'imperial', label:'LB / FT' }]} value={units} onChange={v => setGoalProfile({ units:v })}/>
            </div>

            {/* Sex */}
            <SegPill options={[{ value:'female', label:'Female' }, { value:'male', label:'Male' }]} value={gp.sex} onChange={v => setGoalProfile({ sex:v })} upper/>

            {/* Four fields */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <FieldBox label='Age'>
                <input type='number' style={fieldInputStyle} value={gp.age} onChange={e => setGoalProfile({ age: Math.max(1, Number(e.target.value) || 0) })}/>
                <span style={{ ...unitLabel, whiteSpace:'nowrap' }}>years</span>
              </FieldBox>

              <FieldBox label='Height'>
                {imperial ? (() => { const t = Math.round(gp.heightCm / 2.54); const ft = Math.floor(t / 12), inch = t % 12; return (<>
                  <input type='number' style={{ ...fieldInputStyle, width:28 }} value={ft} onChange={e => setGoalProfile({ heightCm: ftInToCm(Number(e.target.value) || 0, inch) })}/>
                  <span style={unitLabel}>'</span>
                  <input type='number' style={{ ...fieldInputStyle, width:28 }} value={inch} onChange={e => setGoalProfile({ heightCm: ftInToCm(ft, Number(e.target.value) || 0) })}/>
                  <span style={unitLabel}>"</span>
                </>) })() : (<>
                  <input type='number' style={fieldInputStyle} value={Math.round(gp.heightCm)} onChange={e => setGoalProfile({ heightCm: Number(e.target.value) || 0 })}/>
                  <span style={unitLabel}>cm</span>
                </>)}
              </FieldBox>

              <FieldBox label='Current weight'>
                {imperial ? (<>
                  <input type='number' style={fieldInputStyle} value={kgToLb(gp.weightKg)} onChange={e => setGoalProfile({ weightKg: lbToKg(Number(e.target.value) || 0) })}/>
                  <span style={unitLabel}>lb</span>
                </>) : (<>
                  <input type='number' step='0.1' style={fieldInputStyle} value={gp.weightKg} onChange={e => setGoalProfile({ weightKg: Number(e.target.value) || 0 })}/>
                  <span style={unitLabel}>kg</span>
                </>)}
              </FieldBox>

              <FieldBox label='Goal weight' emphasise>
                {imperial ? (<>
                  <input type='number' style={{ ...fieldInputStyle, color:C.primary }} value={kgToLb(gp.goalWeightKg)} onChange={e => setGoalProfile({ goalWeightKg: lbToKg(Number(e.target.value) || 0) })}/>
                  <span style={{ ...unitLabel, color:C.primary }}>lb</span>
                </>) : (<>
                  <input type='number' step='0.1' style={{ ...fieldInputStyle, color:C.primary }} value={gp.goalWeightKg} onChange={e => setGoalProfile({ goalWeightKg: Number(e.target.value) || 0 })}/>
                  <span style={{ ...unitLabel, color:C.primary }}>kg</span>
                </>)}
              </FieldBox>
            </div>

            {/* Activity level */}
            <div>
              <div style={{ ...mn, fontSize:10, fontWeight:700, color:C.onSurfaceVariant, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>Activity level</div>
              <SegPill options={[
                { value:'sedentary', label:'Sedentary', small:true }, { value:'light', label:'Light', small:true },
                { value:'moderate', label:'Moderate', small:true }, { value:'very', label:'Very', small:true },
              ]} value={gp.activityLevel} onChange={v => setGoalProfile({ activityLevel:v })}/>
              <div style={{ ...mn, fontSize:11, color:C.onSurfaceVariant, marginTop:6, lineHeight:1.5 }}>{ACTIVITY[gp.activityLevel]?.explainer}</div>
            </div>

            {/* Pace */}
            <div>
              <div style={{ ...mn, fontSize:10, fontWeight:700, color:C.onSurfaceVariant, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>How fast do you want to {gp.direction === 'gain' ? 'gain' : 'lose'}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {Object.entries(PACES).map(([key, p]) => {
                  const sel = gp.pace === key
                  return (
                    <div key={key} onClick={() => setGoalProfile({ pace:key })} style={{ border:`${sel ? 1.5 : 1}px solid ${sel ? C.primary : C.outlineVariant}`, background: sel ? C.primaryFixed : 'transparent', borderRadius:R.md, padding:'9px 12px', cursor:'pointer' }}>
                      <div style={{ ...mn, fontSize:13, fontWeight:700, color: sel ? C.primary : C.onSurface }}>{p.label}</div>
                      <div style={{ ...mn, fontSize:11, color: sel ? C.primary : C.onSurfaceVariant, opacity: sel ? 0.75 : 1 }}>{p.kgPerWeek} kg / week</div>
                    </div>
                  )
                })}
              </div>
              {goalTargets.paceCaution && (
                <div style={{ display:'flex', gap:7, alignItems:'flex-start', marginTop:8 }}>
                  <span style={{ width:6, height:6, borderRadius:R.pill, background:C.tertiary, flexShrink:0, marginTop:5 }}/>
                  <div style={{ ...mn, fontSize:11, color:'#924b1a', lineHeight:1.5 }}>1 kg a week is aggressive. Most guidance caps sustained loss at 0.5–0.75 kg a week, and this pace leaves little room for protein and fibre in a day.</div>
                </div>
              )}
            </div>

            {/* Daily targets panel */}
            <div style={{ background:C.primaryFixed, borderRadius:R.md, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10, marginBottom:12 }}>
                <div style={{ ...mn, fontSize:11, fontWeight:700, color:C.primary, letterSpacing:'0.06em', textTransform:'uppercase' }}>Your daily targets</div>
                <div style={{ ...mn, fontSize:11, color:C.onSurfaceVariant }}>Updates as you edit</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  [goalTargets.calories.toLocaleString('en-GB'), `calories · band ${formatCalorieBand(goalTargets.calorieBandLow, goalTargets.calorieBandHigh)}`],
                  [`${goalTargets.protein}g`, 'protein'],
                  [`${goalTargets.fibre}g`, 'fibre'],
                  [`${goalTargets.wholeFoodPct}%`, 'whole-food calories'],
                ].map(([value, caption]) => (
                  <div key={caption}>
                    <div style={{ ...mn, fontSize:22, fontWeight:700, color:C.onSurface, lineHeight:1.1 }}>{value}</div>
                    <div style={{ ...mn, fontSize:11, color:C.onSurfaceVariant, marginTop:2 }}>{caption}</div>
                  </div>
                ))}
              </div>
              {goalTargets.floorHit && (
                <div style={{ display:'flex', gap:7, alignItems:'flex-start', marginTop:12 }}>
                  <span style={{ width:6, height:6, borderRadius:R.pill, background:C.tertiary, flexShrink:0, marginTop:5 }}/>
                  <div style={{ ...mn, fontSize:11, color:'#924b1a', lineHeight:1.5 }}>Keep at {CALORIE_FLOOR.toLocaleString('en-GB')} kcal — it's the lowest we recommend.</div>
                </div>
              )}
              <div style={{ borderTop:`1px solid ${C.outlineVariant}80`, marginTop:14, paddingTop:12, ...mn, fontSize:12, color:C.onSurface, lineHeight:1.6 }}>{etaLine(goalTargets, gp)}</div>
              <div style={{ ...mn, fontSize:11, color:C.onSurfaceVariant, lineHeight:1.6, marginTop:8 }}>Calories from the Mifflin-St Jeor equation times your activity factor, less 7,700 kcal per kilo. Protein at {goalTargets.proteinPerKg.toFixed(1)} g per kilo of body weight, fibre at 14 g per 1,000 kcal (Dietary Guidelines for Americans).</div>
            </div>
          </div>
        )}
      </RowCard>
    </>
  )
}
