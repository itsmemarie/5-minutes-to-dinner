import { useEffect, useRef, useState } from 'react'
import { C, mn } from '../lib/theme.js'
import { isDeadInstagramPost, isDeadTikTokMessage, reelEmbed } from '../lib/reels.js'
import { Btn, Spinner } from './ui/index.js'

const FRAME_HEIGHT = 460

// The reel itself. Only ever mounted for the top card, after play is tapped, and
// it goes when the card does. `onUnavailable` means the post is gone or private, and
// the card goes back to its still with a note saying so.
export function ReelPlayer({ recipe, onStop, onUnavailable }) {
  const embed = reelEmbed(recipe.sourceUrl)
  const frame = useRef(null)
  const [ready, setReady] = useState(!embed.checkUrl)

  useEffect(() => {
    if (!embed.checkUrl) return
    let cancelled = false
    fetch(embed.checkUrl)
      .then(async res => {
        const body = await res.json().catch(() => null)
        if (cancelled) return
        if (isDeadInstagramPost(res.status, body)) onUnavailable()
        else setReady(true)
      })
      .catch(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [embed.checkUrl])

  useEffect(() => {
    const listen = e => { if (e.source === frame.current?.contentWindow && isDeadTikTokMessage(e.data)) onUnavailable() }
    window.addEventListener('message', listen)
    return () => window.removeEventListener('message', listen)
  }, [])

  return (
    <div style={{ background:C.onSurface, padding:'10px 10px 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
      <div style={{ width:'100%', height:FRAME_HEIGHT, background:C.white, borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {ready
          ? <iframe ref={frame} src={embed.src} title={`Video for ${recipe.name}`} allow='autoplay; fullscreen; encrypted-media; picture-in-picture' allowFullScreen style={{ width:'100%', height:'100%', border:'none', display:'block' }}/>
          : <Spinner msg='Finding the video…'/>}
      </div>
      <div style={{ ...mn, fontSize:12, color:C.onPrimary, opacity:0.85 }}>Swiping pauses while the video plays</div>
      <Btn label='Stop video' secondary strong small onClick={onStop}/>
    </div>
  )
}
