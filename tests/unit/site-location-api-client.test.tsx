import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const dashboardFetch = vi.fn()
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))
vi.mock('@/lib/dashboard/api-client', () => ({ dashboardFetch: (...a: unknown[]) => dashboardFetch(...a) }))

import { useConfirmSiteLocation, useSetSiteLocation } from '@/lib/associate/onboarding-api-client'
import { useCorrectSiteLocation } from '@/lib/dashboard/onboarding-api-client'

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
}

describe('site-location requests', () => {
  it('POSTs the associate set call to the owner endpoint, with the coordinates only in the body — never in the URL', async () => {
    dashboardFetch.mockResolvedValue({})
    const { result } = renderHook(() => useSetSiteLocation(), { wrapper })
    const input = { source: 'device_gps', latitude: 22.5726, longitude: 88.3639, accuracy_m: 12, captured_at: '2026-10-04T10:15:00+05:30' } as const
    await result.current.mutateAsync({ id: 7, input })
    const [path, token, init] = dashboardFetch.mock.calls[0]
    expect(path).toBe('/api/v1/associate/onboardings/7/site-location')
    expect(path).not.toMatch(/22\.57|88\.36|\?/)
    expect(token).toBe('tok')
    expect(init).toMatchObject({ method: 'POST' })
    expect(JSON.parse(init.body)).toEqual(input)
  })

  it('confirm is a bodyless POST to /site-location/confirm', async () => {
    dashboardFetch.mockClear()
    dashboardFetch.mockResolvedValue({})
    const { result } = renderHook(() => useConfirmSiteLocation(), { wrapper })
    await result.current.mutateAsync(7)
    expect(dashboardFetch.mock.calls[0][0]).toBe('/api/v1/associate/onboardings/7/site-location/confirm')
    expect(dashboardFetch.mock.calls[0][2]).toEqual({ method: 'POST' })
  })

  it('the staff correction goes to the dashboard endpoint with a reason', async () => {
    dashboardFetch.mockClear()
    dashboardFetch.mockResolvedValue({})
    const { result } = renderHook(() => useCorrectSiteLocation(), { wrapper })
    await result.current.mutateAsync({ id: 7, input: { source: 'pasted_coordinates', text: '22.5, 88.3', reason: 'Called the customer' } })
    await waitFor(() => expect(dashboardFetch).toHaveBeenCalled())
    expect(dashboardFetch.mock.calls[0][0]).toBe('/api/v1/dashboard/onboardings/7/site-location')
    expect(JSON.parse(dashboardFetch.mock.calls[0][2].body).reason).toBe('Called the customer')
  })
})
