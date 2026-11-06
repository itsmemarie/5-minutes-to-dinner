import { useState } from 'react'
import { C, mn, CARD, R } from '../../lib/theme.js'
import { openExternal } from '../../lib/platform.js'
import { normaliseRecipeLink, recipeLinkHost } from '../../lib/recipeLink.js'
import { Btn } from '../ui/index.js'
import { Icon } from '../ui/Icon.jsx'

const INVALID = "That doesn't look like a web link. Check it and try again."

// The link to a recipe's original page, under the title on the recipe screen.
// It's also the only way to add one to a recipe that's already saved, so it
// stays visible as a quiet button when there's no link yet.
//
// onSave(link | null) saves the change and rejects if it fails. The parent
// passes the new url back in.
export function RecipeSourceLink({ url, onSave }) {
  const link = normaliseRecipeLink(url)   // the stored value is checked before it's opened
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const startEditing = () => { setDraft(link || ''); setError(null); setEditing(true) }

  const save = async next => {
    setBusy(true); setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    if (!draft.trim()) { save(null); return }
    const next = normaliseRecipeLink(draft)
    if (next) save(next)
    else setError(INVALID)
  }

  if (editing) {
    return (
      <div style={{ marginTop: 10 }}>
        <input value={draft} autoFocus disabled={busy} inputMode='url' placeholder='https://...' aria-label='Original recipe link'
          onChange={e => { setDraft(e.target.value); setError(null) }}
          onKeyDown={e => e.key === 'Enter' && !busy && submit()}
          style={{ ...mn, width: '100%', padding: '10px 12px', borderRadius: R.md, border: `1px solid ${error ? C.error : C.outlineVariant}`, fontSize: 14, background: C.white, outline: 'none', boxSizing: 'border-box' }}/>
        {error && <div role='alert' style={{ ...mn, fontSize: 12, color: C.error, marginTop: 6, lineHeight: 1.5 }}>{error}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Btn label={busy ? 'Saving…' : 'Save'} small onClick={submit} disabled={busy}/>
          <button onClick={() => setEditing(false)} disabled={busy} style={quietBtn(C.onSurfaceVariant, busy)}>Cancel</button>
          {link && <button onClick={() => save(null)} disabled={busy} style={{ ...quietBtn(C.error, busy), marginLeft: 'auto' }}>Remove</button>}
        </div>
      </div>
    )
  }

  if (!link) {
    return (
      <button onClick={startEditing} style={{ ...mn, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', padding: '10px 0 0', fontSize: 13, fontWeight: 700, color: C.primary, cursor: 'pointer' }}>
        + Add link to original recipe
      </button>
    )
  }

  return (
    <div style={{ ...CARD, display: 'flex', alignItems: 'stretch', marginTop: 12, overflow: 'hidden' }}>
      <button onClick={() => openExternal(link)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ display: 'flex', flexShrink: 0 }}><Icon name='externalLink' size={16} color={C.primary}/></span>
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ ...mn, fontSize: 13, fontWeight: 700, color: C.primary }}>Original recipe</span>
          <span style={{ ...mn, fontSize: 12, color: C.onSurfaceVariant, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recipeLinkHost(link)}</span>
        </span>
      </button>
      <button onClick={startEditing} aria-label='Edit original recipe link' style={{ ...mn, flexShrink: 0, border: 'none', borderLeft: `1px solid ${C.outlineVariant}30`, background: 'none', padding: '0 14px', fontSize: 12, fontWeight: 700, color: C.onSurfaceVariant, cursor: 'pointer' }}>
        Edit
      </button>
    </div>
  )
}

const quietBtn = (color, disabled) => ({ ...mn, border: 'none', background: 'none', padding: '9px 6px', fontSize: 13, fontWeight: 700, color, cursor: disabled ? 'not-allowed' : 'pointer' })
