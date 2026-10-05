import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SolarCalculator from '@/app/(site)/[lang]/solar-calculator/SolarCalculator'
import { withI18n } from './helpers/i18n'
import { CATALOGUE, CUSTOM_QUOTE, LIST_ESTIMATE } from './fixtures/pricing'

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

const INSTANT_ESTIMATE_BODY = LIST_ESTIMATE

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
  function stubApi(estimate: unknown = INSTANT_ESTIMATE_BODY, catalogue: unknown = CATALOGUE) {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/pricing/instant-estimate')) return new Response(JSON.stringify(estimate), { status: 200 })
      if (String(url).includes('/api/v1/pricing/packages')) return new Response(JSON.stringify(catalogue), { status: 200 })
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  async function reachResult(user: ReturnType<typeof userEvent.setup>) {
    await fillStepA(user)
    await fillStepB(user)
    await fillStepC(user)
  }

  it('shows two equal package cards with the exact list prices, the subsidy separately, and offers a site visit', async () => {
    const fetchMock = stubApi()
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await reachResult(user)

    const cards = await screen.findAllByTestId('package-card')
    expect(cards.map((c) => c.getAttribute('data-package'))).toEqual(['NOVA_ASSURED', 'NOVA_SIGNATURE'])
    // Equal weight: identical markup classes on both cards.
    expect(cards[0].className).toBe(cards[1].className)
    expect(cards[0]).toHaveTextContent('Nova Assured')
    expect(cards[1]).toHaveTextContent('Nova Signature')
    // Amounts exactly as the backend sent them, Indian grouping, no rounding.
    expect(cards[0]).toHaveTextContent('₹4,12,345.67')
    expect(cards[0]).toHaveTextContent('₹36,698.76')
    expect(cards[0]).toHaveTextContent('₹4,49,044.43')
    expect(cards[1]).toHaveTextContent('₹5,02,928.47')
    // Makes and technology from the catalogue, "or equivalent", terms.
    await waitFor(() => expect(cards[0]).toHaveTextContent('Test Panel Co A, Test Panel Co B'))
    expect(cards[1]).toHaveTextContent('Test technology two, Test technology three')
    expect(cards[0]).toHaveTextContent(/or equivalent/i)
    expect(cards[0]).toHaveTextContent('Test warranty text')
    // Rounded legacy fields are never shown.
    expect(document.body.textContent).not.toMatch(/3,57,600|3,57,601|4,00,000/)

    // Subsidy shown separately with its conditions and the per-package net.
    const subsidy = screen.getByTestId('subsidy-block')
    expect(subsidy).toHaveTextContent(/if eligible/i)
    expect(subsidy).toHaveTextContent('₹78,000')
    expect(subsidy).toHaveTextContent(/DCR solar modules are required/i)
    expect(subsidy).toHaveTextContent(/eligible under the scheme/i)
    expect(within(cards[0]).getByTestId('net-after-subsidy')).toHaveTextContent('₹3,71,044.43')

    // GST rule in plain words, footer lines.
    expect(screen.getByTestId('gst-explanation')).toHaveTextContent('8.9%')
    expect(screen.getByTestId('price-footer')).toHaveTextContent(/West Bengal/)
    expect(screen.getByTestId('price-footer')).toHaveTextContent(/may revise prices/i)
    expect(screen.getByTestId('price-footer')).toHaveTextContent('TEST-2026-01')
    // No "cheap vs premium" framing.
    expect(document.body.textContent).not.toMatch(/budget|best value|cheapest|premium|better|upgrade/i)

    // Whole-kW explanation, because 3.40 ≠ 4.
    expect(screen.getByTestId('snapped-note')).toHaveTextContent('Your recommended 3.40 kW is quoted as a 4 kW system')

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/pricing/instant-estimate'), expect.objectContaining({ method: 'POST' }))
    const sentBody = JSON.parse((fetchMock.mock.calls.find(([u]) => String(u).includes('instant-estimate'))![1] as RequestInit).body as string)
    expect(sentBody).toMatchObject({ segment: 'residential', state: 'West Bengal', sizing_method: 'by_bill', monthly_bill_inr: 3500, connection_phase: 'single_phase' })
    expect(sentBody).not.toHaveProperty('tier')

    // The primary CTA is still the site visit; it no longer carries a rounded single total.
    const href = screen.getByRole('link', { name: /book a free site visit/i }).getAttribute('href')!
    expect(href).toContain('/book-a-call')
    expect(href).not.toContain('estimatedTotal')
    expect(href).toContain('sizingMethod=bill')
    expect(href).toContain('source=calculator')
  })

  it('explains whole-kW pricing only when the recommended and priced sizes differ', async () => {
    stubApi({ ...INSTANT_ESTIMATE_BODY, recommended_kw_exact: '4.00', priced_kw: 4, priced_kw_differs: false })
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await reachResult(user)
    await screen.findAllByTestId('package-card')
    expect(screen.queryByTestId('snapped-note')).not.toBeInTheDocument()
    expect(screen.getByTestId('size-lines')).toHaveTextContent('4 kW')
  })

  it('hides the prices (but keeps the packages) when the backend hides the price table', async () => {
    stubApi(INSTANT_ESTIMATE_BODY, { ...CATALOGUE, price_display: 'hidden', prices: undefined })
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await reachResult(user)
    expect(await screen.findByTestId('prices-hidden')).toBeInTheDocument()
    const cards = screen.getAllByTestId('package-card')
    expect(cards).toHaveLength(2)
    expect(document.body.textContent).not.toMatch(/₹4,12,345|₹5,02,928/)
    expect(screen.queryByTestId('subsidy-block')).not.toBeInTheDocument()
  })

  it.each([
    ['outside_west_bengal', /West Bengal only/i],
    ['size_above_max', /larger than our price list/i],
    ['three_phase_below_min', /three-phase connection/i],
    ['battery_or_off_grid', /battery and off-grid/i],
    ['segment_not_in_price_list', /homes and housing societies/i],
    ['phase_unknown', /connection phase/i],
    ['size_below_min', /smaller than our price list/i],
  ])('custom quote (%s): a friendly message, no number anywhere, and the lead-capture path', async (reason, text) => {
    stubApi(CUSTOM_QUOTE([reason]))
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await reachResult(user)
    const notice = await screen.findByTestId('custom-quote')
    expect(notice).toHaveTextContent(text)
    expect(screen.queryByTestId('package-card')).not.toBeInTheDocument()
    const body = document.querySelector('main, body')!.textContent!
    expect(body).not.toMatch(/₹/)
    // Lead capture (Continue → contact step) and Book a call both remain.
    expect(screen.getByRole('link', { name: /book a call/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^continue$/i }))
    await screen.findByText(/step 5 of 5/i)
  })

  it('treats a list-price response with malformed amounts as unavailable rather than showing garbage', async () => {
    stubApi({ ...INSTANT_ESTIMATE_BODY, packages: { NOVA_ASSURED: { basic: 412345.67, gst: 1, final: 2 } } })
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await reachResult(user)
    await screen.findByText(/we.ll calculate your estimate and follow up personally/i)
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
    render(withI18n(<SolarCalculator />))

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
    render(withI18n(<SolarCalculator />))

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
    render(withI18n(<SolarCalculator />))
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
    render(withI18n(<SolarCalculator />))
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

  it('sends the Site Details fields (roof type, floors, access, shading) through to the pricing call', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/pricing/instant-estimate')) {
        return new Response(JSON.stringify(INSTANT_ESTIMATE_BODY), { status: 200 })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await fillStepA(user)

    await user.type(screen.getByLabelText(/average monthly electricity bill/i), '3500')
    await user.selectOptions(screen.getByLabelText(/connection phase/i), 'Single Phase')
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
      roof_type: 'rcc',
      access_difficulty: 'easy',
      shading: 'significant',
    })
    expect(sentBody).not.toHaveProperty('tier')
  })

  it('never renders an equipment tier selector anywhere in the flow', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const user = userEvent.setup()
    render(withI18n(<SolarCalculator />))
    await fillStepA(user)

    await user.type(screen.getByLabelText(/average monthly electricity bill/i), '3500')
    await user.selectOptions(screen.getByLabelText(/connection phase/i), 'Single Phase')

    expect(screen.queryByText(/equipment tier/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^good$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^better$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^best$/i })).not.toBeInTheDocument()
  })
})
