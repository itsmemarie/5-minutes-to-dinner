import { useEffect, useState } from 'react'
import { C, mn } from '../../lib/theme.js'
import { fetchRemovedRecipes, restoreRecipe } from '../../lib/supabase.js'
import { splitRecipeName } from '../../lib/recipeParsing.js'
import { Btn } from '../ui/index.js'
import { Row } from './primitives.jsx'

// Recipes removed from the swipe deck, each with a way back. App's recipe list
// leaves these out, so they're read here, when Settings opens. `onRestored` hands
// a restored recipe back so it reappears without a reload.
export function RemovedRecipes({ onRestored }) {
  const [removed, setRemoved] = useState(null)   // null until loaded
  const [loadFailed, setLoadFailed] = useState(false)
  const [restoringId, setRestoringId] = useState(null)
  const [restoreError, setRestoreError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchRemovedRecipes()
      .then(rows => { if (!cancelled) setRemoved(rows) })
      .catch(e => { if (!cancelled) { console.error('removed recipes failed', e); setLoadFailed(true) } })
    return () => { cancelled = true }
  }, [])

  const restore = async recipe => {
    if (restoringId) return
    setRestoringId(recipe.id); setRestoreError(null)
    try {
      await restoreRecipe(recipe.id)
      setRemoved(list => list.filter(r => r.id !== recipe.id))
      onRestored?.(recipe)
    } catch (e) {
      console.error('restore recipe failed', e)
      setRestoreError(`Couldn't restore ${splitRecipeName(recipe.name).title}. Try again.`)
    } finally {
      setRestoringId(null)
    }
  }

  const sub = loadFailed ? "Couldn't load these just now."
    : removed === null ? 'Loading…'
    : removed.length ? 'Restoring one puts it back in your recipes and the swipe deck.'
    : 'Nothing removed. Recipes you remove in the swipe deck appear here.'

  return (
    <>
      <Row divider title='Removed recipes' sub={sub}/>
      {(removed || []).map(r => (
        <Row key={r.id} divider title={splitRecipeName(r.name).title}>
          <Btn label={restoringId === r.id ? 'Restoring…' : 'Restore'} secondary strong small disabled={!!restoringId} onClick={() => restore(r)}/>
        </Row>
      ))}
      {restoreError && <div role='alert' style={{ ...mn, fontSize:12, color:C.error, lineHeight:1.5, padding:'0 0 12px' }}>{restoreError}</div>}
    </>
  )
}
