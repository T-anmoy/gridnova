import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { en, withI18n } from './helpers/i18n'
import { ApiError } from '@/lib/dashboard/api-error'
import { CATALOGUE, CUSTOM_QUOTE, LIST_ESTIMATE } from './fixtures/pricing'
import type { Estimate } from '@/lib/associate/onboarding-types'

const mockUseOnboardingEstimates = vi.fn()
const mockUseCreateEstimate = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardingEstimates: (id: number) => mockUseOnboardingEstimates(id),
  useCreateEstimate: () => mockUseCreateEstimate(),
}))

const copy = en.associates.portal.estimate

function estimate(over: Partial<Estimate['result']> = {}): Estimate {
  return {
    estimate_id: 1,
    indicative: true,
    created_at: '2026-01-01T00:00:00Z',
    created_by: 'assoc-1',
    inputs: { sizing_method: 'requested_size' },
    result: {
      recommended_size_kw: 5,
      base_cost: 300000,
      adders: 0,
      component_breakdown: {},
      subtotal_before_tax: 300000,
      gst_amount: 15000,
      subsidy_inr: 78000,
      net_cost: 237000,
      is_indicative_range: false,
      net_cost_range_min: null,
      net_cost_range_max: null,
      ...over,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(CATALOGUE), { status: 200 })))
  mockUseCreateEstimate.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
})

describe('EstimateSection — always indicative, ranges shown as ranges', () => {
  it('shows the "indicative, not final" banner on every estimate card', async () => {
    mockUseOnboardingEstimates.mockReturnValue({ data: [estimate(), estimate({ is_indicative_range: true, net_cost_range_min: 200000, net_cost_range_max: 260000 })], isLoading: false })
    const { default: EstimateSection } = await import('@/components/associate/EstimateSection')
    render(withI18n(<EstimateSection onboardingId={1} copy={copy} />))
    expect(screen.getAllByText(copy.banner)).toHaveLength(2)
  })

  it('a non-range estimate shows a single net cost figure, not a range', async () => {
    mockUseOnboardingEstimates.mockReturnValue({ data: [estimate({ net_cost: 237000 })], isLoading: false })
    const { default: EstimateSection } = await import('@/components/associate/EstimateSection')
    render(withI18n(<EstimateSection onboardingId={1} copy={copy} />))
    expect(screen.getByText('₹2,37,000')).toBeInTheDocument()
    expect(screen.queryByText(copy.result.rangeNote)).not.toBeInTheDocument()
  })

  it('an indicative-range estimate shows min – max, not a single figure, plus the range note', async () => {
    mockUseOnboardingEstimates.mockReturnValue({
      data: [estimate({ is_indicative_range: true, net_cost_range_min: 200000, net_cost_range_max: 260000 })],
      isLoading: false,
    })
    const { default: EstimateSection } = await import('@/components/associate/EstimateSection')
    render(withI18n(<EstimateSection onboardingId={1} copy={copy} />))
    expect(screen.getByText('₹2,00,000 – ₹2,60,000')).toBeInTheDocument()
    expect(screen.getByText(copy.result.rangeNote)).toBeInTheDocument()
  })
})

function priced(over: Record<string, unknown> = {}, top: Record<string, unknown> = {}): Estimate {
  const base = estimate()
  return { ...base, ...top, result: { ...base.result, ...LIST_ESTIMATE, ...over } as unknown as Estimate['result'] }
}

describe('EstimateSection — price-list results', () => {
  async function show(estimates: Estimate[]) {
    mockUseOnboardingEstimates.mockReturnValue({ data: estimates, isLoading: false })
    const { default: EstimateSection } = await import('@/components/associate/EstimateSection')
    return render(withI18n(<EstimateSection onboardingId={1} copy={copy} />))
  }

  it('shows both packages with exact amounts, the whole-kW size, the version and the indicative banner — no range', async () => {
    await show([priced()])
    expect(screen.getByText(copy.banner)).toBeInTheDocument()
    const cards = screen.getAllByTestId('package-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('₹4,49,044.43')
    expect(cards[1]).toHaveTextContent('₹5,02,928.47')
    expect(screen.getByTestId('size-lines')).toHaveTextContent('4 kW')
    expect(screen.getByTestId('price-footer')).toHaveTextContent('TEST-2026-01')
    expect(screen.queryByText(copy.result.rangeNote)).not.toBeInTheDocument()
    await waitFor(() => expect(cards[0]).toHaveTextContent('Test Panel Co A'))
  })

  it('puts the chosen package first, tagged, when exactly one was chosen; both are the same size', async () => {
    await show([priced({ chosen_packages: ['NOVA_SIGNATURE'] })])
    const cards = screen.getAllByTestId('package-card')
    expect(cards.map((c) => c.getAttribute('data-package'))).toEqual(['NOVA_SIGNATURE', 'NOVA_ASSURED'])
    expect(cards[0]).toHaveTextContent(en.pricing.packages.chosen)
    expect(cards[1]).not.toHaveTextContent(en.pricing.packages.chosen)
    expect(cards[0].className).toBe(cards[1].className)
  })

  it('"as recommended" (both chosen) keeps the fixed order with no tag', async () => {
    await show([priced({ chosen_packages: ['NOVA_ASSURED', 'NOVA_SIGNATURE'] })])
    const cards = screen.getAllByTestId('package-card')
    expect(cards.map((c) => c.getAttribute('data-package'))).toEqual(['NOVA_ASSURED', 'NOVA_SIGNATURE'])
    expect(screen.queryByText(en.pricing.packages.chosen)).not.toBeInTheDocument()
  })

  it('a custom-quote estimate states the reason and shows no number', async () => {
    await show([priced(CUSTOM_QUOTE(['outside_west_bengal']) as unknown as Record<string, unknown>)])
    expect(screen.getByTestId('custom-quote')).toHaveTextContent(/West Bengal only/)
    expect(screen.queryByTestId('package-card')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/₹/)
  })

  it('an estimate made before the price list keeps its old display', async () => {
    await show([estimate({ net_cost: 237000 })])
    expect(screen.getByText('₹2,37,000')).toBeInTheDocument()
    expect(screen.queryByTestId('package-card')).not.toBeInTheDocument()
  })

  it.each([
    ['non_integer_size', en.pricing.unsupportedSize.non_integer_size],
    ['three_phase_below_min', en.pricing.unsupportedSize.three_phase_below_min],
    ['mystery', en.pricing.unsupportedSize.generic],
  ])('a 422 unsupported_size (%s) is explained in plain words', async (reason, text) => {
    mockUseCreateEstimate.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new ApiError(422, 'API error 422', 'x', { code: 'unsupported_size', reason, message: 'x' })),
      isPending: false,
    })
    await show([])
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: copy.getEstimateButton })[0])
    await user.click(within(document.body).getAllByRole('button', { name: copy.getEstimateButton })[1])
    expect(await screen.findByText(text)).toBeInTheDocument()
  })
})
