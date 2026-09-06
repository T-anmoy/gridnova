import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SolarCalculator from '@/app/solar-calculator/SolarCalculator'

beforeEach(() => {
  window.scrollTo = vi.fn()
  // The estimate reveal now counts up via CountUp (gsap, ~2s tween) instead
  // of appearing instantly. This suite is about the calculator's own
  // behaviour (correct totals, correct wiring) — not CountUp's animation
  // timing, which has its own dedicated coverage in count-up.test.tsx — so
  // reduced-motion is stubbed on here to keep asserting final values
  // immediately, exercising the same real "skip the animation" code path a
  // user with that OS preference gets.
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

const INSTANT_ESTIMATE_BODY = {
  recommended_size_kw: 4.5,
  sizing_detail: { consumption_based_kw: 4.5, area_based_kw: null, phase_capped: false },
  tier: 'good',
  base_cost: 259875.0,
  tier_cost: 259875.0,
  adders: { access_difficulty: 0.0 },
  component_breakdown: {
    equipment: 0.0,
    installation: 246375.0,
    balance_of_system: 13500.0,
    civil: 8000.0,
    regulatory: 5000.0,
  },
  subtotal_before_tax: 259875.0,
  gst_amount: 35862.75,
  subsidy_inr: 78000.0,
  net_cost: 217737.75,
  is_indicative_range: false,
  net_cost_range_min: null,
  net_cost_range_max: null,
  note: null,
}

async function fillStepA(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^state/i), 'West Bengal')
  await user.type(screen.getByLabelText(/^city/i), 'Kolkata')
  await user.type(screen.getByLabelText(/pin code/i), '700001')
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 2 of 5/i)
}

async function fillStepB(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/average monthly electricity bill/i), '3500')
  await user.selectOptions(screen.getByLabelText(/connection phase/i), 'Single Phase')
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 3 of 5/i)
}

async function fillStepC(user: ReturnType<typeof userEvent.setup>) {
  // Site Details is entirely optional — Next is always enabled here.
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 4 of 5/i)
}

describe('SolarCalculator — full flow with the pricing endpoint mocked', () => {
  it('shows the full breakdown and framing, then offers "Book a Free Site Visit" carrying the result forward', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/pricing/instant-estimate')) {
        return new Response(JSON.stringify(INSTANT_ESTIMATE_BODY), { status: 200 })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<SolarCalculator />)

    await fillStepA(user)
    await fillStepB(user)
    await fillStepC(user)

    // Step D — the estimate itself: net cost, the itemized breakdown, and
    // the subsidy shown clearly as its own deduction, not buried. The net
    // cost figure appears twice by design — once as the hero headline, once
    // as the final line of the itemized breakdown.
    const netCostMatches = await screen.findAllByText('₹2,17,738')
    expect(netCostMatches.length).toBe(2)
    expect(screen.getByText(/recommended system size/i)).toBeInTheDocument()
    expect(screen.getByText(/− ₹78,000/)).toBeInTheDocument()
    expect(screen.getByText(/pm surya ghar subsidy/i)).toBeInTheDocument()
    expect(screen.getByText(/indicative estimate only, not a final quote/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/pricing/instant-estimate'),
      expect.objectContaining({ method: 'POST' })
    )
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(sentBody).toMatchObject({
      segment: 'residential',
      state: 'West Bengal',
      sizing_method: 'by_bill',
      monthly_bill_inr: 3500,
      connection_phase: 'single_phase',
      tier: 'good',
      is_housing_society: false,
    })

    // Primary CTA is now a booking link, not a "Continue" button — and it
    // carries the estimate's own net cost forward as query-string context.
    const bookLink = screen.getByRole('link', { name: /book a free site visit/i })
    const href = bookLink.getAttribute('href')!
    expect(href).toContain('/book-a-call')
    expect(href).toContain('estimatedTotal=217737.75')
    expect(href).toContain('sizingMethod=bill')
    expect(href).toContain('sizingValue=3500')
    expect(href).toContain('source=calculator')
    expect(screen.queryByRole('button', { name: /^continue$/i })).not.toBeInTheDocument()
  })

  it('shows an honest indicative range (not a false confident number) when shading is significant, with a site-visit note', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/pricing/instant-estimate')) {
        return new Response(
          JSON.stringify({
            ...INSTANT_ESTIMATE_BODY,
            net_cost: null,
            is_indicative_range: true,
            net_cost_range_min: 185077.09,
            net_cost_range_max: 250398.41,
            note: 'Shading at this site was reported as significant, so this is an indicative range rather than a firm number — a real site visit is needed to size and price this accurately.',
          }),
          { status: 200 }
        )
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<SolarCalculator />)

    await fillStepA(user)
    await fillStepB(user)
    await fillStepC(user)

    await screen.findByText('₹1,85,077')
    expect(screen.getByText('₹2,50,398')).toBeInTheDocument()
    expect(screen.getByText(/indicative net cost range/i)).toBeInTheDocument()
    expect(screen.getByText(/a real site visit is needed/i)).toBeInTheDocument()
    // No single confident net-cost figure is asserted in range mode.
    expect(screen.queryByText(/^net cost$/i)).not.toBeInTheDocument()
  })

  it('never lets the pricing call stall the estimate step — degrades to a friendly message, and the capture step still creates a real Lead', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/pricing/instant-estimate')) {
        throw new TypeError('fetch failed')
      }
      if (String(url).includes('/api/configurator-lead')) {
        return new Response(JSON.stringify({ success: true }), { status: 200 })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<SolarCalculator />)

    await fillStepA(user)
    await fillStepB(user)
    await fillStepC(user)

    await screen.findByText(/we.ll calculate your estimate and follow up personally/i)
    // Never stuck — Continue is still there (no result to book a visit
    // around) and takes the visitor onward to manual capture instead.
    const continueButton = screen.getByRole('button', { name: /^continue$/i })
    expect(continueButton).toBeEnabled()

    await user.click(continueButton)
    await screen.findByText(/step 5 of 5/i)

    // Step E — capture, which must still trigger real Lead creation.
    await user.type(screen.getByLabelText(/your name/i), 'Ravi Sharma')
    await user.type(screen.getByLabelText(/email address/i), 'ravi@example.com')
    await user.type(screen.getByLabelText(/phone number/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /get my full estimate/i }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/configurator-lead', expect.objectContaining({ method: 'POST' }))
    )
    const leadCall = fetchMock.mock.calls.find(([url]) => url === '/api/configurator-lead')
    const sentBody = JSON.parse(leadCall![1]!.body as string)
    expect(sentBody).toMatchObject({
      customerType: 'residential',
      name: 'Ravi Sharma',
      email: 'ravi@example.com',
      phone: '9876543210',
      state: 'West Bengal',
      city: 'Kolkata',
      pinCode: '700001',
      averageMonthlyBill: '3500',
      connectionPhase: 'Single Phase',
    })

    await screen.findByText(/thank you, ravi/i)
  })

  it('requires a valid 6-digit PIN code before Basics can proceed', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const user = userEvent.setup()
    render(<SolarCalculator />)

    await user.selectOptions(screen.getByLabelText(/^state/i), 'West Bengal')
    await user.type(screen.getByLabelText(/^city/i), 'Kolkata')
    await user.type(screen.getByLabelText(/pin code/i), '123')
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled()

    await user.clear(screen.getByLabelText(/pin code/i))
    await user.type(screen.getByLabelText(/pin code/i), '700001')
    expect(screen.getByRole('button', { name: /^next$/i })).toBeEnabled()
  })

  it('requires a connection phase before Sizing can proceed, even though it used to be optional', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const user = userEvent.setup()
    render(<SolarCalculator />)
    await fillStepA(user)

    await user.type(screen.getByLabelText(/average monthly electricity bill/i), '3500')
    expect(screen.getByRole('button', { name: /^next$/i })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText(/connection phase/i), 'Three Phase')
    expect(screen.getByRole('button', { name: /^next$/i })).toBeEnabled()
  })

  it('offers sizing "by units" as a third method, sent to the backend as by_units', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/pricing/instant-estimate')) {
        return new Response(JSON.stringify(INSTANT_ESTIMATE_BODY), { status: 200 })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<SolarCalculator />)
    await fillStepA(user)

    await user.click(screen.getByRole('button', { name: /by monthly units/i }))
    await user.type(screen.getByLabelText(/average monthly consumption/i), '450')
    await user.selectOptions(screen.getByLabelText(/connection phase/i), 'Single Phase')
    await user.click(screen.getByRole('button', { name: /^next$/i }))
    await screen.findByText(/step 3 of 5/i)
    await fillStepC(user)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(sentBody).toMatchObject({ sizing_method: 'by_units', monthly_units_kwh: 450 })
  })

  it('sends the Site Details fields (roof type, floors, access, shading, tier) through to the pricing call', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/pricing/instant-estimate')) {
        return new Response(JSON.stringify(INSTANT_ESTIMATE_BODY), { status: 200 })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<SolarCalculator />)
    await fillStepA(user)

    // Tier lives in the Sizing step, alongside connection phase.
    await user.type(screen.getByLabelText(/average monthly electricity bill/i), '3500')
    await user.selectOptions(screen.getByLabelText(/connection phase/i), 'Single Phase')
    await user.click(screen.getByRole('button', { name: /^better$/i }))
    await user.click(screen.getByRole('button', { name: /^next$/i }))
    await screen.findByText(/step 3 of 5/i)

    await user.selectOptions(screen.getByLabelText(/roof type/i), 'RCC / Concrete Flat Roof')
    await user.selectOptions(screen.getByLabelText(/site access difficulty/i), 'Easy — ground floor or good vehicle/crane access')
    await user.selectOptions(screen.getByLabelText(/shading condition/i), 'Significant shading / many obstructions')
    await user.click(screen.getByRole('button', { name: /^next$/i }))
    await screen.findByText(/step 4 of 5/i)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(sentBody).toMatchObject({
      tier: 'better',
      roof_type: 'rcc',
      access_difficulty: 'easy',
      shading: 'significant',
    })
  })
})
