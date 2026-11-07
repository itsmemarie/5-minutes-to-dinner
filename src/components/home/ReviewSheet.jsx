import { useState } from 'react'
import { C, ep, mn, R } from '../../lib/theme.js'
import { SECOND_CHANCE } from '../../lib/mealRating.js'
import { useBackToClose } from '../../lib/useBackToClose.js'
import { Btn } from '../ui/index.js'
import { Sheet } from '../ui/Sheet.jsx'
import { Switch } from '../settings/primitives.jsx'

const field = { ...mn, width:'100%', boxSizing:'border-box', border:`1px solid ${C.outlineVariant}`, borderRadius:R.md, padding:'10px 12px', fontSize:16, lineHeight:1.4, color:C.onSurface, background:C.white, outline:'none', resize:'vertical' }
const fieldLabel = { ...mn, display:'block', fontSize:12, fontWeight:700, color:C.onSurfaceVariant, marginBottom:6 }

// After an Okay, or from "Add notes" after a Loved. Keeps a comment on the meal. An
// Okay can also give the recipe a second chance with one fix. `mode` is 'okay' or 'loved'.
export function ReviewSheet({ meal, recipe, mode, onSave, onClose }) {
  useBackToClose(true, onClose)
  const okay = mode === 'okay'
  const [comment, setComment] = useState(meal.ratingComment ?? '')
  const [secondChance, setSecondChance] = useState(okay && recipe?.status === SECOND_CHANCE)
  const [fix, setFix] = useState(recipe?.fixNote ?? '')
  const canSave = !secondChance || !!fix.trim()
  return (
    <Sheet label={`Notes on ${meal.name}`} onClose={onClose}>
      <div style={{ ...ep, fontSize:19, color:C.onSurface, marginBottom:4 }}>{meal.name}</div>
      <div style={{ ...mn, fontSize:13, color:C.onSurfaceVariant, marginBottom:16 }}>{okay ? 'Okay this time. Anything to remember?' : 'What made it good?'}</div>
      <label style={{ display:'block', marginBottom:16 }}>
        <span style={fieldLabel}>Comment</span>
        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} style={field}/>
      </label>
      {okay && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:secondChance ? 12 : 18 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ ...mn, fontSize:14, fontWeight:700, color:C.onSurface }}>Give it a second chance</div>
              <div style={{ ...mn, fontSize:12, color:C.onSurfaceVariant, lineHeight:1.4, marginTop:2 }}>Cook it once more with one change. If you don't love it, it retires.</div>
            </div>
            <Switch on={secondChance} onClick={() => setSecondChance(v => !v)} label='Give it a second chance'/>
          </div>
          {secondChance && (
            <label style={{ display:'block', marginBottom:18 }}>
              <span style={fieldLabel}>Your one fix</span>
              <input value={fix} onChange={e => setFix(e.target.value)} style={field}/>
            </label>
          )}
        </>
      )}
      <Btn label='Save' full disabled={!canSave} onClick={() => onSave({ comment:comment.trim(), secondChance, fix })}/>
    </Sheet>
  )
}
