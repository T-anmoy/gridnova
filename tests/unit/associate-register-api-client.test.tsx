import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAssociateCatalogue, checkAssociateSerial } from '@/lib/associate/register-api-client'
import en from '@/messages/en.json'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('associate register API client', () => {
  it('reads the price-free associate catalogue with category and q, as the associate (never the staff route)', async () => {
    fetchMock.mockResolvedValue(json(200, { items: [{ id: 12, category: 'module', brand: 'Sova Solar', model_name: 'SS-540M', specification: null, is_dcr_compliant: true, is_placeholder: false }] }))
    const { result } = renderHook(() => useAssociateCatalogue('module', ' sova '), { wrapper })
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/v1/associate/equipment?category=module&q=sova')
    expect(String(url)).not.toContain('/api/v1/equipment')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
    expect(result.current.rateLimited).toBe(false)
  })

  it('omits q when the search box is empty', async () => {
    fetchMock.mockResolvedValue(json(200, { items: [] }))
    const { result } = renderHook(() => useAssociateCatalogue('inverter', ''), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/associate\/equipment\?category=inverter$/)
  })

  it('flags a 429 rate_limited answer, without retrying on its own', async () => {
    fetchMock.mockResolvedValue(json(429, { detail: { code: 'rate_limited', message: 'Slow down' } }))
    const { result } = renderHook(() => useAssociateCatalogue('module', ''), { wrapper })
    await waitFor(() => expect(result.current.rateLimited).toBe(true))
    expect(result.current.items).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not treat other failures as a rate limit', async () => {
    fetchMock.mockResolvedValue(json(500, { detail: 'boom' }))
    const { result } = renderHook(() => useAssociateCatalogue('module', ''), { wrapper })
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.rateLimited).toBe(false)
  })

  it('checks a serial on the associate route and returns the answer untouched', async () => {
    const answer = { serial_normalized: 'SN1', available: false, on_this_project: false, message: 'Already registered.', held_by: null }
    fetchMock.mockResolvedValue(json(200, answer))
    await expect(checkAssociateSerial(5, 'sn-1 ', 'tok')).resolves.toEqual(answer)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/associate/onboardings/5/execution/units/check-serial?serial=sn-1%20')
  })
})

describe('associate entry copy in all three locales', () => {
  const leafPaths = (o: unknown, prefix = ''): string[] =>
    o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => leafPaths(v, `${prefix}${prefix ? '.' : ''}${k}`)) : [prefix]

  it('hi and bn carry every entry key English has, filled in', () => {
    const base = en.associates.portal.execution.register.entry
    for (const file of [hi, bn]) {
      const own = file.associates.portal.execution.register.entry
      expect(leafPaths(own).sort()).toEqual(leafPaths(base).sort())
      for (const p of leafPaths(own)) {
        const v = p.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], own)
        expect(typeof v === 'string' && v.length > 0).toBe(true)
      }
    }
  })

  it('the neutral waiting chip never names the staff flag', () => {
    for (const file of [en, hi, bn]) {
      const t = JSON.stringify(file.associates.portal.execution.register.entry)
      expect(t).not.toMatch(/unmatched/i)
    }
  })
})
