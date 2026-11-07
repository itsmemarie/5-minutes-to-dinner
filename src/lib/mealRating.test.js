import { describe, expect, it } from 'vitest'
import { activePatch, canRate, mealDate, nextAte, ratingOutcome, reviewPatch, rotationOf } from './mealRating.js'
import { weekBounds } from './dateHelpers.js'
import { waitingRecipes } from './tryDeck.js'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const chance = { status: 'second_chance', fixNote: 'Less salt', secondChanceSince: '2026-11-04' }

describe('canRate', () => {
  it('allows recipes up to and including today', () => {
    expect(canRate({ recipeId: 'r' }, 'monday', DAYS, 'thursday')).toBe(true)
    expect(canRate({ recipeId: 'r' }, 'thursday', DAYS, 'thursday')).toBe(true)
  })
  it('never allows a day still to come', () => expect(canRate({ recipeId: 'r' }, 'friday', DAYS, 'thursday')).toBe(false))
  it('never allows freezer items', () => expect(canRate({ recipeId: null, freezerItemId: 3 }, 'monday', DAYS, 'thursday')).toBe(false))
  it('follows the week start', () => {
    const fromSunday = ['sunday', ...DAYS.slice(0, 6)]
    expect(canRate({ recipeId: 'r' }, 'sunday', fromSunday, 'monday')).toBe(true)
    expect(canRate({ recipeId: 'r' }, 'sunday', DAYS, 'monday')).toBe(false)
  })
})

describe('ratingOutcome', () => {
  it('Loved after the second chance brings it back', () => expect(ratingOutcome(chance, 'loved', '2026-11-05')).toBe('backInRotation'))
  it('Okay or Bad after the second chance retires it', () => {
    expect(ratingOutcome(chance, 'okay', '2026-11-05')).toBe('retireAfterChance')
    expect(ratingOutcome(chance, 'bad', '2026-11-05')).toBe('retireAfterChance')
  })
  it('the meal that earned the chance, or an earlier one, follows the usual rules', () => {
    expect(ratingOutcome(chance, 'okay', '2026-11-04')).toBe('reviewOkay')
    expect(ratingOutcome(chance, 'loved', '2026-11-03')).toBe('loved')
    expect(ratingOutcome(chance, 'bad', '2026-11-04')).toBe('retire')
  })
  it('an already retired recipe only saves the rating', () => {
    for (const rating of ['loved', 'okay', 'bad']) expect(ratingOutcome({ status: 'retired' }, rating, '2026-11-05')).toBe('alreadyRetired')
  })
  it('active recipes', () => {
    expect(ratingOutcome({ status: 'active' }, 'bad', '2026-11-05')).toBe('retire')
    expect(ratingOutcome({ status: 'active' }, 'okay', '2026-11-05')).toBe('reviewOkay')
    expect(ratingOutcome({ status: 'active' }, 'loved', '2026-11-05')).toBe('loved')
  })
  it('a meal whose recipe has been removed counts as active', () => expect(ratingOutcome(undefined, 'bad', '2026-11-05')).toBe('retire'))
})

describe('mealDate', () => {
  it('counts from the start of the week', () => {
    const week = weekBounds('mon', new Date(2026, 10, 5))
    expect(mealDate(week, 'monday')).toBe('2026-11-02')
    expect(mealDate(week, 'sunday')).toBe('2026-11-08')
  })
})

describe('reviewPatch', () => {
  it('gives a second chance from today, tidying the fix', () => {
    expect(reviewPatch({ status: 'active' }, { secondChance: true, fix: ' Less salt ' }, '2026-11-05'))
      .toEqual({ status: 'second_chance', fixNote: 'Less salt', secondChanceSince: '2026-11-05' })
  })
  it('turning it back off makes the recipe active', () => expect(reviewPatch(chance, { secondChance: false, fix: '' }, '2026-11-05')).toEqual(activePatch))
  it('otherwise leaves the recipe alone', () => expect(reviewPatch({ status: 'active' }, { secondChance: false, fix: '' }, '2026-11-05')).toBeNull())
})

it('the deck leaves out retired recipes', () => {
  const recipe = { id: 'r', tryOut: true, mealTypeId: 'main' }
  expect(waitingRecipes([recipe], [])).toHaveLength(1)
  expect(waitingRecipes([{ ...recipe, status: 'retired' }], [])).toHaveLength(0)
})

it('rotationOf defaults a recipe it can\'t see', () => expect(rotationOf(undefined)).toEqual({ status: 'active', fixNote: null, secondChanceSince: null }))

it('nextAte clears the selected option', () => {
  expect(nextAte('all', 'all')).toBeNull()
  expect(nextAte('all', 'some')).toBe('some')
  expect(nextAte(null, 'none')).toBe('none')
})
