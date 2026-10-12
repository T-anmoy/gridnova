import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiFetch, publicFetch, parseApiError, getTokenOrThrow, formatValidationDetail, buildQS, isNotAuthenticatedError } from '@/lib/api/http'
import { ApiError, ApiShapeError, classifyApiError, isRetryableError } from '@/lib/dashboard/api-error'
import { z } from 'zod'

afterEach(() => vi.unstubAllGlobals())

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('parseApiError', () => {
  it('formats a FastAPI 422 detail array as "field: msg" and keeps the array', () => {
    const body = JSON.stringify({
      detail: [
        { loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error' },
        { loc: ['query', 'page'], msg: 'Input should be >= 1', type: 'greater_than_equal' },
      ],
    })
    const err = parseApiError(422, 'Unprocessable Entity', body)
    expect(err.detail).toBe('email: value is not a valid email address; page: Input should be >= 1')
    expect(err.detail).not.toContain('Unprocessable')
    expect((err.structuredDetail?.fieldErrors as unknown[]).length).toBe(2)
  })
  it('never renders an object detail as [object Object]', () => {
    const err = parseApiError(409, 'Conflict', JSON.stringify({ detail: { code: 'proposal_superseded', message: 'Superseded.' } }))
    expect(err.detail).toBe('Superseded.')
    expect(err.structuredDetail?.code).toBe('proposal_superseded')
    const noMsg = parseApiError(409, 'Conflict', JSON.stringify({ detail: { code: 'x' } }))
    expect(noMsg.detail).toBe('Conflict')
  })
  it('keeps raw text for a non-JSON body', () => {
    expect(parseApiError(502, 'Bad Gateway', '<html>nope</html>').detail).toBe('<html>nope</html>')
  })
})

describe('formatValidationDetail', () => {
  it('handles items without a loc and plain strings', () => {
    expect(formatValidationDetail([{ msg: 'bad' }, 'plain'])).toBe('bad; plain')
  })
})

describe('getTokenOrThrow', () => {
  it('throws an ApiError(401) classified auth and never retried', async () => {
    const err = await getTokenOrThrow(async () => null).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(401)
    expect(isNotAuthenticatedError(err)).toBe(true)
    expect(classifyApiError(err).kind).toBe('auth')
    expect(isRetryableError(err)).toBe(false)
  })
  it('returns the token when there is one', async () => {
    expect(await getTokenOrThrow(async () => 'tok')).toBe('tok')
  })
})

describe('apiFetch bodies', () => {
  it('returns undefined for an empty 2xx body (204)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    expect(await apiFetch('/x', 't', { method: 'DELETE' })).toBeUndefined()
  })
  it('raises ApiShapeError (not SyntaxError) for a non-JSON 2xx body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })))
    await expect(apiFetch('/x', 't')).rejects.toBeInstanceOf(ApiShapeError)
  })
  it('raises ApiShapeError when the schema does not match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ a: 'nope' })))
    await expect(apiFetch('/x', 't', undefined, z.object({ a: z.number() }))).rejects.toBeInstanceOf(ApiShapeError)
  })
  it('classifies a fetch rejection as a network error (status 0)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    await expect(apiFetch('/x', 't')).rejects.toMatchObject({ status: 0 })
  })
  it('forwards the caller signal combined with a timeout, and lets caller aborts propagate', async () => {
    const ctrl = new AbortController()
    const fetchMock = vi.fn().mockImplementation((_u: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      return Promise.reject(new DOMException('aborted', 'AbortError'))
    })
    vi.stubGlobal('fetch', fetchMock)
    ctrl.abort()
    const err = await apiFetch('/x', 't', { signal: ctrl.signal }).catch((e) => e)
    expect(err).not.toBeInstanceOf(ApiError)
    expect((err as Error).name).toBe('AbortError')
  })
  it('publicFetch needs no token and parses errors the same way', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'Nope.' }, 404)))
    await expect(publicFetch('/p')).rejects.toMatchObject({ status: 404, detail: 'Nope.' })
  })
})

describe('buildQS', () => {
  it('skips empty values', () => {
    expect(buildQS({ a: 1, b: '', c: undefined, d: null, e: false })).toBe('?a=1&e=false')
  })
})
