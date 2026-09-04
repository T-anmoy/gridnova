import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SolarCalculator from '@/app/solar-calculator/SolarCalculator'

beforeEach(() => {
  window.scrollTo = vi.fn()
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
  it('shows the indicative estimate and framing, then creates a Lead on capture', async () => {
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

    // Step C — the estimate itself.
    await screen.findByText('₹2,64,585')
    expect(screen.getByText(/indicative estimate only, not a final quote/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/pricing/estimate'),
      expect.objectContaining({ method: 'POST' })
    )

    await user.click(screen.getByRole('button', { name: /^continue$/i }))
    await screen.findByText(/step 4 of 4/i)

    // Step D — capture, which must trigger real Lead creation.
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
      indicativeTotalInr: 264585,
    })

    await screen.findByText(/thank you, ravi/i)
  })

  it('never lets the pricing call stall the estimate step — degrades to a friendly message and stays usable', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/v1/pricing/estimate')) {
        throw new TypeError('fetch failed')
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<SolarCalculator />)

    await fillStepA(user)
    await fillStepB(user)

    await screen.findByText(/we.ll calculate your estimate and follow up personally/i)
    // Never stuck — Continue is still there and takes the visitor onward.
    const continueButton = screen.getByRole('button', { name: /^continue$/i })
    expect(continueButton).toBeEnabled()

    await user.click(continueButton)
    await screen.findByText(/step 4 of 4/i)
  })
})
