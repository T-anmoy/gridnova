import { describe, it, expect } from 'vitest'
import {
  ApiError,
  classifyApiError,
  isRetryableError,
  backoffDelay,
} from '@/lib/dashboard/api-error'

describe('classifyApiError — distinct state per failure mode', () => {
  it('401 → auth (session expired)', () => {
    const c = classifyApiError(new ApiError(401, 'API error 401', 'token expired'))
    expect(c.kind).toBe('auth')
    expect(c.status).toBe(401)
    expect(c.heading).toMatch(/session expired/i)
  })

  it('403 → forbidden (wrong role), distinct from auth', () => {
    const c = classifyApiError(new ApiError(403, 'API error 403', 'insufficient role'))
    expect(c.kind).toBe('forbidden')
    expect(c.heading).toMatch(/permission/i)
  })

  it('429 → rateLimited', () => {
    const c = classifyApiError(new ApiError(429, 'API error 429', 'slow down'))
    expect(c.kind).toBe('rateLimited')
  })

  it('500/503 → server', () => {
    expect(classifyApiError(new ApiError(500, 'x')).kind).toBe('server')
    expect(classifyApiError(new ApiError(503, 'x')).kind).toBe('server')
  })

  it('status 0 (fetch threw) → network', () => {
    expect(classifyApiError(new ApiError(0, 'Network request failed')).kind).toBe('network')
  })

  it('other 4xx → client', () => {
    expect(classifyApiError(new ApiError(400, 'bad', 'validation')).kind).toBe('client')
    expect(classifyApiError(new ApiError(404, 'missing')).kind).toBe('client')
  })

  it('surfaces the real status code + detail (not a generic message)', () => {
    const c = classifyApiError(new ApiError(500, 'API error 500', 'db connection lost'))
    expect(c.detail).toContain('500')
    expect(c.detail).toContain('db connection lost')
  })

  it('handles non-ApiError throwables as network (status 0)', () => {
    expect(classifyApiError(new Error('boom')).kind).toBe('network')
    expect(classifyApiError('weird').kind).toBe('network')
  })
})

describe('isRetryableError — only transient failures retry', () => {
  it('retries 429, 5xx, and network', () => {
    expect(isRetryableError(new ApiError(429, 'x'))).toBe(true)
    expect(isRetryableError(new ApiError(500, 'x'))).toBe(true)
    expect(isRetryableError(new ApiError(0, 'x'))).toBe(true)
  })
  it('never retries auth / forbidden / other 4xx', () => {
    expect(isRetryableError(new ApiError(401, 'x'))).toBe(false)
    expect(isRetryableError(new ApiError(403, 'x'))).toBe(false)
    expect(isRetryableError(new ApiError(404, 'x'))).toBe(false)
  })
})

describe('backoffDelay — exponential with ceiling', () => {
  it('grows exponentially then caps at 8s', () => {
    expect(backoffDelay(0)).toBe(1000)
    expect(backoffDelay(1)).toBe(2000)
    expect(backoffDelay(2)).toBe(4000)
    expect(backoffDelay(10)).toBe(8000)
  })
})
