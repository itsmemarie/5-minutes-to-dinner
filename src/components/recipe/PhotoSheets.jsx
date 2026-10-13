import { useEffect, useRef, useState } from 'react'
import { generateRecipeImage } from '../../lib/ai.js'
import { base64ToFile } from '../../lib/imageHelpers.js'
import { C, mn, R } from '../../lib/theme.js'
import { Btn } from '../ui/Btn.jsx'
import { Icon } from '../ui/Icon.jsx'
import { Sheet } from '../ui/Sheet.jsx'

// How an AI picture is saved: marked as such, so nobody mistakes it for a
// photo of the real thing (the strip shows the credit under the photo).
export const AI_PHOTO = { source: 'ai', credit: 'AI-generated image' }

// Adding or replacing a recipe photo: the user's own, or one the AI makes.
// onUpload must open the file picker synchronously — iOS only allows it
// inside the tap itself.
export function PhotoChoiceSheet({ title = 'Add a photo', onUpload, onGenerate, aiDisabledReason, onClose }) {
  const option = (icon, label, sub, onClick, disabled) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', border: `1px solid ${C.outlineVariant}`, background: C.white, borderRadius: R.md, padding: '14px 14px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      <span style={{ width: 40, height: 40, borderRadius: R.pill, background: C.primaryFixed, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} color={C.primary}/>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ ...mn, fontSize: 14, fontWeight: 700, color: C.onSurface }}>{label}</span>
        <span style={{ ...mn, fontSize: 12, color: C.onSurfaceVariant, lineHeight: 1.4 }}>{sub}</span>
      </span>
    </button>
  )
  return (
    <Sheet title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        {option('camera', 'Upload a photo', 'From your camera roll, or take one now.', onUpload)}
        {option('sparkles', 'Create with AI', aiDisabledReason || 'Made from the recipe name and ingredients.', onGenerate, !!aiDisabledReason)}
      </div>
    </Sheet>
  )
}

// Makes an AI picture and shows it before anything is saved. onUse(file)
// receives it as a File, so it takes the same path as an uploaded photo.
export function AiPhotoSheet({ name, ingredients, onUse, onClose }) {
  const [state, setState] = useState({ status: 'loading' })   // loading | ready { file, url } | error { message }
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])

  const create = async () => {
    setState({ status: 'loading' })
    try {
      const { image } = await generateRecipeImage({ name, ingredients })
      if (!live.current) return
      setState({ status: 'ready', url: `data:${image.mediaType};base64,${image.base64}`, file: base64ToFile(image.base64, image.mediaType, 'ai-photo') })
    } catch (e) {
      if (live.current) setState({ status: 'error', message: e.message })
    }
  }
  // Once per opening (StrictMode re-runs effects in dev; each run is a real picture).
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    create()
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const loading = state.status === 'loading'
  return (
    <Sheet title='AI photo' onClose={onClose}>
      <div style={{ ...mn, fontSize: 12, color: C.onSurfaceVariant, lineHeight: 1.5, marginBottom: 12 }}>
        Made from the recipe name and ingredients. It shows the idea of the dish, not your cooking, and is labelled as AI-made.
      </div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: R.md, overflow: 'hidden', background: `repeating-linear-gradient(135deg,${C.primaryFixed} 0 8px,#dfeedf 8px 16px)` }}>
        {state.status === 'ready' && <img src={state.url} alt={`AI picture of ${name}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>}
        {loading && (
          <div role='status' style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <style>{'@keyframes sp{to{transform:rotate(360deg)}}'}</style>
            <div style={{ width: 32, height: 32, border: `3px solid ${C.secondaryContainer}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'sp 0.9s linear infinite' }}/>
            <span style={{ ...mn, fontSize: 13, color: C.onSurface }}>Creating your photo… this takes a few seconds</span>
          </div>
        )}
        {state.status === 'error' && (
          <div role='alert' style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <span style={{ ...mn, fontSize: 13, color: C.error, background: C.errorContainer, borderRadius: R.sm, padding: '10px 12px', lineHeight: 1.5, textAlign: 'center' }}>{state.message}</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Btn label={state.status === 'error' ? 'Try again' : 'Make another'} small secondary onClick={create} disabled={loading}/>
        <Btn label='Use this photo' small onClick={() => onUse(state.file)} disabled={state.status !== 'ready'}/>
      </div>
    </Sheet>
  )
}
