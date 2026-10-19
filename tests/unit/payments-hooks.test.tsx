// The real payment hooks against a mocked `fetch`: method, URL, JSON body,
// bearer header, which queries are refreshed afterwards, and that a backend 4xx
// reaches the caller with its message. (Component tests mock the hooks away, so
// they cannot catch a wrong request.)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PAYMENT_FIXTURE, PAYMENT_IN_CHEQUE, PAYMENT_IN_UPI, RECORD_PAYMENT_RESPONSE, STAFF_PAYMENT_FIXTURE } from './fixtures/payments-contract'
import { ApiError } from '@/lib/dashboard/api-error'

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }) }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let qc: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const call = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return { url, init, headers: init.headers as Record<string, string> }
}

describe('useRecordStaffPayment', () => {
  it('POSTs the JSON body to the staff onboarding payments URL with the bearer token, then refreshes the staff lists', async () => {
    const { useRecordStaffPayment } = await import('@/lib/dashboard/payments-api-client')
    const fetchMock = stubFetch(json(STAFF_PAYMENT_FIXTURE, 201))
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRecordStaffPayment(12), { wrapper })

    let created: unknown
    await act(async () => {
      created = await result.current.mutateAsync(PAYMENT_IN_CHEQUE)
    })

    const { url, init, headers } = call(fetchMock)
    expect(url).toMatch(/\/api\/v1\/dashboard\/onboardings\/12\/payments$/)
    expect(init.method).toBe('POST')
    expect(headers.Authorization).toBe('Bearer test-token')
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual(PAYMENT_IN_CHEQUE)
    expect(created).toEqual(STAFF_PAYMENT_FIXTURE)
    const keys = invalidate.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)
    expect(keys).toEqual([['staff-payments', 12], ['staff-payments-list'], ['work-queues']])
  })

  it('surfaces the backend’s 4xx message and refreshes nothing', async () => {
    const { useRecordStaffPayment } = await import('@/lib/dashboard/payments-api-client')
    stubFetch(json({ detail: 'Cash is not accepted' }, 422))
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRecordStaffPayment(12), { wrapper })

    const err = await act(async () => result.current.mutateAsync(PAYMENT_IN_UPI).catch((e) => e))
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(422)
    expect((err as ApiError).detail).toBe('Cash is not accepted')
    expect(invalidate).not.toHaveBeenCalled()
  })
})

describe('useRecordCustomerPayment (associate portal)', () => {
  it('POSTs to the associate onboarding payments URL, stores the refreshed overview and refreshes the home feed', async () => {
    const { useRecordCustomerPayment } = await import('@/lib/associate/payment-api-client')
    const fetchMock = stubFetch(json(RECORD_PAYMENT_RESPONSE, 201))
    const setData = vi.spyOn(qc, 'setQueryData')
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRecordCustomerPayment(12), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(PAYMENT_IN_UPI)
    })

    const { url, init, headers } = call(fetchMock)
    expect(url).toMatch(/\/api\/v1\/associate\/onboardings\/12\/payments$/)
    expect(init.method).toBe('POST')
    expect(headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(init.body as string)).toEqual(PAYMENT_IN_UPI)
    // The overview is stored WITHOUT the new `payment` key; the home feed is refetched.
    const [key, overview] = setData.mock.calls[0]
    expect(key).toEqual(['payments', 12])
    expect(overview).not.toHaveProperty('payment')
    expect(overview).toHaveProperty('totals')
    expect(invalidate.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)).toEqual([['home']])
  })

  it('surfaces a 403 (a downline customer’s payments are owner-only) without touching the cache', async () => {
    const { useRecordCustomerPayment } = await import('@/lib/associate/payment-api-client')
    stubFetch(json({ detail: 'Only the owning associate can record payments' }, 403))
    const setData = vi.spyOn(qc, 'setQueryData')
    const { result } = renderHook(() => useRecordCustomerPayment(12), { wrapper })
    const err = await act(async () => result.current.mutateAsync(PAYMENT_IN_UPI).catch((e) => e))
    expect((err as ApiError).status).toBe(403)
    expect((err as ApiError).detail).toBe('Only the owning associate can record payments')
    expect(setData).not.toHaveBeenCalled()
  })
})

describe('payment proof uploads', () => {
  const file = new File(['%PDF-1.4'], 'cheque.pdf', { type: 'application/pdf' })

  it('associate: POSTs multipart to …/payments/{id}/proof with the file and bearer header (no JSON content type), then refreshes the overview', async () => {
    const { useUploadPaymentProof } = await import('@/lib/associate/payment-api-client')
    const fetchMock = stubFetch(json({ ...PAYMENT_FIXTURE, has_proof: true, proof_filename: 'cheque.pdf' }))
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUploadPaymentProof(12), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ paymentId: 41, file })
    })

    const { url, init, headers } = call(fetchMock)
    expect(url).toMatch(/\/api\/v1\/associate\/onboardings\/12\/payments\/41\/proof$/)
    expect(init.method).toBe('POST')
    expect(headers.Authorization).toBe('Bearer test-token')
    expect(headers['Content-Type']).toBeUndefined() // the browser sets the multipart boundary
    expect(init.body).toBeInstanceOf(FormData)
    expect(((init.body as FormData).get('file') as File).name).toBe('cheque.pdf')
    expect(invalidate.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)).toEqual([['payments', 12]])
  })

  it('staff: POSTs to /dashboard/payments/{id}/proof and refreshes the onboarding and list queries', async () => {
    const { useUploadStaffPaymentProof } = await import('@/lib/dashboard/payments-api-client')
    const fetchMock = stubFetch(json({ ...STAFF_PAYMENT_FIXTURE, has_proof: true }))
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUploadStaffPaymentProof(12), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ paymentId: 41, file })
    })

    expect(call(fetchMock).url).toMatch(/\/api\/v1\/dashboard\/payments\/41\/proof$/)
    const keys = invalidate.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)
    expect(keys[0]).toEqual(['staff-payments', 12])
    expect(keys).toContainEqual(['staff-payments-list'])
  })

  it('surfaces a rejected file (413/422) with the backend’s message', async () => {
    const { useUploadPaymentProof } = await import('@/lib/associate/payment-api-client')
    stubFetch(json({ detail: 'File too large' }, 413))
    const { result } = renderHook(() => useUploadPaymentProof(12), { wrapper })
    const err = await act(async () => result.current.mutateAsync({ paymentId: 41, file }).catch((e) => e))
    expect((err as ApiError).status).toBe(413)
    expect((err as ApiError).detail).toBe('File too large')
  })

  it('a network failure becomes an ApiError with status 0 (shown as "can’t reach the server")', async () => {
    const { useUploadPaymentProof } = await import('@/lib/associate/payment-api-client')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { result } = renderHook(() => useUploadPaymentProof(12), { wrapper })
    const err = await act(async () => result.current.mutateAsync({ paymentId: 41, file }).catch((e) => e))
    expect((err as ApiError).status).toBe(0)
  })
})
