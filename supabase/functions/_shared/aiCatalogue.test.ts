import { describe, expect, it } from 'vitest'
import {
  CLAUDE_DEFAULT_MODEL, GROQ_VISION_MODEL, STEPS, claudeSupportsEffort, claudeSupportsServerFallback,
  defaultOwnerRoute, defaultPublicRoute, geminiThinkingOff, groqModelFor, groqReasoningParams, validateChoice,
} from './aiCatalogue.ts'
import { parseModelJson } from './json.ts'

describe('routes', () => {
  it('defaults the owner to Claude and everyone else to Groq', () => {
    for (const id of Object.keys(STEPS)) {
      expect(defaultOwnerRoute(id)).toEqual({ provider: 'claude', model: CLAUDE_DEFAULT_MODEL })
      expect(defaultPublicRoute(id).provider).toBe('groq')
    }
  })

  it('moves photo requests onto Groq\'s vision model', () => {
    expect(groqModelFor('openai/gpt-oss-120b', true)).toBe(GROQ_VISION_MODEL)
    expect(groqModelFor('openai/gpt-oss-120b', false)).toBe('openai/gpt-oss-120b')
    expect(STEPS.freezer_extract.groqModel).toBe(GROQ_VISION_MODEL)
  })

  it('never routes to the retired qwen3.6 model', () => {
    expect(JSON.stringify(STEPS)).not.toContain('qwen3.6')
  })
})

describe('validateChoice', () => {
  it('accepts presets and well-formed custom ids', () => {
    expect(validateChoice('nutrition', 'claude', 'claude-sonnet-5-5')).toBeNull()
    expect(validateChoice('nutrition', 'groq', 'some-org/new-model-2')).toBeNull()
  })
  it('rejects unknown steps, providers and mismatched ids', () => {
    expect(validateChoice('nope', 'claude', 'claude-opus-5-5')).toMatch(/step/)
    expect(validateChoice('nutrition', 'openai', 'gpt')).toMatch(/provider/)
    expect(validateChoice('nutrition', 'claude', 'gemini-2.5-flash')).toMatch(/claude-/)
    expect(validateChoice('nutrition', 'groq', 'has spaces')).toMatch(/model id/)
  })
})

describe('request options', () => {
  it('only sends Claude options the model accepts', () => {
    expect(claudeSupportsServerFallback('claude-opus-5-5')).toBe(true)
    expect(claudeSupportsServerFallback('claude-haiku-5-5')).toBe(false)
    expect(claudeSupportsEffort('claude-haiku-5-5')).toBe(true)
    expect(claudeSupportsEffort('claude-haiku-4-5')).toBe(false)
  })
  it('keeps hidden reasoning low on gpt-oss and off on Qwen', () => {
    expect(groqReasoningParams('openai/gpt-oss-120b')).toEqual({ reasoning_effort: 'low', include_reasoning: false })
    expect(groqReasoningParams(GROQ_VISION_MODEL)).toEqual({ reasoning_effort: 'none' })
    expect(groqReasoningParams('llama-3.3-70b-versatile')).toEqual({})
  })
  it('turns Gemini thinking off only where that is allowed', () => {
    expect(geminiThinkingOff('gemini-2.5-flash')).toBe(true)
    expect(geminiThinkingOff('gemini-2.5-flash-lite')).toBe(true)
    expect(geminiThinkingOff('gemini-2.5-pro')).toBe(false)
  })
})

describe('parseModelJson', () => {
  it('reads clean, fenced, think-wrapped and chatty replies', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 })
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseModelJson('<think>hmm {no}</think>{"a":1}')).toEqual({ a: 1 })
    expect(parseModelJson('Here you go: {"a":1} enjoy')).toEqual({ a: 1 })
    expect(parseModelJson('Items: ["x", {"y":1}]')).toEqual(['x', { y: 1 }])
  })
  it('returns undefined when there is nothing to parse', () => {
    expect(parseModelJson('')).toBeUndefined()
    expect(parseModelJson('no json here')).toBeUndefined()
  })
})
