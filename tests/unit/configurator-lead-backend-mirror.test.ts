import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sendMock = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: (...args: unknown[]) => sendMock(...args) } }
  }),
}))

const VALID_BODY = {
  customerType: 'residential',
  name: 'Ravi Sharma',
  phone: '9876543210',
  email: 'ravi@example.com',
  state: 'West Bengal',
  city: 'Kolkata',
  website: '',
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/configurator-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
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

describe('POST /api/configurator-lead — mirror uses the shared helper with Phase 3 discipline', () => {
  it('sends X-Internal-Key/X-Customer-IP when configured and still returns success when the backend 429s', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8000')
    vi.stubEnv('INTERNAL_API_KEY', 'secret-key')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'rate limited' }), { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await import('@/app/api/configurator-lead/route')
    const res = await POST(makeRequest(VALID_BODY, { 'x-forwarded-for': '203.0.113.5' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8000/api/v1/public/estimate-request')
    expect(options.headers['X-Internal-Key']).toBe('secret-key')
    expect(options.headers['X-Customer-IP']).toBe('203.0.113.5')
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Backend Solar Calculator lead mirror returned 429'))
  })

  it('omits both headers when INTERNAL_API_KEY is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:8000')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/configurator-lead/route')
    await POST(makeRequest(VALID_BODY))

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['X-Internal-Key']).toBeUndefined()
    expect(options.headers['X-Customer-IP']).toBeUndefined()
  })
})
