import { C, mn, R } from '../../lib/theme.js'
import { Icon } from '../ui/Icon.jsx'
import { ageBandFromDob, ageBandLabel, formatAge } from '../../lib/dateHelpers.js'
import { selectedChild } from '../../lib/preferences.js'
import { SectionHeading, RowCard, Row, Switch, Chevron, GroupLabel, SECTION_DIVIDER } from './primitives.jsx'

const fmtDob = dob => new Date(dob).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })

// "27 Sep 2024 · 23 months · 18–24 mo" — DOB, computed age, matched age band.
export const childMeta = child => [fmtDob(child.dob), formatAge(child.dob), ageBandLabel(ageBandFromDob(child.dob))].filter(Boolean).join(' · ')

// ─── Your children ────────────────────────────────────────────────
// Master toggle for every piece of toddler content; below it the list of
// children (one selected — the one activities and safety notes follow) and
// the three feature sub-toggles.
export function ChildrenSection({ prefs, setPrefs, onEditChild, onAddChild }) {
  const on = prefs.toddlerModeEnabled
  const current = selectedChild(prefs)

  return (
    <>
      <SectionHeading>Your children</SectionHeading>
      <RowCard flush>
        <div style={{ padding:'4px 14px' }}>
          <Row gap={14} title='Show toddler content across the app' sub='Turns on kitchen activities, recipe variations and toddler portions everywhere. Off hides all of it.'>
            <Switch size='md' on={on} onClick={() => setPrefs({ toddlerModeEnabled: !on })}/>
          </Row>
        </div>

        {on && (
          <div style={{ borderTop:`1px solid ${SECTION_DIVIDER}`, padding:16, display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <GroupLabel>Children · activities follow</GroupLabel>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {prefs.children.map(child => {
                  const sel = child.id === current?.id
                  return (
                    <div key={child.id} onClick={() => setPrefs({ selectedChildId: child.id })}
                      style={{ display:'flex', alignItems:'center', gap:11, border: sel ? `1.5px solid ${C.primary}` : `1px solid ${C.outlineVariant}`, background: sel ? C.primaryFixed : undefined, borderRadius:R.md, padding:'10px 12px', cursor:'pointer' }}>
                      <span style={{ width:16, height:16, borderRadius:R.pill, border:`2px solid ${sel ? C.primary : C.outlineVariant}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {sel && <span style={{ width:8, height:8, borderRadius:R.pill, background:C.primary }}/>}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ ...mn, fontSize:14, fontWeight:700, color:C.onSurface }}>{child.name}</div>
                        <div style={{ ...mn, fontSize:11, color:C.onSurfaceVariant, marginTop:1 }}>{childMeta(child)}</div>
                      </div>
                      <span onClick={e => { e.stopPropagation(); onEditChild(child.id) }} aria-label={`Edit ${child.name}`} style={{ display:'flex', padding:'6px 0 6px 6px' }}><Chevron/></span>
                    </div>
                  )
                })}
                <div onClick={onAddChild} style={{ display:'flex', alignItems:'center', gap:8, border:`1px dashed ${C.outlineVariant}`, borderRadius:R.md, padding:'11px 12px', cursor:'pointer' }}>
                  <Icon name='plus' size={15} color={C.primary} strokeWidth={2.5}/>
                  <span style={{ ...mn, fontSize:13, fontWeight:700, color:C.primary }}>Add a child</span>
                </div>
              </div>
              <div style={{ ...mn, fontSize:11, color:C.onSurfaceVariant, marginTop:8, lineHeight:1.5 }}>
                {current
                  ? <>Activities and safety notes are written for {current.name}'s age. Honey warnings stay on until 12 months.</>
                  : 'Add a child to get age-appropriate activities and safety notes. Honey warnings stay on until 12 months.'}
              </div>
            </div>

            {[
              ['toddlerActivities', 'Toddler cooking activities'],
              ['toddlerVariations', 'Toddler variations on recipes'],
              ['toddlerPortion',    'Toddler portion in the day plan'],
            ].map(([key, label]) => (
              <div key={key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <span style={{ ...mn, fontSize:14, color:C.onSurface }}>{label}</span>
                <Switch on={!!prefs[key]} onClick={() => setPrefs({ [key]: !prefs[key] })}/>
              </div>
            ))}
          </div>
        )}
      </RowCard>
    </>
  )
}
