import { useState } from 'react'
import { C, mn, R } from '../lib/theme.js'
import { Btn } from './ui/Btn.jsx'
import { Sheet } from './ui/Sheet.jsx'
import { GeminiKeyFlow } from './settings/aiScreens.jsx'
import { removeGeminiKey } from '../lib/geminiKey.js'

// The fallback chain's visible end. Raised app-wide (ai.js → AI_LIMIT_EVENT)
// whenever an AI request the user asked for hits a limit:
//   ai_busy            Groq is out, no Google key yet  → offer the key flow
//   gemini_key_invalid the saved key was rejected       → fix or remove it
//   ai_all_limited     Groq and the key are both out   → carry on by hand
// Every branch keeps manual entry one tap away; nothing is lost, and the
// screen's own Try again button still works later.
const COPY = {
  ai_busy: {
    title: 'The free AI is busy',
    body: "You've reached the free AI limit for now. Add your own free Google AI key to keep going, or carry on by hand. Everything can be filled in manually.",
  },
  gemini_key_invalid: {
    title: "Your Google key didn't work",
    body: 'Google rejected the key saved on this device. Add it again, or remove it and carry on by hand.',
  },
  ai_all_limited: {
    title: 'AI is out for now',
    body: "Both the free AI and your Google key have reached their limits. Carry on by hand, and try the AI buttons again later, once the free limits reset.",
  },
}

export function AiLimitSheet({ notice, onClose }) {
  const [addingKey, setAddingKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const copy = COPY[notice.code] || COPY.ai_busy
  const secondary = { ...mn, flex:1, border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'12px', fontSize:14, fontWeight:700, color:C.onSurface, cursor:'pointer' }

  if (addingKey) {
    return (
      <Sheet title='Add your free Google AI key' onClose={onClose} zIndex={250}>
        <GeminiKeyFlow onSaved={() => setSaved(true)}/>
        <div style={{ marginTop:16 }}>
          {saved
            ? <Btn label='Done — try the AI again' full onClick={onClose}/>
            : <button onClick={onClose} style={{ ...secondary, width:'100%' }}>Not now, I'll do it by hand</button>}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={copy.title} onClose={onClose} zIndex={250}>
      <div style={{ ...mn, fontSize:14, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:18 }}>{copy.body}</div>
      {notice.code === 'ai_all_limited' ? (
        <Btn label='OK, continue by hand' full onClick={onClose}/>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Btn label={notice.code === 'gemini_key_invalid' ? 'Add the key again' : 'Add a free Google key'} full onClick={() => setAddingKey(true)}/>
          <div style={{ display:'flex', gap:10 }}>
            {notice.code === 'gemini_key_invalid' && <button onClick={() => { removeGeminiKey(); onClose() }} style={secondary}>Remove key</button>}
            <button onClick={onClose} style={secondary}>Continue by hand</button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
