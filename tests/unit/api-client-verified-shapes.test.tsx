// Exercises the REAL hooks (not mocked away) against a mocked `fetch`, so
// the exact wire body/URL is asserted — this is exactly the gap that let
// Prompt 03's guessed shapes (`new_total_value` instead of `new_value`, a
// `reason` field the backend silently ignores) pass every component test:
// those tests mock the hook itself, so they can never catch a wrong request
// body. Every shape here comes from the shared fixture file, not hand-rolled.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  ADJUST_PRICING_REQUEST_BODY,
  ADJUST_PRICING_RESPONSE,
  REVIEW_PROPOSAL_INPUT_REJECT_BODY,
  REVIEW_PROPOSAL_INPUT_APPROVE_BODY,
  reviewProposalInputResponse,
  ASSIGNABLE_EMPLOYEES_FIXTURE,
} from './fixtures/dashboard-contract'

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8000')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useAdjustPricing — real wire shape', () => {
  it('sends {new_value, reason} to PATCH /proposals/{id}/adjust-pricing, not new_total_value', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(ADJUST_PRICING_RESPONSE), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { useAdjustPricing } = await import('@/lib/dashboard/api-client')
    const { result } = renderHook(() => useAdjustPricing(), { wrapper })
    const response = await result.current.mutateAsync({ proposalId: 501, newValue: 300000, reason: 'Equipment cost increased' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8000/api/v1/dashboard/proposals/501/adjust-pricing')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual(ADJUST_PRICING_REQUEST_BODY(300000, 'Equipment cost increased'))
    expect(response).toEqual(ADJUST_PRICING_RESPONSE)
  })
})

describe('useReviewProposalInput — real wire shape', () => {
  it('sends rejection_reason (never a plain `reason`, which the backend silently ignores)', async () => {
    const fixture = reviewProposalInputResponse({ status: 'rejected', rejection_reason: 'Missing site photographs' })
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { useReviewProposalInput } = await import('@/lib/dashboard/api-client')
    const { result } = renderHook(() => useReviewProposalInput(), { wrapper })
    await result.current.mutateAsync({ inputId: 7, status: 'rejected', rejectionReason: 'Missing site photographs' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8000/api/v1/proposal-inputs/7/review')
    const sentBody = JSON.parse(options.body)
    expect(sentBody).toEqual(REVIEW_PROPOSAL_INPUT_REJECT_BODY('Missing site photographs'))
    expect(sentBody.reason).toBeUndefined()
  })

  it('sends {status: "approved_for_proposal"} and reads proposal_draft from the response, not top-level fields', async () => {
    const fixture = reviewProposalInputResponse({ proposal_draft: { triggered: true, proposal_id: 501, version: 1 } })
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { useReviewProposalInput } = await import('@/lib/dashboard/api-client')
    const { result } = renderHook(() => useReviewProposalInput(), { wrapper })
    const response = await result.current.mutateAsync({ inputId: 7, status: 'approved_for_proposal' })

    const [, options] = fetchMock.mock.calls[0]
    expect(JSON.parse(options.body)).toEqual(REVIEW_PROPOSAL_INPUT_APPROVE_BODY())
    expect(response.proposal_draft).toEqual({ triggered: true, proposal_id: 501, version: 1 })
  })
})

describe('useAssignableEmployees — real endpoint', () => {
  it('fetches GET /employees/assignable, not the admin-only /employees', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(ASSIGNABLE_EMPLOYEES_FIXTURE), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { useAssignableEmployees } = await import('@/lib/dashboard/api-client')
    const { result } = renderHook(() => useAssignableEmployees(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual(ASSIGNABLE_EMPLOYEES_FIXTURE))

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8000/api/v1/dashboard/employees/assignable')
  })
})
