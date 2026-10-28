import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/client'
import hi from '@/messages/hi.json'
import bn from '@/messages/bn.json'
import { formatInr } from '@/lib/money'
import { STAFF_SHARED_MESSAGES } from '@/lib/dashboard/staff-copy'
import type { Messages } from '@/lib/i18n/types'
import type { Estimate } from '@/lib/associate/onboarding-types'
import type { SurveyResults } from '@/lib/associate/survey-types'
import { en, withI18n } from './helpers/i18n'
import { CATALOGUE } from './fixtures/pricing'
import { SURVEY_RESULTS } from './fixtures/survey-contract'
import { EXAMPLE_A, EXAMPLE_B } from './fixtures/solar-estimate-contract'
import { without } from './helpers/object'

// FE-14 §3: the associate's estimate and both survey-results views draw the
// same result the website does, read-only (no inputs, no prompts).

vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ getToken: async () => 'tok' }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockUseOnboardingEstimates = vi.fn()
vi.mock('@/lib/associate/onboarding-api-client', () => ({
  useOnboardingOptions: () => ({ data: undefined }),
  useOnboardingEstimates: (id: number) => mockUseOnboardingEstimates(id),
  useCreateEstimate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

const staffStatus = vi.fn()
const staffResults = vi.fn()
vi.mock('@/lib/dashboard/survey-review-api-client', () => ({
  useStaffSurvey: () => staffStatus(),
  useStaffSurveyResults: () => staffResults(),
  useSubmitSurveyReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGenerateSurveyReport: () => ({ mutateAsync: vi.fn(), isPending: false }),
  fetchStaffSurveyReportLink: vi.fn(),
}))

import EstimateSection from '@/components/associate/EstimateSection'
import { SurveyResultsPanel } from '@/components/associate/survey/SurveyStep'
import SurveyPanel from '@/components/dashboard/SurveyPanel'
import { STATUS_FEASIBLE } from './fixtures/survey-review-contract'
import { asRoles } from './helpers/permissions-bridge'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(CATALOGUE), { status: 200 })))
})

/** A stored associate estimate whose `result` is a BE-14 instant estimate. */
function storedEstimate(result: Record<string, unknown>, over: Partial<Estimate> = {}): Estimate {
  return {
    estimate_id: 7,
    indicative: true,
    created_at: '2026-10-25T05:00:00Z',
    created_by: 'assoc-1',
    inputs: { sizing_method: 'by_units', state: 'West Bengal' },
    result: result as unknown as Estimate['result'],
    ...over,
  }
}

/** The survey's `estimate` with the BE-14 fields (site_survey.md / solar_estimate.md §5). */
const BE14_SURVEY: SurveyResults = {
  ...SURVEY_RESULTS,
  estimate: {
    ...SURVEY_RESULTS.estimate!,
    packages: EXAMPLE_A.packages as never,
    estimate_version: EXAMPLE_A.estimate_version,
    subsidy: EXAMPLE_A.subsidy,
    subsidy_status: EXAMPLE_A.subsidy_status,
    announced_state_support: EXAMPLE_A.announced_state_support,
    net_cost: EXAMPLE_A.net_cost,
    net_cost_if_announced_support_received: EXAMPLE_A.net_cost_if_announced_support_received,
    generation: EXAMPLE_A.generation,
    coverage_percent: EXAMPLE_A.coverage_percent,
    savings: EXAMPLE_A.savings,
    payback_years: EXAMPLE_A.payback_years,
    long_term: EXAMPLE_A.long_term,
    confidence: EXAMPLE_A.confidence as 'low',
  },
}

const expectReadOnly = (el: HTMLElement) => {
  expect(within(el).queryByRole('textbox')).not.toBeInTheDocument()
  expect(within(el).queryByRole('combobox')).not.toBeInTheDocument()
  expect(within(el).queryByTestId('phase-prompt')).not.toBeInTheDocument()
}

describe('Associate estimate (portal)', () => {
  it('shows a BE-14 estimate with the website\'s result, read-only, under the indicative banner', async () => {
    mockUseOnboardingEstimates.mockReturnValue({ data: [storedEstimate(EXAMPLE_B as never, { chosen_packages: ['NOVA_SIGNATURE'] })], isLoading: false })
    render(withI18n(<EstimateSection onboardingId={1} copy={en.associates.portal.estimate} />))
    const card = screen.getByTestId('estimate-card')
    expect(card).toHaveTextContent(en.associates.portal.estimate.banner)
    const result = within(card).getByTestId('solar-estimate')
    expect(result).toHaveAttribute('data-version', EXAMPLE_B.estimate_version)
    expect(within(result).getByTestId('summary-net')).toHaveTextContent(formatInr(EXAMPLE_B.packages.NOVA_ASSURED.net_after_subsidy))
    expect(within(result).getByTestId('estimate-warning-above_sanctioned_load')).toBeInTheDocument()
    expect(within(result).getByTestId('subsidy-state')).toHaveAttribute('data-status', 'announced')
    // The chosen package first, tagged — as before BE-14.
    const cards = await within(result).findAllByTestId('package-card')
    expect(cards[0]).toHaveAttribute('data-package', 'NOVA_SIGNATURE')
    expect(cards[0]).toHaveTextContent(en.pricing.packages.chosen)
    expectReadOnly(card)
  })

  it('keeps the old display for an estimate made before BE-14', () => {
    mockUseOnboardingEstimates.mockReturnValue({ data: [storedEstimate(without(EXAMPLE_A, 'estimate_version'))], isLoading: false })
    render(withI18n(<EstimateSection onboardingId={1} copy={en.associates.portal.estimate} />))
    expect(screen.queryByTestId('solar-estimate')).not.toBeInTheDocument()
    expect(screen.getByTestId('size-lines')).toBeInTheDocument()
  })

  it.each([
    ['hi', hi],
    ['bn', bn],
  ] as const)('reads in %s in the portal', (locale, messages) => {
    mockUseOnboardingEstimates.mockReturnValue({ data: [storedEstimate(EXAMPLE_A as never)], isLoading: false })
    const m = messages as unknown as Messages
    render(
      <I18nProvider locale={locale} messages={m}>
        <EstimateSection onboardingId={1} copy={m.associates.portal.estimate} />
      </I18nProvider>
    )
    const result = screen.getByTestId('solar-estimate')
    expect(result).toHaveTextContent(m.pricing.estimate.summary.size)
    expect(result).toHaveTextContent(m.pricing.estimate.subsidy.central)
    expect(result).toHaveTextContent(m.pricing.estimate.badge.announced)
    expect(result).not.toHaveTextContent(en.pricing.estimate.summary.size)
  })
})

describe('Survey results', () => {
  it('associate: the BE-14 survey estimate is drawn by the shared result', () => {
    render(withI18n(<SurveyResultsPanel results={BE14_SURVEY} />))
    const box = screen.getByTestId('survey-estimate')
    const result = within(box).getByTestId('solar-estimate')
    expect(within(result).getByTestId('recommended-kw')).toHaveTextContent('3 kW')
    expect(within(result).getByTestId('subsidy-confirmed-total')).toHaveTextContent(formatInr(EXAMPLE_A.subsidy.confirmed_total))
    expect(within(result).getByTestId('saving-monthly')).toHaveTextContent(formatInr(EXAMPLE_A.savings.monthly))
    expect(box).toHaveTextContent(en.survey.results.indicativeNote)
    expectReadOnly(box)
  })

  it('associate: a pre-BE-14 survey estimate keeps its old list', () => {
    render(withI18n(<SurveyResultsPanel results={SURVEY_RESULTS} />))
    expect(within(screen.getByTestId('survey-estimate')).queryByTestId('solar-estimate')).not.toBeInTheDocument()
  })

  it('staff (English): the same result inside the dashboard\'s survey panel', () => {
    staffStatus.mockReturnValue({ data: STATUS_FEASIBLE, isLoading: false, error: null, refetch: vi.fn() })
    staffResults.mockReturnValue({ data: BE14_SURVEY, isLoading: false, error: null, refetch: vi.fn() })
    render(
      <I18nProvider locale="en" messages={STAFF_SHARED_MESSAGES}>
        {asRoles(['sales'], <SurveyPanel onboardingId={12} />)}
      </I18nProvider>
    )
    const block = screen.getByTestId('staff-survey-estimate')
    const result = within(block).getByTestId('solar-estimate')
    expect(result).toHaveTextContent(en.pricing.estimate.subsidy.central)
    expect(within(result).getByTestId('net-if-announced')).toHaveTextContent(formatInr(EXAMPLE_A.packages.NOVA_ASSURED.net_if_announced_support_received))
    expectReadOnly(block)
  })
})
