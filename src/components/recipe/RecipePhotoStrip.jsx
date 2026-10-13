import { useRef, useState } from 'react'
import { C, mn } from '../../lib/theme.js'
import { Icon } from '../ui/Icon.jsx'
import { PhotoChoiceSheet } from './PhotoSheets.jsx'

// Recipe photo on the details screen: a 68px strip under the app bar that opens
// to 200px on tap. Add / Replace offers the user's own photo (device picker:
// camera roll or camera) or an AI one, and must not toggle the strip. The
// strip stays when there's no photo so the affordance can be found.
//
// onPick(file) → the parent crops and uploads, and passes the new imageUrl back.
// onGenerate() → the parent opens the AI photo sheet. Without it, Add goes
// straight to the picker.
export function RecipePhotoStrip({ imageUrl, credit, onPick, onGenerate, busy, error }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(null)   // the url that failed to load
  const [choosing, setChoosing] = useState(false)
  const inputRef = useRef(null)
  const hasPhoto = !!imageUrl && failed !== imageUrl

  const choose = e => {
    e.stopPropagation()
    if (busy) return
    if (onGenerate) setChoosing(true)
    else inputRef.current?.click()
  }
  const onFile = e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onPick(file)
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <div
        onClick={hasPhoto ? () => setOpen(o => !o) : choose}
        style={{
          position: 'relative', height: open && hasPhoto ? 200 : 68, overflow: 'hidden', cursor: 'pointer', transition: 'height 220ms ease',
          background: `repeating-linear-gradient(135deg,${C.primaryFixed} 0 8px,#dfeedf 8px 16px)`,
        }}
      >
        {hasPhoto ? (
          <img src={imageUrl} alt='' onError={() => setFailed(imageUrl)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name='camera' size={15} color={C.onSurfaceVariant}/>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10, color: C.onSurfaceVariant }}>{busy ? 'saving photo…' : onGenerate ? 'upload one or create with AI' : 'recipe photo'}</span>
          </div>
        )}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px',
          background: hasPhoto ? 'linear-gradient(to top, rgba(24,36,23,0.62), rgba(24,36,23,0))' : 'none',
        }}>
          <span style={{ ...mn, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', color: hasPhoto ? '#fff' : C.onSurface }}>
            {busy ? 'Saving…' : !hasPhoto ? 'No photo yet' : open ? 'Tap to collapse' : 'Tap to see photo'}
          </span>
          {/* Visual size stays ~26px; the ::before-free padding wrapper makes the hit area 44px. */}
          <button onClick={choose} disabled={busy} aria-label={hasPhoto ? 'Replace photo' : 'Add photo'}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'rgba(255,255,255,0.94)', color: C.onSurface, borderRadius: 99, padding: '5px 11px', ...mn, fontSize: 11, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            <Icon name='pencil' size={12} color={C.onSurface} strokeWidth={2.6}/>
            {hasPhoto ? 'Replace' : 'Add'}
            <span style={{ position: 'absolute', top: -9, bottom: -9, left: -6, right: -6 }}/>
          </button>
        </div>
      </div>
      <input ref={inputRef} type='file' accept='image/*' onChange={onFile} style={{ display: 'none' }}/>
      {choosing && (
        <PhotoChoiceSheet title={hasPhoto ? 'Replace the photo' : 'Add a photo'} onClose={() => setChoosing(false)}
          onUpload={() => { setChoosing(false); inputRef.current?.click() }}
          onGenerate={() => { setChoosing(false); onGenerate() }}/>
      )}
      {error &&<div role='alert' style={{ ...mn, fontSize: 12, color: C.error, background: C.errorContainer, padding: '8px 20px' }}>{error}</div>}
      {open && hasPhoto && credit && <div style={{ ...mn, fontSize: 10, color: C.onSurfaceVariant, padding: '6px 20px 0' }}>{credit}</div>}
    </div>
  )
}
