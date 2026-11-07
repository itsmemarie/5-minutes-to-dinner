import { describe, expect, it } from 'vitest'
import { LONG_PRESS_MS, MOVE_SLOP, canStartPress, movedTooFar } from './useLongPressDrag.js'

describe('long-press thresholds', () => {
  it('holds for 400 ms and allows 8px of drift', () => {
    expect(LONG_PRESS_MS).toBe(400)
    expect(MOVE_SLOP).toBe(8)
  })
  it('a drift of 8px is still a press', () => {
    expect(movedTooFar(10, 10, 18, 10)).toBe(false)
    expect(movedTooFar(10, 10, 15, 16)).toBe(false)   // 7.8px diagonally
  })
  it('anything further is a scroll', () => {
    expect(movedTooFar(10, 10, 19, 10)).toBe(true)
    expect(movedTooFar(10, 10, 10, 1)).toBe(true)
    expect(movedTooFar(10, 10, 17, 17)).toBe(true)    // 9.9px diagonally
  })
})

describe('canStartPress', () => {
  const on = noDrag => ({ closest: selector => (noDrag && selector === '[data-no-drag]' ? {} : null) })
  it('starts on the row', () => expect(canStartPress(0, on(false))).toBe(true))
  it('ignores chips, menus and the remove button', () => expect(canStartPress(0, on(true))).toBe(false))
  it('ignores right and middle mouse buttons', () => {
    expect(canStartPress(1, on(false))).toBe(false)
    expect(canStartPress(2, on(false))).toBe(false)
  })
  it('accepts a press that reports no button', () => expect(canStartPress(undefined, on(false))).toBe(true))
})
