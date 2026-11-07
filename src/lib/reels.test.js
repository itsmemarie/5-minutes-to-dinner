import { describe, expect, it } from 'vitest'
import { isDeadInstagramPost, isDeadTikTokMessage, reelEmbed, reelPlatform } from './reels.js'

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

describe('reelEmbed', () => {
  it('embeds an Instagram post or reel by its code', () => {
    const embed = reelEmbed('https://www.instagram.com/reel/Cs7MUHIJW7w/?igsh=abc')
    expect(embed.platform).toBe('instagram')
    expect(embed.src).toBe('https://www.instagram.com/p/Cs7MUHIJW7w/embed/')
    expect(embed.checkUrl).toContain('graph.facebook.com/instagram_oembed')
    expect(decodeURIComponent(embed.checkUrl)).toContain('url=https://www.instagram.com/p/Cs7MUHIJW7w/')
    expect(reelEmbed('https://www.instagram.com/someone/reel/Cs7MUHIJW7w/').src).toBe('https://www.instagram.com/p/Cs7MUHIJW7w/embed/')
  })
  it('embeds a TikTok video by its id, with no check', () => {
    expect(reelEmbed('https://www.tiktok.com/@cook/video/7448169436764212510?lang=en')).toEqual({ platform: 'tiktok', src: 'https://www.tiktok.com/player/v1/7448169436764212510?autoplay=1' })
  })
  it('has nothing to embed from a short link or a profile', () => {
    expect(reelEmbed('https://vm.tiktok.com/ZMabc/')).toBe(null)
    expect(reelEmbed('https://www.instagram.com/share/BAabc123')).toBe(null)
    expect(reelEmbed('https://www.instagram.com/someone/')).toBe(null)
  })
  it('has nothing to embed from an ordinary link', () => {
    expect(reelEmbed('https://www.bbcgoodfood.com/recipes/dal')).toBe(null)
    expect(reelEmbed(null)).toBe(null)
  })
})

describe('spotting a dead reel', () => {
  it('reads Instagram saying the post is gone', () => {
    expect(isDeadInstagramPost(400, { error: { code: 24 } })).toBe(true)
  })
  it('does not blame the post for any other failure', () => {
    expect(isDeadInstagramPost(200, {})).toBe(false)
    expect(isDeadInstagramPost(429, { error: { code: 4 } })).toBe(false)
    expect(isDeadInstagramPost(500, null)).toBe(false)
  })
  it('reads the TikTok player saying the video is gone', () => {
    expect(isDeadTikTokMessage({ type: 'onPlayerError', value: { errorCode: 1001, errorType: 'INVALID_VIDEO' }, 'x-tiktok-player': true })).toBe(true)
    expect(isDeadTikTokMessage({ type: 'onPlayerError', value: { errorCode: 2001 }, 'x-tiktok-player': true })).toBe(true)
  })
  it('leaves the player up for passing errors', () => {
    expect(isDeadTikTokMessage({ type: 'onPlayerError', value: { errorCode: 3001 }, 'x-tiktok-player': true })).toBe(false)
    expect(isDeadTikTokMessage({ type: 'onPlayerError', value: { errorCode: 3002 }, 'x-tiktok-player': true })).toBe(false)
  })
  it('ignores everything else the page might post', () => {
    expect(isDeadTikTokMessage({ type: 'onPlayerReady', 'x-tiktok-player': true })).toBe(false)
    expect(isDeadTikTokMessage({ type: 'onPlayerError', value: { errorCode: 1001 } })).toBe(false)
    expect(isDeadTikTokMessage('[tea-sdk]ready')).toBe(false)
    expect(isDeadTikTokMessage(null)).toBe(false)
  })
})
