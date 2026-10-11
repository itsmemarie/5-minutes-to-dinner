import { useState } from 'react'
import { C, ep, mn, R, CARD } from '../../lib/theme.js'
import { Icon } from '../ui/Icon.jsx'
import { Btn } from '../ui/Btn.jsx'
import { RowCard, Row, ConfirmDialog, GroupLabel, ROW_DIVIDER } from './primitives.jsx'
import { validateGeminiKey, setAiChoice, resetAiChoices } from '../../lib/ai.js'
import { looksLikeGeminiKey, maskKey, removeGeminiKey, saveGeminiKey, useGeminiKey } from '../../lib/geminiKey.js'
import { useAiRuns } from '../../lib/aiRuns.js'
import { sendSignInEmail, signOut } from '../../lib/supabase.js'
import { EQUIPMENT_OPTIONS } from '../../lib/preferences.js'
import { openExternal } from '../../lib/platform.js'
import { promptInstall, useInstallState } from '../../lib/install.js'

// ─── AI & account sub-screens (Settings) ──────────────────────────
// Pushed by chevron rows like the other settings sub-screens. The Google-key
// flow is also shown inside the "AI is busy" sheet, so it's its own component.

const shell = { padding:'20px 20px 40px' }
const heading = { ...ep, fontSize:22, color:C.onSurface, marginBottom:4 }
const intro = { ...mn, fontSize:13, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:16 }
const input = { ...mn, width:'100%', padding:'11px 12px', borderRadius:R.md, border:`1px solid ${C.outlineVariant}`, fontSize:14, background:C.white, outline:'none', boxSizing:'border-box' }

function Notice({ kind = 'info', children }) {
  const tone = kind === 'error' ? { bg:C.errorContainer, fg:C.error }
    : kind === 'ok' ? { bg:C.primaryFixed, fg:C.primary }
    : kind === 'warn' ? { bg:C.secondaryContainer, fg:C.onSecondaryContainerStrong }
    : { bg:C.surfaceContainerHigh, fg:C.onSurfaceVariant }
  return <div role={kind === 'error' ? 'alert' : 'status'} style={{ ...mn, fontSize:13, lineHeight:1.5, color:tone.fg, background:tone.bg, borderRadius:R.md, padding:'10px 12px' }}>{children}</div>
}

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey'

// ── "Add your Google key" ─────────────────────────────────────────
function StepNum({ n, done }) {
  return <div style={{ width:24, height:24, borderRadius:R.pill, background: done ? C.primary : C.primaryFixed, color: done ? C.onPrimary : C.primary, display:'flex', alignItems:'center', justifyContent:'center', ...mn, fontSize:12, fontWeight:700, flexShrink:0 }}>{done ? <Icon name='check' size={13} color={C.onPrimary}/> : n}</div>
}

export function GeminiKeyFlow({ onSaved }) {
  const [value, setValue] = useState('')
  const [opened, setOpened] = useState(false)
  const [status, setStatus] = useState(null)   // { kind, text }
  const checking = status?.kind === 'checking'

  const save = async () => {
    const key = value.trim()
    if (!looksLikeGeminiKey(key)) {
      setStatus({ kind:'error', text:"That doesn't look like a whole key yet. Copy the full code from AI Studio and paste it again." })
      return
    }
    setStatus({ kind:'checking', text:'Checking the key with Google…' })
    try {
      const r = await validateGeminiKey(key)
      if (!r.ok) { setStatus({ kind:'error', text:r.error }); return }
      if (!saveGeminiKey(key)) { setStatus({ kind:'error', text:"This browser won't store the key (private browsing?). Open the app in a normal window and try again." }); return }
      setValue('')
      setStatus({ kind: r.warning ? 'warn' : 'ok', text: r.warning || "Done — your key works. The app will use it whenever the free AI is busy." })
      onSaved?.()
    } catch (e) {
      setStatus({ kind:'error', text:e.message })
    }
  }

  const step = (n, done, title, body) => (
    <div style={{ display:'flex', gap:12, padding:'12px 0', borderTop: n > 1 ? `1px solid ${ROW_DIVIDER}` : undefined }}>
      <StepNum n={n} done={done}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ ...mn, fontSize:14, fontWeight:600, color:C.onSurface, marginBottom: body ? 8 : 0 }}>{title}</div>
        {body}
      </div>
    </div>
  )

  return (
    <div>
      <RowCard style={{ padding:'2px 14px 12px' }}>
        {step(1, opened, 'Open Google AI Studio', (
          <button onClick={() => { openExternal(AI_STUDIO_URL); setOpened(true) }} style={{ ...mn, display:'inline-flex', alignItems:'center', gap:8, border:'none', background:C.primary, color:C.onPrimary, borderRadius:R.pill, padding:'9px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            Open Google AI Studio <Icon name='externalLink' size={14} color={C.onPrimary}/>
          </button>
        ))}
        {step(2, false, 'Sign in with your normal Google account.')}
        {step(3, false, <>Click <b>Create API key</b> and copy it.</>)}
        {step(4, status?.kind === 'ok', 'Paste it here', (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input value={value} onChange={e => { setValue(e.target.value); if (status?.kind === 'error') setStatus(null) }}
              onKeyDown={e => e.key === 'Enter' && !checking && save()}
              placeholder='Paste your key' type='password' autoComplete='off' autoCapitalize='off' spellCheck={false} aria-label='Google AI key' style={input} disabled={checking}/>
            <Btn label={checking ? 'Checking…' : 'Check & save'} onClick={save} disabled={checking || !value.trim()} full small/>
          </div>
        ))}
      </RowCard>
      {status && status.kind !== 'checking' && <div style={{ marginTop:12 }}><Notice kind={status.kind}>{status.text}</Notice></div>}
      {checking && <div style={{ marginTop:12 }}><Notice>{status.text}</Notice></div>}
      <div style={{ ...mn, fontSize:12, color:C.onSurfaceVariant, lineHeight:1.6, marginTop:14 }}>
        Google's free tier costs nothing, though its free limits may change.<br/>
        Your key stays on this device: it's sent along with your AI requests but never saved on our server. Google may use free-tier requests to improve its products.
      </div>
    </div>
  )
}

export function GeminiKeyScreen() {
  const key = useGeminiKey()
  const [replacing, setReplacing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  return (
    <div style={shell}>
      <div style={heading}>Free Google AI key</div>
      <div style={intro}>The app's free AI can get busy. With your own free Google key, it carries on using Google's AI instead. You can always fill things in by hand.</div>
      {key && !replacing ? (
        <>
          <RowCard>
            <Row title='Key saved on this device' sub={`${maskKey(key)} · used when the free AI is busy`}>
              <Icon name='key' size={18} color={C.primary}/>
            </Row>
          </RowCard>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <button onClick={() => setReplacing(true)} style={{ ...mn, flex:1, border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'12px', fontSize:14, fontWeight:700, color:C.onSurface, cursor:'pointer' }}>Replace key</button>
            <button onClick={() => setConfirmRemove(true)} style={{ ...mn, flex:1, border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'12px', fontSize:14, fontWeight:700, color:C.errorInk, cursor:'pointer' }}>Remove key</button>
          </div>
        </>
      ) : (
        <GeminiKeyFlow onSaved={() => setReplacing(false)}/>
      )}
      {confirmRemove && (
        <ConfirmDialog destructive title='Remove your Google key?' confirmLabel='Remove'
          body="It's deleted from this device. When the free AI is busy you'll be asked again, or you can fill things in by hand. The key itself still works in Google AI Studio until you delete it there."
          onCancel={() => setConfirmRemove(false)} onConfirm={() => { removeGeminiKey(); setConfirmRemove(false) }}/>
      )}
    </div>
  )
}

// ── Sign in ───────────────────────────────────────────────────────
export function SignInScreen({ session, isOwner, onDone }) {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = async fn => {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(e.message || 'Something went wrong. Try again.') } finally { setBusy(false) }
  }

  if (session) {
    return (
      <div style={shell}>
        <div style={heading}>Signed in</div>
        <div style={intro}>{isOwner ? 'This is the owner account: AI runs on your own keys, and you can pick the model for each step in Settings › AI models.' : 'You can use everything in the app. The owner account has a few extra AI settings.'}</div>
        <RowCard><Row title={session.user?.email} sub={isOwner ? 'Owner' : 'Signed in'}/></RowCard>
        <div style={{ marginTop:18 }}>
          <button onClick={() => run(async () => { await signOut(); onDone?.() })} disabled={busy} style={{ ...mn, width:'100%', border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'12px', fontSize:14, fontWeight:700, color:C.errorInk, cursor:'pointer' }}>{busy ? 'Signing out…' : 'Sign out'}</button>
        </div>
        {error && <div style={{ marginTop:12 }}><Notice kind='error'>{error}</Notice></div>}
      </div>
    )
  }

  return (
    <div style={shell}>
      <div style={heading}>Sign in</div>
      <div style={intro}>Everything works without an account. Signing in is for the owner, whose AI runs on their own keys.</div>
      {!sentTo ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <input type='email' value={email} onChange={e => setEmail(e.target.value)} placeholder='you@example.com' autoComplete='email' aria-label='Email address' style={input} disabled={busy}
            onKeyDown={e => e.key === 'Enter' && email.includes('@') && run(async () => { await sendSignInEmail(email.trim()); setSentTo(email.trim()) })}/>
          <Btn label={busy ? 'Sending…' : 'Email me a sign-in link'} full disabled={busy || !email.includes('@')}
            onClick={() => run(async () => { await sendSignInEmail(email.trim()); setSentTo(email.trim()) })}/>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Notice kind='ok'>We've emailed a sign-in link to <b>{sentTo}</b>. Open it on this device and you'll be signed in. It can take a minute to arrive, so check your spam folder too.</Notice>
          <Btn label={busy ? 'Sending…' : 'Send the link again'} full secondary disabled={busy}
            onClick={() => run(() => sendSignInEmail(sentTo))}/>
          <button onClick={() => { setSentTo(null); setError(null) }} style={{ ...mn, border:'none', background:'none', color:C.primary, fontSize:13, fontWeight:700, cursor:'pointer', padding:8 }}>Use a different email</button>
        </div>
      )}
      {error && <div style={{ marginTop:12 }}><Notice kind='error'>{error}</Notice></div>}
    </div>
  )
}

// ── Kitchen equipment ─────────────────────────────────────────────
export function EquipmentScreen({ value, onChange }) {
  const toggle = id => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  return (
    <div style={shell}>
      <div style={heading}>Kitchen equipment</div>
      <div style={intro}>The expert recipe review and the batch-cooking plan only use what you have, and warn you when a recipe needs something that isn't here.</div>
      <RowCard>
        {EQUIPMENT_OPTIONS.map((o, i) => {
          const on = value.includes(o.id)
          return (
            <Row key={o.id} divider={i > 0} onClick={() => toggle(o.id)} title={o.label} titleWeight={on ? 700 : 400}>
              <div role='checkbox' aria-checked={on} style={{ width:22, height:22, borderRadius:R.pill, border:`2px solid ${on ? C.primary : C.outlineVariant}`, background: on ? C.primary : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {on && <Icon name='check' size={13} color={C.onPrimary}/>}
              </div>
            </Row>
          )
        })}
      </RowCard>
    </div>
  )
}

// ── Install ───────────────────────────────────────────────────────
export function InstallScreen() {
  const { installed, canPrompt, platform } = useInstallState()
  const [result, setResult] = useState(null)
  const steps = platform === 'ios'
    ? ['Open this page in Safari.', 'Tap the Share button.', 'Choose "Add to Home Screen".']
    : platform === 'android'
      ? ['Open this page in Chrome.', 'Tap the ⋮ menu.', 'Choose "Install app" (or "Add to Home screen").']
      : ['Open this page in Chrome or Edge.', 'Click the install icon at the right of the address bar.', 'Choose "Install".']
  return (
    <div style={shell}>
      <div style={heading}>Install the app</div>
      <div style={intro}>Installed, the app opens like any other and appears in your phone's share menu — share a recipe from a website or a photo straight into it.</div>
      {installed ? (
        <Notice kind='ok'>It's installed — you're using the app version now.</Notice>
      ) : (
        <>
          {canPrompt && <div style={{ marginBottom:16 }}><Btn label='Install now' full onClick={async () => setResult(await promptInstall() ? 'ok' : 'dismissed')}/></div>}
          {result === 'dismissed' && <div style={{ marginBottom:12 }}><Notice>No problem — you can install it any time from here.</Notice></div>}
          <RowCard style={{ padding:'4px 14px' }}>
            {steps.map((s, i) => (
              <div key={s} style={{ display:'flex', gap:12, padding:'11px 0', borderTop: i ? `1px solid ${ROW_DIVIDER}` : undefined }}>
                <StepNum n={i + 1}/>
                <span style={{ ...mn, fontSize:14, color:C.onSurface, lineHeight:1.5 }}>{s}</span>
              </div>
            ))}
          </RowCard>
        </>
      )}
      {platform === 'ios' && (
        <div style={{ marginTop:14 }}><Notice kind='warn'>On iPhone, apps added from Safari can't appear in the share menu yet. To bring in a recipe, copy its link and paste it into “Add recipe”. Sharing will come with the App Store version.</Notice></div>
      )}
    </div>
  )
}

// ── Owner: model per AI step ──────────────────────────────────────
const PROVIDER_LABEL = { claude:'Claude', groq:'Groq', gemini:'Gemini' }
const selectStyle = { ...mn, fontSize:12, fontWeight:600, color:C.onSurface, border:`1px solid ${C.outlineVariant}`, borderRadius:R.sm, padding:'6px 8px', background:C.white, minWidth:0 }

function ago(t) {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

function StepModelRow({ step, route, presets, defaults, saving, onChange, run, divider }) {
  const [custom, setCustom] = useState(null)   // draft custom model id, or null
  const known = presets[route.provider] || []
  const isCustom = !known.some(p => p.id === route.model)
  const defaultModel = provider =>
    provider === 'claude' ? defaults.owner.model : provider === 'gemini' ? defaults.gemini : (step.groqModel || 'openai/gpt-oss-120b')

  return (
    <div style={{ padding:'12px 0', borderTop: divider ? `1px solid ${ROW_DIVIDER}` : undefined }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ ...mn, fontSize:14, fontWeight:600, color:C.onSurface, flex:1 }}>{step.label}</div>
        {saving && <span style={{ ...mn, fontSize:11, color:C.onSurfaceVariant }}>Saving…</span>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:8 }}>
        <select aria-label={`${step.label} provider`} value={route.provider} style={selectStyle}
          onChange={e => onChange(e.target.value, defaultModel(e.target.value))}>
          {Object.keys(PROVIDER_LABEL).map(p => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
        </select>
        <select aria-label={`${step.label} model`} value={custom !== null ? '__custom' : route.model} style={selectStyle}
          onChange={e => e.target.value === '__custom' ? setCustom(isCustom ? route.model : '') : (setCustom(null), onChange(route.provider, e.target.value))}>
          {known.map(p => <option key={p.id} value={p.id}>{p.label}{step.vision && route.provider === 'groq' && !p.vision ? ' (photos → Qwen)' : ''}</option>)}
          {isCustom && <option value={route.model}>{route.model}</option>}
          <option value='__custom'>Custom model id…</option>
        </select>
      </div>
      {custom !== null && (
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <input value={custom} onChange={e => setCustom(e.target.value.trim())} placeholder={route.provider === 'claude' ? 'claude-…' : route.provider === 'gemini' ? 'gemini-…' : 'provider/model'} style={{ ...input, padding:'7px 10px', fontSize:13 }} autoCapitalize='off' spellCheck={false}/>
          <Btn label='Use' small disabled={!custom} onClick={() => { onChange(route.provider, custom); setCustom(null) }}/>
        </div>
      )}
      <div style={{ ...mn, fontSize:11, color:C.onSurfaceVariant, marginTop:6, lineHeight:1.5 }}>
        {run
          ? <>Last run: {PROVIDER_LABEL[run.provider] || run.provider} · {run.model}{run.ms != null ? ` · ${(run.ms / 1000).toFixed(1)}s` : ''}{run.tokensIn != null ? ` · ${run.tokensIn.toLocaleString()} → ${(run.tokensOut ?? 0).toLocaleString()} tokens` : ''} · {ago(run.at)}</>
          : 'Not run on this device yet'}
      </div>
    </div>
  )
}

export function OwnerModelsScreen({ config, onConfigChange }) {
  const runs = useAiRuns()
  const hasGeminiKey = !!useGeminiKey()
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  if (!config?.isOwner || !config.steps) return <div style={shell}><Notice>Sign in with the owner account to choose AI models.</Notice></div>

  const choices = config.choices || {}
  const groqDefault = config.defaults.owner.provider === 'groq'   // no Claude key on the server
  const routeFor = id => choices[id] || (groqDefault ? { provider:'groq', model: config.steps.find(s => s.id === id)?.groqModel } : config.defaults.owner)
  const defaultLabel = groqDefault ? 'the free Groq default' : `Claude ${config.presets.claude.find(p => p.id === config.defaults.owner.model)?.label || config.defaults.owner.model}`
  const groups = [...new Set(config.steps.map(s => s.group))]
  const usesGemini = config.steps.some(s => routeFor(s.id).provider === 'gemini')

  const change = async (stepId, provider, model) => {
    const before = choices
    onConfigChange({ ...config, choices: { ...choices, [stepId]: { provider, model } } })
    setSaving(stepId); setError(null)
    try { await setAiChoice(stepId, provider, model) }
    catch (e) { setError(e.message); onConfigChange({ ...config, choices: before }) }
    finally { setSaving(null) }
  }
  const reset = async () => {
    setConfirmReset(false); setError(null)
    try { await resetAiChoices(); onConfigChange({ ...config, choices: {} }) }
    catch (e) { setError(e.message) }
  }

  return (
    <div style={shell}>
      <div style={heading}>AI models</div>
      <div style={intro}>Owner only. Pick the provider and model for each step, then compare speed and tokens from the last run. Everyone else always uses the free Groq setup.</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
        {!config.keys?.claude && <Notice kind='warn'>ANTHROPIC_API_KEY isn't set on the server, so Claude steps will fail until it is.</Notice>}
        {!config.keys?.groq && <Notice kind='warn'>GROQ_API_KEY isn't set on the server, so Groq steps (and everyone else's AI) will fail.</Notice>}
        {usesGemini && !hasGeminiKey && <Notice kind='warn'>Some steps use Gemini, which runs on your own Google key — add one in Settings › Free Google AI key.</Notice>}
        {config.choicesTableReady === false && <Notice kind='error'>The ai_model_choices table is missing — run the latest database migration before saving choices.</Notice>}
        {error && <Notice kind='error'>{error}</Notice>}
      </div>
      {groups.map(g => (
        <div key={g}>
          <GroupLabel style={{ margin:'16px 0 6px' }}>{g}</GroupLabel>
          <div style={{ ...CARD, padding:'0 14px' }}>
            {config.steps.filter(s => s.group === g).map((s, i) => (
              <StepModelRow key={s.id} step={s} route={routeFor(s.id)} presets={config.presets} defaults={config.defaults}
                saving={saving === s.id} run={runs[s.id]} divider={i > 0}
                onChange={(provider, model) => change(s.id, provider, model)}/>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => setConfirmReset(true)} style={{ ...mn, marginTop:22, width:'100%', border:`1px solid ${C.outlineVariant}`, background:'none', borderRadius:R.pill, padding:'12px', fontSize:14, fontWeight:700, color:C.onSurface, cursor:'pointer' }}>Reset every step to {defaultLabel}</button>
      {confirmReset && (
        <ConfirmDialog title='Reset all AI models?' confirmLabel='Reset'
          body={`Every step goes back to the default, ${defaultLabel}. The last-run figures on this device stay.`}
          onCancel={() => setConfirmReset(false)} onConfirm={reset}/>
      )}
    </div>
  )
}
