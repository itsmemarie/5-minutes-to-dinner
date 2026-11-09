import { describe, expect, it } from 'vitest'
import {
  NO_PILLS, POOL_PILLS, START, addedCount, addedToast, deckStep, pickerCaption, pickerDeckCards, pillActive, poolTitle, tapPill, waitingInAdd, defaultsDeckItems, placeholderMembers,
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
    expect(poolTitle('defaults')).toBe('Defaults')
    expect(['tested', 'tryNew', 'orderOut'].map(p => poolTitle(p, 'tuesday'))).toEqual(['Tested & approved', 'Try something new', 'Order out'])
  })
  it('counts', () => {
    expect(pickerCaption(1)).toBe('1 recipe to look at')
    expect(waitingInAdd(3)).toBe('3 recipes are waiting in Add Selected.')
    expect(waitingInAdd(1)).toBe('1 recipe is waiting in Add Selected.')
    expect(addedToast('tuesday', 2)).toBe('Added to Tuesday · 2 selected')
  })
})

describe('picker deck: defaults swap placeholders for real recipes', () => {
  const ph = (id, name) => r(id, { name, placeholder: true })
  const real = (id, name) => r(id, { name })
  // Names from the live recipes, 2026-11-09.
  const pool = [
    real('p1', 'Butternut Pasta'), real('p2', 'One-Pan Orzo with Spinach & Parmesan'), real('p3', "Penne all'Arrabbiata"),
    real('p4', 'Antipasto Tortellini Pasta Salad'), real('p5', 'Vegetarian Lentil Lasagna'),
    real('g1', 'Sweet Potato Gnocchi'),
    real('l1', 'Warm Lentil Walnut Feta Salad'), real('l2', 'Red Lentil Soup'), real('l3', 'One-Pot Thai Red Curry Lentil Soup'), real('l4', 'Lentil Moussaka'),
    real('b1', 'Buddha Bowl with Peanut Dressing'), real('b2', 'Roasted Chickpea & Avocado Power Bowl'),
    real('q1', 'Courgette Quiche'),
    real('v1', 'Rainbow Platter with Herbed Fritters'), real('v2', 'Creamy & Crunchy Platter'),
    real('x1', 'Jacket Potato'), real('x2', 'Antipasti Board'),
    ph('fp', 'Fruit Platter'),
  ]
  const members = name => ids(placeholderMembers(ph('ph', name), pool))

  it('finds the recipes named after a one-word placeholder, synonyms included', () => {
    expect(members('Pasta')).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(members('Gnocchi')).toEqual(['g1'])
    expect(members('Quiche')).toEqual(['q1'])
  })
  it('needs every word when some recipe has them all', () => {
    expect(members('Lentil Salad')).toEqual(['l1'])
    expect(members('Lentil Soup')).toEqual(['l2', 'l3'])
  })
  it('falls back to the last word when no recipe has them all', () => {
    expect(members('Poke Bowl')).toEqual(['b1', 'b2'])
    expect(members('Vegetable Charcuterie Board')).toEqual(['v1', 'v2', 'x2'])
  })
  it('never offers another placeholder', () => {
    expect(members('Platter')).toEqual(['v1', 'v2', 'x2'])
  })
  it('builds the deck in the bucket order, placeholders swapped out, no repeats', () => {
    const defaults = [real('x1', 'Jacket Potato'), ph('pp', 'Pasta'), ph('pl', 'Lentil Soup'), real('p1', 'Butternut Pasta')]
    expect(ids(defaultsDeckItems(defaults, pool))).toEqual(['x1', 'p1', 'p2', 'p3', 'p4', 'p5', 'l2', 'l3'])
  })
  it('drops a placeholder nothing matches', () => {
    expect(ids(defaultsDeckItems([ph('z', 'Zzz Casserole')], pool))).toEqual([])
  })
})
