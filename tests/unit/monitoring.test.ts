import { describe, it, expect, afterEach, vi } from 'vitest'
import { reportError, scrubForReport, setErrorSink } from '@/lib/monitoring'

afterEach(() => setErrorSink(null))

describe('scrubForReport', () => {
  it.each([
    ['Failed for ravi.kumar@example.com', 'ravi.kumar@example.com'],
    ['PAN ABCDE1234F rejected', 'ABCDE1234F'],
    ['IFSC SBIN0001234 invalid', 'SBIN0001234'],
    ['Aadhaar 1234 5678 9012 not valid', '1234 5678 9012'],
    ['account 123456789012345', '123456789012345'],
    ['call +91 98765 43210', '98765 43210'],
    ['at 22.572646, 88.363895', '22.572646'],
    ['GET /proposal/accept/abc123SECRET failed', 'abc123SECRET'],
    ['Authorization: Bearer eyJhbGciOi.abc.def', 'eyJhbGciOi'],
  ])('removes %s', (input, secret) => {
    const out = scrubForReport(input)
    expect(out).not.toContain(secret)
    expect(out).toMatch(/\[[a-z]+\]|\[token\]/)
  })

  it('keeps harmless text and caps the length', () => {
    expect(scrubForReport('Cannot read properties of undefined')).toBe('Cannot read properties of undefined')
    expect(scrubForReport('x'.repeat(500)).length).toBe(301)
  })
})

describe('reportError', () => {
  it('is a no-op until a sink is registered', () => {
    expect(() => reportError(new Error('boom'), { area: 'site' })).not.toThrow()
  })

  it('sends only name, scrubbed message, area and digest — never the stack', () => {
    const sink = vi.fn()
    setErrorSink(sink)
    reportError(new TypeError('bad value for a@b.co'), { area: 'portal', digest: 'd1' })
    expect(sink).toHaveBeenCalledWith({ name: 'TypeError', message: 'bad value for [email]', area: 'portal', digest: 'd1' })
  })

  it('never lets a failing sink break the page', () => {
    setErrorSink(() => {
      throw new Error('sink down')
    })
    expect(() => reportError(new Error('x'), { area: 'site' })).not.toThrow()
  })
})
