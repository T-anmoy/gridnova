import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resetRateLimits } from '@/lib/rate-limit'
import { parseLooseNumber, configuratorMirrorPayload, estimateMirrorPayload } from '@/lib/lead-mirror'
import { subjectSafe } from '@/lib/lead-email'
import { mirrorToBackend, mirrorConfig } from '@/lib/backend-mirror'

const sendMock = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: (...args: unknown[]) => sendMock(...args) } }
  }),
}))

const CONTACT = { name: 'Ravi Sharma', email: 'ravi@example.com', phone: '9876543210', message: 'Need a quote.', interest: 'Residential', website: '' }
const ESTIMATE = {
  customerType: 'residential', name: 'Ravi Sharma', phone: '9876543210', email: 'ravi@example.com', state: 'West Bengal',
  cityOrPin: 'Kolkata - 700001', averageMonthlyBill: '3,500', roofType: 'RCC', roofAreaSqFt: '₹800', floors: '2', connectionPhase: 'Single Phase', website: '',
}
const CONFIGURATOR = {
  customerType: 'society', name: 'Asha Roy', phone: '9876543210', email: 'asha@example.com', state: 'West Bengal', city: 'Kolkata',
  pinCode: '700001', discom: 'CESC', sizingMethod: 'units', monthlyUnits: '1,200', connectionPhase: 'Three Phase', roofType: 'RCC',
  floors: '4', accessDifficulty: 'Easy', shading: 'None', subsidyInterest: 'yes', indicativeTotalInr: 250000, website: '',
}

function req(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const ok = () => new Response('{}', { status: 200 })
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  mirrorConfig.retryDelayMs = 0
  resetRateLimits()
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('ESTIMATE_NOTIFY_EMAIL', 'info@gridnova.in')
  sendMock.mockReset()
  sendMock.mockResolvedValue({ data: { id: 'x' }, error: null })
  fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok()))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(async () => {
  // Let any background CRM mirror (kept alive after the response) settle so it
  // cannot leak into the next test's fetch mock.
  await new Promise((resolve) => setTimeout(resolve, 10))
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ROUTES = [
  ['contact', '/api/contact', CONTACT, () => import('@/app/api/contact/route')],
  ['estimate-request', '/api/estimate-request', ESTIMATE, () => import('@/app/api/estimate-request/route')],
  ['configurator-lead', '/api/configurator-lead', CONFIGURATOR, () => import('@/app/api/configurator-lead/route')],
] as const

describe.each(ROUTES)('%s — a lead must not depend on one channel', (_name, url, body, load) => {
  it('succeeds when only the email works (CRM down)', async () => {
    fetchMock.mockRejectedValue(new TypeError('backend down'))
    const { POST } = await load()
    const res = await POST(req(url, body))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('succeeds when only the CRM mirror works (Resend down)', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'resend is down' } })
    const { POST } = await load()
    const res = await POST(req(url, body))
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('succeeds when Resend is not configured but the CRM works — and says so in the logs', async () => {
    vi.unstubAllEnvs()
    const { POST } = await load()
    const res = await POST(req(url, body))
    expect(res.status).toBe(200)
    expect(sendMock).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('not configured'))
  })

  it('503 when Resend is unconfigured AND the CRM fails; 502 when both fail', async () => {
    fetchMock.mockResolvedValue(new Response('no', { status: 400 }))
    vi.unstubAllEnvs()
    const { POST } = await load()
    expect((await POST(req(url, body))).status).toBe(503)

    vi.stubEnv('RESEND_API_KEY', 'test-key')
    sendMock.mockResolvedValue({ data: null, error: { message: 'down' } })
    expect((await POST(req(url, body))).status).toBe(502)
  })

  it('logs a stable submission id on both outcomes', async () => {
    const { POST } = await load()
    await POST(req(url, body))
    const lines = (console.info as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]))
    expect(lines.some((l) => /\[lead [0-9a-f-]{36}\]/.test(l))).toBe(true)
  })

  it.each([['null', 'null'], ['an array', '[]'], ['a number', '5'], ['a string', '"hi"'], ['broken JSON', '{nope']])(
    'rejects %s with a 400 (never a 500)',
    async (_label, raw) => {
      const { POST } = await load()
      const res = await POST(req(url, raw))
      expect(res.status).toBe(400)
      expect(sendMock).not.toHaveBeenCalled()
    }
  )

  it('honeypot: a generic success without contacting anyone', async () => {
    const { POST } = await load()
    const res = await POST(req(url, { ...body, website: 'http://spam' }))
    expect(res.status).toBe(200)
    expect(sendMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('limits each client IP, and does not limit when no IP can be attributed', async () => {
    const { POST } = await load()
    const headers = { 'x-forwarded-for': '203.0.113.5' }
    for (let i = 0; i < 5; i++) expect((await POST(req(url, body, headers))).status).toBe(200)
    const blocked = await POST(req(url, body, headers))
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    // A different client is unaffected.
    expect((await POST(req(url, body, { 'x-forwarded-for': '203.0.113.6' }))).status).toBe(200)
    // No address at all: skipped.
    for (let i = 0; i < 7; i++) expect((await POST(req(url, body))).status).toBe(200)
  })
})

describe('validation', () => {
  it('rejects a bad enum, a bad email and over-long fields on the estimate form', async () => {
    const { POST } = await import('@/app/api/estimate-request/route')
    for (const bad of [
      { ...ESTIMATE, customerType: 'industrial' },
      { ...ESTIMATE, email: 'nope' },
      { ...ESTIMATE, name: 'x'.repeat(201) },
      { ...ESTIMATE, state: 'x'.repeat(101) },
    ]) {
      expect((await POST(req('/api/estimate-request', bad))).status).toBe(400)
    }
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('rejects a bad subsidyInterest on the calculator lead', async () => {
    const { POST } = await import('@/app/api/configurator-lead/route')
    expect((await POST(req('/api/configurator-lead', { ...CONFIGURATOR, subsidyInterest: 'maybe' }))).status).toBe(400)
  })

  it('strips CR/LF from anything that reaches the email subject', async () => {
    const { POST } = await import('@/app/api/contact/route')
    await POST(req('/api/contact', { ...CONTACT, name: 'Ravi\r\nBcc: attacker@evil.test' }))
    const subject = sendMock.mock.calls[0][0].subject as string
    expect(subject).not.toMatch(/[\r\n]/)
    expect(subject).toContain('Ravi Bcc: attacker@evil.test')
    expect(subjectSafe('a b\nc')).toBe('a b c')
  })

  it('escapes every value in the email body', async () => {
    const { POST } = await import('@/app/api/estimate-request/route')
    await POST(req('/api/estimate-request', { ...ESTIMATE, state: '<img src=x onerror=1>' }))
    expect(sendMock.mock.calls[0][0].html).not.toContain('<img')
  })
})

describe('numeric normalisation', () => {
  it.each([
    ['3,000', 3000],
    ['₹3000', 3000],
    ['Rs. 3,00,000', 300000],
    ['3500.50', 3500.5],
    [3000, 3000],
  ])('%j → %j', (input, expected) => expect(parseLooseNumber(input)).toBe(expected))

  it.each(['abc', '12abc', '', '1e3', '3,0,0x', null, undefined, NaN])('%j → undefined', (input) =>
    expect(parseLooseNumber(input)).toBeUndefined()
  )

  it('"3,000" is 3000, not 3 (the old parseFloat bug) in the CRM payload', () => {
    const p = estimateMirrorPayload({ ...ESTIMATE, averageMonthlyBill: '3,000' } as never)
    expect(p.average_bill).toBe(3000)
    expect(p.roof_area).toBe(800)
  })

  it('omits out-of-range optionals instead of sending a payload the backend would 422', () => {
    const p = estimateMirrorPayload({ ...ESTIMATE, floors: '500', averageMonthlyBill: '1e12', roofAreaSqFt: '-5' } as never)
    expect(p).not.toHaveProperty('floors', 500)
    expect(p.floors).toBeUndefined()
    expect(p.average_bill).toBeUndefined()
    expect(p.roof_area).toBeUndefined()
  })
})

describe('J5 — the calculator mirror sends every field BE-1 accepts', () => {
  it('maps all nine new fields', async () => {
    const { POST } = await import('@/app/api/configurator-lead/route')
    await POST(req('/api/configurator-lead', CONFIGURATOR))
    const mirrorCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/api/v1/public/estimate-request'))!
    const sent = JSON.parse(mirrorCall[1].body as string)
    expect(sent).toMatchObject({
      pin_code: '700001',
      discom: 'CESC',
      monthly_units: 1200,
      sizing_method: 'units',
      floors: 4,
      access_difficulty: 'Easy',
      shading: 'None',
      subsidy_interest: 'yes',
      indicative_total_inr: 250000,
    })
  })

  it('drops an invalid PIN rather than 422-ing the lead', () => {
    expect(configuratorMirrorPayload({ ...CONFIGURATOR, pinCode: '70001' } as never).pin_code).toBeUndefined()
    expect(configuratorMirrorPayload({ ...CONFIGURATOR, pinCode: '700 001' } as never).pin_code).toBe('700001')
  })
})

describe('mirrorToBackend retry policy', () => {
  const r = () => new Request('http://localhost/')
  it('retries once on a 5xx, then reports success', async () => {
    fetchMock.mockResolvedValueOnce(new Response('x', { status: 503 })).mockResolvedValueOnce(ok())
    expect(await mirrorToBackend('/p', {}, r(), 'x', 'sid-1')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('retries once on a network error, then gives up (and logs the id)', async () => {
    fetchMock.mockRejectedValue(new TypeError('down'))
    expect(await mirrorToBackend('/p', {}, r(), 'x', 'sid-2')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[lead sid-2]'), expect.anything())
  })
  it('does not retry a 4xx — the payload was refused', async () => {
    fetchMock.mockResolvedValue(new Response('no', { status: 422 }))
    expect(await mirrorToBackend('/p', {}, r(), 'x', 'sid-3')).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('gives each attempt a 10 s timeout signal', async () => {
    await mirrorToBackend('/p', {}, r(), 'x')
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })
})
