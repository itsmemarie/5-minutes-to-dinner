import { describe, expect, it } from 'vitest'
import { linkPhotoCredit, linkPhotoMayReplace, normaliseRecipeLink, recipeLinkHost } from './recipeLink.js'

describe('normaliseRecipeLink', () => {
  it('keeps http and https links', () => {
    expect(normaliseRecipeLink('https://www.bbcgoodfood.com/recipes/dal')).toBe('https://www.bbcgoodfood.com/recipes/dal')
    expect(normaliseRecipeLink('http://example.com/dal?x=1#method')).toBe('http://example.com/dal?x=1#method')
  })
  it('trims whitespace around a pasted link', () => {
    expect(normaliseRecipeLink('  https://example.com/dal \n')).toBe('https://example.com/dal')
  })
  it('adds https to a link typed without a scheme', () => {
    expect(normaliseRecipeLink('bbcgoodfood.com/recipes/dal')).toBe('https://bbcgoodfood.com/recipes/dal')
    expect(normaliseRecipeLink('www.example.com')).toBe('https://www.example.com/')
    expect(normaliseRecipeLink('example.com:8080/dal')).toBe('https://example.com:8080/dal')
  })
  it('treats the scheme case-insensitively', () => {
    expect(normaliseRecipeLink('HTTPS://Example.com/Dal')).toBe('https://example.com/Dal')
  })
  it('rejects schemes that are not web links', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'javascript://example.com/%0aalert(1)',
      'data:text/html,<script>alert(1)</script>',
      'ftp://example.com/dal',
      'file:///etc/passwd',
      'mailto:chef@example.com',
    ]) expect(normaliseRecipeLink(bad)).toBeNull()
  })
  it('rejects text that is not a link', () => {
    for (const bad of ['Nana Rose', 'my recipe book', 'notalink', 'https://', 'https://localhost/dal']) {
      expect(normaliseRecipeLink(bad)).toBeNull()
    }
  })
  it('treats blanks and non-strings as no link', () => {
    for (const blank of ['', '   ', null, undefined, 42]) expect(normaliseRecipeLink(blank)).toBeNull()
  })
})

describe('linkPhotoMayReplace', () => {
  it('fills an empty slot and replaces a stock or earlier link photo', () => {
    for (const source of [null, undefined, 'stock', 'import']) expect(linkPhotoMayReplace(source)).toBe(true)
  })
  it("never replaces a photo the user chose", () => {
    for (const source of ['user', 'ai']) expect(linkPhotoMayReplace(source)).toBe(false)
  })
})

describe('linkPhotoCredit', () => {
  it('names the site the photo came from', () => {
    expect(linkPhotoCredit({ from: 'tiktok.com' })).toBe('Photo from tiktok.com')
    expect(linkPhotoCredit({})).toBeNull()
  })
})

describe('recipeLinkHost', () => {
  it('gives the site name without www', () => {
    expect(recipeLinkHost('https://www.bbcgoodfood.com/recipes/dal')).toBe('bbcgoodfood.com')
    expect(recipeLinkHost('https://cooking.nytimes.com/x')).toBe('cooking.nytimes.com')
  })
  it('gives nothing for a value that is not a URL', () => {
    expect(recipeLinkHost('not a url')).toBe('')
    expect(recipeLinkHost(null)).toBe('')
  })
})
