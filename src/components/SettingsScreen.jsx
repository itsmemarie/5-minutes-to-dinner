import { useState } from 'react'
import { C, ep, mn } from '../lib/theme.js'
import { WEEK_START_OPTIONS } from '../lib/dateHelpers.js'
import { countryName, RECIPE_UNIT_OPTIONS, MEASUREMENT_OPTIONS } from '../lib/preferences.js'
import { APP_VERSION_LABEL } from '../lib/appVersion.js'
import { useGeminiKey } from '../lib/geminiKey.js'
import { useInstallState } from '../lib/install.js'
import { SectionHeading, RowCard, Row, RowValue, Switch, SegPill, InlineStepper, ConfirmDialog, ROW_DIVIDER } from './settings/primitives.jsx'
import { MealSectionsCard } from './settings/MealSectionsCard.jsx'
import { ChildrenSection } from './settings/ChildrenSection.jsx'
import { GoalSection } from './settings/GoalSection.jsx'

// ─── Settings ─────────────────────────────────────────────────────
// Ten sections of row cards. Every control saves on interaction (App debounces
// the write); chevron rows push a sub-screen via `onOpen`. The destructive
// "Reset this week's plan" row confirms before it calls `onResetWeek`.
//
// Sign-in is optional and only identifies the owner (checked server-side
// against OWNER_EMAIL); the data itself is still one shared set behind the
// anon key. `isOwner` comes from the ai-config function and only decides
// whether the AI models row is shown — the server re-checks every owner action.
export function SettingsScreen({
  defPort, setDefPort,
  prefs, setPrefs,
  goalProfile, goalTargets, setGoalProfile,
  freezerItems = [], weekLabel,
  session, isOwner,
  onOpen, onExportRecipes, onResetWeek,
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const geminiKey = useGeminiKey()
  const install = useInstallState()
  const equipmentCount = prefs.kitchenEquipment.length

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

      {/* AI assistant */}
      <SectionHeading sub={isOwner ? 'Owner account: AI runs on your own keys, with a model you choose per step.' : 'Free AI is on by default. If it gets busy, your own free Google key keeps it going, and everything can always be filled in by hand.'}>AI assistant</SectionHeading>
      <RowCard>
        <Row title='Free Google AI key' sub={geminiKey ? 'Saved on this device. Used when the free AI is busy.' : 'Optional. Keeps AI working when the free tier is busy.'} titleWeight={400} onClick={() => onOpen({ kind:'geminiKey' })}>
          <RowValue>{geminiKey ? 'Added' : 'Not added'}</RowValue>
        </Row>
        <Row divider title='Kitchen equipment' sub='The expert review and batch plans only use what you have.' titleWeight={400} onClick={() => onOpen({ kind:'equipment' })}>
          <RowValue>{equipmentCount ? `${equipmentCount} selected` : 'None'}</RowValue>
        </Row>
        {isOwner && (
          <Row divider title='AI models' sub='Owner only. Choose Claude, Groq or Gemini for each step and compare.' titleWeight={400} onClick={() => onOpen({ kind:'aiModels' })}>
            <RowValue/>
          </Row>
        )}
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
        {session ? (
          <Row title={session.user?.email} sub={isOwner ? 'Owner account' : 'Signed in'} onClick={() => onOpen({ kind:'signIn' })}>
            <RowValue/>
          </Row>
        ) : (
          <Row title='Sign in' sub='For the owner account. Everything else works without one.' onClick={() => onOpen({ kind:'signIn' })}>
            <RowValue/>
          </Row>
        )}
        {!install.installed && (
          <Row divider title='Install the app' sub={install.platform === 'ios' ? 'Add it to your home screen.' : 'Add it to your home screen and share recipes into it.'} onClick={() => onOpen({ kind:'install' })}>
            <RowValue/>
          </Row>
        )}
        <Row divider title='Feedback & support' onClick={() => onOpen({ kind:'feedback' })}>
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
