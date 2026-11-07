import { C, mn, R } from '../lib/theme.js'
import { deckName } from '../lib/tryDeck.js'
import { Btn } from './ui/index.js'
import { Sheet } from './ui/Sheet.jsx'

const ButtonRow = ({ children }) => <div style={{ display:'flex', gap:10 }}>{children}</div>
const Half = ({ children }) => <div style={{ flex:1, minWidth:0 }}>{children}</div>

function Progress({ total, done }) {
  return (
    <div role='img' aria-label={`${done} of ${total}`} style={{ display:'flex', gap:4, margin:'6px 0 18px' }}>
      {Array.from({ length:total }, (_, i) => (
        <span key={i} style={{ flex:1, height:8, borderRadius:R.pill, background: i < done ? C.primary : C.primaryFixed }}/>
      ))}
    </div>
  )
}

// `sheet` comes from tryDeck.yesSheet. Reaching the target turns the emphasis
// round: Done becomes the main button.
export function YesSheet({ sheet, onDone, onKeepGoing }) {
  const reached = sheet.kind === 'reached'
  return (
    <Sheet title={sheet.title} onClose={onKeepGoing}>
      {sheet.segments ? <Progress {...sheet.segments}/> : <div style={{ height:10 }}/>}
      <ButtonRow>
        <Half><Btn label='Done' full secondary={!reached} strong onClick={onDone}/></Half>
        <Half><Btn label={reached ? 'Keep going' : 'Keep swiping'} full secondary={reached} strong onClick={onKeepGoing}/></Half>
      </ButtonRow>
    </Sheet>
  )
}

// Closing it without choosing changes nothing, and the card stays on top.
export function RemoveSheet({ recipe, onKeep, onRemove, onClose }) {
  return (
    <Sheet title="You've passed on this one 4 times" onClose={onClose}>
      <div style={{ ...mn, fontSize:14, color:C.onSurfaceVariant, lineHeight:1.6, marginBottom:18 }}>
        Remove {deckName(recipe)} from your recipes? You can restore it later from Settings.
      </div>
      <ButtonRow>
        <Half><Btn label='Keep it' full secondary strong onClick={onKeep}/></Half>
        <Half><Btn label='Remove' full danger onClick={onRemove}/></Half>
      </ButtonRow>
    </Sheet>
  )
}
