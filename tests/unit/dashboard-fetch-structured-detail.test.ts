import { describe, it, expect, vi, afterEach } from 'vitest'
import { dashboardFetch } from '@/lib/dashboard/api-client'
import { ApiError } from '@/lib/dashboard/api-error'

afterEach(() => {
  vi.unstubAllGlobals()
})

// POST /proposals/{id}/send's 409 has an OBJECT `detail`
// ({code, message, placeholder_sections, missing_total_value}), not a
// string — the exact shape that previously risked rendering "[object
// Object]" if stringified naively.
describe('dashboardFetch — structured (object) error detail', () => {
  it('extracts a friendly message from detail.message and keeps the full object on structuredDetail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: {
              code: 'placeholder_content',
              message: 'This proposal still has placeholder content',
              placeholder_sections: ['scope_of_work'],
              missing_total_value: false,
            },
          }),
          { status: 409 }
        )
      )
    )

    await expect(dashboardFetch('/api/v1/dashboard/proposals/1/send', 'token', { method: 'POST' })).rejects.toSatisfy(
      (err: unknown) => {
        expect(err).toBeInstanceOf(ApiError)
        const apiErr = err as ApiError
        expect(apiErr.status).toBe(409)
        expect(apiErr.detail).toBe('This proposal still has placeholder content')
        expect(apiErr.detail).not.toContain('[object Object]')
        expect(apiErr.structuredDetail).toEqual({
          code: 'placeholder_content',
          message: 'This proposal still has placeholder content',
          placeholder_sections: ['scope_of_work'],
          missing_total_value: false,
        })
        return true
      }
    )
  })

  it('still handles a plain string detail exactly as before', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })))

    await expect(dashboardFetch('/api/v1/dashboard/leads/999', 'token')).rejects.toSatisfy((err: unknown) => {
      const apiErr = err as ApiError
      expect(apiErr.detail).toBe('Not found')
      expect(apiErr.structuredDetail).toBeUndefined()
      return true
    })
  })
})
