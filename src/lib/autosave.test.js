import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaver } from './autosave.js'

// A save that waits until the test lets it finish.
function controlledSave() {
  const calls = []
  const save = vi.fn(patch => new Promise((resolve, reject) => calls.push({ patch, resolve, reject })))
  return { save, calls }
}

describe('createAutosaver', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('merges changes and sends them once after the delay', async () => {
    const save = vi.fn().mockResolvedValue()
    const statuses = []
    const a = createAutosaver({ save, delay: 450, onChange: s => statuses.push(s.status) })
    a.queue({ name: 'A' })
    a.queue({ meals: [1] })
    a.queue({ name: 'B' })
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(450)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ name: 'B', meals: [1] })
    expect(statuses.at(-1)).toBe('saved')
    expect(a.idle()).toBe(true)
  })

  it('waits for the delay to restart on every change', async () => {
    const save = vi.fn().mockResolvedValue()
    const a = createAutosaver({ save, delay: 450 })
    a.queue({ name: 'A' })
    await vi.advanceTimersByTimeAsync(300)
    a.queue({ name: 'AB' })
    await vi.advanceTimersByTimeAsync(300)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(150)
    expect(save).toHaveBeenCalledWith({ name: 'AB' })
  })

  it('never runs two saves at once, so the newest lands last', async () => {
    const { save, calls } = controlledSave()
    const a = createAutosaver({ save, delay: 10 })
    a.queue({ name: 'first' })
    await vi.advanceTimersByTimeAsync(10)
    expect(calls).toHaveLength(1)
    a.queue({ name: 'second' })
    await vi.advanceTimersByTimeAsync(10)
    expect(calls).toHaveLength(1)          // still waiting on the first
    expect(a.state.status).toBe('pending')
    calls[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(2)
    expect(calls[1].patch).toEqual({ name: 'second' })
    calls[1].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(a.state.status).toBe('saved')
  })

  it('keeps a failed change, merged with later ones, for the retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue()
    const a = createAutosaver({ save, delay: 10 })
    a.queue({ name: 'A', meals: [1] })
    await vi.advanceTimersByTimeAsync(10)
    expect(a.state).toEqual({ status: 'error', error: 'offline' })
    expect(a.idle()).toBe(false)
    a.queue({ meals: [2] })
    await a.flush()
    expect(save).toHaveBeenLastCalledWith({ name: 'A', meals: [2] })
    expect(a.state).toEqual({ status: 'saved', error: null })
  })

  it('flush sends at once and resolves after everything queued', async () => {
    const save = vi.fn().mockResolvedValue()
    const a = createAutosaver({ save, delay: 10_000 })
    a.queue({ name: 'now' })
    await a.flush()
    expect(save).toHaveBeenCalledWith({ name: 'now' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush with nothing waiting does nothing', async () => {
    const save = vi.fn()
    await createAutosaver({ save }).flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('discard drops what has not been sent', async () => {
    const save = vi.fn().mockResolvedValue()
    const a = createAutosaver({ save, delay: 10 })
    a.queue({ name: 'gone' })
    a.discard()
    await vi.advanceTimersByTimeAsync(10)
    await a.flush()
    expect(save).not.toHaveBeenCalled()
    expect(a.state.status).toBe('saved')
  })
})
