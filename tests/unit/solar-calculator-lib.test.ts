import { describe, it, expect } from 'vitest'
import {
  toSegment,
  roofAreaToSizeKw,
  roofLabelToEngineKey,
  formatINR,
  validateEmail,
  validatePhone,
  validateName,
} from '@/app/(site)/[lang]/solar-calculator/lib'

describe('solar-calculator/lib', () => {
  it('maps both customer types to the residential segment (no "society" segment exists on the backend)', () => {
    expect(toSegment('residential')).toBe('residential')
    expect(toSegment('society')).toBe('residential')
  })

  it('converts roof area to an approximate size in kW, clamped to a sane range', () => {
    expect(roofAreaToSizeKw(800)).toBe(8)
    expect(roofAreaToSizeKw(50)).toBe(1) // clamped to the minimum
    expect(roofAreaToSizeKw(100_000)).toBe(500) // clamped to the maximum
  })

  it('maps a roof-type label to the engine\'s short key, and "Not Sure" to undefined', () => {
    expect(roofLabelToEngineKey('RCC / Concrete Flat Roof')).toBe('rcc')
    expect(roofLabelToEngineKey('Not Sure')).toBeUndefined()
    expect(roofLabelToEngineKey('')).toBeUndefined()
  })

  it('formats INR without decimals', () => {
    expect(formatINR(264585)).toBe('₹2,64,585')
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
