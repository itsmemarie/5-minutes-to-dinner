import { useState } from 'react'
import { C, ep, mn } from '../lib/theme.js'
import { WEEK_START_OPTIONS } from '../lib/dateHelpers.js'
import { countryName, RECIPE_UNIT_OPTIONS, MEASUREMENT_OPTIONS } from '../lib/preferences.js'
import { APP_VERSION_LABEL } from '../lib/appVersion.js'
import { SectionHeading, RowCard, Row, RowValue, Switch, SegPill, InlineStepper, ConfirmDialog, ROW_DIVIDER } from './settings/primitives.jsx'
import { MealSectionsCard } from './settings/MealSectionsCard.jsx'
import { ChildrenSection } from './settings/ChildrenSection.jsx'
import { GoalSection } from './settings/GoalSection.jsx'

// ─── Settings ─────────────────────────────────────────────────────
// Nine sections of row cards. Every control saves on interaction (App debounces
// the write); chevron rows push a sub-screen via `onOpen`. The destructive
// "Reset this week's plan" row confirms before it calls `onResetWeek`.
//
// The Account section ships without an identity row: the app has no sign-in
// (everything is a singleton behind the anon key), so there is nobody to show
// or sign out. See README › Still open › 4.
export function SettingsScreen({
  defPort, setDefPort,
  prefs, setPrefs,
  goalProfile, goalTargets, setGoalProfile,
  freezerItems = [], weekLabel,
  onOpen, onExportRecipes, onResetWeek,
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const weekStartLabel = WEEK_START_OPTIONS.find(o => o.id === prefs.weekStartsOn)?.label
  const freezerInStock = freezerItems.filter(i => i.in_stock).length
  const freezerUsed = freezerItems.length - freezerInStock

  const runReset = async () => {
    setResetting(true)
    try { await onResetWeek() } finally { setResetting(false); setConfirmReset(false) }
  }
  const runExport = async () => {
    if (exporting) return
    setExporting(true)
    try { await onExportRecipes() } finally { setExporting(false) }
  }

  return (
    <div style={{ padding:'20px 20px 40px' }}>
      <div style={{ ...ep, fontSize:26, color:C.onSurface, marginBottom:4 }}>Settings</div>
      <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, marginBottom:22 }}>Customise your culinary experience</div>

      {/* 1 · Meal planning defaults */}
      <SectionHeading first>Meal planning defaults</SectionHeading>
      <RowCard>
        <Row gap={14} title='Default portion size' sub='Base for scaling every recipe in your planner.'>
          <InlineStepper value={defPort} min={1} onChange={setDefPort}/>
        </Row>
        <Row divider title='Suggest recipes from my history'>
          <Switch on={prefs.suggestFromHistory} onClick={() => setPrefs({ suggestFromHistory: !prefs.suggestFromHistory })}/>
        </Row>
        <Row divider title='Week starts on' onClick={() => onOpen({ kind:'weekStart' })}>
          <RowValue>{weekStartLabel}</RowValue>
        </Row>
      </RowCard>

      {/* 2 · Meal sections */}
      <SectionHeading sub='The rows every day is split into. Drag to reorder.'>Meal sections</SectionHeading>
      <MealSectionsCard sections={prefs.mealSections} onChange={mealSections => setPrefs({ mealSections })}/>

      {/* 3 · Region & units */}
      <SectionHeading>Region &amp; units</SectionHeading>
      <RowCard>
        <Row title='Country' sub='Sets ingredient names and shopping aisles — courgette, not zucchini.' titleWeight={400} onClick={() => onOpen({ kind:'country' })}>
          <RowValue>{countryName(prefs.country)}</RowValue>
        </Row>
        <Row divider title='Recipe units'>
          <SegPill compact options={RECIPE_UNIT_OPTIONS} value={prefs.recipeUnits} onChange={recipeUnits => setPrefs({ recipeUnits })}/>
        </Row>
        <Row divider title='Measurements'>
          <SegPill compact options={MEASUREMENT_OPTIONS} value={prefs.measurements} onChange={measurements => setPrefs({ measurements })}/>
        </Row>
      </RowCard>

      {/* 4 · Your children */}
      <ChildrenSection prefs={prefs} setPrefs={setPrefs}
        onEditChild={childId => onOpen({ kind:'child', childId })}
        onAddChild={() => onOpen({ kind:'child', childId:null })}/>

      {/* 5 · Weight & nutrition goals */}
      <GoalSection goalProfile={goalProfile} goalTargets={goalTargets} setGoalProfile={setGoalProfile}/>

      {/* 6 · Freezer */}
      <SectionHeading>Freezer</SectionHeading>
      <RowCard>
        <Row title='Freezer items' titleWeight={400} onClick={() => onOpen({ kind:'freezer' })}
          sub={freezerItems.length ? `${freezerItems.length} item${freezerItems.length === 1 ? '' : 's'} · ${freezerInStock} in stock, ${freezerUsed} used up` : 'Nothing in the freezer yet'}>
          <RowValue/>
        </Row>
      </RowCard>

      {/* 7 · Your data */}
      <SectionHeading>Your data</SectionHeading>
      <RowCard>
        <Row title={exporting ? 'Exporting…' : 'Export all recipes'} titleWeight={400} sub='Downloads everything in your database as a single file.' onClick={runExport}>
          <RowValue/>
        </Row>
        <Row divider title="Reset this week's plan" titleWeight={700} titleColor={C.errorInk} sub={`Clears every meal from ${weekLabel}. Asks first, then can't be undone.`} onClick={() => setConfirmReset(true)}>
          <RowValue/>
        </Row>
      </RowCard>

      {/* 8 · Account */}
      <SectionHeading>Account</SectionHeading>
      <RowCard>
        <Row title='Feedback & support' onClick={() => onOpen({ kind:'feedback' })}>
          <RowValue/>
        </Row>
        <Row divider title='Version' style={{ justifyContent:'space-between' }}>
          <span style={{ ...mn, fontSize:12, fontWeight:600, color:C.onSurfaceVariant }}>{APP_VERSION_LABEL}</span>
        </Row>
      </RowCard>

      {/* 9 · Connected to Supabase */}
      <SectionHeading>Connected to Supabase</SectionHeading>
      <RowCard style={{ padding:'4px 16px 16px' }}>
        {[['Project','5 Minutes to Dinner'],['Region','eu-west-1'],['Recipes','Live from your database'],['Plan data','Saved in real time'],['Ratings','Persisted per meal instance']].map(([k, v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${ROW_DIVIDER}`, gap:12 }}>
            <span style={{ ...mn, fontSize:12, color:C.onSurfaceVariant, flexShrink:0 }}>{k}</span>
            <span style={{ ...mn, fontSize:12, fontWeight:600, color:C.onSurface, textAlign:'right' }}>{v}</span>
          </div>
        ))}
      </RowCard>

      {confirmReset && (
        <ConfirmDialog destructive title="Reset this week's plan?" confirmLabel='Reset week' busy={resetting}
          body={`Every meal planned for ${weekLabel} is removed. Freezer items used in those meals go back in stock. This can't be undone.`}
          onCancel={() => !resetting && setConfirmReset(false)} onConfirm={runReset}/>
      )}
    </div>
  )
}
