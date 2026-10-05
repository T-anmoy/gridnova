import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCreateCatalogueItem } from '@/lib/dashboard/register-api-client'

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
)

describe('useCreateCatalogueItem', () => {
  it('POSTs the item to the onboarding’s execution/catalogue route', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ equipment: { id: 5 }, package: null, approved_makes: [], in_package: null }), { status: 201 }))
    const { result } = renderHook(() => useCreateCatalogueItem(42), { wrapper })
    const input = { category: 'module' as const, brand: 'Sova Solar', model_name: 'SS-540M', is_dcr_compliant: true }
    const out = await result.current.mutateAsync(input)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/v1\/dashboard\/onboardings\/42\/execution\/catalogue$/)
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(input)
    expect(out.equipment.id).toBe(5)
  })
})
