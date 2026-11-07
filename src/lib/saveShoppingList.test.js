import { beforeEach, describe, expect, it, vi } from 'vitest'

// supabase.js throws without these, and the real client must never load here.
const db = vi.hoisted(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test')
  return { calls: [], old: [], errors: {} }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: () => ({
        select: () => ({
          single: async () => ({ data: db.errors.upsert ? null : { id: 'list-1' }, error: db.errors.upsert ?? null }),
        }),
      }),
      select: () => ({
        eq: async () => ({ data: db.errors.read ? null : db.old, error: db.errors.read ?? null }),
      }),
      insert: async rows => {
        db.calls.push(['insert', rows.map(r => r.name)])
        return { error: db.errors.insert ?? null }
      },
      delete: () => {
        const remove = ids => {
          db.calls.push(['delete', ids])
          return Promise.resolve({ error: db.errors.delete ?? null })
        }
        return { in: (_col, ids) => remove(ids), eq: () => remove('whole list') }
      },
    }),
  }),
}))

import { saveShoppingList } from './supabase.js'

const milk = { name: 'Milk', amount: '1', unit: 'l', aisle: 'DAIRY', checked: false }
const rejected = { message: 'rejected' }

beforeEach(() => {
  db.calls.length = 0
  db.old = [{ id: 'old-1' }, { id: 'old-2' }]
  db.errors = {}
})

describe('saveShoppingList', () => {
  it('puts the new items in before removing the old ones', async () => {
    await expect(saveShoppingList('plan-1', [milk])).resolves.toBe('list-1')
    expect(db.calls).toEqual([['insert', ['Milk']], ['delete', ['old-1', 'old-2']]])
  })

  it('keeps the existing list when the new items are rejected', async () => {
    db.errors.insert = rejected
    await expect(saveShoppingList('plan-1', [milk])).rejects.toBe(rejected)
    expect(db.calls.filter(([op]) => op === 'delete')).toEqual([])
  })

  it('reports a failed delete', async () => {
    db.errors.delete = rejected
    await expect(saveShoppingList('plan-1', [milk])).rejects.toBe(rejected)
  })

  it('stops if the list itself could not be saved', async () => {
    db.errors.upsert = rejected
    await expect(saveShoppingList('plan-1', [milk])).rejects.toBe(rejected)
    expect(db.calls).toEqual([])
  })

  it('touches nothing if the existing items could not be read', async () => {
    db.errors.read = rejected
    await expect(saveShoppingList('plan-1', [milk])).rejects.toBe(rejected)
    expect(db.calls).toEqual([])
  })

  it('empties the list when there is nothing to save', async () => {
    await saveShoppingList('plan-1', [])
    expect(db.calls).toEqual([['delete', ['old-1', 'old-2']]])
  })

  it('has nothing to remove from a new list', async () => {
    db.old = []
    await saveShoppingList('plan-1', [milk])
    expect(db.calls).toEqual([['insert', ['Milk']]])
  })
})
