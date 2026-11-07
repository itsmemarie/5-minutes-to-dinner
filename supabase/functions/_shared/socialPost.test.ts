import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPost, parsePostPage, postAuthor, readReel, readReelAuthor, readSocialPost, socialKind } from './socialPost.ts'

const TT_POST = 'https://www.tiktok.com/@jose.elcook/video/7448169436764212510'
const IG_POST = 'https://www.instagram.com/p/Cs7MUHIJW7w/'
const COVER = 'https://p16.tiktokcdn-eu.com/cover.image?x-signature=a%2Fb'
const ORIGIN = 'https://p16.tiktokcdn-eu.com/origin.image'
const CARD = 'https://p16.tiktokcdn-eu.com/card~tplv-photomode-video-share-card:1200:630:20.jpeg'
const IG_IMG = 'https://scontent-ber1-1.cdninstagram.com/v/t51/502_n.jpg?stp=s640x640&_nc_cat=109'
const IG_MEDIA = 'https://www.instagram.com/p/Cs7MUHIJW7w/media/?size=l'
const LOGO = 'https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png'

// As TikTok sends it: the blob's slashes are \u002F-escaped JSON.
const blob = (item: unknown) => {
  const data = { __DEFAULT_SCOPE__: { 'webapp.app-context': {}, 'webapp.video-detail': { statusCode: 0, itemInfo: { itemStruct: item } } } }
  return `<html><head></head><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data).replace(/\//g, '\\u002F')}</script></body></html>`
}
const ttPage = blob({
  desc: 'Feta pasta! 16oz grape tomatoes, 4oz feta #pasta',
  video: { cover: COVER, originCover: ORIGIN, dynamicCover: 'https://p16.tiktokcdn-eu.com/animated.image' },
})
const ttCrawlerPage = `<meta property="og:image" content="${CARD}"/><meta property="og:title" content="TikTok · Jose el Cook"/>`
const igPage = `<meta name="description" content="short" />
  <meta property="og:description" content="200g pasta &amp; 2 eggs &gt; mix
then boil" />
  <meta property="og:image" content="${IG_IMG.replace('&', '&amp;')}" />`
const igWall = `<meta property="og:title" content="Instagram" /><meta property="og:image" content="${LOGO}" />`

describe('socialKind', () => {
  it.each(['https://www.tiktok.com/@a/video/1', 'https://vm.tiktok.com/ZMabc/', 'https://vt.tiktok.com/ZSabc/', 'https://tiktok.com/t/abc'])('%s is TikTok', u => {
    expect(socialKind(new URL(u))).toBe('tiktok')
  })
  it.each(['https://www.instagram.com/reel/abc/', 'https://instagram.com/p/abc/', 'https://instagr.am/p/abc/'])('%s is Instagram', u => {
    expect(socialKind(new URL(u))).toBe('instagram')
  })
  it.each(['https://www.bbcgoodfood.com/recipes/dal', 'https://nottiktok.com/x', 'https://instagram.com.evil.example/p/abc/'])('%s is neither', u => {
    expect(socialKind(new URL(u))).toBeNull()
  })
})

describe('parsePostPage', () => {
  it("reads a TikTok video's caption and covers from the JSON, without the animated one", () => {
    expect(parsePostPage(ttPage, 'tiktok', TT_POST)).toEqual({
      caption: 'Feta pasta! 16oz grape tomatoes, 4oz feta #pasta',
      imageUrls: [COVER, ORIGIN],
    })
  })

  it('puts the first slide of a TikTok photo post ahead of its cover', () => {
    const html = blob({
      desc: 'Recipe in the slides',
      imagePost: {
        images: [{ imageURL: { urlList: ['https://p16.tiktokcdn-eu.com/slide1.heic', 'https://p16.tiktokcdn-eu.com/slide1.jpeg'] } }, { imageURL: { urlList: ['https://p16.tiktokcdn-eu.com/slide2.jpeg'] } }],
        cover: { imageURL: { urlList: ['https://p16.tiktokcdn-eu.com/photo-cover.jpeg'] } },
      },
    })
    expect(parsePostPage(html, 'tiktok', TT_POST).imageUrls).toEqual([
      'https://p16.tiktokcdn-eu.com/slide1.heic', 'https://p16.tiktokcdn-eu.com/slide1.jpeg', 'https://p16.tiktokcdn-eu.com/photo-cover.jpeg',
    ])
  })

  it("takes the share card from TikTok's crawler page, which has no caption", () => {
    expect(parsePostPage(ttCrawlerPage, 'tiktok', TT_POST)).toEqual({ caption: null, imageUrls: [CARD] })
  })

  it('survives a broken JSON blob', () => {
    const html = '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{not json</script>'
    expect(parsePostPage(html, 'tiktok', TT_POST)).toEqual({ caption: null, imageUrls: [] })
  })

  it("reads Instagram's caption, with its line breaks, entities and a > in it", () => {
    expect(parsePostPage(igPage, 'instagram', IG_POST)).toEqual({
      caption: '200g pasta & 2 eggs > mix\nthen boil',
      imageUrls: [IG_IMG],
    })
  })

  it("drops the likes line Instagram can put before a caption", () => {
    const html = `<meta property="og:description" content="123 likes, 4 comments - terzompls on May 1, 2026: &quot;200g pasta, 2 eggs&quot;." />`
    expect(parsePostPage(html, 'instagram', IG_POST).caption).toBe('200g pasta, 2 eggs')
  })
})

describe('readSocialPost', () => {
  afterEach(() => vi.unstubAllGlobals())

  // answer(url, userAgent) → body, or { body, url } for a redirect, or null for a failed request.
  const stubFetch = (answer: (url: string, ua: string) => string | { body: string; url: string } | null) => {
    const seen: string[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const ua = (init?.headers as Record<string, string>)?.['User-Agent'] ?? ''
      seen.push(ua.startsWith('facebook') ? 'bot' : 'app')
      const a = answer(url, ua)
      if (a == null) throw new Error('network')
      const { body, url: final } = typeof a === 'string' ? { body: a, url } : a
      return { ok: true, url: final, text: async () => body }
    })
    return seen
  }

  it('reads TikTok once when a normal request has it all', async () => {
    const seen = stubFetch(() => ttPage)
    const post = await readSocialPost(new URL(TT_POST), 'tiktok')
    expect(post.imageUrls).toEqual([COVER, ORIGIN])
    expect(post.caption).toContain('Feta pasta')
    expect(seen).toEqual(['app'])
  })

  it("falls back to TikTok's share card when the JSON isn't served", async () => {
    const seen = stubFetch((_, ua) => (ua.startsWith('facebook') ? ttCrawlerPage : '<html>verify you are human</html>'))
    expect((await readSocialPost(new URL(TT_POST), 'tiktok')).imageUrls).toEqual([CARD])
    expect(seen).toEqual(['app', 'bot'])
  })

  it('keeps the better cover ahead of the share card when both are needed', async () => {
    const noCaption = blob({ desc: '', video: { cover: COVER, originCover: ORIGIN } })
    stubFetch((_, ua) => (ua.startsWith('facebook') ? ttCrawlerPage : noCaption))
    expect((await readSocialPost(new URL(TT_POST), 'tiktok')).imageUrls).toEqual([COVER, ORIGIN, CARD])
  })

  it('follows a TikTok short link to the post', async () => {
    stubFetch(() => ({ body: ttPage, url: `${TT_POST}?_r=1&_t=abc` }))
    expect((await readSocialPost(new URL('https://vm.tiktok.com/ZMabc/'), 'tiktok')).imageUrls).toEqual([COVER, ORIGIN])
  })

  it('ignores a dead TikTok short link, which lands on the home page', async () => {
    stubFetch(() => ({ body: ttCrawlerPage, url: 'https://www.tiktok.com/?_r=1' }))
    expect(await readSocialPost(new URL('https://vm.tiktok.com/gone/'), 'tiktok')).toEqual({ caption: null, imageUrls: [] })
  })

  it("prefers Instagram's larger picture over the meta tag's", async () => {
    stubFetch(() => igPage)
    const post = await readSocialPost(new URL(IG_POST), 'instagram')
    expect(post.imageUrls).toEqual([IG_MEDIA, IG_IMG])
    expect(post.caption).toContain('200g pasta')
  })

  it('uses the post code from any Instagram link, not the address it was given', async () => {
    stubFetch(() => igPage)
    const { imageUrls } = await readSocialPost(new URL('https://www.instagram.com/terzompls/reel/Cs7MUHIJW7w/?igsh=abc'), 'instagram')
    expect(imageUrls[0]).toBe(IG_MEDIA)
  })

  it('resolves an Instagram share link through its redirect', async () => {
    stubFetch(() => ({ body: igPage, url: 'https://www.instagram.com/reel/Cs7MUHIJW7w/?igsh=abc' }))
    const { imageUrls } = await readSocialPost(new URL('https://www.instagram.com/share/BAabc123'), 'instagram')
    expect(imageUrls[0]).toBe(IG_MEDIA)
  })

  it('still tries the picture when Instagram redirects to a login wall, without taking its logo', async () => {
    stubFetch(() => ({ body: igWall, url: 'https://www.instagram.com/accounts/login/?next=%2Fp%2FCs7MUHIJW7w%2F' }))
    expect(await readSocialPost(new URL(IG_POST), 'instagram')).toEqual({ caption: null, imageUrls: [IG_MEDIA] })
  })

  it('still tries the picture when both page requests fail', async () => {
    stubFetch(() => null)
    expect(await readSocialPost(new URL(IG_POST), 'instagram')).toEqual({ caption: null, imageUrls: [IG_MEDIA] })
  })

  it("doesn't let a login wall's title beat the real caption", async () => {
    stubFetch((_, ua) => (ua.startsWith('facebook') ? igPage : igWall))
    const post = await readSocialPost(new URL(IG_POST), 'instagram')
    expect(post.caption).toContain('200g pasta')
    expect(post.imageUrls).toEqual([IG_MEDIA, IG_IMG])
  })

  it("won't use a profile's avatar as the dish", async () => {
    const profile = `<meta property="og:image" content="https://scontent.cdninstagram.com/v/t51.2885-19/avatar.jpg" />`
    stubFetch(() => profile)
    expect(await readSocialPost(new URL('https://www.instagram.com/terzompls/'), 'instagram')).toEqual({ caption: null, imageUrls: [] })
  })

  it("only asks Meta's oEmbed when the page had no caption", async () => {
    const asked: string[] = []
    stubFetch(url => {
      asked.push(url)
      return url.includes('graph.facebook.com') ? JSON.stringify({ title: '200g pasta, 2 eggs' }) : '<html></html>'
    })
    const post = await readSocialPost(new URL(IG_POST), 'instagram', 'token')
    expect(post.caption).toBe('200g pasta, 2 eggs')
    expect(asked.filter(u => u.includes('graph.facebook.com'))).toHaveLength(1)

    asked.length = 0
    stubFetch(url => { asked.push(url); return igPage })
    await readSocialPost(new URL(IG_POST), 'instagram', 'token')
    expect(asked.some(u => u.includes('graph.facebook.com'))).toBe(false)
  })
})

describe('postAuthor', () => {
  const tt = new URL(TT_POST), ig = new URL(IG_POST)

  it("takes a TikTok creator's handle from the post's data", () => {
    expect(postAuthor(blob({ desc: 'x', author: { uniqueId: 'jose.elcook' } }), 'tiktok', new URL('https://www.tiktok.com/video/1'))).toBe('jose.elcook')
  })
  it("falls back to the handle in a TikTok address", () => {
    expect(postAuthor('<html></html>', 'tiktok', tt)).toBe('jose.elcook')
  })
  it('has no TikTok handle to give when neither shows one', () => {
    expect(postAuthor('<html></html>', 'tiktok', new URL('https://www.tiktok.com/video/1'))).toBe(null)
  })
  it("reads an Instagram creator from the line above the caption", () => {
    const html = '<meta property="og:description" content="123 likes, 4 comments - terzo.mpls on May 1, 2026: &quot;Pasta&quot;" />'
    expect(postAuthor(html, 'instagram', ig)).toBe('terzo.mpls')
  })
  it('has no Instagram handle to give from a bare caption', () => {
    expect(postAuthor(igPage, 'instagram', ig)).toBe(null)
  })
})

describe('isPost', () => {
  it('tells a post from a short link', () => {
    expect(isPost(new URL(TT_POST), 'tiktok')).toBe(true)
    expect(isPost(new URL('https://vm.tiktok.com/ZMabc/'), 'tiktok')).toBe(false)
    expect(isPost(new URL(IG_POST), 'instagram')).toBe(true)
    expect(isPost(new URL('https://www.instagram.com/share/BAabc123'), 'instagram')).toBe(false)
  })
})

describe('readReel', () => {
  afterEach(() => vi.unstubAllGlobals())
  const stubFetch = (answer: (url: string) => string | { body: string; url: string } | null) => {
    const asked: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(url)
      const a = answer(url)
      if (a == null) throw new Error('network')
      const { body, url: final } = typeof a === 'string' ? { body: a, url } : a
      return { ok: true, url: final, text: async () => body }
    })
    return asked
  }
  const page = blob({ desc: 'Feta pasta', author: { uniqueId: 'jose.elcook' }, video: { cover: COVER } })

  it('finds the post behind a short link', async () => {
    stubFetch(() => ({ body: page, url: TT_POST }))
    const post = await readReel(new URL('https://vm.tiktok.com/ZMabc/'), 'tiktok')
    expect(post).toMatchObject({ author: 'jose.elcook', postUrl: TT_POST, imageUrls: [COVER] })
  })
  it('leaves postUrl empty when a link never reaches a post', async () => {
    stubFetch(() => ({ body: '<html></html>', url: 'https://www.tiktok.com/foryou' }))
    expect((await readReel(new URL('https://vm.tiktok.com/gone/'), 'tiktok')).postUrl).toBe(null)
  })
  it('keeps readSocialPost to its two fields, for the recipe importer', async () => {
    stubFetch(() => page)
    expect(Object.keys(await readSocialPost(new URL(TT_POST), 'tiktok')).sort()).toEqual(['caption', 'imageUrls'])
  })

  it('asks the older oEmbed route for an Instagram creator the page left out', async () => {
    const asked = stubFetch(url => (url.includes('/api/v1/oembed/') ? JSON.stringify({ author_name: 'terzo.mpls' }) : igPage))
    const post = await readReel(new URL(IG_POST), 'instagram')
    expect(post.author).toBe(null)
    await expect(readReelAuthor(post, 'instagram')).resolves.toBe('terzo.mpls')
    expect(asked.filter(u => u.includes('/api/v1/oembed/'))).toHaveLength(1)
  })
  it('makes no extra request when the page named the creator', async () => {
    const asked = stubFetch(() => page)
    const post = await readReel(new URL(TT_POST), 'tiktok')
    await expect(readReelAuthor(post, 'tiktok')).resolves.toBe('jose.elcook')
    expect(asked.some(u => u.includes('oembed'))).toBe(false)
  })
  it('gives no creator rather than failing when oEmbed does', async () => {
    stubFetch(url => (url.includes('/api/v1/oembed/') ? null : igPage))
    await expect(readReelAuthor(await readReel(new URL(IG_POST), 'instagram'), 'instagram')).resolves.toBe(null)
  })
})
