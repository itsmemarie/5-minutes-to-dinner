import { describe, expect, it } from 'vitest'
import {
  DECK_MEAL_TYPES, REMOVE_ON_PASS, SNOOZE_WEEKS, buildDeck, deckCaption, deckName, emptyTitle, hiddenCount, keepPatch,
  londonClock, orderDeck, passOutcome, pickWeek, picksInWeek, progressLabel, removePatch, savedLabel, shuffleKey,
  snoozeUntil, totalMinutes, undoPatch, waitingRecipes, yesSheet,
} from './tryDeck.js'

const NOW = new Date('2026-11-07T12:00:00Z')
const recipe = (id, over = {}) => ({ id, name: id, tryOut: true, mealTypeId: 'main', createdAt: '2026-05-05T10:00:00Z', savedAt: null, skipCount: 0, snoozedUntil: null, prep: 10, active: 20, ...over })
const pick = (recipe_id, over = {}) => ({ id: `pick-${recipe_id}`, recipe_id, week_of: '2026-11-02', planned_meal_id: null, ...over })
const ids = list => list.map(r => r.id)

describe('who is in the deck', () => {
  const build = (recipes, picks = [], opts = {}) => ids(buildDeck(recipes, picks, { now: NOW, ...opts }))

  it('takes try-out mains by default', () => {
    expect(build([recipe('a'), recipe('b', { tryOut: false }), recipe('c', { mealTypeId: 'side' })])).toEqual(['a'])
  })
  it('switches to sides with the Sides filter', () => {
    expect(build([recipe('a'), recipe('c', { mealTypeId: 'side' })], [], { sides: true })).toEqual(['c'])
  })
  it('keeps the two meal types in one constant', () => {
    expect(DECK_MEAL_TYPES).toEqual({ off: 'main', on: 'side' })
  })
  it('never shows starters or breakfasts', () => {
    const others = [recipe('a', { mealTypeId: 'entree' }), recipe('b', { mealTypeId: 'breakfast' })]
    expect(build(others)).toEqual([])
    expect(build(others, [], { sides: true })).toEqual([])
  })
  it('leaves out archived recipes', () => {
    expect(build([recipe('a', { archivedAt: '2026-11-01T00:00:00Z' })])).toEqual([])
  })
  it('hides a snoozed recipe until its snooze has passed', () => {
    expect(build([recipe('a', { snoozedUntil: '2026-12-01T00:00:00Z' })])).toEqual([])
    expect(build([recipe('a', { snoozedUntil: '2026-11-01T00:00:00Z' })])).toEqual(['a'])
  })
  it('leaves out anything picked in any week, scheduled or not', () => {
    const picks = [pick('a'), pick('b', { week_of: '2026-10-05' }), pick('c', { week_of: '2026-10-05', planned_meal_id: 'm1' })]
    expect(build([recipe('a'), recipe('b'), recipe('c'), recipe('d')], picks)).toEqual(['d'])
  })
  it('keeps recipes with empty ingredients', () => {
    expect(build([recipe('a', { ingredients: '' })])).toEqual(['a'])
  })
  it('counts mains and sides together as waiting', () => {
    const recipes = [recipe('a'), recipe('b', { mealTypeId: 'side' }), recipe('c', { mealTypeId: 'entree' })]
    expect(ids(waitingRecipes(recipes, [], NOW))).toEqual(['a', 'b'])
  })
})

describe('the Last 30 days filter', () => {
  const build = recipes => ids(buildDeck(recipes, [], { recent: true, now: NOW }))

  it('uses the saved date when there is one', () => {
    expect(build([recipe('a', { savedAt: '2026-11-01T00:00:00Z' }), recipe('b', { savedAt: '2026-09-01T00:00:00Z', createdAt: '2026-11-01T00:00:00Z' })])).toEqual(['a'])
  })
  it('falls back to the created date', () => {
    expect(build([recipe('a', { createdAt: '2026-11-01T00:00:00Z' }), recipe('b', { createdAt: '2026-09-01T00:00:00Z' })])).toEqual(['a'])
  })
  it('combines with Sides', () => {
    const recipes = [recipe('a', { createdAt: '2026-11-01T00:00:00Z' }), recipe('b', { createdAt: '2026-11-01T00:00:00Z', mealTypeId: 'side' })]
    expect(ids(buildDeck(recipes, [], { recent: true, sides: true, now: NOW }))).toEqual(['b'])
  })
})

describe('ordering', () => {
  it('sorts newest first on the saved date, then the created date', () => {
    const recipes = [recipe('old'), recipe('saved', { savedAt: '2026-10-01T00:00:00Z' }), recipe('made', { createdAt: '2026-11-01T00:00:00Z' })]
    expect(ids(orderDeck(recipes))).toEqual(['made', 'saved', 'old'])
  })
  it('breaks ties the same way every time for one seed', () => {
    const recipes = Array.from({ length: 30 }, (_, i) => recipe(`r${i}`))
    const first = ids(orderDeck(recipes, { seed: 7 }))
    expect(ids(orderDeck([...recipes].reverse(), { seed: 7 }))).toEqual(first)
  })
  it('breaks ties differently for another seed', () => {
    const recipes = Array.from({ length: 30 }, (_, i) => recipe(`r${i}`))
    expect(ids(orderDeck(recipes, { seed: 7 }))).not.toEqual(ids(orderDeck(recipes, { seed: 8 })))
    expect(ids(orderDeck(recipes, { seed: 7 }))).not.toEqual(ids(recipes))
  })
  it('ignores dates when shuffling, and stays stable', () => {
    const recipes = [recipe('a', { savedAt: '2026-11-01T00:00:00Z' }), ...Array.from({ length: 30 }, (_, i) => recipe(`r${i}`))]
    const one = ids(orderDeck(recipes, { order: 'shuffle', seed: 3 }))
    expect(one[0]).not.toBe('a')
    expect(ids(orderDeck(recipes, { order: 'shuffle', seed: 3 }))).toEqual(one)
  })
  it('makes the shuffle key from the id and seed only', () => {
    expect(shuffleKey('MP-A', 1)).toBe(shuffleKey('MP-A', 1))
    expect(shuffleKey('MP-A', 1)).not.toBe(shuffleKey('MP-B', 1))
  })
})

describe('hiddenCount', () => {
  it('counts snoozed recipes the filters would show', () => {
    const snoozed = { snoozedUntil: '2026-12-01T00:00:00Z' }
    const recipes = [recipe('a', snoozed), recipe('b', snoozed), recipe('c', { ...snoozed, mealTypeId: 'side' }), recipe('d')]
    expect(hiddenCount(recipes, [], { now: NOW })).toBe(2)
    expect(hiddenCount(recipes, [], { sides: true, now: NOW })).toBe(1)
  })
})

describe('not now', () => {
  it('counts the pass and snoozes for 8 weeks', () => {
    const out = passOutcome(recipe('a', { skipCount: 2 }), NOW)
    expect(out.ask).toBe(false)
    expect(out.patch.skipCount).toBe(3)
    expect(SNOOZE_WEEKS).toBe(8)
    expect(new Date(out.patch.snoozedUntil).getTime() - NOW.getTime()).toBe(56 * 24 * 60 * 60 * 1000)
  })
  it('treats a recipe that was never passed as a first pass', () => {
    expect(passOutcome(recipe('a', { skipCount: undefined }), NOW).patch.skipCount).toBe(1)
  })
  it('offers removal on the 4th pass and writes nothing', () => {
    expect(REMOVE_ON_PASS).toBe(4)
    expect(passOutcome(recipe('a', { skipCount: 3 }), NOW)).toEqual({ ask: true })
  })
  it('keeps a recipe by clearing its passes and snoozing it', () => {
    expect(keepPatch(NOW)).toEqual({ skipCount: 0, snoozedUntil: snoozeUntil(NOW) })
  })
  it('removes a recipe by archiving it', () => {
    expect(removePatch(NOW)).toEqual({ archivedAt: '2026-11-07T12:00:00.000Z' })
  })
  it('undoes by putting back what was there', () => {
    expect(undoPatch(recipe('a', { skipCount: 3, snoozedUntil: '2026-01-01T00:00:00Z' }))).toEqual({ skipCount: 3, snoozedUntil: '2026-01-01T00:00:00Z', archivedAt: null })
    expect(undoPatch(recipe('a'))).toEqual({ skipCount: 0, snoozedUntil: null, archivedAt: null })
  })
})

describe('weeks', () => {
  it('reads the wall clock in London, in winter and summer', () => {
    expect(londonClock(new Date('2026-01-15T23:30:00Z')).getHours()).toBe(23)
    const summer = londonClock(new Date('2026-07-15T23:30:00Z'))
    expect([summer.getDate(), summer.getHours()]).toEqual([16, 0])
  })
  it('moves to the next week at midnight in London, not UTC', () => {
    expect(pickWeek('mon', new Date('2026-07-05T22:59:00Z')).weekOf).toBe('2026-06-29')
    expect(pickWeek('mon', new Date('2026-07-05T23:01:00Z')).weekOf).toBe('2026-07-06')
  })
  it('follows the week start setting', () => {
    expect(pickWeek('sun', new Date('2026-11-07T12:00:00Z')).weekOf).toBe('2026-11-01')
    expect(pickWeek('mon', new Date('2026-11-07T12:00:00Z')).weekOf).toBe('2026-11-02')
  })
  it('counts a pick only toward the week it was made', () => {
    const picks = [pick('a', { week_of: '2026-10-26' }), pick('b'), pick('c')]
    expect(picksInWeek(picks, '2026-11-02').length).toBe(2)
  })
})

describe('the words', () => {
  it('strips the code from a name', () => {
    expect(deckName({ name: 'Lemon Dal | MP-LMND' })).toBe('Lemon Dal')
  })
  it('adds prep and cook time', () => {
    expect(totalMinutes({ prep: 10, active: 25 })).toBe(35)
    expect(totalMinutes({})).toBe(0)
  })
  it('shows the saved date, or else the created date', () => {
    expect(savedLabel({ savedAt: '2026-10-03T10:00:00Z', createdAt: '2026-05-05T10:00:00Z' })).toBe('3 Oct')
    expect(savedLabel({ createdAt: '2026-05-05T10:00:00Z' })).toBe('5 May')
  })
  it('writes the progress pill, with and without a goal', () => {
    expect(progressLabel(1, 2)).toBe('1/2 this week')
    expect(progressLabel(3, 0)).toBe('3 this week')
  })
  it('captions the deck', () => {
    expect(deckCaption(84, { sides: false, recent: false })).toBe('84 mains to look at')
    expect(deckCaption(28, { sides: true, recent: false })).toBe('28 sides to look at')
    expect(deckCaption(1, { sides: false, recent: true })).toBe('1 main to look at · saved in the last 30 days')
  })
  it('titles the empty state from the filters', () => {
    expect(emptyTitle({ sides: true, recent: false })).toBe('No more sides for now')
    expect(emptyTitle({ sides: false, recent: true })).toBe('Nothing else from the last 30 days')
    expect(emptyTitle({ sides: true, recent: true })).toBe('No more sides for now')
    expect(emptyTitle({ sides: false, recent: false })).toBe("You've seen everything for now")
  })
})

describe('the sheet after a Yes', () => {
  it('shows progress below the target', () => {
    expect(yesSheet(1, 2)).toEqual({ kind: 'below', title: 'Added! 1 of 2 new recipes this week', segments: { total: 2, done: 1 } })
  })
  it('celebrates reaching the target', () => {
    expect(yesSheet(2, 2)).toEqual({ kind: 'reached', title: "That's your 2 new recipes for this week", segments: { total: 2, done: 2 } })
  })
  it('stays full when going past the target', () => {
    expect(yesSheet(5, 2).kind).toBe('reached')
    expect(yesSheet(5, 2).segments).toEqual({ total: 2, done: 2 })
  })
  it('reads properly for a target of 1', () => {
    expect(yesSheet(1, 1).title).toBe("That's your 1 new recipe for this week")
  })
  it('has no bar when the goal is off', () => {
    expect(yesSheet(3, 0)).toEqual({ kind: 'noGoal', title: 'Added to this week', segments: null })
  })
})
