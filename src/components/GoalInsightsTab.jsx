import { C, ep, mn, CARD, R } from '../lib/theme.js'
import { DAYS, DAY_LBL } from '../lib/dateHelpers.js'
import { ALL_SECTION_IDS, dayMeals } from '../lib/mealSections.js'
import {
  dayNutritionTotals, dailyScoreRaw, weeklyScore, weakestComponentReason,
  formatCalorieBand, WHOLE_FOOD_TARGET_PCT,
} from '../lib/goalMaths.js'

const RING_FULL = 251.2 // 2π·40, the 96px insights donut

// Simulate closing the weakest gap on its worst day and report the resulting weekly score —
// a real recomputation, not fabricated copy.
function biggestLever(dayEntries, targets) {
  if (!dayEntries.length) return null
  const score = weeklyScore(dayEntries.map(d => d.raw))
  if (!score) return null
  const weak = score.weakest
  const worst = dayEntries.reduce((a, b) => a.raw[weak] <= b.raw[weak] ? a : b)
  let label, suggestion
  const fixedTotals = { ...worst.totals }
  if (weak === 'protein') {
    const delta = Math.max(5, Math.round(targets.protein - worst.totals.protein))
    label = `+${delta}g protein on ${DAY_LBL[worst.day]}`
    suggestion = 'a spoon of Greek yoghurt or an extra egg covers a good chunk of it.'
    fixedTotals.protein = targets.protein
  } else if (weak === 'fibre') {
    const delta = Math.max(3, Math.round(targets.fibre - worst.totals.fibre))
    label = `+${delta}g fibre on ${DAY_LBL[worst.day]}`
    suggestion = 'an extra side of veg or a spoon of beans is the easiest way to close it.'
    fixedTotals.fibre = targets.fibre
  } else if (weak === 'wholeFood') {
    label = `A whole-food swap on ${DAY_LBL[worst.day]}`
    suggestion = 'trading one processed side for a whole-food one moves this the most.'
    fixedTotals.wholeFoodPct = WHOLE_FOOD_TARGET_PCT
  } else {
    const over = worst.totals.calories > targets.calories
    const delta = Math.round(Math.abs(targets.calories - worst.totals.calories))
    label = over ? `${delta} fewer calories on ${DAY_LBL[worst.day]}` : `${delta} more calories on ${DAY_LBL[worst.day]}`
    suggestion = over ? 'a lighter side on that day would help most.' : 'an extra snack that day would help most.'
    fixedTotals.calories = targets.calories
  }
  const newRaw = dailyScoreRaw(fixedTotals, targets)
  const simulated = weeklyScore(dayEntries.map(d => d.day === worst.day ? newRaw : d.raw))
  return { label, suggestion, projectedScore: simulated?.score }
}

export function GoalInsightsTab({ plan, targets, nutritionByRecipe, days = DAYS, sectionIds = ALL_SECTION_IDS }) {
  const perDay = days.map(day => {
    const meals = dayMeals(plan[day], sectionIds)
    const isPlanned = meals.length > 0
    const totals = dayNutritionTotals(meals, nutritionByRecipe)
    return { day, isPlanned, totals }
  })
  const scoreable = perDay.filter(d => d.isPlanned && d.totals.hasData)
    .map(d => ({ day: d.day, totals: d.totals, raw: dailyScoreRaw(d.totals, targets) }))
  const weekly = weeklyScore(scoreable.map(d => d.raw))
  const lever = biggestLever(scoreable, targets)

  const plannedDays = perDay.filter(d => d.isPlanned)
  const unplannedDays = perDay.filter(d => !d.isPlanned).map(d => DAY_LBL[d.day])
  const weekAvgCalories = Math.round(perDay.reduce((a, d) => a + d.totals.calories, 0) / 7)
  const weekAvgProtein  = Math.round(perDay.reduce((a, d) => a + d.totals.protein, 0) / 7)
  const weekAvgFibre    = Math.round(perDay.reduce((a, d) => a + d.totals.fibre, 0) / 7)
  const wfMatched = scoreable.filter(d => d.totals.wholeFoodPct != null)
  const weekAvgWholeFood = wfMatched.length
    ? Math.round(wfMatched.reduce((a, d) => a + d.totals.wholeFoodPct, 0) / wfMatched.length)
    : null

  const unplannedFootnote = unplannedDays.length === 0
    ? 'Every day this week has at least one meal planned.'
    : `${unplannedDays.join(', ')} ${unplannedDays.length === 1 ? 'has' : 'have'} no meals planned yet.`

  const scorePct = weekly ? weekly.score / 100 : 0

  return (
    <div>
      {/* Meal score */}
      <div style={{...CARD,background:C.surface,boxShadow:'none',padding:'22px 20px',textAlign:'center',marginBottom:12}}>
        <div style={{display:'inline-flex',position:'relative',alignItems:'center',justifyContent:'center',marginBottom:12}}>
          <svg width="96" height="96" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke={C.outlineVariant} strokeWidth="8"/>
            <circle cx="48" cy="48" r="40" fill="none" stroke={C.primary} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${scorePct*RING_FULL} ${RING_FULL}`} transform="rotate(-90 48 48)"/>
          </svg>
          <div style={{position:'absolute',display:'flex',flexDirection:'column',alignItems:'center'}}>
            <div style={{...mn,fontWeight:700,fontSize:26,color:C.onSurface,lineHeight:1}}>{weekly?weekly.score:'–'}</div>
            <div style={{...mn,fontSize:10,color:C.onSurfaceVariant}}>of 100</div>
          </div>
        </div>
        <div style={{...mn,fontSize:11,fontWeight:700,letterSpacing:'0.07em',color:C.onSurfaceVariant,textTransform:'uppercase'}}>Meal score, this week</div>
        {weekly && <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,marginTop:6}}>{weakestComponentReason(weekly)}</div>}
        {!weekly && <div style={{...mn,fontSize:12,color:C.onSurfaceVariant,marginTop:6}}>Plan a meal with matched nutrition to see your score.</div>}
      </div>

      {/* Protein target by day */}
      <div style={{...CARD,background:C.surface,boxShadow:'none',padding:16,marginBottom:12}}>
        <div style={{...mn,fontSize:11,fontWeight:700,color:C.onSurfaceVariant,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:14}}>Protein target by day</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
          {perDay.map(({day,isPlanned,totals})=>{
            const hit = isPlanned && totals.hasData && totals.protein >= targets.protein
            const miss = isPlanned && totals.hasData && totals.protein < targets.protein
            return (
              <div key={day} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                <div style={{width:30,height:30,borderRadius:R.pill,border:`2px ${isPlanned?'solid':'dashed'} ${C.outlineVariant}`,display:'flex',alignItems:'center',justifyContent:'center',...mn,fontSize:12,fontWeight:700,color:isPlanned?C.onSurfaceVariant:C.outlineVariant}}>{DAY_LBL[day][0]}</div>
                <span style={{fontSize:13,fontWeight:700,color:hit?C.primary:miss?C.tertiary:C.outlineVariant}}>{hit?'✓':miss?'✕':'–'}</span>
              </div>
            )
          })}
        </div>
        <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,marginTop:12,lineHeight:1.5}}>{unplannedFootnote}</div>
      </div>

      {/* Headline note */}
      <div style={{...CARD,background:C.surface,boxShadow:'none',padding:16,marginBottom:12,display:'flex',gap:10,alignItems:'flex-start'}}>
        <span style={{width:7,height:7,borderRadius:R.pill,background:C.tertiary,flexShrink:0,marginTop:6}}/>
        <div style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.6}}>
          Averaging <strong>{weekAvgCalories.toLocaleString('en-GB')} cal/day</strong> this week
          {weekAvgCalories < targets.calorieBandLow ? ' — below' : weekAvgCalories > targets.calorieBandHigh ? ' — above' : ' — within'} your {formatCalorieBand(targets.calorieBandLow,targets.calorieBandHigh)} target band.
          {plannedDays.length < 7 ? ` Only ${plannedDays.length} day${plannedDays.length===1?'':'s'} ${plannedDays.length===1?'is':'are'} planned, so the gap is mostly unplanned meals rather than light ones.` : ''}
        </div>
      </div>

      {/* Three averages */}
      <div style={{...CARD,background:C.surface,boxShadow:'none',padding:16,marginBottom:12,display:'flex',flexDirection:'column',gap:16}}>
        {[
          ['Avg protein per day', weekAvgProtein, targets.protein, 'g'],
          ['Avg fibre per day', weekAvgFibre, targets.fibre, 'g'],
        ].map(([label,val,target,unit])=>(
          <div key={label}>
            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12,marginBottom:8}}>
              <span style={{...mn,fontSize:14,fontWeight:600,color:C.onSurface}}>{label}</span>
              <span style={{...mn,fontSize:15,fontWeight:700,color:C.onSurface}}>{val}{unit} <span style={{fontSize:13,fontWeight:600,color:C.onSurfaceVariant}}>/ {target}{unit}</span></span>
            </div>
            <div style={{height:6,borderRadius:R.pill,background:C.outlineVariant,overflow:'hidden'}}><div style={{width:`${Math.min(100,target?val/target*100:0)}%`,height:'100%',background:C.primary,borderRadius:R.pill}}/></div>
          </div>
        ))}
        <div>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12,marginBottom:8}}>
            <span style={{...mn,fontSize:14,fontWeight:600,color:C.onSurface}}>Avg whole-food calories per day</span>
            <span style={{...mn,fontSize:15,fontWeight:700,color:C.onSurface}}>{weekAvgWholeFood!=null?`${weekAvgWholeFood}%`:'–'} <span style={{fontSize:13,fontWeight:600,color:C.onSurfaceVariant}}>/ {WHOLE_FOOD_TARGET_PCT}%</span></span>
          </div>
          <div style={{height:6,borderRadius:R.pill,background:C.outlineVariant,overflow:'hidden'}}><div style={{width:`${Math.min(100,weekAvgWholeFood!=null?weekAvgWholeFood/WHOLE_FOOD_TARGET_PCT*100:0)}%`,height:'100%',background:C.primary,borderRadius:R.pill}}/></div>
        </div>
      </div>

      {/* Biggest lever */}
      {lever && (
        <div style={{background:C.primaryFixed,borderRadius:R.md,padding:16,marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}><span style={{fontSize:14}}>💡</span><span style={{...mn,fontSize:10,fontWeight:700,color:C.primary,letterSpacing:'0.07em',textTransform:'uppercase'}}>Biggest lever this week</span></div>
          <p style={{...mn,fontSize:13,color:C.onSurface,lineHeight:1.7,margin:0}}>
            {lever.label}
            {lever.projectedScore!=null?` would push your score to about ${lever.projectedScore}`:''} — {lever.suggestion}
          </p>
        </div>
      )}

      <div style={{...mn,fontSize:11,color:C.onSurfaceVariant,lineHeight:1.6}}>Figures are computed from each recipe's ingredient amounts against per-100g reference values. A ~ marks a recipe where some ingredients are not matched yet, so the figure is partial. Targets come from Settings and update whenever you change them.</div>
    </div>
  )
}
