import { describe, expect, it } from 'vitest'
import { collapsedSubtitle, pickerBuckets } from './pickerBuckets.js'

const r = (id, over = {}) => ({ id, name: id, defaultDays: [], tryOut: false, orderOut: false, ...over })
const ids = list => list.map(x => x.id)
const build = (available, over = {}) => pickerBuckets({ available, otherDayIds: [], day: 'tuesday', section: 'main', ...over })
const byKey = buckets => Object.fromEntries(buckets.map(b => [b.key, ids(b.items)]))

describe('picker buckets', () => {
  it('come in the new order with the new titles', () => {
    const buckets = build([])
    expect(buckets.map(b => b.key)).toEqual(['suggested', 'alreadyWeek', 'defaults', 'tested', 'tryNew', 'orderOut'])
    expect(buckets.map(b => b.title)).toEqual(['Suggested', 'Already planned this week', 'Defaults', 'Tested & approved', 'Try something new', 'Order out'])
  })
  it('never use the old names', () => {
    const titles = build([]).map(b => b.title).join(' ')
    expect(titles).not.toMatch(/Other Meals|Try Out/)
  })
  it('name the day and the section in the defaults subtitle', () => {
    expect(build([], { day: 'friday' })[2].subtitle).toBe('Your usual Friday mains')
    expect(build([], { section: 'side' })[2].subtitle).toBe('Your usual Tuesday sides')
  })
  it('sort each recipe into one bucket with the same precedence as before', () => {
    const recipes = [
      r('planned', { defaultDays: ['tuesday'], tryOut: true }),
      r('default', { defaultDays: ['tuesday'], tryOut: true, orderOut: true }),
      r('otherDay', { defaultDays: ['monday'] }),
      r('try', { tryOut: true }),
      r('order', { orderOut: true, tryOut: true }),
    ]
    expect(byKey(build(recipes, { otherDayIds: ['planned'] }))).toEqual({
      suggested: [], alreadyWeek: ['planned'], defaults: ['default'], tested: ['otherDay'], tryNew: ['try'], orderOut: ['order'],
    })
  })
  it('keep the recipes in the order they came in', () => {
    expect(byKey(build([r('c'), r('a'), r('b')])).tested).toEqual(['c', 'a', 'b'])
  })
  it('pass Suggested through untouched', () => {
    expect(byKey(build([], { suggested: [r('s')] })).suggested).toEqual(['s'])
  })
  it('offer the deck on defaults, tested, try and order out only', () => {
    expect(build([]).filter(b => b.swipe).map(b => b.swipe)).toEqual(['defaults', 'tested', 'tryNew', 'orderOut'])
    expect(build([]).filter(b => b.pick).map(b => b.key)).toEqual(['defaults'])
  })
  it('list the hidden names when collapsed', () => {
    expect(collapsedSubtitle([r('Pasta'), r('Lentil soup')])).toBe('Pasta, Lentil soup')
  })
})
