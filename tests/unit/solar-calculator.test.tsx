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

async function fillStepA(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^state/i), 'West Bengal')
  await user.type(screen.getByLabelText(/^city/i), 'Kolkata')
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 2 of 4/i)
}

async function fillStepB(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/average monthly electricity bill/i), '3500')
  await user.click(screen.getByRole('button', { name: /^next$/i }))
  await screen.findByText(/step 3 of 4/i)
}

describe('SolarCalculator — full flow with the pricing endpoint mocked', () => {
  it('shows the indicative estimate and framing, then offers "Book a Free Site Visit" carrying the result forward', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/pricing/estimate')) {
        return new Response(
          JSON.stringify({
            indicative_estimate: true,
            total_inr: 264585,
            categories: { Equipment: 11250, Installation: 216250, Other: 37085 },
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

    // Step C — the estimate itself.
    await screen.findByText('₹2,64,585')
    expect(screen.getByText(/indicative estimate only, not a final quote/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/pricing/estimate'),
      expect.objectContaining({ method: 'POST' })
    )

    // Primary CTA is now a booking link, not a "Continue" button — and it
    // carries the estimate's own output forward as query-string context.
    const bookLink = screen.getByRole('link', { name: /book a free site visit/i })
    const href = bookLink.getAttribute('href')!
    expect(href).toContain('/book-a-call')
    expect(href).toContain('estimatedTotal=264585')
    expect(href).toContain('sizingMethod=bill')
    expect(href).toContain('sizingValue=3500')
    expect(href).toContain('source=calculator')
    expect(screen.queryByRole('button', { name: /^continue$/i })).not.toBeInTheDocument()
  })

  it('never lets the pricing call stall the estimate step — degrades to a friendly message, and the capture step still creates a real Lead', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/pricing/estimate')) {
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

    await screen.findByText(/we.ll calculate your estimate and follow up personally/i)
    // Never stuck — Continue is still there (no result to book a visit
    // around) and takes the visitor onward to manual capture instead.
    const continueButton = screen.getByRole('button', { name: /^continue$/i })
    expect(continueButton).toBeEnabled()

    await user.click(continueButton)
    await screen.findByText(/step 4 of 4/i)

    // Step D — capture, which must still trigger real Lead creation.
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
      averageMonthlyBill: '3500',
    })

    await screen.findByText(/thank you, ravi/i)
  })
})
