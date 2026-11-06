import { describe, expect, it } from 'vitest'
import { TODDLER_JOB_TOOLS, TODDLER_TOOL_RULE, recipeToddlerPrompt, sanitiseToddlerActivities } from './toddlerHelpers.ts'

const job = (over = {}) => ({ step: 'Lentils', heatedYet: false, title: 'Tip in the lentils', task: 'Your toddler tips them in.', needsTool: null, ...over })

describe('sanitiseToddlerActivities', () => {
  it('drops a job the model marked as heated', () => {
    const { activities } = sanitiseToddlerActivities({ activities: [job({ heatedYet: true, title: 'Stir the risotto' }), job()] })
    expect(activities.map(a => a.title)).toEqual(['Tip in the lentils'])
  })
  it('drops a job with no heat check, rather than trusting it', () => {
    const { heatedYet: _gone, ...unchecked } = job()
    expect(sanitiseToddlerActivities({ activities: [unchecked] }).activities).toEqual([])
    expect(sanitiseToddlerActivities({ activities: [job({ heatedYet: 'false' })] }).activities).toEqual([])
  })
  it('returns only what the card shows', () => {
    expect(sanitiseToddlerActivities({ activities: [job()] }).activities[0]).toEqual({ title: 'Tip in the lentils', task: 'Your toddler tips them in.', needsTool: null })
  })
  it('keeps listed tools, including when the model writes a non-breaking hyphen', () => {
    const { activities } = sanitiseToddlerActivities({ activities: [job({ needsTool: 'Kid‑size whisk & spatula' })] })
    expect(activities[0].needsTool).toBe('Kid-size whisk & spatula')
  })
  it("clears tools the household wasn't promised", () => {
    const tools = ['Cheese bowl', 'Learning tower or sturdy step stool', 42]
    const { activities } = sanitiseToddlerActivities({ activities: tools.map(needsTool => job({ needsTool })) })
    expect(activities.map(a => a.needsTool)).toEqual([null, null, null])
  })
  it('checks heat before capping at four, so a dropped job makes room', () => {
    const hot = job({ heatedYet: true })
    const { activities } = sanitiseToddlerActivities({ activities: [hot, job(), job(), job(), job(), job()] })
    expect(activities).toHaveLength(4)
  })
  it('skips jobs with no text and survives junk', () => {
    expect(sanitiseToddlerActivities({ activities: [job({ task: '  ' }), null, 'x'] }).activities).toEqual([])
    expect(sanitiseToddlerActivities(null).activities).toEqual([])
    expect(sanitiseToddlerActivities({ activities: 'none' }).activities).toEqual([])
  })
})

describe('recipeToddlerPrompt', () => {
  const recipe = { ageBandLabel: '2–3 yrs', recipeName: 'Dal', ingredients: '- lentils', instructions: '1. Simmer.' }
  it('gives the model the Thermomix method too, so it can see that bowl', () => {
    expect(recipeToddlerPrompt({ ...recipe, instructionsThermomix: '1. Place in TM bowl.' })).toContain('Thermomix method:\n1. Place in TM bowl.')
  })
  it("doesn't repeat a Thermomix method that is already the method", () => {
    expect(recipeToddlerPrompt({ ...recipe, instructions: '1. TM.', instructionsThermomix: '1. TM.' })).not.toContain('Thermomix method')
  })
  it('leaves out what the recipe lacks', () => {
    const prompt = recipeToddlerPrompt({ ageBandLabel: '2–3 yrs', recipeName: 'Lentil Soup', ingredients: null, instructions: null, instructionsThermomix: null })
    expect(prompt).toContain('Ingredients:\n(none provided)')
    expect(prompt).not.toContain('Thermomix method')
    expect(prompt).not.toContain('adaptation notes')
  })
})

describe('TODDLER_TOOL_RULE', () => {
  it('offers every job tool by its exact name', () => {
    TODDLER_JOB_TOOLS.forEach(t => expect(TODDLER_TOOL_RULE).toContain(`"${t}"`))
  })
})
