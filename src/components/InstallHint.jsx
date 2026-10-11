import { useState } from 'react'
import { C, mn, R } from '../lib/theme.js'
import { Icon } from './ui/Icon.jsx'
import { promptInstall, useInstallState } from '../lib/install.js'

// "Install the app to share into it" — shown where importing a recipe starts.
// The share sheet only lists installed web apps, and only on Android/desktop
// Chrome; on iPhone the honest answer is copy-and-paste for now.
export function InstallHint({ onMore }) {
  const { installed, canPrompt, platform } = useInstallState()
  const [hidden, setHidden] = useState(false)
  if (installed || hidden) return null
  const ios = platform === 'ios'
  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-start', background:C.white, border:`1px solid ${C.outlineVariant}60`, borderRadius:R.md, padding:'10px 12px' }}>
      <Icon name='share' size={16} color={C.primary}/>
      <div style={{ flex:1, ...mn, fontSize:12, color:C.onSurfaceVariant, lineHeight:1.5 }}>
        {ios
          ? <>On iPhone, recipes can't be shared straight into the app yet — copy the link and paste it above.</>
          : <><b style={{ color:C.onSurface }}>Install the app to share into it.</b> Then share a recipe page or photo from any app and pick 5 Minutes to Dinner.{!canPrompt && <> In Chrome: ⋮ menu → <i>Install app</i>.</>}</>}
        <div style={{ display:'flex', gap:14, marginTop:6 }}>
          {!ios && canPrompt && <button onClick={promptInstall} style={linkBtn}>Install now</button>}
          {!ios && !canPrompt && onMore && <button onClick={onMore} style={linkBtn}>How to install</button>}
          <button onClick={() => setHidden(true)} style={{ ...linkBtn, color:C.onSurfaceVariant }}>Not now</button>
        </div>
      </div>
    </div>
  )
}

const linkBtn = { ...mn, border:'none', background:'none', padding:0, fontSize:12, fontWeight:700, color:C.primary, cursor:'pointer' }
