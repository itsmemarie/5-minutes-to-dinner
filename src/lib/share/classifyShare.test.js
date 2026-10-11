import { describe, expect, it } from 'vitest'
import { normaliseShare, suggestDestination } from './classifyShare.js'
import { handleIncomingShare, onIncomingShare, clearIncomingShare } from './handleIncomingShare.js'

const img = (name = 'p.jpg') => ({ name, type: 'image/jpeg', size: 10 })

describe('normaliseShare', () => {
  it('finds a link Android put in the text field, and keeps the words separate', () => {
    const s = normaliseShare({ title: 'Best dal', text: 'Look at this https://example.com/dal?x=1).' })
    expect(s.kind).toBe('url')
    expect(s.url).toBe('https://example.com/dal?x=1')
    expect(s.text).toBe('Look at this')
  })
  it('prefers photos over a link and drops non-image files', () => {
    const s = normaliseShare({ url: 'https://a.b', files: [img(), { name: 'x.pdf', type: 'application/pdf' }] })
    expect(s.kind).toBe('images')
    expect(s.files).toHaveLength(1)
    expect(s.url).toBe('https://a.b')
  })
  it('treats plain text as text, ignoring a non-http url field', () => {
    const s = normaliseShare({ url: 'javascript:alert(1)', text: 'Chicken\nBeef mince\nLasagne' })
    expect(s.kind).toBe('text')
    expect(s.url).toBeNull()
  })
  it('returns null for an empty share', () => {
    expect(normaliseShare({})).toBeNull()
    expect(normaliseShare(null)).toBeNull()
  })
})

describe('suggestDestination', () => {
  it('sends links and recipe-like text to the recipe form', () => {
    expect(suggestDestination(normaliseShare({ url: 'https://a.b/r' }))).toBe('recipe')
    expect(suggestDestination(normaliseShare({ text: '200g pasta\n1 tbsp oil\nBoil the pasta' }))).toBe('recipe')
  })
  it('sends a list of short lines to the freezer', () => {
    expect(suggestDestination(normaliseShare({ text: 'Chicken curry\nBeef mince\nLasagne' }))).toBe('freezer')
  })
})

describe('handleIncomingShare', () => {
  it('delivers a share that arrived before anyone subscribed, once', () => {
    clearIncomingShare()
    handleIncomingShare({ url: 'https://a.b/r', source: 'android' })
    const seen = []
    const off = onIncomingShare(s => seen.push(s))
    expect(seen).toHaveLength(1)
    expect(seen[0].source).toBe('android')
    clearIncomingShare()
    off()
    const later = []
    onIncomingShare(s => later.push(s))()
    expect(later).toHaveLength(0)
  })
  it('ignores empty payloads', () => {
    expect(handleIncomingShare({ text: '   ' })).toBeNull()
  })
})
