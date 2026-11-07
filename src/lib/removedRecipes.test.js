import { beforeEach, describe, expect, it, vi } from 'vitest'

// supabase.js throws without these, and the real client must never load here.
const db = vi.hoisted(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test')
  return { calls: [], rows: [], settings: {}, error: null }
})

// A query that records each step, and resolves to the current rows when awaited.
const query = () => {
  const q = {}
  for (const step of ['select', 'in', 'is', 'not', 'order', 'eq']) {
    q[step] = (...args) => { db.calls.push([step, ...args]); return q }
  }
  q.update = patch => { db.calls.push(['update', patch]); return q }
  q.upsert = (row, opts) => { db.calls.push(['upsert', row, opts]); return Promise.resolve({ error: db.error }) }
  q.single = () => Promise.resolve({ data: db.settings, error: db.error })
  q.then = (done, fail) => Promise.resolve({ data: db.error ? null : db.rows, error: db.error }).then(done, fail)
  return q
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: table => { db.calls.push(['from', table]); return query() },
    storage: { from: () => ({ getPublicUrl: path => ({ data: { publicUrl: `https://img/${path}` } }) }) },
  }),
}))

import { fetchRecipes, fetchRemovedRecipes, fetchSettings, restoreRecipe, savePreferences } from './supabase.js'

const row = { id: 'MP-A', name: 'Dal', meal_type_id: 'main', image_path: 'MP-A.jpg' }
const stepsNamed = name => db.calls.filter(c => c[0] === name)

beforeEach(() => {
  db.calls.length = 0
  db.rows = []
  db.settings = {}
  db.error = null
})

describe('fetchRecipes', () => {
  it('leaves removed recipes out', async () => {
    db.rows = [row]
    await expect(fetchRecipes()).resolves.toMatchObject([{ id: 'MP-A', name: 'Dal', cat: 'Mains' }])
    expect(stepsNamed('is')).toEqual([['is', 'archived_at', null]])
  })
})

describe('fetchRemovedRecipes', () => {
  it('reads only removed recipes, latest first, in the same shape as the list', async () => {
    db.rows = [row]
    await expect(fetchRemovedRecipes()).resolves.toMatchObject([{ id: 'MP-A', name: 'Dal', cat: 'Mains', imageUrl: 'https://img/MP-A.jpg' }])
    expect(stepsNamed('not')).toEqual([['not', 'archived_at', 'is', null]])
    expect(stepsNamed('order')).toEqual([['order', 'archived_at', { ascending: false }]])
  })

  it('passes a failed read on', async () => {
    db.error = { message: 'no' }
    await expect(fetchRemovedRecipes()).rejects.toEqual({ message: 'no' })
  })
})

describe('restoreRecipe', () => {
  it('clears archived_at and resets the passes on that recipe alone', async () => {
    await restoreRecipe('MP-A')
    const [[, patch]] = stepsNamed('update')
    expect(patch).toMatchObject({ archived_at: null, skip_count: 0 })
    expect(stepsNamed('eq')).toEqual([['eq', 'id', 'MP-A']])
  })

  it('passes a failed write on', async () => {
    db.error = { message: 'no' }
    await expect(restoreRecipe('MP-A')).rejects.toEqual({ message: 'no' })
  })
})

describe('the weekly try-out target', () => {
  it('saves to its app_settings column', async () => {
    await savePreferences({ tryoutWeeklyTarget: 0 })
    const [[, saved]] = stepsNamed('upsert')
    expect(saved).toMatchObject({ id: 1, tryout_weekly_target: 0 })
  })

  it('reads back from its app_settings column', async () => {
    db.settings = { tryout_weekly_target: 5 }
    const { preferences } = await fetchSettings()
    expect(preferences.tryoutWeeklyTarget).toBe(5)
  })
})
