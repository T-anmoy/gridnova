import { describe, it, expect } from 'vitest'
import { formatInr, isAmountShapeValid } from '@/lib/money'

describe('formatInr (string-only, Indian grouping)', () => {
  it.each([
    ['0', '₹0'],
    ['999', '₹999'],
    ['1000', '₹1,000'],
    ['100000', '₹1,00,000'],
    ['1234567.89', '₹12,34,567.89'],
    ['12345678.9', '₹1,23,45,678.9'],
    ['0.50', '₹0.50'],
    ['00012.00', '₹12.00'],
    ['-2500.00', '-₹2,500.00'],
  ])('%s → %s', (input, expected) => expect(formatInr(input)).toBe(expected))

  it('keeps every digit of a value a float could not hold exactly', () => {
    expect(formatInr('9007199254740993.01')).toBe('₹9,00,71,99,25,47,40,993.01')
  })

  it('returns null/empty as a dash and unparseable input untouched', () => {
    expect(formatInr(null)).toBe('—')
    expect(formatInr('')).toBe('—')
    expect(formatInr('12abc')).toBe('12abc')
  })
})

describe('isAmountShapeValid', () => {
  it('accepts positive amounts with at most two decimals', () => {
    for (const ok of ['1', '25000', '25000.5', '25000.50', ' 10 ']) expect(isAmountShapeValid(ok)).toBe(true)
  })
  it('rejects zero, negatives, three decimals, commas and text', () => {
    for (const bad of ['', '0', '0.00', '-5', '1.234', '1,000', 'abc', '1e5', '.5']) expect(isAmountShapeValid(bad)).toBe(false)
  })
})
