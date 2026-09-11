import { useState } from 'react'
import { C, ep, mn, R } from '../../lib/theme.js'
import { Icon } from '../ui/Icon.jsx'
import { Btn } from '../ui/Btn.jsx'
import { RowCard, Row, FieldBox, fieldInputStyle, ConfirmDialog } from './primitives.jsx'
import { childMeta } from './ChildrenSection.jsx'

// ─── Settings sub-screens ─────────────────────────────────────────
// Each one is pushed by a chevron row and rendered under the app header with
// the row's name as its title (App owns the header). They save on interaction,
// like the rest of Settings — nothing here has a save button except the
// "Add child" form, which needs a name and a date before there is anything to
// save.

const shell = { padding:'20px 20px 40px' }
const intro = { ...mn, fontSize:13, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:16 }

// Single-select list: Week starts on, Country.
export function OptionListScreen({ heading, description, options, value, onSelect }) {
  return (
    <div style={shell}>
      {heading && <div style={{ ...ep, fontSize:22, color:C.onSurface, marginBottom:4 }}>{heading}</div>}
      {description && <div style={intro}>{description}</div>}
      <RowCard>
        {options.map((o, i) => {
          const sel = o.value === value
          return (
            <Row key={o.value} divider={i > 0} onClick={() => onSelect(o.value)} title={o.label} sub={o.sub} titleWeight={sel ? 700 : 400} titleColor={sel ? C.primary : undefined}>
              {sel && <Icon name='check' size={16} color={C.primary}/>}
            </Row>
          )
        })}
      </RowCard>
    </div>
  )
}

const todayISO = () => new Date().toISOString().split('T')[0]
const isValidDob = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v) <= new Date()

// Add or edit one child. Existing children save each field as it changes;
// a new child is created once both fields are filled in.
export function ChildEditorScreen({ child, onChange, onCreate, onDelete }) {
  const isNew = !child
  const [draft, setDraft] = useState({ name: child?.name ?? '', dob: child?.dob ?? '' })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const update = patch => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (!isNew) {
      const clean = {}
      if (patch.name !== undefined && patch.name.trim()) clean.name = patch.name.trim()
      if (patch.dob !== undefined && isValidDob(patch.dob)) clean.dob = patch.dob
      if (Object.keys(clean).length) onChange(clean)
    }
  }
  const canCreate = draft.name.trim().length > 0 && isValidDob(draft.dob)

  return (
    <div style={shell}>
      <div style={{ ...ep, fontSize:22, color:C.onSurface, marginBottom:4 }}>{isNew ? 'Add a child' : child.name}</div>
      <div style={intro}>{isNew ? 'Activities, safety notes and portions are matched to each child\'s age.' : childMeta({ ...child, ...(isValidDob(draft.dob) ? { dob: draft.dob } : {}) })}</div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <FieldBox label='Name'>
          <input value={draft.name} placeholder='e.g. Mabel' onChange={e => update({ name: e.target.value })} style={{ ...fieldInputStyle, fontSize:14 }}/>
        </FieldBox>
        <FieldBox label='Date of birth'>
          <input type='date' value={draft.dob} max={todayISO()} onChange={e => update({ dob: e.target.value })} style={{ ...fieldInputStyle, fontSize:14 }}/>
        </FieldBox>
      </div>

      {isNew ? (
        <div style={{ marginTop:22 }}>
          <Btn label='Add child' full disabled={!canCreate} onClick={() => onCreate({ name: draft.name, dob: draft.dob })}/>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={{ ...mn, marginTop:28, width:'100%', border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'12px', fontSize:14, fontWeight:700, color:C.errorInk, cursor:'pointer' }}>
          Remove {child.name}
        </button>
      )}

      {confirmDelete && (
        <ConfirmDialog destructive title={`Remove ${child.name}?`} confirmLabel='Remove'
          body='Their entry is deleted from Settings. Activities already generated for their age band stay cached and are reused if you add them again.'
          onCancel={() => setConfirmDelete(false)} onConfirm={() => { setConfirmDelete(false); onDelete() }}/>
      )}
    </div>
  )
}

const REPO_ISSUES_URL = 'https://github.com/itsmemarie/5-minutes-to-dinner/issues'

export function FeedbackScreen({ versionLabel }) {
  return (
    <div style={shell}>
      <div style={{ ...ep, fontSize:22, color:C.onSurface, marginBottom:4 }}>Feedback &amp; support</div>
      <div style={intro}>Found something broken, or want a feature? Open an issue on the project's GitHub — include the version below so it can be reproduced.</div>
      <RowCard>
        <Row title='Report a problem or idea' sub='Opens GitHub in a new tab.' onClick={() => window.open(REPO_ISSUES_URL, '_blank', 'noopener')}>
          <Icon name='externalLink' size={16} color={C.outlineStrong} strokeWidth={2.5}/>
        </Row>
        <Row divider title='Version'>
          <span style={{ ...mn, fontSize:12, fontWeight:600, color:C.onSurfaceVariant }}>{versionLabel}</span>
        </Row>
      </RowCard>
    </div>
  )
}
