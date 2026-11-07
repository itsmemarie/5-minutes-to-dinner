import { useState } from 'react'
import { C, ep, mn, R } from '../lib/theme.js'
import { DAY_LBL, monthWeeks } from '../lib/dateHelpers.js'
import { Icon } from './ui/index.js'
import { Sheet } from './ui/Sheet.jsx'

const MONTHS = Array.from({ length:12 }, (_, m) => new Date(2026, m, 1))
const monthName = (d, month) => d.toLocaleDateString('en-GB', { month })
const TAP = 44
const WEEK_ROW_COLUMNS = '34px repeat(7, minmax(0, 1fr)) 22px'

const dot = (size, background) => <span style={{ flexShrink:0, width:size, height:size, borderRadius:R.pill, background }}/>
const circleBtn = (size, background) => ({ width:size, height:size, flexShrink:0, border:'none', borderRadius:R.pill, background, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' })
const outlinedBtn = { ...circleBtn(TAP, C.white), border:`1.5px solid ${C.outlineVariant}`, boxSizing:'border-box' }

// ‹ [THIS WEEK / 2 – 8 Nov ▾] ›. `label` and `week` describe the week on screen; a
// dot after the label says a week other than this one has meals.
export function WeekStepper({ week, label, isThisWeek, hasMeals, onStep, onOpen }) {
  const arrow = { ...circleBtn(48, C.white), boxShadow:'0 1px 3px rgba(24,36,23,0.10)' }
  return (
    <nav aria-label='Week' style={{ display:'flex', alignItems:'center', gap:8, background:C.primaryFixed, borderRadius:24, padding:6, marginBottom:14 }}>
      <button onClick={() => onStep(-1)} aria-label='Previous week' style={arrow}><Icon name='chevronLeft' size={20} color={C.primary}/></button>
      <button onClick={onOpen} aria-haspopup='dialog' aria-label={`${label}, ${week.range.replace('–', 'to')}${hasMeals ? ', has meals planned' : ''}. Choose another week`}
        style={{ ...mn, flex:1, minWidth:0, minHeight:48, border:'none', background:'none', padding:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, cursor:'pointer' }}>
        <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:isThisWeek ? C.primary : C.onSurfaceVariant }}>
          {label}{!isThisWeek && hasMeals && dot(7, C.primary)}
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:week.range.length > 16 ? 15 : 18, fontWeight:700, color:C.onSurface, whiteSpace:'nowrap' }}>
          {week.range}<Icon name='chevronDown' size={16} color={C.primary}/>
        </span>
      </button>
      <button onClick={() => onStep(1)} aria-label='Next week' style={arrow}><Icon name='chevronRight' size={20} color={C.primary}/></button>
    </nav>
  )
}

function WeekRow({ row, selected, hasMeals, onPick }) {
  const isCurrent = row.offset === 0
  return (
    <button onClick={() => onPick(row.offset)} aria-pressed={selected}
      aria-label={`Week ${row.number}, ${row.range.replace('–', 'to')}${isCurrent ? ', this week' : ''}, ${hasMeals ? 'has meals planned' : 'nothing planned'}`}
      style={{ ...mn, width:'100%', minHeight:TAP, border:'none', borderRadius:R.lg, padding:'0 6px', display:'grid', gridTemplateColumns:WEEK_ROW_COLUMNS, alignItems:'center', textAlign:'center', cursor:'pointer',
        background:selected ? C.primary : isCurrent ? C.primaryFixed : 'transparent', boxShadow:isCurrent && !selected ? `inset 0 0 0 1.5px ${C.outlineVariant}` : 'none' }}>
      <span style={{ textAlign:'left', fontSize:12, fontWeight:600, color:selected ? C.primaryFixed : C.onSurfaceVariant }}>{row.number}</span>
      {row.dates.map((d, i) => (
        <span key={i} style={{ justifySelf:'center', width:30, height:30, borderRadius:R.pill, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:d.isToday ? 800 : 600,
          background:!d.isToday ? 'transparent' : selected ? C.white : C.accent2_700,
          color:d.isToday ? (selected ? C.primary : C.white) : selected ? (d.inMonth ? C.white : C.outlineVariant) : (d.inMonth ? C.onSurface : C.onSurfaceDisabled) }}>{d.day}</span>
      ))}
      <span style={{ justifySelf:'center', display:'flex' }}>{hasMeals && dot(9, selected ? C.primaryFixed : C.primary)}</span>
    </button>
  )
}

function MonthTile({ name, spoken, weeks, selected, current, onPick }) {
  return (
    <button onClick={onPick} aria-label={`${spoken}, ${weeks ? `${weeks} week${weeks === 1 ? '' : 's'} with meals` : 'no meals planned'}`}
      style={{ ...mn, minHeight:60, border:'none', borderRadius:R.lg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, cursor:'pointer',
        background:selected ? C.primary : C.primaryFixed, boxShadow:current && !selected ? `inset 0 0 0 1.5px ${C.outlineStrong}` : 'none' }}>
      <span style={{ fontSize:15, fontWeight:700, color:selected ? C.white : C.onSurface }}>{name}</span>
      <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:selected ? C.primaryFixed : weeks ? C.primary : C.onSurfaceVariant }}>
        {weeks > 0 && dot(7, selected ? C.primaryFixed : C.primary)}
        {weeks ? `${weeks} week${weeks === 1 ? '' : 's'}` : 'Empty'}
      </span>
    </button>
  )
}

// Choose any week: a month of weeks, or tap the title for a year of months.
// `plannedWeeks` is a Set of the weekOf dates that have meals. Years run from the
// earliest planned week to the end of next year.
export function WeekPicker({ week, weekOffset, weekStartsOn, plannedWeeks, onSelect, onClose }) {
  const now = new Date()
  const shown = monthWeeks(weekStartsOn, week.start.getFullYear(), week.start.getMonth()).find(r => r.offset === weekOffset)
  // A week across two months opens on the month it counts towards.
  const opensOn = shown?.inMonth === false ? new Date(week.start.getFullYear(), week.start.getMonth() + 1, 1) : week.start
  const selectedMonth = { year:opensOn.getFullYear(), month:opensOn.getMonth() }
  const [view, setView] = useState(selectedMonth)
  const [months, setMonths] = useState(false)   // showing the year of months?
  const { year, month } = view

  const years = [now.getFullYear(), selectedMonth.year, ...[...plannedWeeks].map(w => Number(w.slice(0, 4)))]
  const minYear = Math.min(...years)
  const maxYear = Math.max(now.getFullYear() + 1, ...years)
  const atStart = months ? year <= minYear : year <= minYear && month === 0
  const atEnd = months ? year >= maxYear : year >= maxYear && month === 11
  const step = dir => {
    if (months) return setView({ ...view, year:year + dir })
    const target = new Date(year, month + dir, 1)
    setView({ year:target.getFullYear(), month:target.getMonth() })
  }
  const unit = months ? 'year' : 'month'
  const stepBtn = disabled => ({ ...outlinedBtn, opacity:disabled ? 0.4 : 1, cursor:disabled ? 'default' : 'pointer' })

  return (
    <Sheet label='Choose a week' radius={28} swipe onClose={onClose} head={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ ...ep, fontSize:22, color:C.onSurface }}>Choose a week</div>
        <button onClick={onClose} aria-label='Close' style={circleBtn(TAP, C.primaryFixed)}><Icon name='x' size={18} color={C.onSurfaceVariant}/></button>
      </div>
    }>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:12 }}>
        <button onClick={() => step(-1)} disabled={atStart} aria-label={`Previous ${unit}`} style={stepBtn(atStart)}><Icon name='chevronLeft' size={18} color={C.primary}/></button>
        <button onClick={() => setMonths(!months)} aria-label={months ? 'Back to weeks' : `Show the months of ${year}`}
          style={{ ...mn, minHeight:TAP, border:'none', background:C.primaryFixed, borderRadius:22, padding:'0 16px', display:'flex', alignItems:'center', gap:6, fontSize:17, fontWeight:700, color:C.onSurface, cursor:'pointer' }}>
          {months ? year : `${monthName(MONTHS[month], 'long')} ${year}`}
          <span style={{ display:'flex', transform:months ? 'rotate(180deg)' : undefined }}><Icon name='chevronDown' size={16} color={C.primary}/></span>
        </button>
        <button onClick={() => step(1)} disabled={atEnd} aria-label={`Next ${unit}`} style={stepBtn(atEnd)}><Icon name='chevronRight' size={18} color={C.primary}/></button>
      </div>

      {months ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:8 }}>
          {MONTHS.map((d, m) => (
            <MonthTile key={m} name={monthName(d, 'short')} spoken={`${monthName(d, 'long')} ${year}`}
              weeks={monthWeeks(weekStartsOn, year, m).filter(r => r.inMonth && plannedWeeks.has(r.weekOf)).length}
              selected={year === selectedMonth.year && m === selectedMonth.month}
              current={year === now.getFullYear() && m === now.getMonth()}
              onPick={() => { setView({ year, month:m }); setMonths(false) }}/>
          ))}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <div aria-hidden='true' style={{ ...mn, display:'grid', gridTemplateColumns:WEEK_ROW_COLUMNS, padding:'0 6px', fontSize:11, fontWeight:700, letterSpacing:'0.04em', color:C.onSurfaceVariant, textAlign:'center' }}>
            <span style={{ textAlign:'left' }}>WK</span>
            {week.days.map(day => <span key={day}>{DAY_LBL[day][0]}</span>)}
            <span/>
          </div>
          {monthWeeks(weekStartsOn, year, month).map(row => (
            <WeekRow key={row.weekOf} row={row} selected={row.offset === weekOffset} hasMeals={plannedWeeks.has(row.weekOf)} onPick={onSelect}/>
          ))}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginTop:12 }}>
        <span style={{ ...mn, display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:500, color:C.onSurfaceVariant }}>{dot(9, C.primary)}Meals planned</span>
        <button onClick={() => onSelect(0)} style={{ ...mn, minHeight:TAP, border:`1.5px solid ${C.primary}`, background:C.white, borderRadius:22, padding:'0 18px', fontSize:14, fontWeight:700, color:C.primary, cursor:'pointer' }}>Jump to this week</button>
      </div>
    </Sheet>
  )
}
