import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SolarCalculator from '@/app/(site)/[lang]/solar-calculator/SolarCalculator'
import { resetRateLimits } from '@/lib/rate-limit'
import { mirrorConfig } from '@/lib/backend-mirror'
import { formatInr } from '@/lib/money'
import { withI18n } from './helpers/i18n'
import { fillLocation, fillProperty, fillUsage } from './helpers/calculator'
import { CATALOGUE } from './fixtures/pricing'
import { CESC_BILL_NO_PHASE, EXAMPLE_C_NO_HOUSES } from './fixtures/solar-estimate-contract'

// The lead keeps a copy of the estimate the visitor saw (FE-14 §2): the
// calculator sends it, the route emails it, and the CRM mirror carries the one
// figure its contract has room for.

const sendMock = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function MockResend() {
    return { emails: { send: (...args: unknown[]) => sendMock(...args) } }
  }),
}))

beforeEach(() => {
  window.scrollTo = vi.fn()
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('calculator → /api/configurator-lead', () => {
  it('sends the estimate snapshot, the flat count and the new inputs with the lead', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('instant-estimate')) return new Response(JSON.stringify(CESC_BILL_NO_PHASE), { status: 200 })
      if (u.includes('/packages')) return new Response(JSON.stringify(CATALOGUE), { status: 200 })
      if (u === '/api/configurator-lead') return new Response(JSON.stringify({ success: true }), { status: 200 })
      throw new Error(`Unexpected ${u}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await fillLocation(user, { discom: 'CESC Limited (Kolkata & parts of Howrah)' })
    await fillProperty(user, { houses: '12' })
    await fillUsage(user, { units: '450', bill: '4000', sanctioned: '3' })

    // Custom quote (the phase was not given) → Continue to the contact step.
    await screen.findByTestId('phase-prompt')
    await user.click(screen.getByRole('button', { name: /^continue$/i }))
    await screen.findByText(/step 5 of 5/i)
    await user.type(screen.getByLabelText(/your name/i), 'Asha Roy')
    await user.type(screen.getByLabelText(/email address/i), 'asha@example.com')
    await user.type(screen.getByLabelText(/phone number/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /get my full estimate/i }))

    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === '/api/configurator-lead')).toBe(true))
    const lead = JSON.parse((fetchMock.mock.calls.find(([u]) => u === '/api/configurator-lead')![1] as RequestInit).body as string)
    const e = CESC_BILL_NO_PHASE
    expect(lead).toMatchObject({
      customerType: 'society',
      discom: 'CESC Limited (Kolkata & parts of Howrah)',
      numberOfHouses: 12,
      sizingMethod: 'units',
      monthlyUnits: '450',
      averageMonthlyBill: '4000',
      sanctionedLoadKw: '3',
      estimate: {
        estimateVersion: e.estimate_version,
        sizeKw: e.figures_for_kw,
        priceStatus: 'custom_quote',
        subsidyConfirmedInr: e.subsidy.confirmed_total,
        subsidyAnnouncedInr: e.subsidy.announced_total,
        subsidyStatus: e.subsidy.status,
        monthlySavingInr: e.savings.monthly,
        confidence: e.confidence,
      },
    })
    // No price, so no net cost is claimed.
    expect(lead.estimate).not.toHaveProperty('netCostInr')
  })
})

describe('/api/configurator-lead with a snapshot', () => {
  beforeEach(() => {
    mirrorConfig.retryDelayMs = 0
    resetRateLimits()
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('ESTIMATE_NOTIFY_EMAIL', 'info@gridnova.in')
    sendMock.mockReset()
    sendMock.mockResolvedValue({ data: { id: 'x' }, error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  const LEAD = {
    customerType: 'residential', name: 'Ravi Sharma', phone: '9876543210', email: 'ravi@example.com', state: 'West Bengal', city: 'Kolkata',
    pinCode: '700001', discom: 'WBSEDCL', sizingMethod: 'units', monthlyUnits: '360', averageMonthlyBill: '2600', sanctionedLoadKw: '2',
    indicativeTotalInr: 123465, website: '',
    estimate: {
      estimateVersion: '1.1+ebb9f500bf76', sizeKw: '3', priceStatus: 'list_price', netCostInr: '123465.00', netCostIfAnnouncedInr: '108465.00',
      subsidyConfirmedInr: '78000.00', subsidyAnnouncedInr: '15000.00', subsidyStatus: 'eligible', monthlySavingInr: '2599.20', paybackYears: '4.0',
      confidence: 'medium',
    },
  }
  const post = async (body: unknown) => {
    const { POST } = await import('@/app/api/configurator-lead/route')
    return POST(new Request('http://localhost/api/configurator-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  }

  it('emails every snapshot figure, labelled confirmed vs announced, exactly as sent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    expect((await post(LEAD)).status).toBe(200)
    const mail = JSON.stringify(sendMock.mock.calls[0][0])
    expect(mail).toContain('1.1+ebb9f500bf76')
    expect(mail).toContain('Net Cost After Confirmed Subsidy (Nova Assured)')
    expect(mail).toContain(formatInr('123465.00'))
    expect(mail).toContain('State Support Announced (not deducted)')
    expect(mail).toContain(formatInr('15000.00'))
    expect(mail).toContain('Sanctioned Load (kW)')
    expect(mail).toContain(formatInr('2599.20'))
  })

  it('mirrors only fields the backend contract has (units and bill together, the confirmed net cost)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await post(LEAD)
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/api/v1/public/estimate-request'))).toBe(true))
    const sent = JSON.parse(fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/api/v1/public/estimate-request'))![1].body as string)
    expect(sent).toMatchObject({ monthly_units: 360, average_bill: 2600, discom: 'WBSEDCL', indicative_total_inr: 123465 })
    for (const key of ['estimate', 'estimate_version', 'number_of_houses', 'sanctioned_load_kw']) expect(sent).not.toHaveProperty(key)
  })

  it('never loses a lead over a malformed snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    const res = await post({ ...LEAD, estimate: { netCostInr: 'lots', confidence: 'sure' } })
    expect(res.status).toBe(200)
    expect(JSON.stringify(sendMock.mock.calls[0][0])).not.toContain('lots')
  })

  it('a society\'s snapshot without a flat count carries its status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    await post({ ...LEAD, customerType: 'society', numberOfHouses: '20', estimate: { estimateVersion: EXAMPLE_C_NO_HOUSES.estimate_version, subsidyStatus: 'needs_number_of_houses' } })
    const mail = JSON.stringify(sendMock.mock.calls[0][0])
    expect(mail).toContain('needs_number_of_houses')
    expect(mail).toContain('Flats / Houses (housing society)')
  })
})
