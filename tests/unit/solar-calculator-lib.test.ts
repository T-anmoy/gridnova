import { describe, it, expect } from 'vitest'
import {
  toSegment,
  billValid,
  housesValid,
  parseInput,
  positiveValid,
  unitsValid,
  roofLabelToEngineKey,
  validateEmail,
  validatePhone,
  validateName,
} from '@/app/(site)/[lang]/solar-calculator/lib'

describe('solar-calculator/lib', () => {
  it('maps both customer types to the residential segment (no "society" segment exists on the backend)', () => {
    expect(toSegment('residential')).toBe('residential')
    expect(toSegment('society')).toBe('residential')
  })

  it('has no sizing of its own any more — roof area, units and bill are only checked against the backend bounds', async () => {
    const lib = await import('@/app/(site)/[lang]/solar-calculator/lib')
    expect(lib).not.toHaveProperty('roofAreaToSizeKw')
    expect(lib).not.toHaveProperty('PLACEHOLDER_ROOF_AREA_SQFT_PER_KW')
    expect(parseInput(' 360 ')).toBe(360)
    expect(parseInput('3,600')).toBeUndefined()
    expect(parseInput('')).toBeUndefined()
    expect([unitsValid('1'), unitsValid('100000'), unitsValid('0'), unitsValid('100001')]).toEqual([true, true, false, false])
    expect([billValid('1'), billValid('5000000'), billValid('0.5'), billValid('5000001')]).toEqual([true, true, false, false])
    expect([housesValid('1'), housesValid('5000'), housesValid('2.5'), housesValid('5001')]).toEqual([true, true, false, false])
    expect([positiveValid('0.5', 10), positiveValid('0', 10), positiveValid('11', 10)]).toEqual([true, false, false])
  })

  it('maps a roof-type label to the engine\'s short key, and "Not Sure" to undefined', () => {
    expect(roofLabelToEngineKey('RCC / Concrete Flat Roof')).toBe('rcc')
    expect(roofLabelToEngineKey('Not Sure')).toBeUndefined()
    expect(roofLabelToEngineKey('')).toBeUndefined()
  })

  it.each([
    ['', 'Email is required'],
    ['not-an-email', 'Enter a valid email address'],
    ['ravi@example.com', undefined],
  ])('validateEmail(%s)', (input, expected) => {
    expect(validateEmail(input)).toBe(expected)
  })

  it.each([
    ['', 'Phone number is required'],
    ['12345', 'Enter a valid 10-digit mobile number'],
    ['9876543210', undefined],
    ['+91 98765 43210', undefined],
  ])('validatePhone(%s)', (input, expected) => {
    expect(validatePhone(input)).toBe(expected)
  })

  it.each([
    ['', 'Name is required'],
    ['R', 'Name must be at least 2 characters'],
    ['Ravi Sharma', undefined],
  ])('validateName(%s)', (input, expected) => {
    expect(validateName(input)).toBe(expected)
  })
})
