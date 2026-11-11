import { describe, expect, it } from 'vitest'
import {
  DECK_MEAL_TYPES, REMOVE_ON_PASS, SCROLL_ZONE, autoScrollStep, buildDeck, deckCaption, deckName, deckProgressLabel,
  dropSection, emptyTitle, keepPatch, londonClock, orderDeck, passOutcome, passedAgain, pickWeek, pickedMealIds, picksInWeek,
  plannedMealFrom, progressLabel, removePatch, savedLabel, shuffleKey, toBottom, totalMinutes, trayItems, undoPatch,
  waitingLabel, waitingRecipes, yesSheet,
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
  it('ignores an old snooze, so the recipe is back in the pile', () => {
    expect(build([recipe('a', { snoozedUntil: '2026-12-01T00:00:00Z' })])).toEqual(['a'])
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
    expect(ids(waitingRecipes(recipes, []))).toEqual(['a', 'b'])
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

describe('the pile', () => {
  const deck = ['a', 'b', 'c', 'd'].map(id => recipe(id))

  it('sends passed cards to the bottom, oldest pass first', () => {
    expect(ids(toBottom(deck, ['b', 'a']))).toEqual(['c', 'd', 'b', 'a'])
  })
  it('leaves the deck alone when nothing was passed', () => {
    expect(ids(toBottom(deck, []))).toEqual(['a', 'b', 'c', 'd'])
  })
  it('ignores passed ids that are no longer in the deck', () => {
    expect(ids(toBottom(deck, ['x', 'a']))).toEqual(['b', 'c', 'd', 'a'])
  })
  it('moves a card passed again to the very bottom', () => {
    expect(passedAgain(['a', 'b'], 'a')).toEqual(['b', 'a'])
    expect(passedAgain([], 'a')).toEqual(['a'])
  })
  it('applies to both Newest first and Shuffle', () => {
    const recipes = Array.from({ length: 10 }, (_, i) => recipe(`r${i}`, { createdAt: `2026-10-${10 + i}T00:00:00Z` }))
    for (const order of ['newest', 'shuffle']) {
      const plain = ids(buildDeck(recipes, [], { order, seed: 5, now: NOW }))
      const out = ids(buildDeck(recipes, [], { order, seed: 5, passed: [plain[0]], now: NOW }))
      expect(out).toEqual([...plain.slice(1), plain[0]])
    }
  })
  it('brings the only card straight back', () => {
    expect(ids(buildDeck([recipe('a')], [], { passed: ['a'], now: NOW }))).toEqual(['a'])
  })
})

describe('not now', () => {
  it('counts the pass and hides nothing', () => {
    expect(passOutcome(recipe('a', { skipCount: 2 }))).toEqual({ ask: false, patch: { skipCount: 3 } })
  })
  it('treats a recipe that was never passed as a first pass', () => {
    expect(passOutcome(recipe('a', { skipCount: undefined })).patch.skipCount).toBe(1)
  })
  it('offers removal on the 6th pass and writes nothing', () => {
    expect(REMOVE_ON_PASS).toBe(6)
    expect(passOutcome(recipe('a', { skipCount: 4 })).ask).toBe(false)
    expect(passOutcome(recipe('a', { skipCount: 5 }))).toEqual({ ask: true })
  })
  it('keeps a recipe by clearing its passes', () => {
    expect(keepPatch()).toEqual({ skipCount: 0 })
  })
  it('removes a recipe by archiving it', () => {
    expect(removePatch(NOW)).toEqual({ archivedAt: '2026-11-07T12:00:00.000Z' })
  })
  it('undoes by putting back what was there', () => {
    expect(undoPatch(recipe('a', { skipCount: 3 }))).toEqual({ skipCount: 3, archivedAt: null })
    expect(undoPatch(recipe('a'))).toEqual({ skipCount: 0, archivedAt: null })
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
  it('shortens the pill for the deck header', () => {
    expect(deckProgressLabel(1, 2)).toBe('1/2')
    expect(deckProgressLabel(3, 0)).toBe('3 added')
  })
  it('counts what is waiting', () => {
    expect(waitingLabel(112)).toBe('112 try-outs waiting')
    expect(waitingLabel(1)).toBe('1 try-out waiting')
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

describe('the tray', () => {
  const recipes = [recipe('a'), recipe('b')]

  it('holds unscheduled picks from any week, and carries them over', () => {
    const picks = [pick('a', { week_of: '2026-10-05' }), pick('b', { planned_meal_id: 'm1' })]
    expect(trayItems(picks, recipes).map(i => i.recipe.id)).toEqual(['a'])
  })
  it('skips a pick whose recipe is no longer listed', () => {
    expect(trayItems([pick('gone')], recipes)).toEqual([])
  })
  it('marks the meals that came from the deck', () => {
    const marked = pickedMealIds([pick('a'), pick('b', { planned_meal_id: 'm1' })])
    expect([...marked]).toEqual(['m1'])
  })
})

describe('dropSection', () => {
  const main = recipe('a')
  const side = recipe('b', { mealTypeId: 'side' })

  it('puts a main in the main meal', () => {
    expect(dropSection(main, ['breakfast', 'main', 'side'])).toBe('main')
  })
  it('puts a side with the sides', () => {
    expect(dropSection(side, ['breakfast', 'main', 'side'])).toBe('side')
  })
  it('falls back to dinner when the main meal is off', () => {
    expect(dropSection(main, ['breakfast', 'dinner', 'side'])).toBe('dinner')
  })
  it('puts a side in the main meal when sides are off', () => {
    expect(dropSection(side, ['breakfast', 'main'])).toBe('main')
  })
  it('never picks a section that is off', () => {
    expect(dropSection(main, ['breakfast'])).toBe('breakfast')
  })
})

describe('plannedMealFrom', () => {
  it('snapshots the recipe the way adding a meal does', () => {
    const meal = plannedMealFrom(recipe('a', { name: 'Dal', min: 2, base: 6, advancePrepHours: 4, advancePrepNote: 'Soak' }), 'main', 3, 4)
    expect(meal).toEqual({ recipeId: 'a', section: 'main', name: 'Dal', prep: 10, active: 20, min: 2, portion: 4, base: 6, advancePrepHours: 4, advancePrepNote: 'Soak', position: 3 })
  })
})

describe('autoScrollStep', () => {
  const TOP = 60, BOTTOM = 650

  it('stays still in the middle of the list', () => {
    expect(autoScrollStep(300, TOP, BOTTOM)).toBe(0)
  })
  it('leaves the zones exactly at their edges', () => {
    expect(SCROLL_ZONE).toEqual({ top: 50, bottom: 70 })
    expect(autoScrollStep(BOTTOM - 70, TOP, BOTTOM)).toBe(0)
    expect(autoScrollStep(TOP + 50, TOP, BOTTOM)).toBe(0)
  })
  it('scrolls down near the bottom, faster further in', () => {
    const near = autoScrollStep(BOTTOM - 60, TOP, BOTTOM)
    const far = autoScrollStep(BOTTOM - 5, TOP, BOTTOM)
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(near)
  })
  it('scrolls up near the top', () => {
    expect(autoScrollStep(TOP + 10, TOP, BOTTOM)).toBeLessThan(0)
  })
  it('caps the speed past the edge', () => {
    expect(autoScrollStep(BOTTOM + 100, TOP, BOTTOM)).toBe(14)
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
