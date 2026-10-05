import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConnectCalendar } from '@/lib/dashboard/api-client'

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

describe('useConnectCalendar', () => {
  it('calls the connect route with GET (the backend route is GET; POST is a 405)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ authorization_url: 'https://accounts.google.com/x' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const { result } = renderHook(() => useConnectCalendar(), { wrapper })
    const out = await result.current.mutateAsync()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/v1\/dashboard\/employees\/me\/calendar\/connect$/)
    expect((init as RequestInit | undefined)?.method ?? 'GET').toBe('GET')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
    expect(out.authorization_url).toBe('https://accounts.google.com/x')
  })
})
