import { describe, it, expect } from 'vitest'
import {
  snapshotWeek, weekMealRows, defaultWeekName, mealsByDay, savedRecipeIds, buildFill, fillNotice,
  SAVED_WEEK_NAME_MAX, findSavedByName, uniqueSavedName, checkSavedName, savedWeekSummary, savedWeekPreview,
  withMealIds, savedDayMeals, moveSavedMeal, removeSavedMeal, setSavedMealPortion, addSavedMeals,
} from './savedWeeks.js'
import { emptyWeek, weekBounds } from './dateHelpers.js'

const DAYS = weekBounds('mon', new Date(2026, 10, 4)).days
const ON = ['breakfast', 'main', 'side']

const meal = (over = {}) => ({ id: 'p1', recipeId: 'r1', freezerItemId: null, section: 'main', name: 'Fish pie', prep: 20, active: 40, min: 1, portion: 4, base: 4, advancePrepHours: null, advancePrepNote: null, ...over })
const planWith = (...entries) => {
  const plan = emptyWeek()
  entries.forEach(([day, m]) => plan[day][m.section].push(m))
  return plan
}
const saved = (...meals) => ({ id: 's1', name: 'Busy week', meals })
const savedMeal = (over = {}) => ({ day: 'tuesday', section: 'main', recipeId: 'r1', freezerItemId: null, name: 'Fish pie', prep: 20, active: 40, portion: 3, base: 4, advancePrepHours: null, advancePrepNote: null, ...over })
const ctx = (over = {}) => ({ plan: emptyWeek(), days: DAYS, sectionIds: ON, recipes: [], freezerItems: [], existingRecipeIds: new Set(['r1', 'r2']), defPort: 4, ...over })

describe('snapshotWeek', () => {
  it('stores each meal by weekday, in week order', () => {
    const plan = planWith(['friday', meal({ id: 'a', name: 'Later' })], ['monday', meal({ id: 'b', name: 'First' })])
    expect(snapshotWeek(plan, DAYS, ON).map(m => [m.day, m.name])).toEqual([['monday', 'First'], ['friday', 'Later']])
  })
  it('keeps the servings you set but not the planned meal id', () => {
    const [m] = snapshotWeek(planWith(['monday', meal({ portion: 7 })]), DAYS, ON)
    expect(m.portion).toBe(7)
    expect(m).not.toHaveProperty('id')
  })
  it('leaves out meals in a section that is turned off', () => {
    const plan = planWith(['monday', meal({ id: 'a', section: 'main' })], ['monday', meal({ id: 'b', section: 'dessert' })])
    expect(snapshotWeek(plan, DAYS, ON).map(m => m.section)).toEqual(['main'])
  })
  it('keeps a name-only meal', () => {
    const [m] = snapshotWeek(planWith(['monday', meal({ recipeId: null })]), DAYS, ON)
    expect(m).toMatchObject({ recipeId: null, name: 'Fish pie' })
  })
})

describe('weekMealRows', () => {
  const entries = Object.fromEntries(DAYS.map(d => [d, `entry-${d}`]))
  it('keeps each meal in its place, on its own day entry', () => {
    const rows = weekMealRows(planWith(['monday', meal({ id:'a' })], ['monday', meal({ id:'b' })], ['friday', meal({ id:'c', section:'side' })]), DAYS, entries)
    expect(rows.map(r => [r.id, r.dayEntryId, r.section, r.position])).toEqual([
      ['a', 'entry-monday', 'main', 0], ['b', 'entry-monday', 'main', 1], ['c', 'entry-friday', 'side', 0],
    ])
  })
  it('includes sections that are turned off, as a clear removes those too', () => {
    expect(weekMealRows(planWith(['tuesday', meal({ section:'dessert' })]), DAYS, entries).map(r => r.section)).toEqual(['dessert'])
  })
  it('is empty for an empty week', () => {
    expect(weekMealRows(emptyWeek(), DAYS, entries)).toEqual([])
  })
})

describe('defaultWeekName', () => {
  it('names the week after its first day', () => {
    expect(defaultWeekName(weekBounds('mon', new Date(2026, 9, 14)))).toBe('Week of 12 Oct')
  })
})

describe('mealsByDay', () => {
  it('follows the given day order and skips empty days', () => {
    const s = saved(savedMeal({ day: 'sunday', name: 'B' }), savedMeal({ day: 'monday', name: 'A' }))
    const sundayFirst = weekBounds('sun', new Date(2026, 10, 4)).days
    expect(mealsByDay(s, sundayFirst).map(d => d.day)).toEqual(['sunday', 'monday'])
  })
})

describe('savedRecipeIds', () => {
  it('lists each recipe once and ignores name-only meals', () => {
    expect(savedRecipeIds(saved(savedMeal(), savedMeal(), savedMeal({ recipeId: 'r2' }), savedMeal({ recipeId: null })))).toEqual(['r1', 'r2'])
  })
})

describe('buildFill', () => {
  it('puts each meal on its saved weekday with its saved servings', () => {
    const { meals } = buildFill(saved(savedMeal({ portion: 3 })), ctx())
    expect(meals).toHaveLength(1)
    expect(meals[0]).toMatchObject({ day: 'tuesday', section: 'main', recipeId: 'r1', portion: 3, position: 0 })
  })

  it('keeps the weekday when the week starts on a different day', () => {
    const sundayFirst = weekBounds('sun', new Date(2026, 10, 4)).days
    const { meals } = buildFill(saved(savedMeal({ day: 'tuesday' })), ctx({ days: sundayFirst }))
    expect(meals[0].day).toBe('tuesday')
  })

  it('picks up the current details of a recipe that has changed', () => {
    const recipes = [{ id: 'r1', name: 'Fish pie with leeks', prep: 15, active: 30, base: 6, advancePrepHours: 2, advancePrepNote: 'Chill' }]
    const { meals } = buildFill(saved(savedMeal()), ctx({ recipes }))
    expect(meals[0]).toMatchObject({ name: 'Fish pie with leeks', prep: 15, active: 30, base: 6, advancePrepHours: 2, advancePrepNote: 'Chill', portion: 3 })
  })

  it('falls back to the saved details when the recipe is not in the loaded list', () => {
    // fetchRecipes leaves some recipes out, so "not loaded" isn't "deleted".
    const { meals } = buildFill(saved(savedMeal()), ctx({ recipes: [] }))
    expect(meals[0]).toMatchObject({ recipeId: 'r1', name: 'Fish pie', prep: 20, active: 40, base: 4 })
  })

  it('keeps a deleted recipe as a name-only meal rather than failing the insert', () => {
    const { meals } = buildFill(saved(savedMeal({ recipeId: 'gone', name: 'Old favourite' })), ctx())
    expect(meals[0]).toMatchObject({ recipeId: null, name: 'Old favourite' })
  })

  it('never falls back to a missing name, and fills in missing portions', () => {
    const { meals } = buildFill(saved(savedMeal({ recipeId: null, portion: undefined, base: undefined })), ctx({ defPort: 5 }))
    expect(meals[0]).toMatchObject({ name: 'Fish pie', portion: 5, base: 5 })
  })

  describe('adding', () => {
    it('keeps the week and carries on after its meals', () => {
      const plan = planWith(['tuesday', meal({ id: 'a' })], ['tuesday', meal({ id: 'b' })])
      const out = buildFill(saved(savedMeal(), savedMeal()), ctx({ plan, mode: 'add' }))
      expect(out.replacedIds).toEqual([])
      expect(out.meals.map(m => m.position)).toEqual([2, 3])
    })
    it('counts positions per day and section', () => {
      const out = buildFill(saved(savedMeal(), savedMeal({ day: 'friday' }), savedMeal({ section: 'side' }), savedMeal()), ctx())
      expect(out.meals.map(m => [m.day, m.section, m.position])).toEqual([
        ['tuesday', 'main', 0], ['friday', 'main', 0], ['tuesday', 'side', 0], ['tuesday', 'main', 1],
      ])
    })
  })

  describe('replacing', () => {
    it('removes the meals you can see and starts positions again', () => {
      const plan = planWith(['tuesday', meal({ id: 'a' })], ['friday', meal({ id: 'b', section: 'side' })])
      const out = buildFill(saved(savedMeal()), ctx({ plan, mode: 'replace' }))
      expect(out.replacedIds).toEqual(['a', 'b'])
      expect(out.meals[0].position).toBe(0)
    })
    it('keeps meals in a section that is turned off', () => {
      const plan = planWith(['tuesday', meal({ id: 'seen' })], ['tuesday', meal({ id: 'hidden', section: 'dessert' })])
      expect(buildFill(saved(), ctx({ plan, mode: 'replace' })).replacedIds).toEqual(['seen'])
    })
    it('goes after a hidden meal that stays, rather than on top of it', () => {
      const plan = planWith(['tuesday', meal({ id: 'hidden', section: 'dessert' })])
      const out = buildFill(saved(savedMeal({ section: 'dessert' })), ctx({ plan, mode: 'replace' }))
      expect(out.meals[0].position).toBe(1)
    })
    it('only touches the given days', () => {
      const out = buildFill(saved(savedMeal({ day: 'someday' })), ctx())
      expect(out.meals).toEqual([])
    })
  })

  describe('freezer meals', () => {
    const frozen = over => savedMeal({ recipeId: null, freezerItemId: 9, name: 'Chilli', ...over })

    it('plans an item that is in stock and marks it as taken', () => {
      const out = buildFill(saved(frozen()), ctx({ freezerItems: [{ id: 9, name: 'Chilli', in_stock: true }] }))
      expect(out.meals[0]).toMatchObject({ freezerItemId: 9, recipeId: null })
      expect(out.takenFreezerIds).toEqual([9])
      expect(out.skipped).toEqual([])
    })
    it('skips an item that is out of stock', () => {
      const out = buildFill(saved(frozen()), ctx({ freezerItems: [{ id: 9, name: 'Chilli', in_stock: false }] }))
      expect(out.meals).toEqual([])
      expect(out.skipped).toEqual(['Chilli'])
      expect(out.takenFreezerIds).toEqual([])
    })
    it('skips an item that has been removed from the freezer list', () => {
      expect(buildFill(saved(frozen()), ctx()).skipped).toEqual(['Chilli'])
    })
    it('uses one item only once', () => {
      const out = buildFill(saved(frozen(), frozen({ day: 'friday' })), ctx({ freezerItems: [{ id: 9, name: 'Chilli', in_stock: true }] }))
      expect(out.meals).toHaveLength(1)
      expect(out.skipped).toEqual(['Chilli'])
    })
    it('lets a replace reuse the item it is putting back', () => {
      const plan = planWith(['monday', meal({ id: 'a', recipeId: null, freezerItemId: 9, section: 'main' })])
      const out = buildFill(saved(frozen()), ctx({ plan, mode: 'replace', freezerItems: [{ id: 9, name: 'Chilli', in_stock: false }] }))
      expect(out.releasedFreezerIds).toEqual([9])
      expect(out.takenFreezerIds).toEqual([9])
      expect(out.skipped).toEqual([])
    })
    it('does not release anything when adding', () => {
      const plan = planWith(['monday', meal({ id: 'a', recipeId: null, freezerItemId: 9 })])
      const out = buildFill(saved(), ctx({ plan, mode: 'add', freezerItems: [{ id: 9, in_stock: false }] }))
      expect(out.releasedFreezerIds).toEqual([])
    })
  })

  it('counts meals going into a section that is turned off', () => {
    const out = buildFill(saved(savedMeal({ section: 'dessert' }), savedMeal()), ctx())
    expect(out.meals).toHaveLength(2)
    expect(out.hiddenCount).toBe(1)
  })
})

describe('fillNotice', () => {
  it('stays quiet when there is nothing to report', () => {
    expect(fillNotice({ skipped: [], hiddenCount: 0 })).toBeNull()
  })
  it('names skipped meals and counts hidden ones', () => {
    const text = fillNotice({ skipped: ['Chilli', 'Soup'], hiddenCount: 2 })
    expect(text).toContain('Chilli, Soup')
    expect(text).toContain('2 meals are')
  })
  it('reads correctly for one hidden meal', () => {
    expect(fillNotice({ skipped: [], hiddenCount: 1 })).toContain("1 meal is in a meal section that's turned off, so it won't")
  })
})

describe('saved week names', () => {
  const all = [{ id: 'a', name: 'Busy week' }, { id: 'b', name: 'Busy week (2)' }, { id: 'c', name: 'Roast' }]

  it('finds a name ignoring case and repeated spaces', () => {
    expect(findSavedByName(all, '  busy   WEEK ')?.id).toBe('a')
    expect(findSavedByName(all, 'Quiet week')).toBeNull()
  })
  it('lets a saved week keep its own name', () => {
    expect(findSavedByName(all, 'Roast', 'c')).toBeNull()
    expect(checkSavedName('Roast', all, 'c').clash).toBeNull()
  })
  it('numbers a copy past the ones already taken', () => {
    expect(uniqueSavedName('Busy week', all)).toBe('Busy week (3)')
    expect(uniqueSavedName('Busy week (2)', all)).toBe('Busy week (3)')
    expect(uniqueSavedName('Quiet week', all)).toBe('Quiet week')
    expect(uniqueSavedName('   ', [])).toBe('Saved week')
  })
  it('keeps a numbered copy within the length limit', () => {
    const long = 'x'.repeat(SAVED_WEEK_NAME_MAX)
    const copy = uniqueSavedName(long, [{ id: 'a', name: long }])
    expect(copy).toHaveLength(SAVED_WEEK_NAME_MAX)
    expect(copy.endsWith(' (2)')).toBe(true)
  })
  it('rejects an empty or overlong name and reports a clash', () => {
    expect(checkSavedName('  ', all).error).toBe('Give it a name.')
    expect(checkSavedName('y'.repeat(SAVED_WEEK_NAME_MAX + 1), all).error).toContain('under 60')
    const check = checkSavedName(' roast ', all)
    expect(check).toMatchObject({ name: 'roast', error: null })
    expect(check.clash.id).toBe('c')
  })
})

describe('savedWeekSummary and savedWeekPreview', () => {
  const week = saved(
    savedMeal({ day: 'wednesday', section: 'main', name: 'Curry' }),
    savedMeal({ day: 'monday', section: 'side', name: 'Rice' }),
    savedMeal({ day: 'monday', section: 'main', name: 'Pie' }),
    savedMeal({ day: 'friday', section: 'main', name: 'Pizza' }),
    savedMeal({ day: 'saturday', section: 'dinner', name: 'Tacos' }),
  )
  it('counts meals and the days they fall on', () => {
    expect(savedWeekSummary(week)).toBe('5 meals · 4 days')
    expect(savedWeekSummary(saved(savedMeal()))).toBe('1 meal · 1 day')
    expect(savedWeekSummary(saved())).toBe('No meals yet')
  })
  it('previews the mains in day order', () => {
    expect(savedWeekPreview(week, DAYS)).toBe('Pie, Curry, Pizza…')
    expect(savedWeekPreview(week, DAYS, 5)).toBe('Pie, Curry, Pizza, Tacos')
  })
  it('falls back to any meal when there are no mains', () => {
    expect(savedWeekPreview(saved(savedMeal({ section: 'side', name: 'Rice' })), DAYS)).toBe('Rice')
  })
})

describe('editing a saved week', () => {
  let n = 0
  const makeId = () => `new${++n}`
  const meals = withMealIds([
    savedMeal({ id: 'm1', day: 'monday', section: 'side', name: 'Rice' }),
    savedMeal({ id: 'm2', day: 'monday', section: 'main', name: 'Pie', portion: 3 }),
    savedMeal({ id: 'm3', day: 'tuesday', section: 'main', name: 'Curry' }),
    savedMeal({ id: 'm4', day: 'monday', section: 'main', name: 'Soup' }),
  ])

  it('gives meals saved without an id one, and keeps the ids already there', () => {
    const got = withMealIds([savedMeal(), savedMeal({ id: 'keep' })], () => 'fresh')
    expect(got.map(m => m.id)).toEqual(['fresh', 'keep'])
    expect(withMealIds(null)).toEqual([])
  })
  it('makes ids that differ by default', () => {
    const [a, b] = withMealIds([savedMeal(), savedMeal()])
    expect(a.id).toBeTruthy()
    expect(a.id).not.toBe(b.id)
  })
  it('lists a day in meal-section order, then the order meals were added', () => {
    expect(savedDayMeals(meals, 'monday', ['breakfast', 'main', 'side']).map(m => m.name)).toEqual(['Pie', 'Soup', 'Rice'])
    expect(savedDayMeals(meals, 'sunday')).toEqual([])
  })
  it('puts a section not in the order last', () => {
    expect(savedDayMeals(meals, 'monday', ['side']).map(m => m.name)).toEqual(['Rice', 'Pie', 'Soup'])
  })
  it('moves a meal to another day, at the end of its section', () => {
    const moved = moveSavedMeal(meals, 'm2', 'tuesday')
    expect(moved.find(m => m.id === 'm2').day).toBe('tuesday')
    expect(savedDayMeals(moved, 'tuesday').map(m => m.name)).toEqual(['Curry', 'Pie'])
    expect(moved).toHaveLength(4)
  })
  it('leaves the list alone for the same day or an unknown meal', () => {
    expect(moveSavedMeal(meals, 'm2', 'monday')).toBe(meals)
    expect(moveSavedMeal(meals, 'nope', 'friday')).toBe(meals)
  })
  it('takes out only the meal asked for', () => {
    expect(removeSavedMeal(meals, 'm2').map(m => m.id)).toEqual(['m1', 'm3', 'm4'])
  })
  it('changes servings, rounded and never below the minimum', () => {
    expect(setSavedMealPortion(meals, 'm2', 5).find(m => m.id === 'm2').portion).toBe(5)
    expect(setSavedMealPortion(meals, 'm2', 0, 2).find(m => m.id === 'm2').portion).toBe(2)
    expect(setSavedMealPortion(meals, 'm2', 3.6).find(m => m.id === 'm2').portion).toBe(4)
    expect(setSavedMealPortion(meals, 'm2', 6).find(m => m.id === 'm1').portion).toBe(3)
  })
  it('adds recipes with the default servings, or the recipe minimum if higher', () => {
    const recipes = [
      { id: 'r9', name: 'Tacos', prep: 10, active: 15, min: 1, base: 4, advancePrepHours: 2, advancePrepNote: 'Marinate' },
      { id: 'r8', name: 'Lasagne', min: 6 },
    ]
    const added = addSavedMeals(meals, { day: 'friday', section: 'dinner', recipes, defPort: 4 }, makeId).slice(4)
    expect(added).toEqual([
      { id: 'new1', day: 'friday', section: 'dinner', recipeId: 'r9', freezerItemId: null, name: 'Tacos', prep: 10, active: 15, portion: 4, base: 4, advancePrepHours: 2, advancePrepNote: 'Marinate' },
      { id: 'new2', day: 'friday', section: 'dinner', recipeId: 'r8', freezerItemId: null, name: 'Lasagne', prep: 0, active: 0, portion: 6, base: null, advancePrepHours: null, advancePrepNote: null },
    ])
  })
  it('fills a week from edited meals without carrying their ids', () => {
    const { meals: planned } = buildFill(saved(...meals), ctx({ existingRecipeIds: new Set(['r1']) }))
    expect(planned).toHaveLength(4)
    planned.forEach(m => expect(m).not.toHaveProperty('id'))
  })
})
