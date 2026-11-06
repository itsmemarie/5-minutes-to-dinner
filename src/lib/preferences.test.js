import { describe, it, expect } from 'vitest'
import { normalisePreferences, migrateLegacyToddlerDob, activeToddlerDob, normaliseChildren, languageName } from './preferences.js'
import { normaliseMealSections, enabledSectionIds, dayMeals, emptyDay, ALL_SECTION_IDS, sectionInfo } from './mealSections.js'
import { weekBounds, addWeeks, dayDateLabel, weekStripItems, ageInMonths, formatAge, emptyWeek } from './dateHelpers.js'

describe('normaliseMealSections', () => {
  it('returns the shipped defaults for nothing saved', () => {
    const s = normaliseMealSections(null)
    expect(s.map(x => x.id)).toEqual(['breakfast', 'main', 'side', 'lunch', 'dinner', 'dessert', 'drinks'])
    expect(enabledSectionIds(s)).toEqual(['breakfast', 'main', 'side'])
  })
  it('keeps a saved order and appends missing sections disabled', () => {
    const s = normaliseMealSections([{ id: 'main', enabled: true }, { id: 'breakfast', enabled: false }, { id: 'bogus', enabled: true }])
    expect(s.map(x => x.id)).toEqual(['main', 'breakfast', 'side', 'lunch', 'dinner', 'dessert', 'drinks'])
    expect(enabledSectionIds(s)).toEqual(['main'])
  })
  it('never lets every section be off', () => {
    const s = normaliseMealSections(ALL_SECTION_IDS.map(id => ({ id, enabled: false })))
    expect(enabledSectionIds(s)).toEqual(['breakfast'])
  })
  it('drops duplicate ids', () => {
    const s = normaliseMealSections([{ id: 'side', enabled: true }, { id: 'side', enabled: false }])
    expect(s.filter(x => x.id === 'side')).toHaveLength(1)
  })
})

describe('dayMeals', () => {
  const day = { ...emptyDay(), breakfast: [{ id: 'b' }], main: [{ id: 'm' }], dessert: [{ id: 'd' }] }
  it('follows the enabled section order and leaves hidden sections out', () => {
    expect(dayMeals(day, ['main', 'breakfast']).map(m => m.id)).toEqual(['m', 'b'])
  })
  it('defaults to every section', () => {
    expect(dayMeals(day).map(m => m.id)).toEqual(['b', 'm', 'd'])
  })
  it('tolerates a missing day', () => {
    expect(dayMeals(undefined)).toEqual([])
  })
  it('emptyWeek covers every catalogue section for every weekday', () => {
    const w = emptyWeek()
    expect(Object.keys(w)).toHaveLength(7)
    expect(Object.keys(w.monday)).toEqual(ALL_SECTION_IDS)
  })
  it('section catalogue gives the picker a category and a meal type', () => {
    expect(sectionInfo('side')).toMatchObject({ category: 'Sides', mealType: 'side', label: 'Sides & snacks' })
    expect(sectionInfo('drinks').category).toBeNull()
  })
})

describe('normalisePreferences', () => {
  it('fills defaults from nothing', () => {
    const p = normalisePreferences()
    expect(p).toMatchObject({ suggestFromHistory: true, weekStartsOn: 'mon', country: 'GB', recipeUnits: 'metric', measurements: 'weight', toddlerModeEnabled: false, children: [], selectedChildId: null })
    expect(enabledSectionIds(p.mealSections)).toEqual(['breakfast', 'main', 'side'])
  })
  it('rejects bad enum values', () => {
    const p = normalisePreferences({ weekStartsOn: 'someday', country: 'XX', recipeUnits: 'stone', measurements: 'handfuls' })
    expect(p).toMatchObject({ weekStartsOn: 'mon', country: 'GB', recipeUnits: 'metric', measurements: 'weight' })
  })
  it('defaults recipes to English, asking before translating', () => {
    expect(normalisePreferences()).toMatchObject({ recipeLanguage: 'en', recipeTranslate: 'ask' })
  })
  it('keeps a valid recipe language and translate mode, and rejects bad ones', () => {
    expect(normalisePreferences({ recipeLanguage: 'de', recipeTranslate: 'never' })).toMatchObject({ recipeLanguage: 'de', recipeTranslate: 'never' })
    expect(normalisePreferences({ recipeLanguage: 'klingon', recipeTranslate: 'sometimes' })).toMatchObject({ recipeLanguage: 'en', recipeTranslate: 'ask' })
  })
  it('names a language from its code, and falls back to the code', () => {
    expect(languageName('de')).toBe('German')
    expect(languageName('not a code')).toBe('not a code')
  })
  it('repairs a selected child id that no longer exists', () => {
    const p = normalisePreferences({ children: [{ id: 'a', name: 'Mabel', dob: '2024-09-27' }], selectedChildId: 'gone' })
    expect(p.selectedChildId).toBe('a')
  })
  it('drops children without a valid date of birth and names the unnamed', () => {
    expect(normaliseChildren([{ id: 'x', dob: 'nope' }, { id: 'y', dob: '2022-03-14', name: '  ' }])).toEqual([{ id: 'y', name: 'Child 1', dob: '2022-03-14' }])
  })
})

describe('migrateLegacyToddlerDob', () => {
  it('turns a legacy DOB into one selected child with toddler content on', () => {
    const patch = migrateLegacyToddlerDob(normalisePreferences(), '2024-09-27')
    expect(patch.children).toHaveLength(1)
    expect(patch.children[0]).toMatchObject({ name: 'Child 1', dob: '2024-09-27' })
    expect(patch.selectedChildId).toBe(patch.children[0].id)
    expect(patch.toddlerModeEnabled).toBe(true)
  })
  it('does nothing once children exist or without a DOB', () => {
    const withChild = normalisePreferences({ children: [{ id: 'a', name: 'A', dob: '2024-01-01' }] })
    expect(migrateLegacyToddlerDob(withChild, '2024-09-27')).toBeNull()
    expect(migrateLegacyToddlerDob(normalisePreferences(), null)).toBeNull()
  })
})

describe('activeToddlerDob', () => {
  const prefs = normalisePreferences({ toddlerModeEnabled: true, children: [{ id: 'a', name: 'A', dob: '2024-01-01' }, { id: 'b', name: 'B', dob: '2022-01-01' }], selectedChildId: 'b' })
  it('is the selected child while toddler content is on', () => {
    expect(activeToddlerDob(prefs)).toBe('2022-01-01')
  })
  it('is null when toddler content is off', () => {
    expect(activeToddlerDob({ ...prefs, toddlerModeEnabled: false })).toBeNull()
  })
})

describe('weekBounds', () => {
  const wed = new Date(2026, 8, 9, 12) // Wednesday 9 Sep 2026
  it('starts on Monday by default', () => {
    const w = weekBounds('mon', wed)
    expect(w.weekOf).toBe('2026-09-07')
    expect(w.days).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    expect(w.label).toBe('7 Sept – 13 Sept')
  })
  it('rolls back to the most recent chosen weekday', () => {
    expect(weekBounds('sun', wed).weekOf).toBe('2026-09-06')
    expect(weekBounds('wed', wed).weekOf).toBe('2026-09-09')
    expect(weekBounds('thu', wed).weekOf).toBe('2026-09-03')
    expect(weekBounds('sat', wed).days[0]).toBe('saturday')
  })
  it('gives a compact label, spelling out both months only when it has to', () => {
    expect(weekBounds('mon', new Date(2026, 10, 4)).shortLabel).toBe('2–8 Nov')
    expect(weekBounds('mon', new Date(2026, 9, 28)).shortLabel).toBe('26 Oct – 1 Nov')
  })
})

describe('addWeeks', () => {
  it('moves forward and back by whole weeks', () => {
    const wed = new Date(2026, 8, 9, 12)
    expect(addWeeks(wed, 1).getDate()).toBe(16)
    expect(addWeeks(wed, -2).getDate()).toBe(26)
    expect(addWeeks(wed, -2).getMonth()).toBe(7)
  })
  it('does not change the date it was given', () => {
    const wed = new Date(2026, 8, 9, 12)
    addWeeks(wed, 3)
    expect(wed.getDate()).toBe(9)
  })
  it('lands on the same weekday across a clock change', () => {
    // UK clocks go back on 25 Oct 2026 and forward on 28 Mar 2027.
    const monday = new Date(2026, 9, 19)
    expect(weekBounds('mon', addWeeks(monday, 1)).weekOf).toBe('2026-10-26')
    expect(weekBounds('mon', addWeeks(new Date(2027, 2, 22), 1)).weekOf).toBe('2027-03-29')
  })
})

describe('dayDateLabel', () => {
  it('finds the date of a day within the week', () => {
    const week = weekBounds('mon', new Date(2026, 9, 21))
    expect(dayDateLabel(week, 'monday')).toBe('19 Oct')
    expect(dayDateLabel(week, 'sunday')).toBe('25 Oct')
  })
  it('follows the week start', () => {
    expect(dayDateLabel(weekBounds('sun', new Date(2026, 9, 21)), 'sunday')).toBe('18 Oct')
  })
})

describe('weekStripItems', () => {
  const now = new Date(2026, 10, 4, 12) // Wednesday 4 Nov 2026
  const counts = { '2026-10-12': 9, '2026-10-19': 0, '2026-11-02': 2 }

  it('runs from the earliest week with meals to the weeks ahead', () => {
    const items = weekStripItems('mon', counts, { ahead: 2, now })
    expect(items.map(i => i.weekOf)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'])
    expect(items.map(i => i.offset)).toEqual([-3, -2, -1, 0, 1, 2])
  })
  it('includes weeks that were never opened', () => {
    expect(weekStripItems('mon', { '2026-10-12': 1 }, { ahead: 0, now }).map(i => i.weekOf)).toContain('2026-10-26')
  })
  it('marks this week and which weeks have meals', () => {
    const items = weekStripItems('mon', counts, { ahead: 0, now })
    expect(items.filter(i => i.isThisWeek).map(i => i.weekOf)).toEqual(['2026-11-02'])
    expect(items.filter(i => i.hasMeals).map(i => i.weekOf)).toEqual(['2026-10-12', '2026-11-02'])
  })
  it('ignores empty stored weeks when finding where to start', () => {
    expect(weekStripItems('mon', { '2026-05-04': 0, '2026-10-26': 3 }, { ahead: 0, now })[0].weekOf).toBe('2026-10-26')
  })
  it('starts at this week when nothing is planned', () => {
    expect(weekStripItems('mon', {}, { ahead: 1, now }).map(i => i.offset)).toEqual([0, 1])
  })
  it('stops at this week for a future-only plan rather than going past it', () => {
    expect(weekStripItems('mon', { '2026-12-07': 4 }, { ahead: 1, now })[0].offset).toBe(0)
  })
  it('follows a non-Monday week start', () => {
    const items = weekStripItems('sun', { '2026-10-25': 1 }, { ahead: 0, now })
    expect(items.map(i => i.weekOf)).toEqual(['2026-10-25', '2026-11-01'])
  })
  it('crosses a clock change without repeating or skipping a week', () => {
    const items = weekStripItems('mon', { '2026-10-19': 1 }, { ahead: 0, now })
    expect(items.map(i => i.weekOf)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02'])
  })
  it('reaches a stored week that does not line up with the week start', () => {
    // A Monday-keyed plan viewed with a Sunday start: the walk must still stop.
    const items = weekStripItems('sun', { '2026-10-19': 1 }, { ahead: 0, now })
    expect(items[0].weekOf).toBe('2026-10-18')
  })
})

describe('ages', () => {
  const today = new Date(2026, 8, 11)
  it('counts whole months', () => {
    expect(ageInMonths('2024-09-27', today)).toBe(23)
    expect(ageInMonths('2022-03-14', today)).toBe(53)
    expect(ageInMonths('not a date', today)).toBeNull()
  })
  it('formats under-twos in months, older children in years and months', () => {
    expect(formatAge('2024-09-27', today)).toBe('23 months')
    expect(formatAge('2022-03-14', today)).toBe('4 yrs 5 mo')
    expect(formatAge('2022-09-11', today)).toBe('4 yrs')
  })
})
