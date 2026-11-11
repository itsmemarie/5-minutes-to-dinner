import { useEffect, useRef, useState } from 'react'
import { fetchRecipeRatings, saveOwnRecipeRating } from './supabase.js'
import { ownRatingFields, recipeVerdict, withOwnRow } from './mealRating.js'

// What you last thought of a recipe, and a way to change it from the recipe screen.
// `verdict` is null until the ratings have loaded. `save(change)` shows the change at
// once and writes the recipe's own row; writes run one after another, so the first
// one's new row id is known before the next. A failed write puts the rows back, and
// `save` rejects so the caller can say so.
export function useRecipeRating(recipeId) {
  const [rows, setRows] = useState(null)
  const rowsRef = useRef(null)
  const queue = useRef(Promise.resolve())
  const shownId = useRef(recipeId)
  shownId.current = recipeId
  const set = next => { rowsRef.current = next; setRows(next) }

  useEffect(() => {
    let live = true
    set(null)
    fetchRecipeRatings(recipeId)
      .then(r => { if (live) set(r) })
      .catch(e => { console.error('ratings load failed', e); if (live) set([]) })
    return () => { live = false }
  }, [recipeId])

  const verdict = rows ? recipeVerdict(rows) : null

  const save = change => {
    const forId = recipeId
    // A write that ends after the screen has moved to another recipe leaves it alone.
    const setIfShown = next => { if (shownId.current === forId) set(next) }
    const before = rowsRef.current ?? []
    const shown = recipeVerdict(before)
    const fields = ownRatingFields(shown, change)
    set(withOwnRow(before, { id: shown.own?.id ?? null, plannedMealId: null, ...fields, ratedAt: new Date().toISOString() }))
    const run = queue.current.then(async () => {
      const id = shownId.current === forId ? recipeVerdict(rowsRef.current ?? []).own?.id ?? null : shown.own?.id ?? null
      try {
        const saved = await saveOwnRecipeRating(id, forId, fields)
        setIfShown(withOwnRow(rowsRef.current ?? [], saved))
      } catch (e) {
        console.error('recipe rating save failed', e)
        setIfShown(before)
        throw e
      }
    })
    queue.current = run.catch(() => {})
    return run
  }

  return { verdict, save }
}
