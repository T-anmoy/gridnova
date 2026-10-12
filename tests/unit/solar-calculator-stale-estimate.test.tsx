import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SolarCalculator from '@/app/(site)/[lang]/solar-calculator/SolarCalculator'
import { withI18n } from './helpers/i18n'
import { CATALOGUE, CUSTOM_QUOTE, LIST_ESTIMATE } from './fixtures/pricing'

// L8 — the estimate belongs to the inputs it was computed from. Changing an
// input after seeing a price must never leave that price on screen, and must
// never put the old figure into the lead email.
const SECOND_ESTIMATE = {
  ...LIST_ESTIMATE,
  net_cost: 712300,
  packages: {
    NOVA_ASSURED: { basic: '800000.00', gst: '71200.00', final: '871200.00', net_after_subsidy: '793200.00', display_name: 'Nova Assured' },
    NOVA_SIGNATURE: { basic: '900000.00', gst: '80100.00', final: '980100.00', net_after_subsidy: '902100.00', display_name: 'Nova Signature' },
  },
}

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
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stub(responses: unknown[], opts: { holdSecond?: boolean } = {}) {
  let estimateCalls = 0
  let releaseSecond: () => void = () => {}
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    const u = String(url)
    if (u.includes('/api/v1/pricing/instant-estimate')) {
      const body = responses[Math.min(estimateCalls, responses.length - 1)]
      estimateCalls += 1
      if (opts.holdSecond && estimateCalls === 2) await new Promise<void>((res) => (releaseSecond = res))
      return new Response(JSON.stringify(body), { status: 200 })
    }
    if (u.includes('/api/v1/pricing/packages')) return new Response(JSON.stringify(CATALOGUE), { status: 200 })
    if (u.includes('/api/configurator-lead')) return new Response(JSON.stringify({ success: true }), { status: 200 })
    throw new Error(`Unexpected fetch to ${u} ${init?.method}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, release: () => releaseSecond() }
}

const estimateBodies = (fetchMock: ReturnType<typeof stub>['fetchMock']) =>
  fetchMock.mock.calls.filter(([u]) => String(u).includes('instant-estimate')).map(([, init]) => JSON.parse((init as RequestInit).body as string))

async function toResults(user: ReturnType<typeof userEvent.setup>, bill: string) {
  await user.selectOptions(screen.getByLabelText(/^state/i), 'West Bengal')
  await user.type(screen.getByLabelText(/^city/i), 'Kolkata')
  await user.type(screen.getByLabelText(/pin code/i), '700001')
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 2 of 5/i)
  await user.type(screen.getByLabelText(/average monthly electricity bill/i), bill)
  await user.selectOptions(screen.getByLabelText(/connection phase/i), 'Single Phase')
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 3 of 5/i)
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 4 of 5/i)
}

async function backToSizingAndChangeBill(user: ReturnType<typeof userEvent.setup>, bill: string) {
  await user.click(screen.getByRole('button', { name: /^back$/i }))
  await screen.findByText(/step 3 of 5/i)
  await user.click(screen.getByRole('button', { name: /^back$/i }))
  await screen.findByText(/step 2 of 5/i)
  const input = screen.getByLabelText(/average monthly electricity bill/i)
  await user.clear(input)
  await user.type(input, bill)
}

async function forwardToResults(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 3 of 5/i)
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 4 of 5/i)
}

describe('SolarCalculator — stale estimate', () => {
  it('refetches after an input change and shows the new price, not the old one', async () => {
    const { fetchMock } = stub([LIST_ESTIMATE, SECOND_ESTIMATE])
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await toResults(user, '3500')
    const first = await screen.findAllByTestId('package-card')
    expect(first[0]).toHaveTextContent('₹4,49,044.43')

    await backToSizingAndChangeBill(user, '7000')
    await forwardToResults(user)

    await waitFor(() => expect(screen.getAllByTestId('package-card')[0]).toHaveTextContent('₹8,71,200'))
    expect(document.body.textContent).not.toContain('4,49,044.43')
    const bodies = estimateBodies(fetchMock)
    expect(bodies).toHaveLength(2)
    expect(bodies.map((b) => b.monthly_bill_inr)).toEqual([3500, 7000])
  })

  it('never shows the previous price while the new estimate is still loading', async () => {
    const { release } = stub([LIST_ESTIMATE, SECOND_ESTIMATE], { holdSecond: true })
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await toResults(user, '3500')
    await screen.findAllByTestId('package-card')

    await backToSizingAndChangeBill(user, '7000')
    await forwardToResults(user)

    await waitFor(() => expect(screen.queryByTestId('package-card')).not.toBeInTheDocument())
    expect(document.body.textContent).not.toContain('4,49,044.43')
    release()
    await waitFor(() => expect(screen.getAllByTestId('package-card')[0]).toHaveTextContent('₹8,71,200'))
  })

  it('does not refetch when going back and forward without changing anything', async () => {
    const { fetchMock } = stub([LIST_ESTIMATE, SECOND_ESTIMATE])
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await toResults(user, '3500')
    await screen.findAllByTestId('package-card')
    await user.click(screen.getByRole('button', { name: /^back$/i }))
    await screen.findByText(/step 3 of 5/i)
    await user.click(screen.getByRole('button', { name: /^next$/i }))
    await screen.findByText(/step 4 of 5/i)
    expect(estimateBodies(fetchMock)).toHaveLength(1)
    expect(screen.getAllByTestId('package-card')[0]).toHaveTextContent('₹4,49,044.43')
  })

  // With a list price on screen the capture step is not offered (the visitor
  // books a site visit instead), so the lead email carries an indicative figure
  // only when the CURRENT estimate has one. It must never be the earlier input's.
  it('does not email the earlier input\'s figure after the inputs change', async () => {
    const { fetchMock } = stub([LIST_ESTIMATE, CUSTOM_QUOTE(['size_above_max'])])
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await toResults(user, '3500')
    await screen.findAllByTestId('package-card')
    await backToSizingAndChangeBill(user, '9000000')
    await forwardToResults(user)
    await screen.findByTestId('custom-quote')

    await user.click(screen.getByRole('button', { name: /^continue$/i }))
    await screen.findByText(/step 5 of 5/i)
    await user.type(screen.getByLabelText(/your name/i), 'Ravi Sharma')
    await user.type(screen.getByLabelText(/email address/i), 'ravi@example.com')
    await user.type(screen.getByLabelText(/phone number/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /get my full estimate/i }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === '/api/configurator-lead')).toBe(true))
    const lead = JSON.parse((fetchMock.mock.calls.find(([u]) => u === '/api/configurator-lead')![1] as RequestInit).body as string)
    expect(lead.indicativeTotalInr).toBeUndefined() // not the 357600 from the 3500-bill estimate
    expect(lead.averageMonthlyBill).toBe('9000000')
  })

  it('retries after a failed estimate when the visitor returns to the results step', async () => {
    let n = 0
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('instant-estimate')) {
        n += 1
        if (n === 1) throw new TypeError('fetch failed')
        return new Response(JSON.stringify(LIST_ESTIMATE), { status: 200 })
      }
      if (u.includes('/packages')) return new Response(JSON.stringify(CATALOGUE), { status: 200 })
      throw new Error(`Unexpected ${u}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await toResults(user, '3500')
    await screen.findByText(/we.ll calculate your estimate and follow up personally/i)
    await user.click(screen.getByRole('button', { name: /^back$/i }))
    await screen.findByText(/step 3 of 5/i)
    await user.click(screen.getByRole('button', { name: /^next$/i }))
    await screen.findByText(/step 4 of 5/i)
    expect((await screen.findAllByTestId('package-card'))[0]).toHaveTextContent('₹4,49,044.43')
  })
})
