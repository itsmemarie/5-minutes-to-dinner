import { describe, it, expect } from 'vitest'
import { normalisePreferences, migrateLegacyToddlerDob, activeToddlerDob, normaliseChildren } from './preferences.js'
import { normaliseMealSections, enabledSectionIds, dayMeals, emptyDay, ALL_SECTION_IDS, sectionInfo } from './mealSections.js'
import { weekBounds, ageInMonths, formatAge, emptyWeek } from './dateHelpers.js'

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
