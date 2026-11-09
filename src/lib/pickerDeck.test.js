import { describe, expect, it } from 'vitest'
import {
  NO_PILLS, POOL_PILLS, START, addedCount, addedToast, deckStep, pickerCaption, pickerDeckCards, pillActive, poolTitle, tapPill, waitingInAdd,
} from './pickerDeck.js'

const NOW = new Date('2026-11-09T12:00:00Z')
const r = (id, over = {}) => ({ id, name: id, prep: 10, active: 10, husband: false, createdAt: '2026-01-01T00:00:00Z', savedAt: null, ...over })
const ids = list => list.map(x => x.id)
const pill = (pool, id) => POOL_PILLS[pool].find(p => p.id === id)

// Runs a list of actions, collecting the picker's ticked list the way PickerDeck does.
function run(actions, selected = []) {
  let state = START
  for (const action of actions) {
    const out = deckStep(state, action)
    state = out.state
    if (out.select && !selected.includes(out.select)) selected = [...selected, out.select]
    if (out.unselect) selected = selected.filter(id => id !== out.unselect)
  }
  return { state, selected }
}

describe('picker deck: yes, skip and undo', () => {
  it('ticks a recipe on Yes', () => {
    const { state, selected } = run([{ type: 'yes', id: 'a' }])
    expect(selected).toEqual(['a'])
    expect(addedCount(state)).toBe(1)
  })
  it('only skips on Not now, ticking nothing', () => {
    const { state, selected } = run([{ type: 'skip', id: 'a' }])
    expect(selected).toEqual([])
    expect(state.skipped).toEqual(['a'])
    expect(addedCount(state)).toBe(0)
  })
  it('unticks on Undo after a Yes, and puts the card back on top', () => {
    const { state, selected } = run([{ type: 'yes', id: 'a' }, { type: 'yes', id: 'b' }, { type: 'undo' }], ['x'])
    expect(selected).toEqual(['x', 'a'])
    expect(state.top).toBe('b')
    expect(addedCount(state)).toBe(1)
  })
  it('brings a skipped card back on Undo, leaving the ticks alone', () => {
    const { state, selected } = run([{ type: 'yes', id: 'a' }, { type: 'skip', id: 'b' }, { type: 'undo' }])
    expect(selected).toEqual(['a'])
    expect(state.skipped).toEqual([])
    expect(state.top).toBe('b')
  })
  it('undoes one step at a time, back to the start', () => {
    const { state, selected } = run([{ type: 'yes', id: 'a' }, { type: 'skip', id: 'b' }, { type: 'undo' }, { type: 'undo' }, { type: 'undo' }])
    expect(selected).toEqual([])
    expect(state.skipped).toEqual([])
    expect(state.history).toEqual([])
  })
  it('never unticks a recipe that was ticked before the deck opened', () => {
    const { selected } = run([{ type: 'yes', id: 'a' }, { type: 'undo' }], ['a'])
    expect(selected).toEqual([])   // a Yes on it can't happen: ticked recipes aren't in the deck
    expect(ids(pickerDeckCards([r('a'), r('b')], { selected: ['a'], now: NOW }))).toEqual(['b'])
  })
  it('starts again with nothing skipped', () => {
    expect(run([{ type: 'skip', id: 'a' }, { type: 'restart' }]).state).toEqual(START)
  })
})

describe('picker deck: which cards, in what order', () => {
  const bucket = [r('c', { prep: 30 }), r('a', { husband: true, prep: 5 }), r('b', { savedAt: '2026-11-01T00:00:00Z', prep: 1 })]
  const cards = (opts = {}) => ids(pickerDeckCards(bucket, { now: NOW, ...opts }))

  it("keeps the bucket's own order by default", () => {
    expect(cards()).toEqual(['c', 'a', 'b'])
  })
  it('leaves out ticked and skipped recipes', () => {
    expect(cards({ selected: ['a'], skipped: ['c'] })).toEqual(['b'])
  })
  it('puts a card brought back by Undo on top', () => {
    expect(cards({ top: 'b' })).toEqual(['b', 'c', 'a'])
  })
  it('filters to husband approved, and sorts quickest first', () => {
    let pills = tapPill(NO_PILLS, pill('tested', 'husband'))
    expect(cards({ pills })).toEqual(['a'])
    pills = tapPill(NO_PILLS, pill('tested', 'quickest'))
    expect(cards({ pills })).toEqual(['b', 'a', 'c'])
  })
  it('sorts newest first and filters to the last 30 days', () => {
    expect(cards({ pills: tapPill(NO_PILLS, pill('tryNew', 'newest')) })[0]).toBe('b')
    expect(cards({ pills: tapPill(NO_PILLS, pill('tryNew', 'recent')) })).toEqual(['b'])
  })
  it('turns an order pill off on a second tap, and keeps one order at a time', () => {
    const shuffle = pill('tested', 'shuffle'), quickest = pill('tested', 'quickest')
    let pills = tapPill(NO_PILLS, shuffle)
    expect(pillActive(pills, shuffle)).toBe(true)
    pills = tapPill(pills, quickest)
    expect(pillActive(pills, shuffle)).toBe(false)
    expect(tapPill(pills, quickest).order).toBe(null)
  })
  it('offers no pills on defaults or order out', () => {
    expect(POOL_PILLS.defaults).toEqual([])
    expect(POOL_PILLS.orderOut).toEqual([])
  })
})

describe('picker deck: words', () => {
  it('names each pool', () => {
    expect(poolTitle('defaults', 'tuesday')).toBe('Tuesday defaults')
    expect(['tested', 'tryNew', 'orderOut'].map(p => poolTitle(p, 'tuesday'))).toEqual(['Tested & approved', 'Try something new', 'Order out'])
  })
  it('counts', () => {
    expect(pickerCaption(1)).toBe('1 recipe to look at')
    expect(waitingInAdd(3)).toBe('3 recipes are waiting in Add Selected.')
    expect(waitingInAdd(1)).toBe('1 recipe is waiting in Add Selected.')
    expect(addedToast('tuesday', 2)).toBe('Added to Tuesday · 2 selected')
  })
})
