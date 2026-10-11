import { useState } from 'react'
import { C, mn, R } from '../lib/theme.js'
import { isFullFrame } from '../lib/imageMath.js'
import { Icon } from './ui/Icon.jsx'
import { ImageCropper, useObjectUrl } from './ui/ImageCropper.jsx'
import { Switch } from './settings/primitives.jsx'

// Photo list for AI extraction (recipe pages, freezer lists). Items are
// { id, file, crop }; nothing is compressed until extraction, so a crop can be
// changed any time. A single new photo opens the cropper straight away — the
// cheapest token is the one never sent. `max` is 3: Groq's vision model takes
// no more per request.
let nextId = 1
export const photoItem = file => ({ id: `p${nextId++}`, file, crop: null })

function Thumb({ file }) {
  const url = useObjectUrl(file)
  return <div style={{ width:44, height:44, borderRadius:R.sm, background:C.surfaceContainerHigh, flexShrink:0, overflow:'hidden' }}>
    {url && <img src={url} alt='' style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>}
  </div>
}

export function PhotoPicker({ items, onChange, max = 3, disabled, emptyLabel = 'Tap to choose a photo', grayscale, onGrayscaleChange }) {
  const [cropping, setCropping] = useState(null)
  const [note, setNote] = useState(null)

  const add = e => {
    const files = Array.from(e.target.files || []).filter(f => f.type?.startsWith('image/'))
    e.target.value = ''
    const room = Math.max(0, max - items.length)
    setNote(files.length > room ? `Up to ${max} photos at a time — the first ${room || 'none'} ${room === 1 ? 'was' : 'were'} added.` : null)
    const added = files.slice(0, room).map(photoItem)
    if (!added.length) return
    onChange([...items, ...added])
    if (added.length === 1) setCropping(added[0].id)
  }
  const update = (id, patch) => onChange(items.map(it => (it.id === id ? { ...it, ...patch } : it)))
  const remove = id => onChange(items.filter(it => it.id !== id))
  const croppingItem = items.find(it => it.id === cropping)
  const full = items.length >= max

  return (
    <div>
      <label style={{ display:'block', border:`2px dashed ${C.outlineVariant}`, borderRadius:R.md, padding:'14px 16px', textAlign:'center', cursor: disabled || full ? 'not-allowed' : 'pointer', background:C.white, opacity: full ? 0.6 : 1 }}>
        <input type='file' accept='image/*' multiple onChange={add} style={{ display:'none' }} disabled={disabled || full}/>
        <div style={{ ...mn, fontSize:13, color: items.length ? C.onSurface : C.onSurfaceVariant }}>
          {full ? `${max} photos added (the most at once)` : items.length ? `Add another photo (${items.length} of ${max})` : emptyLabel}
        </div>
      </label>
      {note && <div style={{ ...mn, fontSize:12, color:C.onSecondaryContainerStrong, marginTop:6 }}>{note}</div>}

      {items.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:10 }}>
          {items.map(it => (
            <div key={it.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 8px', borderRadius:R.sm, background:C.white, border:`1px solid ${C.outlineVariant}40` }}>
              <Thumb file={it.file}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ ...mn, fontSize:13, color:C.onSurface, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.file.name || 'Photo'}</div>
                <div style={{ ...mn, fontSize:11, color: isFullFrame(it.crop) ? C.onSecondaryContainerStrong : C.primary, fontWeight:600 }}>{isFullFrame(it.crop) ? 'Whole photo — crop to save tokens' : 'Cropped'}</div>
              </div>
              <button onClick={() => setCropping(it.id)} disabled={disabled} style={{ ...mn, border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'5px 12px', fontSize:12, fontWeight:700, color:C.primary, cursor: disabled ? 'not-allowed' : 'pointer' }}>Crop</button>
              <button onClick={() => remove(it.id)} disabled={disabled} aria-label='Remove photo' style={{ border:'none', background:'none', padding:4, cursor: disabled ? 'not-allowed' : 'pointer', display:'flex' }}><Icon name='x' size={16} color={C.error}/></button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && onGrayscaleChange && (
        <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ ...mn, fontSize:13, fontWeight:600, color:C.onSurface }}>Send in black &amp; white</div>
            <div style={{ ...mn, fontSize:11, color:C.onSurfaceVariant, lineHeight:1.4 }}>Fine for printed or handwritten text, and smaller to send.</div>
          </div>
          <Switch on={grayscale} onClick={() => onGrayscaleChange(!grayscale)} disabled={disabled}/>
        </div>
      )}

      {croppingItem && (
        <ImageCropper file={croppingItem.file} initial={croppingItem.crop}
          onCancel={() => setCropping(null)}
          onDone={crop => { update(croppingItem.id, { crop: isFullFrame(crop) ? null : crop }); setCropping(null) }}/>
      )}
    </div>
  )
}
