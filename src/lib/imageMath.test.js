import { describe, expect, it } from 'vitest'
import { MIN_CROP, cropToPixels, fitWithin, isFullFrame, moveCropRect, toGrayscale } from './imageMath.js'

describe('fitWithin', () => {
  it('shrinks the long edge to 1024 and never enlarges', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1024, height: 768 })
    expect(fitWithin(3024, 4032)).toEqual({ width: 768, height: 1024 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('crop', () => {
  it('maps a relative crop to source pixels', () => {
    expect(cropToPixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 4000, 2000)).toEqual({ sx: 1000, sy: 1000, sw: 2000, sh: 500 })
    expect(cropToPixels(null, 100, 50)).toEqual({ sx: 0, sy: 0, sw: 100, sh: 50 })
  })
  it('keeps the box inside the image when moved', () => {
    expect(moveCropRect({ x: 0.5, y: 0.5, w: 0.4, h: 0.4 }, 'move', 0.5, -1)).toEqual({ x: 0.6, y: 0, w: 0.4, h: 0.4 })
  })
  it('resizes from a corner without inverting or shrinking past the minimum', () => {
    const r = moveCropRect({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'nw', 0.9, 0.9)
    expect(r.w).toBeCloseTo(MIN_CROP)
    expect(r.h).toBeCloseTo(MIN_CROP)
    expect(r.x + r.w).toBeCloseTo(0.7)
    const grown = moveCropRect({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'se', 1, 1)
    expect(grown.x + grown.w).toBe(1)
    expect(grown.y + grown.h).toBe(1)
  })
  it('knows a whole-photo crop', () => {
    expect(isFullFrame(null)).toBe(true)
    expect(isFullFrame({ x: 0, y: 0, w: 1, h: 1 })).toBe(true)
    expect(isFullFrame({ x: 0.1, y: 0, w: 0.9, h: 1 })).toBe(false)
  })
})

describe('toGrayscale', () => {
  it('sets r=g=b to the luminance and leaves alpha', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 200, 0, 255, 0, 255])
    toGrayscale(px)
    expect([...px]).toEqual([76, 76, 76, 200, 150, 150, 150, 255])
  })
})
