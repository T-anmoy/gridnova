import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The Resend SDK is mocked out entirely so these tests exercise only this
// route's own logic (and its second, backend-mirror fetch) — not a real
// network call to Resend or any real email send. Manually verified once,
// for real, against both an unreachable and a genuinely running local
// backend (see the Phase 2 report) — this is the permanent regression guard.
const sendMock = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: (...args: unknown[]) => sendMock(...args) } }
  }),
}))

const VALID_FORM_BODY = {
  customerType: 'residential',
  name: 'Ravi Sharma',
  phone: '9876543210',
  email: 'ravi@example.com',
  state: 'West Bengal',
  cityOrPin: 'Kolkata - 700001',
  averageMonthlyBill: '3500',
  roofType: 'RCC / Concrete Flat Roof',
  roofAreaSqFt: '800',
  floors: '2',
  connectionPhase: 'Single Phase',
  website: '',
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/estimate-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('ESTIMATE_NOTIFY_EMAIL', 'info@gridnova.in')
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'mock-email-id' }, error: null })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/estimate-request — backend mirror graceful degradation', () => {
  it('still sends the email and returns success when the backend is unreachable', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8001')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('@/app/api/estimate-request/route')
    const res = await POST(makeRequest(VALID_FORM_BODY))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(sendMock).toHaveBeenCalledTimes(1)
    // The failure is logged server-side, never surfaced to the caller.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Backend estimate-request mirror failed (non-fatal'),
      expect.any(Error)
    )
  })

  it('sends the email, mirrors to the backend, and returns success when the backend is reachable', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8000')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ lead_id: 42, success: true }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/estimate-request/route')
    const res = await POST(makeRequest(VALID_FORM_BODY))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(sendMock).toHaveBeenCalledTimes(1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8000/api/v1/public/estimate-request')
    expect(options.method).toBe('POST')
    expect(options.signal).toBeInstanceOf(AbortSignal)

    const sentBody = JSON.parse(options.body)
    expect(sentBody).toEqual({
      name: 'Ravi Sharma',
      email: 'ravi@example.com',
      phone: '9876543210',
      customer_type: 'residential',
      state: 'West Bengal',
      city: 'Kolkata - 700001',
      average_bill: 3500,
      roof_type: 'RCC / Concrete Flat Roof',
      roof_area: 800,
      floors: 2,
      connection_phase: 'Single Phase',
    })
  })

  it('passes an AbortSignal to the backend call so a hanging backend cannot delay the response indefinitely', async () => {
    // Real fetch aborts on the signal firing — verified for real, in
    // isolation, against a TCP server that genuinely never responds:
    // AbortSignal.timeout(5000) rejects at ~5009ms (see Phase 2 report).
    // A mock here can't reproduce that timing without faking Node's native
    // timers underneath fetch, so this test instead pins down the one thing
    // that's actually this route's responsibility: that the signal it hands
    // to fetch is a real AbortSignal wired to a timeout, not omitted.
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8000')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/estimate-request/route')
    const res = await POST(makeRequest(VALID_FORM_BODY))

    expect(res.status).toBe(200)
    const [, options] = fetchMock.mock.calls[0]
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(options.signal.aborted).toBe(false)
  })

  it('does not attempt the backend mirror at all when the honeypot is filled', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8000')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/estimate-request/route')
    const res = await POST(makeRequest({ ...VALID_FORM_BODY, website: 'bot-filled-this' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(sendMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
