import { describe, expect, it } from 'vitest'
import { reelPlatform } from './reels.js'

describe('reelPlatform', () => {
  it('recognises Instagram links', () => {
    expect(reelPlatform('https://www.instagram.com/reel/Cs7MUHIJW7w/')).toBe('instagram')
    expect(reelPlatform('https://instagram.com/p/abc')).toBe('instagram')
    expect(reelPlatform('http://instagr.am/p/abc')).toBe('instagram')
  })
  it('recognises TikTok links, including short ones', () => {
    expect(reelPlatform('https://www.tiktok.com/@cook/video/123')).toBe('tiktok')
    expect(reelPlatform('https://vm.tiktok.com/ZMabc/')).toBe('tiktok')
  })
  it('ignores ordinary recipe links', () => {
    expect(reelPlatform('https://www.bbcgoodfood.com/recipes/dal')).toBe(null)
  })
  it('is not fooled by a lookalike host or path', () => {
    expect(reelPlatform('https://notinstagram.com/p/abc')).toBe(null)
    expect(reelPlatform('https://tiktok.com.evil.example/video/1')).toBe(null)
    expect(reelPlatform('https://example.com/instagram.com/p/abc')).toBe(null)
  })
  it('copes with nothing', () => {
    expect(reelPlatform(null)).toBe(null)
    expect(reelPlatform(undefined)).toBe(null)
  })
})
