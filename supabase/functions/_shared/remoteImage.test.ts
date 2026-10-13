import { describe, expect, it } from 'vitest'
import { bytesToBase64, isPrivateHost, sniffImageType } from './remoteImage.ts'

const bytes = (...head: number[]) => new Uint8Array([...head, ...new Array(16).fill(0)])
const ascii = (s: string) => [...s].map(c => c.charCodeAt(0))

describe('sniffImageType', () => {
  it('knows photos by their first bytes', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('image/png')
    expect(sniffImageType(bytes(...ascii('GIF89a')))).toBe('image/gif')
    expect(sniffImageType(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')))).toBe('image/webp')
    expect(sniffImageType(bytes(0, 0, 0, 0x1c, ...ascii('ftypavif')))).toBe('image/avif')
  })

  it('rejects anything else', () => {
    expect(sniffImageType(new Uint8Array(ascii('<!doctype html><html>')))).toBeNull()
    expect(sniffImageType(new Uint8Array(ascii('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull()
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull()
  })
})

describe('bytesToBase64', () => {
  it('matches the standard encoding, across chunk boundaries', () => {
    const big = new Uint8Array(70_000).map((_, i) => i % 251)
    expect(bytesToBase64(big)).toBe(Buffer.from(big).toString('base64'))
    expect(bytesToBase64(new Uint8Array(ascii('ABC')))).toBe('QUJD')
  })
})

describe('isPrivateHost', () => {
  it.each(['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.4', '172.20.0.1', '169.254.169.254', 'printer.local', '[::1]'])('%s is private', h => {
    expect(isPrivateHost(h)).toBe(true)
  })
  it.each(['www.instagram.com', 'scontent-ham3-1.cdninstagram.com', '172.32.0.1', '8.8.8.8'])('%s is public', h => {
    expect(isPrivateHost(h)).toBe(false)
  })
})
