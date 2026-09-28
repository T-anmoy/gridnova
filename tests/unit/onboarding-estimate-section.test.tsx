import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { en } from './helpers/i18n'
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
  mockUseCreateEstimate.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
})

describe('EstimateSection — always indicative, ranges shown as ranges', () => {
  it('shows the "indicative, not final" banner on every estimate card', async () => {
    mockUseOnboardingEstimates.mockReturnValue({ data: [estimate(), estimate({ is_indicative_range: true, net_cost_range_min: 200000, net_cost_range_max: 260000 })], isLoading: false })
    const { default: EstimateSection } = await import('@/components/associate/EstimateSection')
    render(<EstimateSection onboardingId={1} copy={copy} />)
    expect(screen.getAllByText(copy.banner)).toHaveLength(2)
  })

  it('a non-range estimate shows a single net cost figure, not a range', async () => {
    mockUseOnboardingEstimates.mockReturnValue({ data: [estimate({ net_cost: 237000 })], isLoading: false })
    const { default: EstimateSection } = await import('@/components/associate/EstimateSection')
    render(<EstimateSection onboardingId={1} copy={copy} />)
    expect(screen.getByText('₹2,37,000')).toBeInTheDocument()
    expect(screen.queryByText(copy.result.rangeNote)).not.toBeInTheDocument()
  })

  it('an indicative-range estimate shows min – max, not a single figure, plus the range note', async () => {
    mockUseOnboardingEstimates.mockReturnValue({
      data: [estimate({ is_indicative_range: true, net_cost_range_min: 200000, net_cost_range_max: 260000 })],
      isLoading: false,
    })
    const { default: EstimateSection } = await import('@/components/associate/EstimateSection')
    render(<EstimateSection onboardingId={1} copy={copy} />)
    expect(screen.getByText('₹2,00,000 – ₹2,60,000')).toBeInTheDocument()
    expect(screen.getByText(copy.result.rangeNote)).toBeInTheDocument()
  })
})
