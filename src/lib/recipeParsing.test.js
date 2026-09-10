import { describe, it, expect } from 'vitest'
import { splitRecipeName } from './recipeParsing.js'

// All fixtures below are real recipe names from the recipes table.

describe('splitRecipeName', () => {
  it('splits a name from its code suffix', () => {
    expect(splitRecipeName('Avocado & Banana Pancakes | MP-VCBN'))
      .toEqual({ title: 'Avocado & Banana Pancakes', code: 'MP-VCBN' })
    expect(splitRecipeName('Beef Burgers | MP-BFBR'))
      .toEqual({ title: 'Beef Burgers', code: 'MP-BFBR' })
  })

  it('keeps a hyphenated code intact', () => {
    expect(splitRecipeName('Overnight Oats — Greek Yoghurt | MP-GRKY-2'))
      .toEqual({ title: 'Overnight Oats — Greek Yoghurt', code: 'MP-GRKY-2' })
  })

  it('returns the whole name and no code when there is no pipe', () => {
    expect(splitRecipeName('Sausages')).toEqual({ title: 'Sausages', code: '' })
    expect(splitRecipeName('Wholemeal Bread')).toEqual({ title: 'Wholemeal Bread', code: '' })
  })

  it('does not truncate on a second pipe (the split()[1] bug)', () => {
    expect(splitRecipeName('Fish | Chips | MP-FSCH'))
      .toEqual({ title: 'Fish', code: 'Chips | MP-FSCH' })
  })

  it('handles empty and nullish input', () => {
    expect(splitRecipeName('')).toEqual({ title: '', code: '' })
    expect(splitRecipeName(null)).toEqual({ title: '', code: '' })
    expect(splitRecipeName(undefined)).toEqual({ title: '', code: '' })
  })

  it('trims surrounding whitespace on both halves', () => {
    expect(splitRecipeName('  Fruit Platter   |   MP-FRPL  '))
      .toEqual({ title: 'Fruit Platter', code: 'MP-FRPL' })
  })
})
